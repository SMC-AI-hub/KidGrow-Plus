/* =====================================================================
   NeoKid Care — M3 Tenant platform: org onboarding, branding, members &
   invites, MFA (TOTP), break-glass emergency access, server audit writer,
   quotas/usage, suspension banners. Extends window.Cloud; inert unless cloud
   is enabled + signed in. Live paths need Supabase; pure helpers in
   window.TenantPure are unit-tested. Loaded after cloud.js, before ops.js.
   ===================================================================== */
(function () {
"use strict";

var CFG = (typeof window.KIDGROW_CONFIG === "object" && window.KIDGROW_CONFIG) || {};
var MFA_ROLES = CFG.MFA_REQUIRED_ROLES || ["owner", "admin"];
var T = { mine: [], current: null, role: null, settings: null, tenant: null };
try { T.current = localStorage.getItem("kidgrow_tenant") || null; } catch (e) {}

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function toast(m) {
  var t = $("tenantToast");
  if (!t) { t = document.createElement("div"); t.id = "tenantToast"; t.style.cssText = "position:fixed;left:50%;bottom:64px;transform:translateX(-50%);background:#0c2340;color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;z-index:10002;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:92vw;text-align:center"; document.body.appendChild(t); }
  t.textContent = m; t.style.display = "block";
  clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = "none"; }, 3400);
}
function sb() { try { return (typeof Cloud !== "undefined" && Cloud._sb) ? Cloud._sb() : null; } catch (e) { return null; } }
function live() { return !!(typeof Cloud !== "undefined" && Cloud.enabled && Cloud.user && Cloud.user() && sb()); }

/* ---------------- pure helpers (tested) ---------------- */
function planQuota(plan, key) {
  var u = { trial: 3, solo: 1, clinic: 5, nicu: 15, hospital: 50 };
  var p = { trial: 200, solo: 500, clinic: 5000, nicu: 20000, hospital: 100000 };
  if (key === "users") return u[plan] != null ? u[plan] : null;
  if (key === "patients") return p[plan] != null ? p[plan] : null;
  return null;
}
function quotaStatus(used, limit) {
  if (limit == null) return { pct: 0, state: "ok", label: used + " / unlimited" };
  var pct = limit > 0 ? Math.round((used / limit) * 100) : 100;
  return { pct: pct, state: pct >= 100 ? "full" : pct >= 80 ? "warn" : "ok", label: used + " / " + limit };
}
function roleRank(serverRole) {
  if (serverRole === "owner" || serverRole === "doctor") return "Doctor";
  if (serverRole === "admin") return "Admin";
  if (serverRole === "nurse" || serverRole === "lab" || serverRole === "mrd") return "Nurse";
  if (serverRole === "pharmacist") return "Pharmacist";
  return "Frontdesk";
}
function mfaNext(o) {
  if (!o || o.aal === "aal2") return "ok";
  if (!o.required || o.required.indexOf(o.role) < 0) return "ok";
  if (!o.hasFactors) return "enroll";
  return "verify";
}
function breakGlassValid(bg, nowMs) {
  if (!bg || !bg.tenant_id || !bg.reason || bg.reason.length < 8) return false;
  if (!bg.at || !bg.until || bg.at > nowMs || bg.until <= nowMs) return false;
  return true;
}
function auditPayload(tenantId, actorId, action, table, recordId, detail) {
  return { tenant_id: tenantId, actor_id: actorId, action: String(action || "").slice(0, 80), record_table: String(table || "").slice(0, 40), record_id: String(recordId || "").slice(0, 80), detail: detail == null ? null : detail };
}
function validInviteEmail(e) { return /.+@.+\..+/.test(String(e || "")); }
window.TenantPure = { planQuota: planQuota, quotaStatus: quotaStatus, roleRank: roleRank, mfaNext: mfaNext, breakGlassValid: breakGlassValid, auditPayload: auditPayload, validInviteEmail: validInviteEmail };

/* ---------------- break-glass (local gate relief; server logs it) ---------------- */
function bgGet() { try { return JSON.parse(localStorage.getItem("kidgrow_breakglass") || "null"); } catch (e) { return null; } }
function bgSet(v) { try { if (v) localStorage.setItem("kidgrow_breakglass", JSON.stringify(v)); else localStorage.removeItem("kidgrow_breakglass"); } catch (e) {} }
window.BreakGlassActive = function () { return breakGlassValid(bgGet(), Date.now()); };
window.CloudServerUser = function () {
  try {
    if (typeof Cloud === "undefined" || !Cloud.enabled || !Cloud.user || !Cloud.user() || !T.role) return null;
    return { name: Cloud.user().email || "Cloud user", role: roleRank(T.role), cloud: true };
  } catch (e) { return null; }
};

/* ---------------- data ---------------- */
function loadMine() {
  var c = sb(); if (!c) return Promise.resolve();
  return c.from("memberships").select("tenant_id, role, tenants(id, name, status, plan, grace_until, read_until)").then(function (r) {
    if (r.error) throw r.error;
    T.mine = r.data || [];
    var ids = T.mine.map(function (m) { return m.tenant_id; });
    if (!T.current || ids.indexOf(T.current) < 0) {
      T.current = ids[0] || null;
      try { if (T.current) localStorage.setItem("kidgrow_tenant", T.current); else localStorage.removeItem("kidgrow_tenant"); } catch (e) {}
    }
    var m = null;
    for (var i = 0; i < T.mine.length; i++) if (T.mine[i].tenant_id === T.current) m = T.mine[i];
    T.role = m ? m.role : null;
    T.tenant = m && m.tenants ? m.tenants : null;
    if (!T.current) return null;
    return c.from("tenant_settings").select("*").eq("tenant_id", T.current).maybeSingle().then(function (s) {
      T.settings = (s && s.data) || null;
    });
  }).catch(function () { /* offline: keep cached context */ });
}
/* Server-role sync, then delegates to front.js applyRole() for nav hiding.
   (Previously this redeclared applyRole and recursed into itself — nav hiding never ran.) */
function applyServerRole() {
  try {
    if (typeof DB !== "undefined" && DB.session && T.role) {
      DB.session.serverRole = T.role;
      DB.session.serverName = (Cloud.user() || {}).email || "";
    }
    if (typeof applyRole === "function") applyRole();
  } catch (e) {}
}
function audit(action, table, recordId, detail) {
  try {
    var c = sb();
    if (!c || !T.current || !Cloud.user()) return;
    c.from("audit_events").insert(auditPayload(T.current, Cloud.user().id, action, table, recordId, detail)).then(function () {});
  } catch (e) {}
}

/* ---------------- onboarding + settings ---------------- */
function onboardModal() {
  if (!live()) { toast("Sign in first."); return; }
  var r = $("cloudRoot") || document.body;
  var d = document.createElement("div");
  d.innerHTML = '<div class="modal-bg open" id="mTenantNew"><div class="modal" style="max-width:420px">' +
    "<h3>🏥 Register your hospital / clinic</h3><div class='hint'>Creates your isolated organization. You become its owner.</div>" +
    '<div id="tnErr" style="color:var(--red,#dc2626);font-size:13px;min-height:18px"></div>' +
    '<input id="tnName" placeholder="e.g. City Care Children Hospital">' +
    '<input id="tnPrefix" placeholder="Patient ID prefix (optional, e.g. CC-)">' +
    '<button class="btn btn-p" style="width:100%;margin-top:8px" onclick="Tenant.create()">Create organization</button>' +
    '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="document.getElementById(\'mTenantNew\').remove()">Cancel</button></div></div>';
  r.appendChild(d.firstChild);
  setTimeout(function () { var e = $("tnName"); if (e) e.focus(); }, 60);
}
function tenantCreate() {
  var name = ($("tnName") || {}).value || "", prefix = ($("tnPrefix") || {}).value || "";
  if (name.trim().length < 3) { $("tnErr").textContent = "Enter the organization name."; return; }
  var c = sb();
  c.from("tenants").insert({ name: name.trim() }).select("id").single().then(function (r) {
    if (r.error) throw r.error;
    var tid = r.data.id;
    return c.from("tenant_settings").insert({ tenant_id: tid, display_name: name.trim(), mrn_prefix: prefix.trim() }).then(function () { return tid; });
  }).then(function (tid) {
    T.current = tid;
    try { localStorage.setItem("kidgrow_tenant", tid); } catch (e) {}
    var m = $("mTenantNew"); if (m) m.remove();
    toast("Organization created ✓");
    audit("tenant.create", "tenants", tid, null);
    return loadMine().then(function () { applyServerRole(); renderTenantCard(); renderBanners(); if (typeof renderAll === "function") renderAll(); });
  }).catch(function (e) { $("tnErr").textContent = e.message || "Could not create."; });
}
function saveBranding() {
  if (!live() || !T.current) return;
  var v = function (id) { return (($(id) || {}).value || "").trim(); };
  sb().from("tenant_settings").upsert({
    tenant_id: T.current, display_name: v("tName"), address: v("tAddr"), phone: v("tPhone"),
    email: v("tEmail"), mrn_prefix: v("tPrefix"), timezone: v("tTz") || "Asia/Kolkata"
  }, { onConflict: "tenant_id" }).then(function (r) {
    if (r.error) throw r.error;
    toast("Branding saved ✓"); audit("tenant.settings", "tenant_settings", T.current, null);
    return loadMine().then(renderTenantCard);
  }).catch(function (e) { toast(e.message || "Save failed."); });
}
function applyToDevice() {
  try {
    if (!T.settings) { toast("No cloud branding yet."); return; }
    DB.settings = DB.settings || {};
    DB.settings.clinic = T.settings.display_name || DB.settings.clinic || "";
    DB.settings.addr = [T.settings.address, T.settings.phone].filter(Boolean).join(" · ") || DB.settings.addr || "";
    if (typeof save === "function") save();
    if (typeof loadSettings === "function") loadSettings();
    if (typeof renderBrand === "function") renderBrand();
    toast("Applied to this device ✓ (full sync lands in M4)");
  } catch (e) { toast("Could not apply."); }
}

/* ---------------- members + invites ---------------- */
function membersModal() {
  if (!live() || !T.current) return;
  var c = sb();
  c.from("memberships").select("user_id, role, status").eq("tenant_id", T.current).then(function (m) {
    if (m.error) throw m.error;
    var rows = (m.data || []).map(function (x) {
      return "<div style='display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)'><span>👤 " + esc(String(x.user_id).slice(0, 8)) + "…</span><b>" + esc(x.role) + "</b></div>";
    }).join("") || "<div class='hint'>No members.</div>";
    var canAdmin = T.role === "owner" || T.role === "admin";
    var r = $("cloudRoot") || document.body;
    var d = document.createElement("div");
    d.innerHTML = '<div class="modal-bg open" id="mMembers"><div class="modal" style="max-width:440px">' +
      "<h3>👥 Members</h3>" + rows +
      (canAdmin ? "<h3 style='margin-top:12px'>✉️ Invite by email</h3><div class='hint'>They sign up, open your link, and join with this role.</div>" +
        '<input id="invEmail" type="email" placeholder="colleague@hospital.org">' +
        '<select id="invRole"><option>doctor</option><option>nurse</option><option>pharmacist</option><option>lab</option><option>mrd</option><option>billing</option><option>auditor</option><option>readonly</option><option>admin</option></select>' +
        '<button class="btn btn-p" style="width:100%;margin-top:8px" onclick="Tenant.invite()">Create invite link</button>' +
        '<div id="invOut" style="font-size:12px;margin-top:8px;word-break:break-all"></div>' : "") +
      '<button class="btn btn-o" style="width:100%;margin-top:10px" onclick="document.getElementById(\'mMembers\').remove()">Close</button></div></div>';
    r.appendChild(d.firstChild);
  }).catch(function (e) { toast(e.message || "Could not load members."); });
}
function inviteCreate() {
  var em = (($("invEmail") || {}).value || "").trim().toLowerCase(), role = ($("invRole") || {}).value || "readonly";
  if (!validInviteEmail(em)) { toast("Enter a valid email."); return; }
  sb().from("invites").insert({ tenant_id: T.current, email: em, role: role }).select("token").single().then(function (r) {
    if (r.error) throw r.error;
    var link = location.origin + location.pathname + "?invite=" + r.data.token;
    $("invOut").innerHTML = "Share this link (7 days, single use):<br><b>" + esc(link) + "</b>";
    audit("member.invite", "invites", em, { role: role });
    try { if (navigator.clipboard) navigator.clipboard.writeText(link); } catch (e) {}
  }).catch(function (e) { toast(e.message || "Invite failed (quota? role?)."); });
}
function inviteFromURL() {
  try {
    var m = /[?&]invite=([A-Za-z0-9]+)/.exec(location.search || "");
    if (!m || !live()) return;
    sb().rpc("accept_invite", { p_token: m[1] }).then(function (r) {
      if (r.error) throw r.error;
      T.current = r.data;
      try { localStorage.setItem("kidgrow_tenant", T.current); } catch (e) {}
      toast("Welcome to the organization ✓");
      try { history.replaceState(null, "", location.pathname); } catch (e) {}
      loadMine().then(function () { applyServerRole(); renderTenantCard(); renderBanners(); if (typeof renderAll === "function") renderAll(); });
    }).catch(function (e) { toast("Invite: " + (e.message || "invalid.")); });
  } catch (e) {}
}

/* ---------------- MFA (TOTP via Supabase Auth; enforced for owner/admin) ---------------- */
function mfaGate() {
  if (!live()) return;
  var c = sb();
  Promise.all([c.auth.mfa.getAuthenticatorAssuranceLevel(), c.auth.mfa.listFactors()]).then(function (x) {
    var aal = x[0] && x[0].data ? x[0].data.currentLevel : null;
    var tots = x[1] && x[1].data ? (x[1].data.totp || []) : [];
    var next = mfaNext({ aal: aal, hasFactors: tots.length > 0, role: T.role, required: MFA_ROLES });
    if (next === "verify") mfaVerifyModal(tots[0].id);
    else if (next === "enroll") mfaEnrollModal(false);
  }).catch(function () {});
}
function mfaEnrollModal(fromCard) {
  var c = sb();
  c.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app" }).then(function (r) {
    if (r.error) throw r.error;
    var f = r.data;
    var qr = "";
    try {
      if (typeof qrcode === "function") { var q = qrcode(0, "M"); q.addData(f.totp.uri); q.make(); qr = q.createImgTag(4, 8); }
    } catch (e) {}
    var d = document.createElement("div");
    d.innerHTML = '<div class="modal-bg open" id="mMfa"><div class="modal" style="max-width:400px;text-align:center">' +
      "<h3>🔐 Set up authenticator</h3><div class='hint'>Scan in Google/Microsoft Authenticator, then enter the 6-digit code.</div>" +
      "<div>" + qr + "</div><div style='font-size:11px;word-break:break-all'>" + esc(f.totp.secret) + "</div>" +
      '<input id="mfaCode" inputmode="numeric" placeholder="123456" style="text-align:center">' +
      '<div id="mfaErr" style="color:var(--red,#dc2626);font-size:13px;min-height:18px"></div>' +
      '<button class="btn btn-p" style="width:100%" onclick="Tenant._mfaFinish(\'' + f.id + "')\">Verify & enable</button>" +
      (fromCard ? "" : '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="Tenant._mfaLater()">Remind me next login</button>') +
      '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="document.getElementById(\'mMfa\').remove()">Close</button></div></div>';
    ($("cloudRoot") || document.body).appendChild(d.firstChild);
    Tenant._mfaFactor = f.id;
  }).catch(function (e) { toast("MFA setup failed: " + (e.message || "error")); });
}
function mfaVerifyModal(factorId) {
  if ($("mMfa")) return;
  var d = document.createElement("div");
  d.innerHTML = '<div class="modal-bg open" id="mMfa"><div class="modal" style="max-width:360px;text-align:center">' +
    "<h3>🔐 Authenticator code</h3><div class='hint'>Your role needs two-step verification.</div>" +
    '<input id="mfaCode" inputmode="numeric" placeholder="123456" style="text-align:center">' +
    '<div id="mfaErr" style="color:var(--red,#dc2626);font-size:13px;min-height:18px"></div>' +
    '<button class="btn btn-p" style="width:100%" onclick="Tenant._mfaFinish(\'' + factorId + "')\">Verify</button></div></div>";
  ($("cloudRoot") || document.body).appendChild(d.firstChild);
  Tenant._mfaFactor = factorId;
}
function mfaFinish(factorId) {
  var code = (($("mfaCode") || {}).value || "").trim();
  if (!/^\d{6}$/.test(code)) { $("mfaErr").textContent = "Enter the 6-digit code."; return; }
  var c = sb();
  c.auth.mfa.challenge({ factorId: factorId }).then(function (ch) {
    if (ch.error) throw ch.error;
    return c.auth.mfa.verify({ factorId: factorId, challengeId: ch.data.id, code: code });
  }).then(function (v) {
    if (v.error) throw v.error;
    var m = $("mMfa"); if (m) m.remove();
    toast("Verified ✓"); audit("mfa.verify", "auth", "", null);
  }).catch(function (e) { $("mfaErr").textContent = e.message || "Wrong code — try again."; });
}

/* ---------------- break-glass UI ---------------- */
function bgModal() {
  if (!live()) { toast("Sign in first."); return; }
  var d = document.createElement("div");
  d.innerHTML = '<div class="modal-bg open" id="mBg"><div class="modal" style="max-width:420px">' +
    "<h3>🚨 Emergency access</h3><div class='hint'>Grants <b>4 hours</b> of app access for genuine clinical emergencies (e.g. billing lapse mid-shift). It does <b>not</b> bypass hospital isolation — you only ever see your own organization. This is logged and shown to owners.</div>" +
    '<textarea id="bgReason" rows="2" placeholder="Reason (min 8 characters) — e.g. Night duty, subscription renewal pending"></textarea>' +
    '<div id="bgErr" style="color:var(--red,#dc2626);font-size:13px;min-height:18px"></div>' +
    '<button class="btn btn-d" style="width:100%" onclick="Tenant._bgGo()">Activate 4-hour emergency access</button>' +
    '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="document.getElementById(\'mBg\').remove()">Cancel</button></div></div>';
  ($("cloudRoot") || document.body).appendChild(d.firstChild);
}
function ensureTenant() {
  if (T.current) return Promise.resolve(T.current);
  var em = (Cloud.user() || {}).email || "clinic";
  var c = sb();
  return c.from("tenants").insert({ name: em.split("@")[0] + "'s Clinic" }).select("id").single().then(function (r) {
    if (r.error) throw r.error;
    T.current = r.data.id;
    try { localStorage.setItem("kidgrow_tenant", T.current); } catch (e) {}
    return loadMine().then(function () { return T.current; });
  });
}
function bgGo() {
  var reason = (($("bgReason") || {}).value || "").trim();
  if (reason.length < 8) { $("bgErr").textContent = "Give a reason (min 8 characters)."; return; }
  ensureTenant().then(function (tid) {
    return sb().from("break_glass_events").insert({ tenant_id: tid, actor_id: Cloud.user().id, reason: reason, scope: "subscription-gate" });
  }).then(function (r) {
    if (r.error) throw r.error;
    var now = Date.now();
    bgSet({ tenant_id: T.current, reason: reason, at: now, until: now + 4 * 3600e3 });
    var m = $("mBg"); if (m) m.remove();
    var p = $("mPay"); if (p) { p.classList.remove("open"); p.remove(); }
    if (typeof renderAll === "function") renderAll();
    renderBanners(); renderTenantCard();
    toast("Emergency access active for 4 hours");
  }).catch(function (e) { $("bgErr").textContent = e.message || "Could not activate."; });
}
function bgEnd() {
  bgSet(null);
  if (typeof renderAll === "function") renderAll();
  renderBanners();
  toast("Emergency access ended.");
}
// Offer emergency access inside the paywall (idempotent DOM augment; server still logs).
setInterval(function () {
  try {
    if (typeof Cloud === "undefined" || !Cloud.enabled) return;
    if (!Cloud.user || !Cloud.user()) { if (bgGet()) bgSet(null); return; }
    var p = $("mPay");
    if (p && p.classList.contains("open") && !$("bgBtn") && !window.BreakGlassActive()) {
      var b = document.createElement("button");
      b.id = "bgBtn"; b.className = "btn btn-o"; b.style.cssText = "width:100%;margin-top:8px";
      b.textContent = "🚨 Emergency access (logged)";
      b.onclick = function () { bgModal(); };
      var box = p.querySelector(".modal"); if (box) box.appendChild(b);
    }
  } catch (e) {}
}, 2000);

/* ---------------- banners + cards ---------------- */
function renderBanners() {
  var old;
  old = $("tenantBanner"); if (old) old.remove();
  old = $("bgBanner"); if (old) old.remove();
  var bg = bgGet();
  if (window.BreakGlassActive() && bg) {
    var mins = Math.max(1, Math.round((bg.until - Date.now()) / 60000));
    var g = document.createElement("div");
    g.id = "bgBanner";
    g.style.cssText = "background:#b91c1c;color:#fff;font-size:13px;text-align:center;padding:8px 12px";
    g.innerHTML = "🚨 EMERGENCY ACCESS (" + mins + " min left · logged) — <a href='#' onclick='Tenant._bgEnd();return false' style='color:#fff;font-weight:700'>End now</a>";
    var c0 = document.querySelector(".content");
    if (c0 && c0.parentNode) c0.parentNode.insertBefore(g, c0); else document.body.prepend(g);
  }
  if (T.tenant && T.tenant.status && T.tenant.status !== "active") {
    var msg = T.tenant.status === "grace" ? "⏳ Subscription grace — renew soon to avoid read-only mode."
      : T.tenant.status === "suspended" ? "⛔ Subscription suspended — READ-ONLY. Your data is safe; export works. Renew to resume."
      : "🔒 Organization closed — owners can still read & export.";
    var b = document.createElement("div");
    b.id = "tenantBanner";
    b.style.cssText = "background:#92400e;color:#fff;font-size:13px;text-align:center;padding:8px 12px";
    b.textContent = msg;
    var c1 = document.querySelector(".content");
    if (c1 && c1.parentNode) c1.parentNode.insertBefore(b, c1); else document.body.prepend(b);
  }
}
function renderTenantCard() {
  var pg = $("pg-settings"); if (!pg) return;
  var old = $("tenantCard"); if (old) old.remove();
  if (typeof Cloud === "undefined" || !Cloud.enabled) return;
  var card = document.createElement("div");
  card.className = "card"; card.id = "tenantCard";
  if (!Cloud.user || !Cloud.user()) {
    card.innerHTML = "<h3>🏥 Organization</h3><div class='hint'>Sign in (Cloud card above) to register or join your hospital.</div>";
    pg.appendChild(card); return;
  }
  if (!T.current) {
    card.innerHTML = "<h3>🏥 Organization</h3><div class='hint'>No organization yet.</div>" +
      "<button class='btn btn-p btn-sm' onclick='Tenant.onboard()'>＋ Register hospital / clinic</button> " +
      "<span class='hint'>or open the invite link your admin sent.</span>";
    pg.appendChild(card); return;
  }
  var s = T.settings || {}, t = T.tenant || {};
  var opts = T.mine.map(function (m) {
    return "<option value='" + m.tenant_id + "'" + (m.tenant_id === T.current ? " selected" : "") + ">" + esc((m.tenants && m.tenants.name) || m.tenant_id.slice(0, 8)) + " (" + esc(m.role) + ")</option>";
  }).join("");
  card.innerHTML = "<h3>🏥 Organization</h3>" +
    "<div style='display:flex;gap:8px;align-items:center;flex-wrap:wrap'><select id='tenantSwitch' style='flex:1;min-width:180px' onchange='Tenant.switch(this.value)'>" + opts + "</select>" +
    "<span class='badge b-teal'>" + esc(T.role || "?") + "</span>" +
    "<span class='badge " + (t.status === "active" ? "b-green" : "b-amber") + "'>" + esc(t.status || "?") + " · " + esc(t.plan || "?") + "</span></div>" +
    "<div class='form-grid' style='margin-top:10px'>" +
    "<div class='full'><label>Display name (prints on reports)</label><input id='tName' value='" + esc(s.display_name || "") + "'></div>" +
    "<div class='full'><label>Address</label><input id='tAddr' value='" + esc(s.address || "") + "'></div>" +
    "<div><label>Phone</label><input id='tPhone' value='" + esc(s.phone || "") + "'></div>" +
    "<div><label>Email</label><input id='tEmail' value='" + esc(s.email || "") + "'></div>" +
    "<div><label>Patient ID prefix</label><input id='tPrefix' value='" + esc(s.mrn_prefix || "") + "'></div>" +
    "<div><label>Timezone</label><input id='tTz' value='" + esc(s.timezone || "Asia/Kolkata") + "'></div></div>" +
    "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:8px'>" +
    "<button class='btn btn-p btn-sm' onclick='Tenant.saveBranding()'>💾 Save branding</button>" +
    "<button class='btn btn-o btn-sm' onclick='Tenant.applyToDevice()'>📲 Apply to this device</button>" +
    "<button class='btn btn-o btn-sm' onclick='Tenant.members()'>👥 Members & invites</button>" +
    "<button class='btn btn-o btn-sm' onclick='Tenant.usage()'>📊 Usage</button>" +
    "<button class='btn btn-o btn-sm' onclick='Tenant.mfa()'>🔐 Authenticator</button>" +
    ((T.role === "owner" || T.role === "admin" || T.role === "auditor") ? "<button class='btn btn-o btn-sm' onclick='Tenant.auditView()'>🧾 Audit log</button>" : "") +
    "<button class='btn btn-o btn-sm' onclick='Tenant.onboard()'>＋ New organization</button></div>" +
    "<div class='hint' id='tenantMsg' style='margin-top:8px'></div>";
  pg.appendChild(card);
}
function tenantSwitch(tid) {
  T.current = tid;
  try { localStorage.setItem("kidgrow_tenant", tid); } catch (e) {}
  loadMine().then(function () { applyServerRole(); renderTenantCard(); renderBanners(); if (typeof renderAll === "function") renderAll(); });
}
function usageView() {
  if (!live() || !T.current) return;
  var c = sb(), plan = (T.tenant || {}).plan || "trial";
  Promise.all([
    c.from("patients").select("id", { count: "exact", head: true }).eq("tenant_id", T.current),
    c.from("memberships").select("user_id", { count: "exact", head: true }).eq("tenant_id", T.current).eq("status", "active")
  ]).then(function (x) {
    var pu = x[0].count || 0, mu = x[1].count || 0;
    var ps = quotaStatus(pu, planQuota(plan, "patients")), ms = quotaStatus(mu, planQuota(plan, "users"));
    var el = $("tenantMsg");
    if (el) el.innerHTML = "Plan <b>" + esc(plan) + "</b> · Patients: <b>" + esc(ps.label) + "</b>" + (ps.state !== "ok" ? " ⚠️" : "") + " · Staff: <b>" + esc(ms.label) + "</b>" + (ms.state !== "ok" ? " ⚠️" : "");
  }).catch(function (e) { toast(e.message || "Usage unavailable offline."); });
}
function auditView() {
  if (!live() || !T.current) return;
  sb().from("audit_events").select("created_at, actor_id, action, record_table, record_id").eq("tenant_id", T.current).order("created_at", { ascending: false }).limit(50).then(function (r) {
    if (r.error) throw r.error;
    var rows = (r.data || []).map(function (a) {
      return "<div style='font-size:12px;padding:5px 0;border-bottom:1px solid var(--line)'><b>" + esc(a.action) + "</b> " + esc(a.record_table || "") + " " + esc(String(a.record_id || "").slice(0, 12)) + "<br><span class='hint'>" + esc(a.created_at || "") + " · " + esc(String(a.actor_id || "").slice(0, 8)) + "…</span></div>";
    }).join("") || "<div class='hint'>No server audit rows yet.</div>";
    var d = document.createElement("div");
    d.innerHTML = '<div class="modal-bg open" id="mAudit"><div class="modal" style="max-width:480px"><h3>🧾 Server audit (latest 50)</h3>' + rows +
      '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="document.getElementById(\'mAudit\').remove()">Close</button></div></div>';
    ($("cloudRoot") || document.body).appendChild(d.firstChild);
  }).catch(function (e) { toast(e.message || "Audit unavailable."); });
}

/* ---------------- boot (waits for cloud session) ---------------- */
var Tenant = {
  onboard: onboardModal, create: tenantCreate, saveBranding: saveBranding, applyToDevice: applyToDevice,
  members: membersModal, invite: inviteCreate, switch: tenantSwitch, usage: usageView,
  mfa: function () { mfaEnrollModal(true); }, _mfaFinish: mfaFinish,
  _mfaLater: function () { var m = $("mMfa"); if (m) m.remove(); },
  requestBreakGlass: bgModal, _bgGo: bgGo, _bgEnd: bgEnd, auditView: auditView, mirror: audit, // F6: device log() mirrors here
  current: function () { return T.current; }, role: function () { return T.role; },
  _brand: function () { try { var s = T.settings || {}, t = T.tenant || {}; return { name: s.display_name || t.name || "", prefix: s.mrn_prefix || "" }; } catch (e) { return { name: "", prefix: "" }; } },
  boot: function () {
    var n = 0;
    var iv = setInterval(function () {
      n++;
      try {
        if (typeof Cloud !== "undefined" && Cloud.enabled && Cloud.user && Cloud.user()) {
          clearInterval(iv);
          loadMine().then(function () {
            applyServerRole(); renderTenantCard(); renderBanners(); inviteFromURL(); mfaGate();
          });
        } else if (typeof Cloud !== "undefined" && !Cloud.enabled) {
          clearInterval(iv); renderTenantCard();
        }
      } catch (e) {}
      if (n > 15) { clearInterval(iv); try { renderTenantCard(); } catch (e) {} }
    }, 1000);
  }
};
window.Tenant = Tenant;
if (typeof Cloud !== "undefined" && Cloud) {
  Cloud.audit = audit;
  Cloud.tenantId = function () { return T.current; };
  var _cinit = Cloud.init;
  Cloud.init = function () { try { _cinit(); } catch (e) {} try { Tenant.boot(); } catch (e2) {} };
} else {
  setInterval(function () {
    try {
      if (typeof Cloud !== "undefined" && Cloud && !Cloud._tenantHooked) {
        Cloud._tenantHooked = true;
        Cloud.audit = audit;
        Cloud.tenantId = function () { return T.current; };
        var _c2 = Cloud.init;
        Cloud.init = function () { try { _c2(); } catch (e) {} try { Tenant.boot(); } catch (e2) {} };
      }
    } catch (e) {}
  }, 500);
}

})();

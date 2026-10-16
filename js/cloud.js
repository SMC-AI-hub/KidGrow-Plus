/* =====================================================================
   KidGrow Pro — Cloud: Supabase auth + sync + Razorpay subscriptions.
   - Inactive (zero behaviour change) unless js/config.js has Supabase keys.
   - Offline-first preserved: local data always works; cloud syncs when online.
   - Subscription enforced with trial + offline grace (clinics with bad net).
   Depends: js/config.js (KIDGROW_CONFIG), js/vendor/supabase.js, app.js core.
   Loaded before ops.js; self-starts via Cloud.init() from ops.js tail.
   ===================================================================== */
(function () {
"use strict";

var CFG = (typeof window.KIDGROW_CONFIG === "object" && window.KIDGROW_CONFIG) || {};
var SB_URL = CFG.SUPABASE_URL || "", SB_ANON = CFG.SUPABASE_ANON_KEY || "";
var RZP_KEY = CFG.RAZORPAY_KEY_ID || "";
var PLAN_NAME = CFG.PLAN_NAME || "KidGrow Pro Monthly";
var PLAN_PRICE = CFG.PLAN_PRICE || "";
var TRIAL_DAYS = CFG.TRIAL_DAYS || 14;
var GRACE_MS = (CFG.OFFLINE_GRACE_DAYS || 7) * 864e5;
var STATUS_KEY = "kidgrow_cloud_status", HASH_KEY = "kidgrow_last_push_hash";
var APP_VER = "v10";

var sb = null, session = null, profile = null;
var pushTimer = null, suspendPush = false, rzpLoading = null;

function configured() {
  return !!(SB_URL && SB_ANON && typeof window.supabase !== "undefined" && window.supabase.createClient);
}
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function toast(msg) {
  var t = $("cloudToast");
  if (!t) { t = document.createElement("div"); t.id = "cloudToast"; t.style.cssText = "position:fixed;left:50%;bottom:26px;transform:translateX(-50%);background:#0c2340;color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;z-index:10001;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:92vw;text-align:center"; document.body.appendChild(t); }
  t.textContent = msg; t.style.display = "block";
  clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = "none"; }, 3200);
}
function hashStr(s) { var h = 5381, i; for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); }
function lsGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

/* ---------------- access logic (pure — unit tested) ----------------
   profile: live row or null · cache: {ok,reason,verifiedAt} or null
   -> {ok, reason, daysLeft?}  reasons: active|past_due|trial|grace|
      pending|expired|login */
function trialLeft(p, nowMs) {
  if (!p || !p.trial_ends_at) return 0;
  return Math.max(0, Math.ceil((new Date(p.trial_ends_at).getTime() - nowMs) / 864e5));
}
function accessFor(p, cache, nowMs) {
  if (p) {
    if (p.sub_status === "active") {
      var pe = p.current_period_end ? new Date(p.current_period_end).getTime() : 0;
      if (!pe || pe > nowMs - 3 * 864e5) return { ok: true, reason: "active" };
    }
    if (p.sub_status === "past_due") return { ok: true, reason: "past_due" };
    var tl = trialLeft(p, nowMs);
    if (tl > 0 && (p.sub_status === "trialing" || p.sub_status === "created" || p.sub_status === "authenticated" || p.sub_status === "none" || !p.sub_status))
      return { ok: true, reason: "trial", daysLeft: tl };
    if (p.sub_status === "created" || p.sub_status === "authenticated") return { ok: false, reason: "pending" };
    return { ok: false, reason: "expired" };
  }
  if (cache && cache.ok && (nowMs - (cache.verifiedAt || 0)) < GRACE_MS) return { ok: true, reason: "grace" };
  if (cache && !cache.ok) return { ok: false, reason: cache.reason || "expired" };
  return { ok: false, reason: "login" };
}
function currentAccess() {
  try { if (typeof BreakGlassActive === "function" && BreakGlassActive()) return { ok: true, reason: "breakglass" }; } catch (e) {}
  if (profile) return accessFor(profile, null, Date.now());
  return accessFor(null, lsGet(STATUS_KEY), Date.now());
}

/* ---------------- UI shells ---------------- */
function ensureRoot() {
  var r = $("cloudRoot");
  if (!r) { r = document.createElement("div"); r.id = "cloudRoot"; document.body.appendChild(r); }
  return r;
}
function showAuth(mode) {
  ensureRoot();
  var r = $("cloudRoot");
  r.innerHTML =
    '<div class="modal-bg open" id="mCloud"><div class="modal" style="max-width:400px;text-align:center">' +
    '<div style="font-size:44px">👶</div><h2 style="margin:6px 0">KidGrow Pro</h2>' +
    '<div class="hint" id="cloudAuthSub">' + (mode === "signup" ? "Create your clinic account — includes a " + TRIAL_DAYS + "-day free trial." : "Sign in to your clinic account.") + "</div>" +
    '<div id="cloudAuthErr" style="color:var(--red,#dc2626);font-size:13px;min-height:18px;margin-top:6px"></div>' +
    '<input id="cloudEmail" type="email" placeholder="Email address" autocomplete="email" style="margin-bottom:8px">' +
    '<input id="cloudPass" type="password" placeholder="Password (min 6 characters)" autocomplete="' + (mode === "signup" ? "new-password" : "current-password") + '">' +
    '<button class="btn btn-p" style="width:100%;margin-top:10px" onclick="Cloud.authGo(\'' + mode + '\')">' + (mode === "signup" ? "Start free trial" : "Sign in") + "</button>" +
    '<div style="margin-top:10px;font-size:13px">' + (mode === "signup"
      ? 'Have an account? <a href="#" onclick="Cloud.showAuth(\'login\');return false">Sign in</a>'
      : 'New clinic? <a href="#" onclick="Cloud.showAuth(\'signup\');return false">Start free trial</a> · <a href="#" onclick="Cloud.forgot();return false">Forgot password</a>') + "</div>" +
    '<div class="hint" style="margin-top:10px">Works offline after first sign-in · your data stays yours.</div>' +
    "</div></div>";
  setTimeout(function () { var e = $("cloudEmail"); if (e) e.focus(); }, 60);
}
function hideAuth() { var m = $("mCloud"); if (m) m.classList.remove("open"); }
function authErr(m) { var e = $("cloudAuthErr"); if (e) e.textContent = m; }
function showPaywall(a) {
  ensureRoot();
  var r = $("cloudRoot");
  var head = a.reason === "pending" ? "Complete your subscription" : a.reason === "expired" ? "Your trial has ended" : "Subscription required";
  r.innerHTML =
    '<div class="modal-bg open" id="mPay"><div class="modal" style="max-width:440px;text-align:center">' +
    '<div style="font-size:44px">💎</div><h2 style="margin:6px 0">' + head + "</h2>" +
    '<div class="hint">Keep unlimited children, growth charts, vaccines, billing & cloud backup.</div>' +
    '<div class="card" style="margin:14px 0;text-align:left"><h3>' + esc(PLAN_NAME) + '</h3><div style="font-size:26px;font-weight:800;color:var(--navy)">' + esc(PLAN_PRICE) + "</div>" +
    '<div style="font-size:13px;margin-top:8px">✓ Unlimited children & records<br>✓ Automatic cloud backup + multi-device sync<br>✓ WhatsApp reminders & vaccine alerts<br>✓ Cancel anytime</div></div>' +
    '<button class="btn btn-p" style="width:100%" onclick="Cloud.subscribe()">Subscribe now</button>' +
    '<div style="margin-top:10px;font-size:13px"><a href="#" onclick="Cloud.logout();return false">Sign in as a different account</a></div>' +
    "</div></div>";
}
function hidePaywall() { var m = $("mPay"); if (m) { m.classList.remove("open"); m.remove(); } }
function renderBanner(a) {
  var old = $("cloudBanner"); if (old) old.remove();
  if (!a.ok) return;
  var msg = "";
  if (a.reason === "trial") msg = "🎁 Free trial: " + a.daysLeft + " day" + (a.daysLeft === 1 ? "" : "s") + " left — <a href='#' onclick='Cloud.subscribe();return false' style='color:#fff;font-weight:700'>Subscribe</a>";
  else if (a.reason === "past_due") msg = "⚠️ Last payment failed — <a href='#' onclick='Cloud.subscribe();return false' style='color:#fff;font-weight:700'>update payment</a> to stay subscribed.";
  else if (a.reason === "grace") msg = "📴 Offline — using your last verified subscription. Will re-check when online.";
  if (!msg) return;
  var b = document.createElement("div");
  b.id = "cloudBanner";
  b.style.cssText = "background:#b45309;color:#fff;font-size:13px;text-align:center;padding:8px 12px;border-radius:0 0 12px 12px";
  b.innerHTML = msg;
  var c = document.querySelector(".content");
  if (c && c.parentNode) c.parentNode.insertBefore(b, c); else document.body.prepend(b);
}
function renderCloudCard() {
  if (!Cloud.enabled) return;
  var pg = $("pg-settings"); if (!pg) return;
  var old = $("cloudCard"); if (old) old.remove();
  var email = (session && session.user && session.user.email) || "";
  var a = currentAccess();
  var statusLine = !session ? "Not signed in" : !a.ok ? ("Locked (" + a.reason + ")") :
    a.reason === "active" ? "✅ Subscribed" : a.reason === "trial" ? ("🎁 Trial — " + a.daysLeft + " days left") :
    a.reason === "past_due" ? "⚠️ Payment failed" : "📴 Offline grace";
  var card = document.createElement("div");
  card.className = "card"; card.id = "cloudCard";
  card.innerHTML = "<h3>☁️ Cloud & subscription</h3>" +
    "<div class='hint'>" + esc(email || "Sign in to sync & subscribe") + " · " + esc(statusLine) + "</div>" +
    "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:8px'>" +
    (session
      ? "<button class='btn btn-p btn-sm' onclick='Cloud.syncNow()'>↻ Sync now</button>" +
        "<button class='btn btn-o btn-sm' onclick='Cloud.pushNow(true)'>⬆ Upload this device</button>" +
        "<button class='btn btn-o btn-sm' onclick='Cloud.pullNow()'>⬇ Download from cloud</button>" +
        (a.ok && a.reason !== "active" ? "<button class='btn btn-d btn-sm' onclick='Cloud.subscribe()'>💎 Subscribe</button>" : "") +
        "<button class='btn btn-o btn-sm' onclick='Cloud.logout()'>Logout</button>"
      : "<button class='btn btn-p btn-sm' onclick='Cloud.showAuth(\"login\")'>Sign in / Sign up</button>") +
    "</div><div class='hint' id='cloudSyncLine' style='margin-top:8px'></div>";
  pg.appendChild(card);
}
function syncLine(m) { var e = $("cloudSyncLine"); if (e) e.textContent = m || ""; }

/* ---------------- auth ---------------- */
function afterAuth() {
  hideAuth();
  fetchStatus().then(function () {
    renderCloudCard();
    // First login with local data? offer upload (never auto-overwrite either side).
    var h = lsGet(HASH_KEY);
    if (session && !h && typeof DB !== "undefined" && DB.children && DB.children.length && !DB._cloudWelcomed) {
      DB._cloudWelcomed = true;
      if (confirm("Welcome! This device has local records. Upload them to your new cloud account now? (Recommended — then all devices stay in sync.)")) pushNow(true);
      else try { if (typeof save === "function") save(); } catch (e) {}
    }
  });
}
function doLogin(email, pass) {
  return sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
    if (r.error) throw r.error;
    session = r.data.session; return fetchStatus();
  }).then(afterAuthStep).catch(function (e) { authErr(e.message || "Sign-in failed."); });
}
function doSignup(email, pass) {
  return sb.auth.signUp({ email: email, password: pass }).then(function (r) {
    if (r.error) throw r.error;
    session = r.data.session;
    if (!session) { authErr("Account created — please check your email to confirm, then sign in."); return null; }
    return fetchStatus();
  }).then(function (x) { if (x !== null) afterAuthStep(); }).catch(function (e) { authErr(e.message || "Sign-up failed."); });
}
function afterAuthStep() { afterAuth(); }

/* ---------------- status / gate ---------------- */
function fetchStatus() {
  return sb.auth.getSession().then(function (r) {
    session = (r.data && r.data.session) || null;
    if (!session) { profile = null; enforceGate(); renderCloudCard(); return null; }
    var loadProfile = function () {
      return sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle().then(function (pr) {
        if (pr.error) throw pr.error;
        profile = pr.data;
        var a = accessFor(profile, null, Date.now());
        lsSet(STATUS_KEY, { ok: a.ok, reason: a.reason, verifiedAt: Date.now(), email: session.user.email });
        enforceGate(); renderCloudCard();
        return a;
      });
    };
    // Provision the trial row if this login is the first (0005). If the RPC
    // is missing or fails, fall through to a plain select: a stale backend
    // must never lock out a paying user.
    try {
      if (sb && typeof sb.rpc === "function") {
        var ensured = sb.rpc("ensure_profile");
        if (ensured && typeof ensured.then === "function") return ensured.then(loadProfile, loadProfile);
      }
    } catch (e) {}
    return loadProfile();
  }).catch(function (e) {
    // Offline or transient: fall back to cached status, gate still enforced.
    enforceGate(); renderCloudCard();
    return null;
  });
}
function enforceGate() {
  if (!Cloud.enabled) return;
  var a = currentAccess();
  if (!session) { hidePaywall(); showAuth("login"); renderBanner({ ok: false }); return; }
  hideAuth();
  if (!a.ok) showPaywall(a); else hidePaywall();
  renderBanner(a);
}

/* ---------------- sync ---------------- */
function localHash() { try { return hashStr(JSON.stringify(typeof DB !== "undefined" ? DB : {})); } catch (e) { return ""; } }
function schedulePush() {
  if (!Cloud.enabled || suspendPush) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(function () { pushTimer = null; pushNow(false); }, 6000);
}
function pushNow(manual) {
  if (!Cloud.enabled) return Promise.resolve();
  if (!session) { if (manual) toast("Sign in first (Settings → Cloud)."); return Promise.resolve(); }
  if (!navigator.onLine && navigator.onLine === false) { if (manual) toast("You're offline — will sync when online."); return Promise.resolve(); }
  if (!currentAccess().ok) { if (manual) toast("Subscription required for cloud sync."); return Promise.resolve(); }
  syncLine("Uploading…");
  var payload = { user_id: session.user.id, data: (typeof DB !== "undefined" ? DB : {}), device: String((navigator.userAgent || "").slice(0, 80)), app_version: APP_VER };
  return sb.from("clinic_snapshots").insert(payload).select("id").single().then(function (r) {
    if (r.error) throw r.error;
    lsSet(HASH_KEY, localHash());
    syncLine("Synced just now ✓");
    if (manual) toast("Uploaded to cloud ✓");
    // prune history to latest 30
    return sb.from("clinic_snapshots").select("id").eq("user_id", session.user.id).order("id", { ascending: false }).limit(100).then(function (l) {
      if (l.data && l.data.length > 30) {
        var old = l.data.slice(30).map(function (x) { return x.id; });
        return sb.from("clinic_snapshots").delete().in("id", old);
      }
    });
  }).catch(function (e) { syncLine("Sync failed — will retry."); if (manual) toast("Upload failed: " + (e.message || "network error")); });
}
function pullNow() {
  if (!Cloud.enabled || !session) { toast("Sign in first (Settings → Cloud)."); return; }
  syncLine("Checking cloud…");
  sb.from("clinic_snapshots").select("id,data,created_at").eq("user_id", session.user.id).order("id", { ascending: false }).limit(1).maybeSingle().then(function (r) {
    if (r.error) throw r.error;
    if (!r.data) { toast("No cloud backup yet — use Upload first."); syncLine(""); return; }
    var cloudHash = hashStr(JSON.stringify(r.data.data || {}));
    var lh = localHash(), last = lsGet(HASH_KEY) || "";
    if (cloudHash === lh) { toast("Already up to date ✓"); syncLine("Synced just now ✓"); return; }
    if (lh !== last && last) { conflictModal(r.data.data); return; } // both sides changed
    applySnapshot(r.data.data);
  }).catch(function (e) { toast("Download failed: " + (e.message || "network error")); syncLine(""); });
}
function applySnapshot(data) {
  try {
    try { localStorage.setItem("kidgrow_pro_v1_prev", JSON.stringify(typeof DB !== "undefined" ? DB : {})); } catch (e) {}
    suspendPush = true;
    DB = data && data.children ? data : DB;
    if (typeof normalizeChild === "function" && DB.children) DB.children.forEach(normalizeChild);
    if (typeof save === "function") save();
    lsSet(HASH_KEY, localHash());
    suspendPush = false;
    if (typeof syncChildPicker === "function") syncChildPicker();
    if (typeof renderAll === "function") renderAll();
    if (typeof loadSettings === "function") loadSettings();
    toast("Downloaded from cloud ✓ (previous data kept as fallback)");
  } catch (e) { suspendPush = false; toast("Could not apply cloud data."); }
}
function conflictModal(cloudData) {
  ensureRoot();
  var r = $("cloudRoot");
  r.innerHTML =
    '<div class="modal-bg open" id="mConflict"><div class="modal" style="max-width:420px;text-align:center">' +
    "<h3>⚠️ Both sides changed</h3><div class='hint'>This device and the cloud both have newer data. Choose one — the other is kept as a local fallback.</div>" +
    '<button class="btn btn-p" style="width:100%;margin-top:8px" onclick="Cloud._confUp()">⬆ Keep THIS DEVICE (upload)</button>' +
    '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="Cloud._confDown()">⬇ Keep CLOUD (download)</button>' +
    '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="document.getElementById(\'mConflict\').remove()">Cancel</button></div></div>';
  Cloud._confData = cloudData;
}

/* ---------------- subscribe (Razorpay) ---------------- */
function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  if (rzpLoading) return rzpLoading;
  rzpLoading = new Promise(function (res, rej) {
    var s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = res; s.onerror = function () { rej(new Error("Could not load payment page.")); };
    document.head.appendChild(s);
  });
  return rzpLoading;
}
function subscribe() {
  if (!Cloud.enabled || !session) { showAuth("login"); return; }
  if (!RZP_KEY) { toast("Payments not configured yet."); return; }
  toast("Preparing secure payment…");
  fetch("/api/create-subscription", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token }, body: "{}" })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (x) {
      if (!x.ok || !x.j.subscription_id) throw new Error((x.j && x.j.error) || "Payment backend not reachable.");
      return loadRazorpay().then(function () { return x.j; });
    })
    .then(function (j) {
      var rzp = new window.Razorpay({
        key: j.key_id || RZP_KEY, subscription_id: j.subscription_id,
        name: "KidGrow Pro", description: PLAN_NAME,
        prefill: { email: session.user.email },
        theme: { color: "#0e7c7b" },
        modal: { ondismiss: function () { toast("You can subscribe anytime from Settings → Cloud."); } },
        handler: function () {
          toast("Payment done — confirming…");
          var n = 0;
          var iv = setInterval(function () {
            n++;
            fetchStatus().then(function () { if (currentAccess().ok) { clearInterval(iv); toast("Welcome to " + PLAN_NAME + "! 🎉"); } });
            if (n > 10) clearInterval(iv);
          }, 3000);
        }
      });
      rzp.open();
    })
    .catch(function (e) { toast(e.message || "Could not start payment."); });
}

/* ---------------- billing center ---------------- */
var billCache = null;
function fmtINR(n) { try { return "₹" + Number(n || 0).toLocaleString("en-IN"); } catch (e) { return "₹" + n; } }
function fmtDT(iso) { try { if (!iso) return "—"; return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return "—"; } }
function billStatusLabel(a, p) {
  if (!a || !a.ok) return (a && a.reason === "pending") ? "Completing payment…" : "Expired";
  if (a.reason === "active") return "Active" + ((p && p.current_period_end) ? " · renews " + fmtDT(p.current_period_end) : "");
  if (a.reason === "past_due") return "Past due — update payment";
  if (a.reason === "trial") return "Free trial" + ((a.daysLeft != null) ? " · " + a.daysLeft + " day(s) left" : "");
  if (a.reason === "grace") return "Offline grace";
  return a.reason || "";
}
function billInfoHTML(info, a) {
  var prof = (info && info.profile) || profile || {};
  var head = '<div class="card"><h3>💳 Subscription</h3>'
    + '<dl class="kv"><dt>Plan</dt><dd><b>' + esc(PLAN_NAME) + "</b> · " + esc(PLAN_PRICE || "—") + "</dd>"
    + "<dt>Status</dt><dd><b>" + esc(billStatusLabel(a, prof)) + "</b></dd>"
    + ((info && info.email) ? "<dt>Account</dt><dd>" + esc(info.email) + "</dd>" : "")
    + ((info && info.subscription) ? "<dt>Renews</dt><dd>" + esc(fmtDT(info.subscription.current_end || info.subscription.charge_at)) + "</dd>"
      + "<dt>Payments</dt><dd>" + esc(String(info.subscription.paid_count)) + " paid" + (info.subscription.remaining_count ? " · " + esc(String(info.subscription.remaining_count)) + " to go" : "") + "</dd>" : "")
    + "</dl>";
  if (!info || info.error) {
    return head + '<div class="hint">Could not load live billing details (offline or unreachable).</div>'
      + '<button class="btn btn-o btn-sm" onclick="Cloud.refreshBilling()">↻ Retry</button></div>';
  }
  var body = head;
  if (a && a.ok && a.reason === "past_due") {
    body += '<div class="alert a-amber">⚠️ <div><b>Last payment failed.</b> Update your payment method to stay subscribed — access continues during retry.</div></div>'
      + '<button class="btn btn-p btn-sm" onclick="Cloud.subscribe()">Update payment</button> ';
  } else if (!a || !a.ok) {
    body += '<button class="btn btn-p btn-sm" onclick="Cloud.subscribe()">Subscribe now</button> ';
  } else if (a.reason === "trial") {
    body += '<button class="btn btn-p btn-sm" onclick="Cloud.subscribe()">Subscribe now</button> ';
  }
  if (info.subscription && (a.ok && (a.reason === "active" || a.reason === "past_due"))) {
    body += '<button class="btn btn-o btn-sm" onclick="Cloud.cancelSub()">Cancel subscription</button> ';
  }
  body += '<button class="btn btn-o btn-sm" onclick="Cloud.refreshBilling()">↻ Refresh</button></div>';
  body += '<div class="card"><h3>🧾 Invoices</h3>';
  if (!info.invoices || !info.invoices.length) {
    body += '<div class="hint">No invoices yet — they appear here after each successful charge. GST invoices are emailed by Razorpay after every payment.</div>';
  } else {
    body += "<table class=\"tbl\"><tr><th>Date</th><th>Amount</th><th>Status</th><th></th></tr>" + info.invoices.map(function (v) {
      return "<tr><td>" + esc(fmtDT(v.date)) + "</td><td>" + esc(fmtINR(v.amount)) + "</td>"
        + "<td>" + (v.status === "paid" ? '<span class="badge b-green">paid</span>' : v.status === "failed" ? '<span class="badge b-red">failed</span>' : esc(v.status || "—")) + "</td>"
        + "<td>" + (v.short_url ? '<a href="' + esc(v.short_url) + '" target="_blank" rel="noopener">Download</a>' : "—") + "</td></tr>";
    }).join("") + "</table>";
  }
  return body + "</div>";
}
function renderBilling() {
  var el = $("billBody"); if (!el) return;
  if (!Cloud.enabled) { el.innerHTML = '<div class="card"><h3>💳 Billing</h3><div class="hint">Cloud is not configured on this device.</div></div>'; return; }
  if (!session) { el.innerHTML = subscriptionPitchHTML(false); return; }
  var a = currentAccess();
  if (!a.ok && a.reason !== "pending") { el.innerHTML = subscriptionPitchHTML(true); return; }
  if (!billCache) {
    el.innerHTML = billStatusCard(a) + '<div class="hint">Loading billing details…</div>';
    fetch("/api/billing-info", { headers: { Authorization: "Bearer " + session.access_token } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) { billCache = x.ok ? x.j : { error: true }; renderBilling(); })
      .catch(function () { billCache = { error: true }; renderBilling(); });
    return;
  }
  el.innerHTML = billInfoHTML(billCache.error ? null : billCache, a);
}
function billStatusCard(a) {
  return '<div class="card"><h3>💳 Subscription</h3><dl class="kv"><dt>Plan</dt><dd><b>' + esc(PLAN_NAME) + "</b> · " + esc(PLAN_PRICE || "—") + "</dd>"
    + "<dt>Status</dt><dd><b>" + esc(billStatusLabel(a, profile)) + "</b></dd></dl></div>";
}
function cancelSub() {
  if (!Cloud.enabled || !session) { showAuth("login"); return; }
  if (!window.confirm("Cancel your subscription?\n\nYou keep full access until the end of the current billing period.")) return;
  toast("Cancelling…");
  fetch("/api/cancel-subscription", { method: "POST", headers: { Authorization: "Bearer " + session.access_token } })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
    .then(function (x) {
      if (!x.ok) throw new Error((x.j && x.j.error) || "Cancel failed.");
      billCache = null;
      toast("Cancelled — access continues till period end.");
      fetchStatus().then(renderBilling);
    })
    .catch(function (e) { toast(e.message || "Could not cancel."); });
}
// Pure pitch card for visitors + expired accounts. Subscribed/trial/pending users
// never see this — renderBilling shows them the management view instead.
function subscriptionPitchHTML(authed) {
  var cta = authed
    ? '<button class="btn btn-p" style="width:100%" onclick="Cloud.subscribe()">Subscribe now</button>'
    : '<button class="btn btn-p" style="width:100%" onclick="Cloud.showAuth(\'signup\')">Start ' + TRIAL_DAYS + '-day free trial</button>'
      + '<div style="margin-top:10px;font-size:13px">Have an account? <a href="#" onclick="Cloud.showAuth(\'login\');return false">Sign in</a></div>';
  return '<div class="card" style="max-width:520px;margin:0 auto"><div style="text-align:center"><div style="font-size:40px">💎</div><h2 style="margin:4px 0">' + esc(PLAN_NAME) + '</h2>'
    + '<div style="font-size:30px;font-weight:800;color:var(--navy)">' + esc(PLAN_PRICE || "—") + '</div><div class="hint">per clinic, per month · cancel anytime</div></div>'
    + '<div style="font-size:14px;margin:14px 0">✓ Unlimited children & records<br>✓ Automatic cloud backup + multi-device sync<br>✓ WhatsApp reminders & vaccine alerts<br>✓ Growth charts (WHO/CDC) & eMAR<br>✓ Works offline — syncs when online</div>'
    + cta + "</div>"
    + '<div class="card" style="max-width:520px;margin:12px auto"><h3>Questions</h3><dl class="kv">'
    + "<dt>Free trial?</dt><dd>" + TRIAL_DAYS + " days, full access, no card required.</dd>"
    + "<dt>Cancel?</dt><dd>Anytime in one tap on this page — access runs till period end.</dd>"
    + "<dt>Payment fails?</dt><dd>We retry automatically; you keep access meanwhile.</dd>"
    + "<dt>My data?</dt><dd>Yours. Export anytime; GST invoices emailed per payment.</dd>"
    + "</dl></div>";
}

/* ---------------- public API ---------------- */
var Cloud = {
  enabled: false,
  sb: function () { return sb; }, // authed client for tenant.js (shared session)
  init: function () {
    if (!configured()) { Cloud.enabled = false; return; }
    Cloud.enabled = true;
    try { sb = window.supabase.createClient(SB_URL, SB_ANON); } catch (e) { Cloud.enabled = false; return; }
    fetchStatus();
    window.addEventListener("online", function () { fetchStatus().then(function () { schedulePush(); }); });
    window.addEventListener("offline", function () { renderBanner(currentAccess()); });
  },
  showAuth: showAuth,
  authGo: function (mode) {
    var em = ($("cloudEmail") || {}).value || "", pw = ($("cloudPass") || {}).value || "";
    if (!/.+@.+\..+/.test(em)) { authErr("Enter a valid email address."); return; }
    if (pw.length < 6) { authErr("Password needs at least 6 characters."); return; }
    authErr("");
    if (mode === "signup") doSignup(em, pw); else doLogin(em, pw);
  },
  forgot: function () {
    var em = ($("cloudEmail") || {}).value || "";
    if (!/.+@.+\..+/.test(em)) { authErr("Enter your email first, then tap Forgot password."); return; }
    sb.auth.resetPasswordForEmail(em).then(function (r) {
      authErr(r.error ? r.error.message : "Reset link sent — check your inbox.");
    });
  },
  logout: function () {
    if (sb) sb.auth.signOut().catch(function () {});
    session = null; profile = null;
    try { localStorage.removeItem(STATUS_KEY); } catch (e) {}
    enforceGate(); renderCloudCard();
  },
  syncNow: function () { fetchStatus().then(function () { pullNow(); }); },
  pushNow: pushNow,
  pullNow: pullNow,
  subscribe: subscribe,
  user: function () { return session ? session.user : null; },
  access: currentAccess,
  _confUp: function () { var m = $("mConflict"); if (m) m.remove(); pushNow(true); },
  _confDown: function () { var m = $("mConflict"); if (m) m.remove(); if (Cloud._confData) applySnapshot(Cloud._confData); },
  // test hooks (pure logic)
  cancelSub: cancelSub,
  refreshBilling: function () { billCache = null; renderBilling(); },
  _access: accessFor,
  _trialLeft: trialLeft,
  _hash: hashStr,
  _billInfoHTML: billInfoHTML,
  _billStatusLabel: billStatusLabel
};
window.Cloud = Cloud;
window.renderBilling = renderBilling;
window.subscriptionPitchHTML = subscriptionPitchHTML;
window.CloudSchedulePush = schedulePush;

})();

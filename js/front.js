/* =====================================================
   KidGrow Pro — Frontdesk (Round 2)
   PIN login + roles · audit trail · token queue ·
   billing & receipts · users management.
   ===================================================== */
const ROLE_RANK = { Doctor: 3, Nurse: 2, Frontdesk: 1 };
const ROLE_HIDE = {
  Frontdesk: ["milestones", "growth", "visits", "rx", "analytics", "reports", "users", "settings", "nb", "labs", "aefi", "screen", "diet", "consent", "export", "nicu", "mar", "calc", "mrd", "formulary"],
  Nurse: ["users", "settings"],
};

/* ---------------- auth ---------------- */
function currentUser() {
  if (!(DB.users || []).length) {
    try { if (typeof CloudServerUser === "function") { var cu = CloudServerUser(); if (cu) return cu; } } catch (e) {}
    return { name: "Open mode", role: "Doctor", open: true };
  }
  const s = DB.session || {};
  return (DB.users || []).find((u) => u.id === s.userId) || null;
}
function myRank() { const u = currentUser(); return u ? (ROLE_RANK[u.role] || 0) : 0; }
function need(rank, what) {
  if (myRank() >= rank) return true;
  alert(`🔒 ${what ? what[0].toUpperCase() + what.slice(1) : "This action"} needs ${rank === 3 ? "Doctor" : "Nurse or Doctor"} access.`);
  return false;
}
function roleBlock(page) {
  const u = currentUser();
  if (!u || u.open || u.role === "Doctor") return false;
  return (ROLE_HIDE[u.role] || []).includes(page);
}
function applyRole() {
  const u = currentUser();
  document.querySelectorAll("#sideNav button, #mobNav button").forEach((b) => {
    b.style.display = (u && !u.open && roleBlock(b.dataset.page)) ? "none" : "";
  });
  const chip = document.getElementById("userChip");
  if (chip) {
    chip.innerHTML = (u && !u.open)
      ? `👤 <b>${esc(u.name)}</b> <span class="badge b-teal">${esc(u.role)}</span> <button class="btn btn-o btn-xs" onclick="doLogout()">Logout</button>`
      : ((DB.users || []).length ? "" : `<span style="font-size:12px;color:var(--muted)">🔓 Open mode — <a href="#" onclick="go('users');return false;">set up users & PINs</a></span>`);
  }
}
function enforceLock() {
  const lock = document.getElementById("lockScreen");
  if (!lock) return;
  const needLock = (DB.users || []).length > 0 && !currentUser();
  lock.classList.toggle("show", !!needLock);
  if (needLock) {
    document.getElementById("lockUser").innerHTML = (DB.users || []).map((u) => `<option value="${u.id}">${esc(u.name)} (${esc(u.role)})</option>`).join("");
    document.getElementById("lockPin").value = "";
    document.getElementById("lockMsg").textContent = "";
  }
}
/* PINs are salted hashes (SHA-256 via WebCrypto), never plaintext. Legacy plaintext
   PINs migrate to hashes on next successful login. Honest limits: a 4-digit PIN
   has ~13 bits of entropy — this stops casual reads, not targeted cracking.
   The real multi-user security boundary is Supabase Auth + memberships (M3). */
async function pinHash(pin, salt) {
  const msg = salt + ":" + String(pin);
  if (window.crypto && crypto.subtle) {
    const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
    return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
  }
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57; // weak fallback for non-secure contexts only
  for (let i = 0; i < msg.length; i++) { const ch = msg.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return "w$" + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}
function pinSalt() {
  try { const b = crypto.getRandomValues(new Uint8Array(16)); return [...b].map((x) => x.toString(16).padStart(2, "0")).join(""); }
  catch (e) { return "s" + Date.now().toString(16) + Math.floor(Math.random() * 1e9).toString(16); }
}
function pinGuard() { try { return JSON.parse(safeGet("kidgrow_pin_guard") || "{}"); } catch (e) { return {}; } }
function pinGuardSet(g) { try { localStorage.setItem("kidgrow_pin_guard", JSON.stringify(g)); } catch (e) {} }
async function doLogin() {
  const u = (DB.users || []).find((x) => x.id === document.getElementById("lockUser").value);
  const pin = document.getElementById("lockPin").value;
  const msg = document.getElementById("lockMsg");
  const g = pinGuard();
  if (g.until && Date.now() < g.until) { msg.textContent = "🔒 Too many attempts — try again in " + Math.ceil((g.until - Date.now()) / 1000) + "s."; return; }
  let authed = false;
  if (u && u.pinHash && u.pinSalt) authed = (await pinHash(pin, u.pinSalt)) === u.pinHash;
  else if (u && u.pin != null && String(u.pin) === String(pin)) {
    u.pinSalt = pinSalt(); u.pinHash = await pinHash(pin, u.pinSalt); delete u.pin; authed = true;
  }
  if (u && authed) {
    pinGuardSet({});
    DB.session = { userId: u.id, at: new Date().toISOString() };
    log("Login", u.name);
    save(); applyRole(); renderAll();
  } else {
    const n = (g.n || 0) + 1;
    pinGuardSet(n >= 5 ? { n: 0, until: Date.now() + 60000 } : { n });
    msg.textContent = n >= 5 ? "🔒 Too many attempts — locked 60s." : "❌ Wrong PIN — try again.";
    try { log("Login failed", (u || {}).name || "?"); save(); } catch (e) {}
  }
}
function doLogout() {
  log("Logout", (currentUser() || {}).name || "");
  DB.session = {};
  save(); applyRole(); renderAll();
}

/* ---------------- inactivity auto-lock (M2) ----------------
   Locks the local session after N idle minutes (default 15, 1–480 via
   Settings → Session lock). Any click/key/touch counts as activity.
   Supabase cloud sessions are short-lived server-side; this guards the device. */
let IdleLast = Date.now();
function idleTimeoutMs() {
  const m = parseInt((DB.settings && DB.settings.lockMins) || "15", 10);
  return Math.max(1, Math.min(480, isNaN(m) ? 15 : m)) * 60e3;
}
function touchIdle() { IdleLast = Date.now(); }
function checkIdle(nowMs) {
  if (!(DB.users || []).length) return false;      // open mode: nothing to lock
  if (!((DB.session || {}).userId)) return false;  // already locked
  if ((nowMs || Date.now()) - IdleLast < idleTimeoutMs()) return false;
  log("Auto-lock", "inactivity");
  doLogout();
  const m = document.getElementById("lockMsg");
  if (m) m.textContent = "🔒 Locked after inactivity.";
  return true;
}
try {
  ["click", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, touchIdle, { passive: true }));
  setInterval(() => { try { checkIdle(); } catch (e) {} }, 30000);
} catch (e) {}

/* ---------------- audit ---------------- */
function log(action, detail) {
  DB.audit = DB.audit || [];
  DB.audit.unshift({ t: new Date().toISOString(), user: (currentUser() || {}).name || "?", action: action || "", detail: detail || "" });
  if (DB.audit.length > 500) DB.audit.length = 500;
}
function exportAudit() {
  if (!need(3, "export audit")) return;
  const rows = [["Time", "User", "Action", "Detail"], ...(DB.audit || []).map((a) => [a.t, a.user, a.action, a.detail])];
  const csv = rows.map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const b = new Blob([csv], { type: "text/csv" }), el = document.createElement("a");
  el.href = URL.createObjectURL(b); el.download = `kidgrow_audit_${todayISO()}.csv`; el.click();
  setTimeout(() => URL.revokeObjectURL(el.href), 2000);
}

/* ---------------- tokens ---------------- */
function nextTokenNo(dateISO) {
  const ns = (DB.tokens || []).filter((t) => t.date === dateISO).map((t) => t.n || 0);
  return (ns.length ? Math.max(...ns) : 0) + 1;
}
function nowHM() { return new Date().toTimeString().slice(0, 5); }
function addToken() {
  DB.tokens = DB.tokens || [];
  const cid = document.getElementById("tkChild").value;
  const kid = DB.children.find((x) => x.id === cid);
  const name = (document.getElementById("tkName").value.trim()) || (kid ? kid.name : "");
  if (!name) return alert("Pick a child or type a walk-in name.");
  const t = todayISO();
  DB.tokens.push({ id: uid(), n: nextTokenNo(t), date: t, time: nowHM(), childId: cid || "", name, reason: document.getElementById("tkReason").value.trim() || "General", status: "waiting" });
  log("Token", `#${nextTokenNo(t) - 1} ${name}`);
  save(); renderAll();
}
function callNext() {
  const t = todayISO();
  (DB.tokens || []).filter((x) => x.date === t && x.status === "in").forEach((x) => (x.status = "done"));
  const nx = (DB.tokens || []).filter((x) => x.date === t && x.status === "waiting").sort((a, b) => a.n - b.n)[0];
  if (nx) nx.status = "in";
  log("Token call", nx ? `#${nx.n} ${nx.name}` : "queue empty");
  save(); renderAll();
}
function setTokenStatus(id, st) {
  const x = (DB.tokens || []).find((t) => t.id === id);
  if (x) { x.status = st; log("Token " + st, `#${x.n} ${x.name}`); save(); renderAll(); }
}
function delToken(id) {
  const x = (DB.tokens || []).find((t) => t.id === id);
  if (!x || !confirm(`Remove token #${x.n} (${x.name})?`)) return;
  DB.tokens = DB.tokens.filter((t) => t.id !== id);
  log("Token removed", `#${x.n} ${x.name}`);
  save(); renderAll();
}
function clearOldTokens() {
  if (!need(2, "clear old tokens")) return;
  const t = todayISO(), n = (DB.tokens || []).filter((x) => x.date !== t).length;
  if (!n || !confirm(`Remove ${n} token(s) from earlier days?`)) return;
  DB.tokens = (DB.tokens || []).filter((x) => x.date === t);
  log("Tokens cleared", `${n} old`);
  save(); renderAll();
}

/* ---------------- billing ---------------- */
const RATE_DEFAULTS = { Consultation: 300, "Follow-up": 200, "Vaccination charge": 100, Nebulisation: 150, Dressing: 100 };
function rates() { return Object.assign({}, RATE_DEFAULTS, (DB.settings || {}).rates || {}); }
let BILL_DRAFT = null;
function billDraft() {
  if (!BILL_DRAFT) { const c = (typeof child === "function") ? child() : null; BILL_DRAFT = { childId: c ? c.id : "", items: [], paid: "", mode: "UPI" }; }
  return BILL_DRAFT;
}
function billTotal() { return billDraft().items.reduce((s, i) => s + (+i.amt || 0), 0); }
function billAddRate(name) { billDraft().items.push({ desc: name, amt: rates()[name] || 0 }); renderFront(); }
function billAddCustom() {
  const d = document.getElementById("bDesc").value.trim(), a = +document.getElementById("bAmt").value || 0;
  if (!d) return alert("Describe the charge.");
  billDraft().items.push({ desc: d, amt: a }); renderFront();
}
function billDelItem(i) { billDraft().items.splice(i, 1); renderFront(); }
function saveBill() {
  if (typeof guardSubmit === "function" && !guardSubmit("bill")) return; // M4: no double bills
  const dft = billDraft();
  if (!dft.items.length) return alert("Add at least one charge.");
  DB.bills = DB.bills || [];
  const kid = DB.children.find((x) => x.id === dft.childId);
  const total = billTotal(), paid = dft.paid === "" ? total : +dft.paid || 0;
  DB.bills.push({ id: uid(), date: todayISO(), time: nowHM(), childId: dft.childId, name: kid ? kid.name : "Walk-in", items: dft.items.map((i) => ({ ...i })), total, paid, mode: dft.mode, by: (currentUser() || {}).name || "" });
  BILL_DRAFT = null;
  log("Bill", `₹${total} — ${kid ? kid.name : "Walk-in"}`);
  save(); renderAll();
}
function delBill(id) {
  if (!need(3, "delete bills")) return;
  if (!confirm("Delete this bill?")) return;
  DB.bills = (DB.bills || []).filter((b) => b.id !== id);
  log("Bill deleted", id.slice(-6));
  save(); renderAll();
}
function printBill(id) {
  const b = (DB.bills || []).find((x) => x.id === id); if (!b) return;
  const bal = b.total - b.paid;
  $("billPrint").innerHTML = `<div class="receipt">${clinicHeader()}
    <div style="text-align:center;font-weight:800;letter-spacing:1px;margin:6px 0">RECEIPT · No. R-${b.id.slice(-6).toUpperCase()}</div>
    <dl class="kv"><dt>Date</dt><dd>${fmtDate(b.date)} ${esc(b.time || "")}</dd><dt>Received from</dt><dd><b>${esc(b.name)}</b></dd><dt>Mode</dt><dd>${esc(b.mode || "—")}</dd></dl>
    <table class="tbl"><tr><th>Particulars</th><th style="text-align:right">Amount (₹)</th></tr>
    ${b.items.map((i) => `<tr><td>${esc(i.desc)}</td><td style="text-align:right">${(+i.amt || 0).toFixed(0)}</td></tr>`).join("")}
    <tr><td><b>Total</b></td><td style="text-align:right"><b>₹${b.total.toFixed(0)}</b></td></tr>
    <tr><td>Paid</td><td style="text-align:right">₹${b.paid.toFixed(0)}</td></tr>
    ${bal !== 0 ? `<tr><td><b>Balance</b></td><td style="text-align:right"><b>₹${bal.toFixed(0)}</b></td></tr>` : ""}</table>
    <div style="display:flex;justify-content:space-between;margin-top:28px;font-size:13px"><span>Received by: ${esc(b.by || "")}</span><span>Authorised signatory</span></div>
    <div style="text-align:center;font-size:12px;color:var(--muted);margin-top:10px">Get well soon! · Thank you for visiting.</div></div>`;
  printPage("pg-billprint");
}
function saveRates() {
  if (!need(3, "edit rates")) return;
  const r = {};
  Object.keys(rates()).forEach((k, i) => { r[k] = +((document.getElementById("rate" + i) || {}).value || 0); });
  DB.settings.rates = r;
  log("Rates updated", "");
  save(); renderAll();
}

/* ---------------- frontdesk page ---------------- */
function renderFront() {
  if (!$("pg-front")) return;
  DB.tokens = DB.tokens || []; DB.bills = DB.bills || [];
  const t = todayISO();
  const tod = (DB.tokens || []).filter((x) => x.date === t).sort((a, b) => a.n - b.n);
  const serving = tod.find((x) => x.status === "in");
  const waiting = tod.filter((x) => x.status === "waiting");
  const dft = billDraft();
  const bills = [...(DB.bills || [])].sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || "")));
  const todayBills = bills.filter((b) => b.date === t);
  const coll = todayBills.reduce((s, b) => s + (+b.paid || 0), 0);
  const r = rates(), rKeys = Object.keys(r);
  $("frontBox").innerHTML = `
  <div class="token-banner"><div><div style="font-size:12px;letter-spacing:1px;opacity:.8">NOW SERVING</div>
    <div style="font-size:34px;font-weight:800">${serving ? `#${serving.n} · ${esc(serving.name)}` : "—"}</div>
    <div style="font-size:13px">${waiting.length} waiting${tod.filter((x) => x.status === "done").length ? ` · ${tod.filter((x) => x.status === "done").length} done` : ""}</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-p" onclick="callNext()">📢 Call next</button>
    <button class="btn btn-o btn-sm" onclick="clearOldTokens()">🧹 Clear old days</button></div></div>
  <div style="height:16px"></div>
  <div class="grid g2">
    <div class="card"><h3>🎟️ Token queue — ${fmtDate(t)}</h3>
      <div class="form-grid">
        <div><label>Child (registered)</label><select id="tkChild" onchange="document.getElementById('tkName').value=''"><option value="">— walk-in —</option>${DB.children.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div>
        <div><label>Or walk-in name</label><input id="tkName" placeholder="e.g. Sara"></div>
        <div class="full"><label>Reason</label><input id="tkReason" placeholder="e.g. Fever / Vaccination / Review"></div>
      </div>
      <button class="btn btn-p btn-sm" onclick="addToken()">＋ Add token (#${nextTokenNo(t)})</button>
      <div style="margin-top:10px">${tod.length ? tod.map((x) => `
        <div class="vac-row" style="${x.status === "in" ? "border-left:4px solid var(--teal)" : ""}${x.status === "done" ? ";opacity:.55" : ""}">
          <div class="grow"><b>#${x.n}</b> ${esc(x.name)} <span class="badge ${x.status === "in" ? "b-teal" : x.status === "waiting" ? "b-amber" : "b-gray"}">${x.status}</span><br>
          <span style="font-size:12px;color:var(--muted)">${esc(x.time || "")} · ${esc(x.reason || "")}</span></div>
          ${x.status === "waiting" ? `<button class="btn btn-d btn-xs" onclick="setTokenStatus('${x.id}','in')">Call</button>` : ""}
          ${x.status === "in" ? `<button class="btn btn-d btn-xs" onclick="setTokenStatus('${x.id}','done')">Done</button>` : ""}
          ${x.status !== "done" ? `<button class="btn btn-o btn-xs" onclick="setTokenStatus('${x.id}','skipped')">Skip</button>` : ""}
          <button class="btn btn-danger btn-xs" onclick="delToken('${x.id}')">✕</button>
        </div>`).join("") : `<div style="font-size:13px;color:var(--muted)">Queue empty — add the first token.</div>`}</div>
    </div>
    <div class="card"><h3>🧾 New bill</h3>
      <div class="form-grid">
        <div><label>Child</label><select onchange="billDraft().childId=this.value"><option value="">— walk-in —</option>${DB.children.map((c) => `<option value="${c.id}"${dft.childId === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select></div>
        <div><label>Mode</label><select onchange="billDraft().mode=this.value">${["UPI", "Cash", "Card"].map((m) => `<option${dft.mode === m ? " selected" : ""}>${m}</option>`).join("")}</select></div>
      </div>
      <div class="hint">Quick charges (₹ — edit rates below)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${rKeys.map((k) => `<button class="btn btn-o btn-xs" onclick="billAddRate('${esc(k).replace(/'/g, "&#39;")}')">${esc(k)} ₹${r[k]}</button>`).join("")}</div>
      <div style="display:flex;gap:6px;margin-bottom:8px"><input id="bDesc" placeholder="Custom charge" style="flex:2"><input id="bAmt" type="number" min="0" placeholder="₹" style="flex:1"><button class="btn btn-o btn-sm" onclick="billAddCustom()">Add</button></div>
      ${dft.items.length ? dft.items.map((i, n) => `<div class="vac-row"><div class="grow">${esc(i.desc)}</div><b>₹${(+i.amt || 0).toFixed(0)}</b><button class="btn btn-danger btn-xs" onclick="billDelItem(${n})">✕</button></div>`).join("") : `<div style="font-size:13px;color:var(--muted)">No charges yet.</div>`}
      <div class="form-grid" style="margin-top:8px">
        <div><label>Total (₹)</label><input value="${billTotal()}" disabled></div>
        <div><label>Paid (₹)</label><input id="bPaid" type="number" min="0" value="${dft.paid}" placeholder="${billTotal()}" oninput="billDraft().paid=this.value"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-p btn-sm" onclick="saveBill()" ${dft.items.length ? "" : "disabled"}>💾 Save bill${dft.paid !== "" && +dft.paid !== billTotal() ? ` (bal ₹${billTotal() - (+dft.paid || 0)})` : ""}</button>
      <button class="btn btn-o btn-sm" onclick="BILL_DRAFT=null;renderFront()">Clear</button></div>
    </div>
  </div>
  <div style="height:16px"></div>
  <div class="grid g2">
    <div class="card"><h3>📒 Bills — ${fmtDate(t)} <span style="font-size:13px;color:var(--muted)">(collected ₹${coll.toFixed(0)} today)</span></h3>
      ${todayBills.length ? todayBills.map((b) => `<div class="vac-row"><div class="grow"><b>R-${b.id.slice(-6).toUpperCase()}</b> · ${esc(b.name)} · ${esc(b.time || "")}<br>
        <span style="font-size:12.5px;color:var(--muted)">${b.items.map((i) => esc(i.desc)).join(" + ")} · ${esc(b.mode || "")}</span></div>
        <b>₹${b.total.toFixed(0)}</b>
        <button class="btn btn-o btn-xs" onclick="printBill('${b.id}')">🖨️</button>
        <button class="btn btn-danger btn-xs" onclick="delBill('${b.id}')">✕</button></div>`).join("")
      : `<div style="font-size:13px;color:var(--muted)">No bills today yet.</div>`}
      ${bills.filter((b) => b.date !== t).length ? `<div class="hint" style="margin-top:8px">Earlier (${bills.filter((b) => b.date !== t).length}) — latest:</div>` + bills.filter((b) => b.date !== t).slice(0, 5).map((b) => `<div style="font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--line)">${fmtDate(b.date)} · ${esc(b.name)} · <b>₹${b.total.toFixed(0)}</b> <button class="btn btn-o btn-xs" onclick="printBill('${b.id}')">🖨️</button></div>`).join("") : ""}
    </div>
    <div class="card"><h3>💰 Charge rates</h3><div class="hint">Doctor can edit · used by quick-charge buttons</div>
      <div class="form-grid">${rKeys.map((k, i) => `<div><label>${esc(k)} (₹)</label><input type="number" min="0" id="rate${i}" value="${r[k]}"></div>`).join("")}</div>
      <button class="btn btn-o btn-sm" onclick="saveRates()" style="margin-top:8px">Save rates</button>
    </div>
  </div>
  <div style="height:16px"></div>
  <div id="dayCloseBox"></div>`;
  if (typeof renderDayClose === "function") renderDayClose();
}

/* ---------------- users + audit page ---------------- */
function renderUsers() {
  if (!$("pg-users")) return;
  const locked = (DB.users || []).length > 0 && myRank() < 3;
  if (locked) { $("usersBox").innerHTML = `<div class="alert a-red">🔒 <div>Users & audit needs <b>Doctor</b> access.</div></div>`; return; }
  const au = (DB.audit || []).slice(0, 100);
  $("usersBox").innerHTML = `
  <div class="grid g2">
    <div class="card"><h3>👥 Users & PINs</h3>
      ${(DB.users || []).length ? "" : `<div class="alert a-amber">🔓 <div><b>Open mode</b> — anyone can use the app. Add a Doctor user + PIN to enable login.</div></div>`}
      <div class="form-grid">
        <input type="hidden" id="uId">
        <div><label>Name</label><input id="uName" placeholder="e.g. Dr. Sharma"></div>
        <div><label>Role</label><select id="uRole"><option>Doctor</option><option>Nurse</option><option>Frontdesk</option></select></div>
        <div><label>PIN (4+ digits)</label><input id="uPin" type="password" inputmode="numeric" placeholder="••••"></div>
        <div style="align-self:end"><button class="btn btn-p btn-sm" onclick="saveUser()">＋ Save user</button></div>
      </div>
      <div style="margin-top:10px">${(DB.users || []).map((u) => `<div class="vac-row"><div class="grow">👤 <b>${esc(u.name)}</b> <span class="badge b-teal">${esc(u.role)}</span>
        ${(DB.session || {}).userId === u.id ? ` <span class="badge b-gray">logged in</span>` : ""}</div>
        <button class="btn btn-o btn-xs" onclick="editUser('${u.id}')">Edit</button>
        <button class="btn btn-danger btn-xs" onclick="delUser('${u.id}')">✕</button></div>`).join("") || `<div style="font-size:13px;color:var(--muted)">No users yet.</div>`}</div>
      <div style="margin-top:10px"><button class="btn btn-o btn-sm" onclick="doLogout()">Logout now</button></div>
    </div>
    <div class="card"><h3>📜 Audit trail <span style="font-size:13px;color:var(--muted)">(latest ${(DB.audit || []).length}, kept 500)</span></h3>
      <div class="hint">Who did what, when. <button class="btn btn-o btn-xs" onclick="exportAudit()">⬇ Export CSV</button>
      <button class="btn btn-o btn-xs" onclick="printPage('pg-users')">🖨️ Print</button></div>
      <div style="max-height:420px;overflow:auto"><table class="tbl"><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr>
      ${au.map((a) => `<tr><td style="font-size:11.5px;white-space:nowrap">${esc(a.t.slice(0, 16).replace("T", " "))}</td><td>${esc(a.user)}</td><td><b>${esc(a.action)}</b></td><td style="font-size:12px">${esc(a.detail)}</td></tr>`).join("") || `<tr><td colspan="4" style="color:var(--muted)">No activity yet.</td></tr>`}</table></div>
    </div>
  </div>`;
}
async function saveUser() {
  if (!need(3, "manage users")) return;
  DB.users = DB.users || [];
  const name = document.getElementById("uName").value.trim(), role = document.getElementById("uRole").value, pin = document.getElementById("uPin").value.trim();
  const id = document.getElementById("uId").value;
  if (!name) return alert("Name required.");
  if (!id && !/^\d{4,}$/.test(pin)) return alert("PIN must be 4+ digits.");
  if (id && pin && !/^\d{4,}$/.test(pin)) return alert("PIN must be 4+ digits.");
  if (id) {
    const u = DB.users.find((x) => x.id === id); Object.assign(u, { name, role });
    if (pin) { u.pinSalt = pinSalt(); u.pinHash = await pinHash(pin, u.pinSalt); delete u.pin; }
  } else { const s = pinSalt(); DB.users.push({ id: uid(), name, role, pinSalt: s, pinHash: await pinHash(pin, s) }); }
  log("User saved", `${name} (${role})`);
  save(); applyRole(); renderAll();
}
function editUser(id) {
  const u = (DB.users || []).find((x) => x.id === id); if (!u) return;
  document.getElementById("uId").value = u.id;
  document.getElementById("uName").value = u.name;
  document.getElementById("uRole").value = u.role;
  document.getElementById("uPin").value = "";
  document.getElementById("uPin").placeholder = "blank = keep old PIN";
}
function delUser(id) {
  if (!need(3, "manage users")) return;
  const u = (DB.users || []).find((x) => x.id === id);
  if (!u) return;
  if ((DB.session || {}).userId === id) return alert("Cannot delete the logged-in user.");
  if (!confirm(`Remove user ${u.name}?`)) return;
  DB.users = DB.users.filter((x) => x.id !== id);
  log("User removed", u.name);
  save(); applyRole(); renderAll();
}

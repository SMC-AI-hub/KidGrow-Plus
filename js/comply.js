/* NeoKid Care — compliance helpers (Phase 8): soft-delete erasure with 30-day
   grace + auto-purge, per-patient audit strip, session-passphrase encryption
   for cloud snapshots (AES-GCM via the proven ops.js backup crypto). */
var ENC_PW = null; // session-only: never persisted
function complyPw(v) {
  if (arguments.length) ENC_PW = v || null;
  return ENC_PW;
}
const ERASE_GRACE_D = 30;
function complyUser() { try { return ((typeof currentUser === "function" && currentUser()) || {}).name || "?"; } catch (e) { return "?"; } }
function complyDeleted() {
  try { if (typeof DB !== "undefined") { DB._deleted = DB._deleted || []; return DB._deleted; } } catch (e) {}
  return [];
}
function eraseRequest(id) {
  const c = (typeof childById === "function") ? childById(id) : null;
  if (!c) return;
  if (typeof needSafe === "function" && !needSafe(3, "erase child records")) return;
  try {
    if (confirm(`Download ${c.name}'s record before erasing? (Recommended — keeps a medico-legal copy.)`)) {
      downloadFile(`erased_${String(c.name).replace(/\s+/g, "_")}_${todayISO()}.json`, JSON.stringify(c, null, 1), "application/json");
    }
  } catch (e) {}
  const reason = prompt(`Reason for erasing ${c.name}'s record (recorded in audit):`, "Parent request (DPDP right to erasure)");
  if (reason === null) return;
  const first = String(c.name || "").split(" ")[0].toLowerCase();
  const typed = prompt(`Type the child's first name to confirm (recoverable for ${ERASE_GRACE_D} days):`);
  if ((typed || "").trim().toLowerCase() !== first || !first) { alert("Name did not match — erasure cancelled."); return; }
  Comply.erase(id, { reason: reason || "", by: complyUser() });
}
function complyErase(id, meta) {
  meta = meta || {};
  if (typeof DB === "undefined") return false;
  const i = (DB.children || []).findIndex((x) => x && x.id === id);
  if (i < 0) return false;
  const c = DB.children[i];
  DB.children.splice(i, 1);
  const purgeAfter = addDays(todayISO(), ERASE_GRACE_D);
  complyDeleted().push({ child: c, erasedAt: todayISO(), purgeAfter, by: meta.by || complyUser(), reason: meta.reason || "" });
  if (DB.activeId === id) DB.activeId = ((DB.children || [])[0] || {}).id || null;
  try { if (typeof auditSafe === "function") auditSafe("Record erased", `${c.name} — soft-deleted by ${meta.by || complyUser()}, purges after ${purgeAfter}. Reason: ${meta.reason || "—"}`); } catch (e) {}
  try { if (typeof save === "function") save(); } catch (e2) {}
  try { if (typeof syncChildPicker === "function") syncChildPicker(); } catch (e3) {}
  try { if (typeof renderAll === "function") renderAll(); } catch (e4) {}
  return true;
}
function complyRestore(id) {
  if (typeof DB === "undefined") return false;
  const del = complyDeleted(), i = del.findIndex((d) => d && d.child && d.child.id === id);
  if (i < 0) return false;
  const c = del[i].child;
  del.splice(i, 1);
  if (!(DB.children || []).some((x) => x && x.id === id)) DB.children.push(c);
  try { if (typeof auditSafe === "function") auditSafe("Record restored", `${c.name} — erasure reversed by ${complyUser()}`); } catch (e) {}
  try { if (typeof save === "function") save(); } catch (e2) {}
  try { if (typeof syncChildPicker === "function") syncChildPicker(); } catch (e3) {}
  try { if (typeof renderAll === "function") renderAll(); } catch (e4) {}
  return true;
}
function complyPurgeOne(id) {
  if (typeof DB === "undefined") return false;
  const del = complyDeleted(), i = del.findIndex((d) => d && d.child && d.child.id === id);
  if (i < 0) return false;
  const nm = del[i].child.name;
  del.splice(i, 1);
  try { if (typeof auditSafe === "function") auditSafe("Record purged", `${nm} — permanently deleted by ${complyUser()}`); } catch (e) {}
  try { if (typeof save === "function") save(); } catch (e2) {}
  try { if (typeof renderAll === "function") renderAll(); } catch (e3) {}
  return true;
}
function complyPurge(today) {
  if (typeof DB === "undefined") return 0;
  const t = today || todayISO();
  let n = 0;
  DB._deleted = complyDeleted().filter((d) => {
    if (d && d.purgeAfter && d.purgeAfter <= t) {
      n++;
      try { if (typeof auditSafe === "function") auditSafe("Record auto-purged", `${(d.child || {}).name} — grace expired ${d.purgeAfter}`); } catch (e) {}
      return false;
    }
    return true;
  });
  if (n) { try { if (typeof save === "function") save(); } catch (e) {} }
  return n;
}
function auditStripHTML(c) {
  try {
    if (!c) return "";
    const rows = ((typeof DB !== "undefined" && DB.audit) || []).filter((a) => a && a.cid === c.id).slice(0, 8);
    if (!rows.length) return "";
    const esc2 = (typeof esc === "function") ? esc : (s) => String(s == null ? "" : s);
    return `<div class="card" style="margin-top:12px"><h3>🧾 Record history (audit)</h3>
    <table class="tbl"><tr><th>When</th><th>User</th><th>Action</th><th>Detail</th></tr>
    ${rows.map((a) => `<tr><td style="white-space:nowrap">${esc2(String(a.t || "").slice(0, 16).replace("T", " "))}</td><td>${esc2(a.user)}</td><td><b>${esc2(a.action)}</b></td><td>${esc2(a.detail)}</td></tr>`).join("")}</table>
    <div class="hint">New entries attach to this child automatically; older entries predate per-patient audit.</div></div>`;
  } catch (e) { return ""; }
}
async function complyEncryptObj(obj, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aes = await encKey(pw, salt, "encrypt");
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(obj)));
  return { app: "KidGrowPro", enc: "AES-GCM-256-PBKDF2-100k", salt: b64enc(salt), iv: b64enc(iv), data: b64enc(ct) };
}
async function complyDecryptObj(env, pw) {
  if (!env || env.app !== "KidGrowPro" || !env.data) throw new Error("not an encrypted NeoKid Care object");
  const aes = await encKey(pw, b64dec(env.salt), "decrypt");
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64dec(env.iv) }, aes, b64dec(env.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
var Comply = {
  pw: complyPw, erase: complyErase, restore: complyRestore, purgeOne: complyPurgeOne,
  purge: complyPurge, deleted: complyDeleted, auditStrip: auditStripHTML,
  encrypt: complyEncryptObj, decrypt: complyDecryptObj, graceDays: ERASE_GRACE_D,
};
try { if (typeof window !== "undefined" && window) window.Comply = Comply; } catch (e) {}
/* Self-init: the boot line in app.js runs before this file loads, so the
   grace purge triggers here instead (DB + log() are ready by now). */
try { if (typeof DB !== "undefined" && DB && DB._deleted && DB._deleted.length) complyPurge(); } catch (ePI) {}

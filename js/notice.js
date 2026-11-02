/* =====================================================
   NeoKid Care — in-app privacy notice (DPDP Act 2023).
   Shown before/at first collection; version + acceptance
   timestamp stored in settings. Re-shown on version bump.
   Full counsel-adapted template: docs/PRIVACY-NOTICE-TEMPLATE.md
   ===================================================== */
const NOTICE_VERSION = "2026-10-27-v1";
function noticeStamp() { try { return (DB.settings && DB.settings.notice) || null; } catch (e) { return null; } }
function noticeStatusLine() {
  const s = noticeStamp();
  if (s && s.v === NOTICE_VERSION) return `Accepted ${s.v} on ${fmtDate(s.ts)} (this device)`;
  if (s) return `Accepted ${s.v || "?"} on ${fmtDate(s.ts)} — v${NOTICE_VERSION} needs review`;
  return `Not yet accepted (current v${NOTICE_VERSION})`;
}
function noticeMaybeShow() {
  const s = noticeStamp();
  if (s && s.v === NOTICE_VERSION) return;
  const p = document.getElementById("noticePrevAccept");
  if (p) p.textContent = s ? `Notice updated since you accepted ${s.v || "?"} on ${fmtDate(s.ts)} — please review.` : "";
  openModal("mNotice");
}
function noticeShow() {
  const p = document.getElementById("noticePrevAccept");
  if (p) p.textContent = "";
  openModal("mNotice");
}
function noticeAccept() {
  DB.settings = DB.settings || {};
  DB.settings.notice = { v: NOTICE_VERSION, ts: todayISO() };
  auditSafe("Privacy notice", `Accepted ${NOTICE_VERSION}`);
  save(); loadSettings(); closeModal("mNotice");
}

/* E2c: delegated actions for templates in this file. */
try {
  ["noticeShow", "noticeAccept"].forEach(function (n) { actCall0(n); });
} catch (e) {}

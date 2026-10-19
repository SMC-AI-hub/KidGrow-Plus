/* NeoKid Care — tiered alerts engine (Phase 1 infra).
   Tiers: info (note), warn (caution), hard (blocks the action — ONLY for
   genuinely dangerous errors: probable 10x dose, allergy match,
   contraindicated drug). Dismissals need a reason and are audit-logged. */
const _AL = { seq: 0, active: [] };
function alertRaise(tier, code, msg, ctx) {
  tier = tier === "hard" ? "hard" : tier === "warn" ? "warn" : "info";
  const a = { id: "al" + (++_AL.seq), tier, code: code || "", msg: String(msg || ""), ctx: ctx || null, t: new Date().toISOString(), dismissed: null };
  _AL.active.push(a);
  try {
    const line = (tier === "hard" ? "⛔ " : tier === "warn" ? "⚠️ " : "ℹ️ ") + a.msg;
    if (tier === "hard" && typeof alert === "function") alert(line);
    else if (typeof toast === "function") toast(line);
  } catch (e) {}
  try {
    if (typeof auditSafe === "function") auditSafe("Alert-" + tier, (code ? code + ": " : "") + a.msg);
    else if (typeof log === "function") log("Alert-" + tier, a.msg);
  } catch (e2) {}
  return { id: a.id, tier, blocked: tier === "hard" };
}
function alertDismiss(id, reason) {
  const a = _AL.active.find((x) => x.id === id);
  if (!a) return false;
  a.dismissed = { reason: reason || "", t: new Date().toISOString() };
  try {
    const line = `${a.code || a.tier} dismissed — ${reason || "no reason given"}`;
    if (typeof auditSafe === "function") auditSafe("Alert dismissed", line);
    else if (typeof log === "function") log("Alert dismissed", line);
  } catch (e) {}
  return true;
}
function alertList() { return _AL.active.slice(); }
var Alerts = { raise: alertRaise, dismiss: alertDismiss, list: alertList };
try { if (typeof window !== "undefined" && window) window.Alerts = Alerts; } catch (e) {}

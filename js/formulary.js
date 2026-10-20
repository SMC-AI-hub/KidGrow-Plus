/* =====================================================================
   NeoKid Care — Formulary review workflow (C1, partial): per-drug source +
   edition tracking with pharmacist sign-off. Reviews live in
   DB.formularyReviews (local-first; server mirror is M8 scope).
   DrugPure.validateDrug checks STRUCTURAL integrity only — it never
   certifies clinical correctness. Only an approved human review marks a
   drug verified, and only M7 pharmacist UAT closes C1.
   ===================================================================== */
(function () {
"use strict";

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

/* ---------------- pures (tested) ---------------- */
function validateDrug(d) {
  d = d || {};
  var issues = [];
  if (!d.id || !d.name) issues.push("missing id/name");
  var hasBasis = d.mgkg || d.info || d.ageBandsY || d.ageBandsM || d.wtBands;
  if (!hasBasis) issues.push("no dosing basis (mgkg/bands/info)");
  if (!d.info && (!Array.isArray(d.strengths) || !d.strengths.length)) issues.push("no strengths");
  if (!Array.isArray(d.allergy)) issues.push("allergy keywords missing (use [] if none)");
  if (d.freqs && d.defFreq && d.freqs.indexOf(d.defFreq) < 0) issues.push("defFreq not in freqs");
  if (d.mgkg && !d.perDay && !(+d.maxDose > 0)) issues.push("no max single dose");
  if (d.perDay && !(+d.maxDaily > 0)) issues.push("no max daily dose");
  return issues;
}
function validateReview(r) {
  r = r || {};
  var errs = [];
  if (!String(r.source || "").trim()) errs.push("reference source is required (e.g. Nelson 22e)");
  if (!String(r.edition || "").trim()) errs.push("edition/version is required");
  if (!String(r.by || "").trim()) errs.push("reviewer name is required");
  if (["approved", "flagged"].indexOf(r.verdict) < 0) errs.push("verdict must be approved or flagged");
  return errs;
}
function reviewStatus(drugId, reviews) {
  var r = (reviews || {})[drugId];
  return r && r.verdict === "approved" ? "reviewed" : "pending";
}
function pendingList(drugs, reviews) {
  return (drugs || []).filter(function (d) { return reviewStatus(d.id, reviews) !== "reviewed"; });
}
window.DrugPure = {
  validateDrug: validateDrug, validateReview: validateReview,
  reviewStatus: reviewStatus, pendingList: pendingList
};

/* ---------------- live ---------------- */
function reviewsOf() {
  if (typeof DB === "undefined") return {};
  if (!DB.formularyReviews || typeof DB.formularyReviews !== "object") DB.formularyReviews = {};
  return DB.formularyReviews;
}
function formularyStatus(drugId) {
  try { return reviewStatus(drugId, reviewsOf()); } catch (e) { return "pending"; }
}
window.formularyStatus = formularyStatus;

function renderFormulary() {
  var box = $("formularyBox"); if (!box || typeof DRUGS === "undefined") return;
  var R = reviewsOf();
  var pend = pendingList(DRUGS, R);
  var rows = DRUGS.map(function (d) {
    var st = reviewStatus(d.id, R), r = R[d.id] || {};
    var struct = validateDrug(d);
    return "<tr><td><b>" + esc(d.name) + "</b><br><span style='font-size:11px;color:var(--muted)'>" + esc(d.cat || "") + "</span></td>" +
      "<td>" + (st === "reviewed" ? "✅" : "⚠️ pending") + (struct.length ? "<br><span style='font-size:11px;color:var(--red)'>structural: " + esc(struct.join("; ")) + "</span>" : "") + "</td>" +
      "<td style='font-size:12px'>" + (r.source ? esc(r.source) + " " + esc(r.edition || "") + "<br>" + esc(r.by || "") + " " + esc(String(r.at || "").slice(0, 10)) : "—") + "</td></tr>";
  }).join("");
  var opts = DRUGS.map(function (d) { return "<option value='" + d.id + "'>" + esc(d.name) + "</option>"; }).join("");
  box.innerHTML = "<div class='card'><h3>📚 Formulary review (" + (DRUGS.length - pend.length) + "/" + DRUGS.length + " reviewed)</h3>" +
    "<div class='hint'>Unreviewed drugs show ⚠️ in the prescription picker. Reviews are pharmacist sign-offs against a named reference — they do not replace M7 UAT.</div>" +
    "<div class='form-grid'><div><label>Drug</label><select id='frDrug'>" + opts + "</select></div>" +
    "<div><label>Reference source</label><input id='frSource' placeholder='e.g. Nelson Textbook of Pediatrics'></div>" +
    "<div><label>Edition / version</label><input id='frEdition' placeholder='e.g. 22e (2024)'></div>" +
    "<div><label>Reviewer</label><input id='frBy' placeholder='pharmacist name'></div>" +
    "<div><label>Verdict</label><select id='frVerdict'><option value='approved'>Approved</option><option value='flagged'>Flagged (needs fix)</option></select></div>" +
    "<div><label>Note</label><input id='frNote' placeholder='optional'></div></div>" +
    "<button class='btn btn-p btn-sm' style='margin-top:8px' data-act='saveFormularyReview'>Save review</button></div>" +
    "<div class='card'><table class='tbl'><tr><th>Drug</th><th>Status</th><th>Review</th></tr>" + rows + "</table></div>";
}
window.renderFormulary = renderFormulary;

window.saveFormularyReview = function () {
  if (typeof needSafe === "function" && !needSafe(2, "review formulary")) return;
  var r = {
    source: $("frSource").value.trim(), edition: $("frEdition").value.trim(),
    by: $("frBy").value.trim(), verdict: $("frVerdict").value, note: $("frNote").value.trim(),
    at: new Date().toISOString()
  };
  var errs = validateReview(r);
  if (errs.length) { alert(errs.join("\n")); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("formulary")) return;
  reviewsOf()[$("frDrug").value] = r;
  try { if (typeof auditSafe === "function") auditSafe("Formulary review", $("frDrug").value + " " + r.verdict + " by " + r.by); } catch (e) {}
  save(); renderAll();
};

})();

/* E2c: delegated actions for templates in this file. */
try {
  ["saveFormularyReview"].forEach(function (n) { actCall0(n); });
} catch (e) {}

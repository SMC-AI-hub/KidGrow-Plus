/* =====================================================================
   NeoKid Care — M5 validated clinical calculators: maintenance fluids
   (Holliday–Segar + neonatal day-of-life), feed volumes, calorie goals.
   Every result carries {value, capped, warnings[]} or {error} — outputs
   are never bare numbers, and every input is range-checked. Pures in
   window.CalcPure are unit-tested. Guidance only — confirm all orders.
   ===================================================================== */
(function () {
"use strict";

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function num(x) { var n = parseFloat(x); return isNaN(n) ? null : n; }
function r1(x) { return Math.round(x * 10) / 10; }

/* ---------------- pures (tested) ---------------- */
// Holliday–Segar 4-2-1 for children beyond the neonatal period.
function fluidsHS(wtKg) {
  var w = num(wtKg), warnings = [];
  if (w == null || w <= 0 || w > 200) return { error: "weight must be 0–200 kg" };
  var perDay;
  if (w <= 10) perDay = w * 100;
  else if (w <= 20) perDay = 1000 + (w - 10) * 50;
  else perDay = 1500 + (w - 20) * 20;
  var capped = false;
  if (perDay > 2400) { perDay = 2400; capped = true; warnings.push("capped at adult ceiling 2400 mL/day — confirm"); }
  if (w > 50) warnings.push("adult-range weight — confirm rate with senior");
  return { mlPerDay: Math.round(perDay), mlPerHour: r1(perDay / 24), capped: capped, warnings: warnings, method: "Holliday–Segar 4-2-1" };
}
// Neonatal fluids by day of life (term; ml/kg/day).
function fluidsNeonatal(wtKg, dol) {
  var w = num(wtKg), d = num(dol), warnings = [];
  if (w == null || w <= 0.3 || w > 8) return { error: "neonatal weight must be 0.3–8 kg" };
  if (d == null || d < 1 || d > 60) return { error: "day of life must be 1–60" };
  d = Math.floor(d);
  var perKg = d <= 1 ? 70 : d === 2 ? 90 : d === 3 ? 110 : d === 4 ? 130 : d <= 6 ? 145 : 160;
  if (w < 1.5) warnings.push("VLBW — fluids highly individualised; senior review required");
  if (d <= 2) warnings.push("restrictive early fluids — monitor weight, Na⁺, urine output");
  return { mlPerKg: perKg, mlPerDay: Math.round(w * perKg), mlPerHour: r1((w * perKg) / 24), capped: false, warnings: warnings, method: "neonatal day-of-life" };
}
// Feed volume splits for a ml/kg/day target.
function feedVolume(wtKg, mlPerKg) {
  var w = num(wtKg), t = num(mlPerKg);
  if (w == null || w <= 0.3 || w > 60) return { error: "weight must be 0.3–60 kg" };
  if (t == null || t <= 0 || t > 220) return { error: "target must be 1–220 mL/kg/day" };
  var total = Math.round(w * t), warnings = [];
  if (t > 180) warnings.push("above usual 180 mL/kg/day ceiling — confirm indication");
  return { totalMl: total, q2h: Math.round(total / 12), q3h: Math.round(total / 8), q4h: Math.round(total / 6), capped: false, warnings: warnings };
}
// Calorie/protein goals (enteral, growing preterm/term).
function nutritionGoal(wtKg, preterm) {
  var w = num(wtKg);
  if (w == null || w <= 0.3 || w > 60) return { error: "weight must be 0.3–60 kg" };
  var kcalKg = preterm ? 120 : 110, protKg = preterm ? 3.2 : 2.2;
  return {
    kcalPerDay: Math.round(w * kcalKg), proteinGPerDay: r1(w * protKg),
    kcalPerKg: kcalKg, proteinPerKg: protKg, capped: false,
    warnings: preterm ? ["preterm goal 110–135 kcal/kg, protein 3–4 g/kg — adjust to growth"] : ["term goal 100–120 kcal/kg — adjust to growth"]
  };
}
window.CalcPure = { fluidsHS: fluidsHS, fluidsNeonatal: fluidsNeonatal, feedVolume: feedVolume, nutritionGoal: nutritionGoal };

/* ---------------- UI ---------------- */
function warnList(w) {
  return (w || []).map(function (x) { return "<div style='font-size:12.5px'>⚠️ " + esc(x) + "</div>"; }).join("");
}
function renderCalc() {
  var box = $("calcBox"); if (!box) return;
  var c = null;
  try { c = (typeof window.child === "function") ? window.child() : null; } catch (e) {}
  var lm = null;
  try { lm = c && typeof latestMeasure === "function" ? latestMeasure(c) : null; } catch (e) {}
  var defWt = (lm && lm.wt) || (c && c.birthWt) || "";
  box.innerHTML = "<div class='card'><h3>🧮 Clinical calculators</h3>" +
    "<div class='hint'>Guidance only — confirm every order. " + (c ? "Active child: <b>" + esc(c.name) + "</b>" : "No child selected.") + "</div>" +
    "<div class='form-grid'><div><label>Weight (kg)</label><input type='number' step='0.01' id='ccWt' value='" + esc(defWt) + "'></div>" +
    "<div><label>Day of life (neonatal)</label><input type='number' id='ccDol' placeholder='e.g. 3'></div>" +
    "<div><label>Feed target (mL/kg/day)</label><input type='number' id='ccFeed' value='160'></div>" +
    "<div><label>Preterm?</label><select id='ccPre'><option value=''>Term</option><option value='1'>Preterm</option></select></div></div>" +
    "<button class='btn btn-p btn-sm' style='margin-top:8px' data-act='runCalc'>Calculate</button></div><div id='ccOut'></div>";
}
window.renderCalc = renderCalc;

window.runCalc = function () {
  var out = $("ccOut"); if (!out) return;
  var wt = $("ccWt").value, dol = $("ccDol").value || 7, feed = $("ccFeed").value, pre = $("ccPre").value === "1";
  function card(title, r, body) {
    if (!r || r.error) return "<div class='card'><h3>" + title + "</h3><div class='hint'>❌ " + esc((r && r.error) || "?") + "</div></div>";
    return "<div class='card'><h3>" + title + "</h3><div style='font-size:20px;font-weight:700'>" + body + "</div>" +
      "<div class='hint'>" + esc(r.method || "") + (r.capped ? " · capped" : "") + "</div>" + warnList(r.warnings) + "</div>";
  }
  var hs = fluidsHS(wt), neo = fluidsNeonatal(wt, dol), fv = feedVolume(wt, feed), ng = nutritionGoal(wt, pre);
  out.innerHTML =
    card("💧 Maintenance fluids (child)", hs, hs.error ? "" : hs.mlPerDay + " mL/day · " + hs.mlPerHour + " mL/hr") +
    card("👶 Neonatal fluids (day " + esc(dol) + ")", neo, neo.error ? "" : neo.mlPerKg + " mL/kg → " + neo.mlPerDay + " mL/day · " + neo.mlPerHour + " mL/hr") +
    card("🍼 Feed splits", fv, fv.error ? "" : fv.totalMl + " mL/day · q2h " + fv.q2h + " · q3h " + fv.q3h + " · q4h " + fv.q4h + " mL") +
    card("🥗 Nutrition goal" + (pre ? " (preterm)" : ""), ng, ng.error ? "" : ng.kcalPerDay + " kcal/day · " + ng.proteinGPerDay + " g protein/day");
};

})();

/* E2c: delegated actions for templates in this file. */
try {
  ["runCalc"].forEach(function (n) { actCall0(n); });
} catch (e) {}

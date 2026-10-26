/* =====================================================================
   NeoKid Care — M5 NICU longitudinal: admissions, daily rounds, discharge.
   Data lives on the child record (child.nicu.admissions[]) — synced to
   nicu_admissions/nicu_rounds via apply_clinical_op(). Pure helpers in
   window.NicuPure are unit-tested. This module never deletes clinical rows
   from the UI (corrections are new rounds; tombstones exist only for sync).
   ===================================================================== */
(function () {
"use strict";

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function child() { try { return (typeof window.child === "function") ? window.child() : null; } catch (e) { return null; } }
function dayDiff(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5); }

/* ---------------- pures (tested) ---------------- */
function losDays(admittedISO, dischargedISO, todayISO) {
  var a = String(admittedISO || "").slice(0, 10) || todayISO;
  var d = dischargedISO ? String(dischargedISO).slice(0, 10) : todayISO;
  var n = dayDiff(a, d) + 1;
  return n >= 1 ? n : 1;
}
function activeAdmissions(admissions) {
  return (admissions || []).filter(function (a) { return a && a.status === "admitted"; });
}
function roundsDue(admissions, todayISO) {
  return activeAdmissions(admissions).filter(function (a) {
    return !(a.rounds || []).some(function (r) { return r && r.date === todayISO; });
  });
}
function admissionValid(a) {
  a = a || {};
  var errs = [];
  if (!a.admittedAt) errs.push("admission date/time is required");
  if (a.birthWtG != null && a.birthWtG !== "" && !(+a.birthWtG >= 300 && +a.birthWtG <= 8000)) errs.push("birth weight 300–8000 g");
  if (a.ga != null && a.ga !== "" && !(+a.ga >= 22 && +a.ga <= 45)) errs.push("gestation 22–45 weeks");
  return errs;
}
function dischargeValid(a) {
  a = a || {};
  var errs = [];
  if (a.status !== "admitted") errs.push("only an active admission can be discharged");
  if (!a.dischargedAt) errs.push("discharge date/time is required");
  if (!a.outcome) errs.push("outcome is required");
  if (a.admittedAt && a.dischargedAt && a.dischargedAt < a.admittedAt) errs.push("discharge cannot precede admission");
  return errs;
}
function roundValid(r, todayISO) {
  r = r || {};
  var errs = [];
  if (!r.date) errs.push("round date required");
  else if (r.date > todayISO) errs.push("round date cannot be in the future");
  if (r.wtG != null && r.wtG !== "" && !(+r.wtG >= 300 && +r.wtG <= 15000)) errs.push("weight 300–15000 g");
  try { // F15: central vitals ranges
    if (typeof V !== "undefined" && r.vitals) {
      const vv = V.checkVitals(r.vitals);
      vv.bad.forEach(function (w) { errs.push(w); });
    }
  } catch (e) {}
  return errs;
}
// Enteral feed advancement guide (term/m Late-preterm; ELBW individualised).
function feedGuide(dol, wtKg) {
  dol = Math.max(1, Math.min(60, +dol || 1));
  var target = dol <= 1 ? 20 : dol <= 3 ? 60 : dol <= 5 ? 110 : dol <= 7 ? 140 : 160;
  var total = Math.round((+wtKg || 0) * target);
  return {
    dol: dol, mlPerKg: target, goalMlPerKg: 160, maxMlPerKg: 180,
    totalMl: total, perFeedQ3h: Math.round(total / 8),
    note: dol <= 1 ? "trophic feeds — advance 20–30 mL/kg/day as tolerated" : target >= 160 ? "at goal — fortify per unit protocol if indicated" : "advancing — hold/reduce for residuals, distension, apnoea"
  };
}
function censusList(children) {
  var out = [];
  (children || []).forEach(function (c) {
    activeAdmissions((c.nicu || {}).admissions).forEach(function (a) { out.push({ child: c, adm: a }); });
  });
  return out;
}
function numG(v) { var n = +v; return (v == null || v === "" || isNaN(n)) ? null : n; }
function weightTrend(rounds) {
  var wts = (rounds || []).map(function (r) { return numG(r && r.wtG); }).filter(function (w) { return w != null; });
  if (!wts.length) return null;
  return { first: wts[0], last: wts[wts.length - 1], delta: wts[wts.length - 1] - wts[0] };
}
function eventsUnion(rounds) {
  var seen = {}, out = [];
  (rounds || []).forEach(function (r) {
    (r.events || []).forEach(function (e) {
      e = String(e || "").trim();
      if (e && !seen[e]) { seen[e] = 1; out.push(e); }
    });
  });
  return out;
}
function outcomeLabel(o) {
  return o === "stable" ? "Stable — discharged home"
    : o === "against advice" ? "Discharge against medical advice"
    : o === "referred" ? "Referred / transferred to higher centre"
    : o === "expired" ? "Expired" : (o || "—");
}
// null for active admissions — summaries print only after discharge.
function dischargeSummaryData(c, adm, today) {
  if (!adm || adm.status === "admitted") return null;
  var rounds = adm.rounds || [];
  return {
    admitted: String(adm.admittedAt || "").slice(0, 10),
    discharged: String(adm.dischargedAt || "").slice(0, 10),
    los: losDays(adm.admittedAt, adm.dischargedAt, today),
    nRounds: rounds.length,
    wt: weightTrend(rounds),
    events: eventsUnion(rounds),
    outcome: adm.outcome || ""
  };
}
function roundRowsHTML(rounds, gaWk) {
  return (rounds || []).map(function (r) {
    return "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.wtG || "—") + "</td><td>" + esc(roundRespChip(r) || "—") + "</td><td>" + esc(roundBiliChip(r, gaWk) || "—") + "</td><td>" + esc((r.feeds && r.feeds.totalMl) || "—") + "</td><td>" + esc((r.events || []).join(", ") || "—") + "</td><td>" + esc(r.note || "") + "</td></tr>";
  }).join("");
}
function dischargeSummaryHTML(c, adm, d) {
  if (!d) return "";
  var wtLine = d.wt
    ? ("First recorded " + d.wt.first + " g → last " + d.wt.last + " g (" + (d.wt.delta >= 0 ? "+" : "") + d.wt.delta + " g)")
    : "No weights recorded";
  return clinicHeader() + childHeader(c)
    + "<div class='doc-title'>NICU discharge summary</div>"
    + "<dl class='kv'><dt>Admitted</dt><dd>" + esc(fmtDate(d.admitted)) + " · " + esc(adm.indication || "—") + "</dd>"
    + "<dt>Discharged</dt><dd>" + esc(fmtDate(d.discharged)) + " · LOS " + d.los + " day(s) · " + d.nRounds + " round(s)</dd>"
    + "<dt>Birth wt / GA</dt><dd>" + (adm.birthWtG ? esc(String(adm.birthWtG)) + " g" : "—") + (adm.ga ? " · " + esc(String(adm.ga)) + " wk" : "") + "</dd>"
    + "<dt>Weight course</dt><dd>" + esc(wtLine) + "</dd>"
    + "<dt>Events</dt><dd>" + (d.events.length ? esc(d.events.join(", ")) : "none recorded") + "</dd>"
    + "<dt>Outcome</dt><dd><b>" + esc(outcomeLabel(d.outcome)) + "</b></dd></dl>"
    + ((adm.rounds || []).length ? "<table class='tbl'><tr><th>Date</th><th>Wt(g)</th><th>Resp</th><th>Bili</th><th>Feeds(mL)</th><th>Events</th><th>Note</th></tr>" + roundRowsHTML(adm.rounds, adm.ga) + "</table>" : "")
    + (adm.fuNote ? "<div style='margin-top:10px;font-size:13.5px'><b>Follow-up:</b> " + esc(adm.fuNote) + "</div>" : "")
    + docFooter("NICU discharge summary");
}
function handoverHTML(entries, today) {
  var head = clinicHeader() + "<div class='doc-title'>NICU shift handover — " + esc(fmtDate(today)) + "</div>";
  if (!entries || !entries.length) {
    return head + "<div class='card'><div class='hint'>No active NICU admissions — census is clear.</div></div>" + docFooter("NICU handover");
  }
  var rows = entries.map(function (e) {
    var c = e.child, a = e.adm, rounds = a.rounds || [], last = rounds[rounds.length - 1] || null;
    var due = !rounds.some(function (r) { return r && r.date === today; });
    var dol = (c.dob && today) ? (dayDiff(c.dob, today) + 1) : "—";
    var lastCell = last
      ? esc(last.date) + " · " + (last.wtG ? esc(String(last.wtG)) + " g" : "no wt") + ((last.feeds && last.feeds.totalMl) ? " · " + esc(String(last.feeds.totalMl)) + " mL" : "") + (roundRespChip(last) ? " · " + esc(roundRespChip(last)) : "") + (function () { var _bc = roundBiliChip(last, a.ga); return _bc ? " · " + esc(_bc) : ""; })() + ((last.events || []).length ? "<br>" + esc(last.events.join(", ")) : "")
      : "no rounds yet";
    return "<tr><td><b>" + esc(c.name) + "</b><br><span style='font-size:12px'>DOL " + dol + " · day " + losDays(a.admittedAt, null, today) + "</span></td>"
      + "<td>" + esc(a.indication || "—") + "<br><span style='font-size:12px'>" + (a.birthWtG ? esc(String(a.birthWtG)) + " g" : "") + (a.ga ? " · " + esc(String(a.ga)) + " wk" : "") + "</span></td>"
      + "<td style='font-size:12.5px'>" + lastCell + "</td>"
      + "<td>" + (due ? "<b style='color:var(--red)'>round due</b>" : "✅") + "</td></tr>";
  }).join("");
  return head + "<table class='tbl'><tr><th>Baby</th><th>Indication</th><th>Last round</th><th>Status</th></tr>" + rows + "</table>" + docFooter("NICU handover");
}
function nicuPack() { try { return (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT.nicu) || null; } catch (e) { return null; } }
function dolOf(dobISO, dateISO) {
  try {
    if (!dobISO || !dateISO) return null;
    var n = dayDiff(String(dobISO).slice(0, 10), String(dateISO).slice(0, 10)) + 1;
    return n >= 1 ? n : 1;
  } catch (e) { return null; }
}
function biliRowFor(ageHrs) {
  var P = nicuPack(); var rows = (P && P.biliTerm) || [];
  var h = +ageHrs; if (!(h >= 0) || !rows.length) return null;
  var best = rows[0];
  for (var i = 0; i < rows.length; i++) { if (rows[i].h <= h) best = rows[i]; }
  return best;
}
// NICE CG98: term table (>=38wk); preterm (F25-P1): 72-336h GAx10-100 / GAx10,
// <72h straight line from 40 (photo) / 80 (exchange) at 0h to the 72h values,
// >336h (day 14): formula not validated -> unit protocol, no line drawn.
function biliThreshold(gaWk, ageHrs) {
  var ga = (gaWk == null || gaWk === "") ? null : +gaWk;
  var h = +ageHrs;
  if (!(h >= 0)) return null;
  if (ga == null || isNaN(ga)) return { note: "Record gestation to interpret bilirubin." };
  if (ga >= 38) { var r = biliRowFor(h); return r ? { repeat: r.repeat, consider: r.consider, photo: r.photo, exchange: r.exchange, preterm: false } : null; }
  if (h > 336) return { note: "Preterm beyond day 14 (336h) — lines validated to day 14 only; use unit protocol." };
  var photo72 = Math.round(ga * 10 - 100), exch72 = Math.round(ga * 10), photo, exchange;
  if (h >= 72) { photo = photo72; exchange = exch72; }
  else {
    photo = Math.round(40 + (photo72 - 40) * h / 72);
    exchange = Math.round(80 + (exch72 - 80) * h / 72);
  }
  return { repeat: null, consider: null, photo: photo, exchange: exchange, preterm: true };
}
/* G3: jaundice guideline modes (NICE CG98 + IAP STG 2022 + NNF CPG 2019).
   Thresholds stay shared (NICE table / preterm formula); modes change only
   sub-threshold advice, monitoring cadence and follow-up timing. */
function biliMode() {
  try {
    if (typeof guideEffective === "function") {
      var m = guideEffective("bili");
      if (m === "iap" || m === "nnf") return m;
    }
  } catch (e) {}
  return "nice"; /* aap falls through to nice until the G5 engine lands */
}
function biliGPack() { try { var P = nicuPack(); return (P && P.biliGuides) || null; } catch (e) { return null; } }
function biliRiskDef(id) {
  var risks = (biliGPack() || {}).risks || [];
  for (var i = 0; i < risks.length; i++) if (risks[i].id === id) return risks[i];
  return null;
}
/* Checked risks relevant to one mode; preterm <38wk auto-counts for iap/nnf. */
function biliModeRisks(risks, gaWk, flag) {
  var out = [], seen = {};
  (risks || []).forEach(function (id) {
    var d = biliRiskDef(id);
    if (d && d[flag] && !seen[id]) { seen[id] = 1; out.push(id); }
  });
  var G = biliGPack();
  if ((flag === "iap" || flag === "nnf") && G && G.autoPreterm38 && gaWk != null && gaWk !== "" && +gaWk < 38 && !seen.preterm38) out.push("preterm38");
  return out;
}
/* NICE sub-threshold path: Table-1 wording by default; 1.4.1/1.4.2 branch
   only when the full context is known (well baby, >24h, term). */
function biliNiceSub(v, gaWk, h, t, cx) {
  var G = biliGPack() || {};
  var R = G.nice141 || { riskHrs: 18, noRiskHrs: 24, minHrs: 24, minGa: 38 };
  var ctx = cx.well === true && h > R.minHrs && gaWk != null && gaWk !== "" && +gaWk >= R.minGa;
  if (t.consider != null && v > t.consider) {
    if (ctx) {
      var rr = biliModeRisks(cx.risks, gaWk, "nice141");
      var hrs = rr.length ? R.riskHrs : R.noRiskHrs;
      var why = rr.length ? "risk factors present" : "no risk factors";
      return { band: "consider", tier: "info", text: "Bilirubin " + v + " within 50 of phototherapy line (" + t.photo + ") — repeat in " + hrs + "h (" + why + ") [NICE 1.4.1].", src: "nice" };
    }
    return { band: "consider", tier: "info", text: "Bilirubin " + v + " in consider-phototherapy zone (>" + t.consider + ") — repeat in 6h.", src: "nice" };
  }
  if (t.repeat != null && v > t.repeat) {
    if (ctx) return { band: "repeat", tier: "info", text: "Bilirubin " + v + " >50 below phototherapy line — do not routinely repeat [NICE 1.4.2].", src: "nice" };
    return { band: "repeat", tier: "info", text: "Bilirubin " + v + " above repeat line (>" + t.repeat + ") — repeat in 6-12h.", src: "nice" };
  }
  return null;
}
/* IAP STG 2022 sub-threshold path (Ch-079: timing, follow-up, <24h urgency). */
function biliIapSub(v, gaWk, h, t, cx) {
  var G = biliGPack() || {};
  var IAP = G.iap || { followRiskHrs: 24, followNoRiskHrs: 48 };
  if (h < 24) return { band: "severe", tier: "warn", text: "Jaundice <24h (" + v + ") — urgent workup; start phototherapy after sending TSB; refer early to an exchange-capable centre [IAP].", src: "iap" };
  var risks = biliModeRisks(cx.risks, gaWk, "iap");
  if (risks.length) return { band: "followup", tier: "info", text: "Bilirubin " + v + " below line (photo " + t.photo + ") — IAP: review within " + IAP.followRiskHrs + "h (risk: " + risks.join(", ") + ").", src: "iap" };
  if (h <= 72) return { band: "followup", tier: "info", text: "Bilirubin " + v + " below line (photo " + t.photo + ") — IAP: review within " + IAP.followNoRiskHrs + "h.", src: "iap" };
  return { band: "followup", tier: "info", text: "Bilirubin " + v + " below line (photo " + t.photo + ") — IAP: routine follow-up.", src: "iap" };
}
/* NNF CPG 2019 sub-threshold path (TcB confirmation, near-exchange cadence). */
function biliNnfSub(v, gaWk, h, t, cx) {
  var G = biliGPack() || {};
  var N = G.nnf || { tcbMargin: 50, nearExchangeMargin: 50, monitorNear: "4-6h", monitorDeclining: "8-12h" };
  if (cx.kind === "tcb" && Math.abs(v - t.photo) <= N.tcbMargin)
    return { band: "confirm", tier: "info", text: "TcB " + v + " within " + N.tcbMargin + " of phototherapy line (" + t.photo + ") — confirm with TSB [NNF].", src: "nnf" };
  if (t.exchange != null && v >= t.exchange - N.nearExchangeMargin) {
    var decl = cx.prevUmol != null && isFinite(+cx.prevUmol) && v < +cx.prevUmol;
    var every = decl ? N.monitorDeclining : N.monitorNear;
    return { band: "monitor", tier: "info", text: "Bilirubin " + v + " near exchange level (" + t.exchange + ")" + (decl ? ", declining" : "") + " — TSB every " + every + " on intensive phototherapy [NNF].", src: "nnf" };
  }
  return { band: "observe", tier: "info", text: "Bilirubin " + v + " below line (photo " + t.photo + ") — visual assessment every 12h, first 3-5 days [NNF].", src: "nnf" };
}
/* G3: contextual advice lines appended to the bili chip (stop, rebound,
   TSB-during-photo, MoHFW follow-up grid). Pure given its inputs. */
function biliAdvise(tsbUmol, gaWk, ageHrs, x) {
  var lines = [];
  try {
    var v = +tsbUmol, h = +ageHrs; if (!(v > 0) || !(h >= 0)) return lines;
    var t = biliThreshold(gaWk, ageHrs);
    if (!t || t.note || t.photo == null) return lines;
    var mode = biliMode(), cx = x || {};
    var G = biliGPack() || {};
    var N = G.nnf || {}, F = G.mohfwFollowup || {};
    var onPhoto = cx.photo === "on", offPhoto = cx.photo === "off";
    var haem = cx.haem === true;
    var st = biliStop(v, gaWk, h, haem);
    if (st.stop && onPhoto) {
      if (mode === "nnf") lines.push(haem ? "consider stopping — 2nd consecutive value ≥" + st.margin + " below line needed (haemolytic) [NNF]" : "consider stopping — ≥" + st.margin + " below line, single value sufficient (non-haemolytic) [NNF]");
      else if (mode === "iap") lines.push("consider stopping — ≥" + st.margin + " below line (IAP stop 2-3 mg/dL below range) [IAP]");
      else lines.push("consider stopping — ≥" + st.margin + " below phototherapy line [NICE 1.4.5]");
    }
    if (offPhoto) {
      if (mode === "nnf" && haem) lines.push("repeat TSB in " + (N.postStopWindow || "12-24h") + " to check rebound (haemolysis) [NNF]");
      else if (mode === "iap" && haem) lines.push("follow-up bilirubin within 24h (haemolytic / stopped early) [IAP]");
      else if (mode === "nice") lines.push("rebound TSB in 12-18h after stopping [NICE 1.4.6]");
    }
    if (cx.kind === "tcb" && onPhoto) {
      if (mode === "nnf") lines.push("use TSB (not TcB) for all decisions during phototherapy [NNF]");
      else if (mode === "iap") lines.push("confirm by TSB before acting during phototherapy [IAP]");
      else lines.push("use TSB (not TcB) for all decisions during phototherapy [NICE 1.2.16]");
    }
    if (mode === "nnf" && t.exchange != null && v >= t.exchange - (N.nearExchangeMargin || 50) && v <= t.exchange) {
      var decl2 = cx.prevUmol != null && isFinite(+cx.prevUmol) && v < +cx.prevUmol;
      lines.push("near exchange level (" + t.exchange + ")" + (decl2 ? ", declining" : "") + " — TSB every " + (decl2 ? (N.monitorDeclining || "8-12h") : (N.monitorNear || "4-6h")) + " on intensive phototherapy [NNF]");
    }
    if (mode === "iap" && onPhoto && v > t.photo) lines.push("repeat TSB after 4-6h of phototherapy — no 1-2 mg/dL fall = photo failure, escalate [IAP/MoHFW]");
    if (mode === "nnf" && h >= 24 && v <= t.photo) {
      var risks = biliModeRisks(cx.risks, gaWk, "nnf");
      if (risks.length) lines.push("follow-up: review " + (h < (F.riskEarlyH || 48) ? (F.riskEarlyVisit || "24h") : (F.riskLateVisit || "48h")) + " after discharge (risk factors) [NNF/MoHFW]");
      else if (h >= (F.noRiskMinH || 24) && h <= (F.noRiskMaxH || 72)) lines.push("follow-up: review " + (F.noRiskVisit || "48h") + " after discharge [NNF/MoHFW]");
      else if (h > (F.noRiskMaxH || 72)) lines.push("follow-up: " + (F.lateVisit || "optional") + " after discharge (no risk factors) [NNF/MoHFW]");
    }
    try {
      if (typeof guideEffective === "function" && guideEffective("bili") === "aap") lines.push("AAP 2022 engine lands in G5 — thresholds above are NICE meanwhile.");
    } catch (e) {}
  } catch (e) {}
  return lines;
}
function biliRiskChecksHTML() {
  try {
    var risks = (biliGPack() || {}).risks || [];
    return risks.map(function (d) {
      return "<label style='font-weight:normal'><input type='checkbox' class='nrRisk' value='" + esc(d.id) + "'> " + esc(d.label) + "</label>";
    }).join("");
  } catch (e) { return ""; }
}
function biliFormSrcLabel() {
  try { var m = biliMode(); return m === "iap" ? "NICE line · IAP advice" : m === "nnf" ? "NICE line · NNF advice" : "NICE CG98"; } catch (e) { return "NICE CG98"; }
}
function biliFormPendBadge() {
  try {
    if (typeof guidePending === "function" && guidePending("bili") && typeof GUIDE_META !== "undefined" && GUIDE_META.bili) {
      var pend = guidePending("bili");
      var lab = ((GUIDE_META.bili.modes || []).filter(function (m) { return m.id === pend; })[0] || {}).label || pend;
      return " <span title='Requested mode awaiting sign-off'>⏳ " + esc(lab) + " requested — pending sign-off</span>";
    }
  } catch (e) {}
  return "";
}
function biliCheckedRisks() {
  var out = [];
  try {
    var boxes = document.querySelectorAll(".nrRisk:checked");
    for (var i = 0; i < boxes.length; i++) out.push(boxes[i].value);
  } catch (e) {}
  return out;
}
function biliFlag(tsbUmol, gaWk, ageHrs, x) {
  var v = +tsbUmol; if (!(v > 0)) return null;
  var t = biliThreshold(gaWk, ageHrs);
  if (!t || t.note || t.photo == null) return t && t.note ? { band: "info", tier: "info", text: t.note } : null;
  var mode = biliMode(), cx = x || {};
  if (t.exchange != null && v > t.exchange) return { band: "exchange", tier: "warn", text: "Bilirubin " + v + " above EXCHANGE level (" + t.exchange + ") — urgent senior review.", src: mode };
  if (v > t.photo) return { band: "photo", tier: "warn", text: "Bilirubin " + v + " above phototherapy line (" + t.photo + ") — start/reassess phototherapy.", src: mode };
  if (mode === "iap") return biliIapSub(v, gaWk, ageHrs, t, cx);
  if (mode === "nnf") return biliNnfSub(v, gaWk, ageHrs, t, cx);
  return biliNiceSub(v, gaWk, ageHrs, t, cx);
}
// F25-P2: stop-phototherapy margin — stop CONSIDERED when TSB is >= margin
// (pack biliStopMargin, 50 umol/L ~ NNF 2.9 mg/dL) BELOW the photo line.
// G3: haem=true (NNF 1) needs a 2nd consecutive value — needsTwo says so.
function biliStop(tsbUmol, gaWk, ageHrs, haem) {
  var out = { stop: false, margin: null, line: null, needsTwo: false };
  try {
    var v = +tsbUmol; if (!(v > 0)) return out;
    var t = biliThreshold(gaWk, ageHrs);
    if (!t || t.photo == null) return out;
    var P = nicuPack(); var m = (P && P.biliStopMargin) || 50;
    out.line = t.photo; out.margin = m;
    out.stop = v <= t.photo - m;
    out.needsTwo = out.stop && haem === true;
  } catch (e) {}
  return out;
}
function biliRise(prevTsb, prevHrs, tsb, hrs) {
  var out = { rate: null, rapid: false };
  try {
    var P = nicuPack(); var cut = (P && P.biliRiseRate) || 8.5;
    var dt = (+hrs) - (+prevHrs);
    if (dt > 0 && isFinite(+prevTsb) && isFinite(+tsb)) {
      out.rate = Math.round(((+tsb) - (+prevTsb)) / dt * 10) / 10;
      out.rapid = out.rate > cut;
    }
  } catch (e) {}
  return out;
}
function fluidGuide(dol, gaWk, wtKg) {
  try {
    var P = nicuPack(); if (!P || !P.fluids) return null;
    var d = +dol, ga = (gaWk == null || gaWk === "") ? null : +gaWk, wt = +wtKg;
    if (!(d >= 1) || !(wt > 0)) return null;
    var band = (ga == null || ga >= 37) ? "term" : ga >= 32 ? "preterm32_36" : null;
    if (!band) return { note: "<32 weeks — individualise fluids (see unit protocol)." };
    var row = null;
    for (var i = 0; i < P.fluids[band].length; i++) { if (d <= P.fluids[band][i][0]) { row = P.fluids[band][i]; break; } }
    if (!row) row = P.fluids[band][P.fluids[band].length - 1];
    return { band: band, lo: row[1], hi: row[2], totalLo: Math.round(wt * row[1]), totalHi: Math.round(wt * row[2]) };
  } catch (e) { return null; }
}
function sepsisAbxDays(abxStartISO, todayISO) {
  try {
    if (!abxStartISO || !todayISO) return null;
    var n = dayDiff(String(abxStartISO).slice(0, 10), String(todayISO).slice(0, 10)) + 1;
    return n >= 1 ? n : 1;
  } catch (e) { return null; }
}
function bundleScore(bundleId, checked) {
  var out = { done: 0, total: 0, pct: 0, misses: [] };
  try {
    var P = nicuPack(); var b = P && P.bundles && P.bundles[bundleId];
    if (!b) return out;
    out.total = b.items.length; checked = checked || {};
    b.items.forEach(function (label, i) {
      if (checked[i]) out.done++;
      else out.misses.push(label);
    });
    out.pct = out.total ? Math.round(out.done / out.total * 100) : 0;
  } catch (e) {}
  return out;
}
function boardSort(entries) {
  return (entries || []).slice().sort(function (x, y) {
    var bx = ((x.adm && x.adm.bed) || "~") + "", by = ((y.adm && y.adm.bed) || "~") + "";
    if (bx !== by) return bx < by ? -1 : 1;
    var nx = (x.child && x.child.name) || "", ny = (y.child && y.child.name) || "";
    return nx < ny ? -1 : nx > ny ? 1 : 0;
  });
}
function respModes() { try { var P = nicuPack(); return (P && P.respModes) || []; } catch (e) { return []; } }
function respLabel(modeId) {
  var m = respModes().filter(function (x) { return x.id === modeId; })[0];
  return m ? m.label : (modeId || "");
}
function respRank(modeId) {
  var m = respModes().filter(function (x) { return x.id === modeId; })[0];
  return m ? m.rank : 0;
}
function roundRespChip(r) {
  try {
    var rp = (r && r.resp) || {};
    if (!rp.mode) return "";
    var s = respLabel(rp.mode);
    if (rp.fio2) s += " " + rp.fio2 + "%";
    return s;
  } catch (e) { return ""; }
}
function roundBiliChip(r, gaWk) {
  try {
    var b = (r && r.bili) || {};
    var v = parseFloat(b.tsb); var h = parseFloat(b.ageHrs);
    if (!(v > 0) || !(h >= 0)) return "";
    var P = nicuPack(); var conv = (P && P.mgdlToUmol) || 17.1;
    var umol = (b.unit === "mgdl") ? Math.round(v * conv) : Math.round(v);
    var cx = { kind: b.kind, risks: b.risks, well: b.well, haem: b.haem, photo: b.photo };
    var f = biliFlag(umol, gaWk, h, cx);
    var adv = biliAdvise(umol, gaWk, h, cx);
    var s = "Bili " + v + (b.unit === "mgdl" ? "" : "\u00b5") + "@" + h + "h";
    if (f && f.tier === "warn") s = "\u26a0\ufe0f " + s;
    if (adv && adv.length) s += " \u00b7 " + adv.join("; ");
    return s;
  } catch (e) { return ""; }
}
window.NicuPure = {
  losDays: losDays, activeAdmissions: activeAdmissions, roundsDue: roundsDue,
  admissionValid: admissionValid, dischargeValid: dischargeValid, roundValid: roundValid,
  feedGuide: feedGuide, censusList: censusList,
  weightTrend: weightTrend, eventsUnion: eventsUnion, outcomeLabel: outcomeLabel,
  dischargeSummaryData: dischargeSummaryData, dischargeSummaryHTML: dischargeSummaryHTML,
  handoverHTML: handoverHTML,
  dolOf: dolOf, biliThreshold: biliThreshold, biliFlag: biliFlag, biliStop: biliStop, biliRise: biliRise,
  biliMode: biliMode, biliAdvise: biliAdvise, biliModeRisks: biliModeRisks,
  fluidGuide: fluidGuide, sepsisAbxDays: sepsisAbxDays, bundleScore: bundleScore,
  boardSort: boardSort, respLabel: respLabel, respRank: respRank,
  roundRespChip: roundRespChip, roundBiliChip: roundBiliChip
};

/* ---------------- data helpers ---------------- */
function nicuOf(c) {
  if (!c.nicu || typeof c.nicu !== "object") c.nicu = {};
  if (!Array.isArray(c.nicu.admissions)) c.nicu.admissions = [];
  c.nicu.admissions.forEach(admDefaults);
  return c.nicu;
}
function admDefaults(a) {
  if (!Array.isArray(a.rounds)) a.rounds = [];
  if (!Array.isArray(a.procedures)) a.procedures = [];
  if (!Array.isArray(a.bundles)) a.bundles = [];
  return a;
}

/* ---------------- UI ---------------- */
function nicuBoardHTML() {
  var kids = (typeof DB !== "undefined" && DB.children) || [];
  var today = (typeof todayISO === "function") ? todayISO() : "";
  var list = boardSort(censusList(kids));
  if (!list.length) return "";
  var rows = list.map(function (e) {
    var rounds = e.adm.rounds || [], last = rounds[rounds.length - 1] || {};
    var due = !rounds.some(function (r) { return r && r.date === today; });
    var dol = (e.child.dob && today) ? dolOf(e.child.dob, today) : "\u2014";
    var chip = roundRespChip(last) || "\u2014";
    return "<tr data-act=\"hriSetActive\" data-arg=\"'" + esc(e.child.id) + "'\" style='cursor:pointer'><td><b>" + esc(e.adm.bed || "\u2014") + "</b></td><td><b>" + esc(e.child.name) + "</b><br><span style='font-size:12px'>DOL " + dol + "</span></td><td style='font-size:12.5px'>" + esc(chip) + "</td><td>" + (due ? "<b style='color:var(--red)'>round due</b>" : "\u2705") + "</td></tr>";
  }).join("");
  return "<div class='card'><h3>\U0001f6cf\ufe0f Bed board (" + list.length + ")</h3><table class='tbl'><tr><th>Bed</th><th>Baby</th><th>Support</th><th>Status</th></tr>" + rows + "</table></div>";
}
function procRowsHTML(a) {
  var list = (a.procedures || []).slice().reverse();
  if (!list.length) return "<div class='hint'>No procedures logged.</div>";
  return "<table class='tbl'><tr><th>Date</th><th>Procedure</th><th>By</th><th>Note</th></tr>" + list.map(function (p) {
    return "<tr><td>" + esc(p.date) + "</td><td>" + esc(p.name) + "</td><td>" + esc(p.by || "\u2014") + "</td><td>" + esc(p.note || "") + "</td></tr>";
  }).join("") + "</table>";
}
function procFormHTML() {
  var P = nicuPack();
  var opts = ((P && P.procedures) || ["(update content pack)"]).map(function (n) { return "<option>" + esc(n) + "</option>"; }).join("");
  var today = ""; try { today = todayISO(); } catch (e) {}
  return "<div class='form-grid' style='margin-top:8px'><div><label>Date</label><input type='date' id='npDate' value='" + today + "'></div>" +
    "<div><label>Procedure</label><select id='npName'>" + opts + "</select></div>" +
    "<div><label>By</label><input id='npBy' placeholder='Dr \u2026'></div>" +
    "<div><label>Note</label><input id='npNote' placeholder='consent taken, no complications'></div></div>" +
    "<button class='btn btn-o btn-sm' style='margin-top:8px' data-act='saveNicuProc'>+ Log procedure</button>";
}
function bundleItemsHTML(bundleId) {
  var P = nicuPack(); var b = P && P.bundles && P.bundles[bundleId];
  if (!b) return "";
  return b.items.map(function (label, i) {
    return "<label style='display:block;font-size:13.5px;margin:3px 0'><input type='checkbox' id='nbItem" + i + "'> " + esc(label) + "</label>";
  }).join("");
}
function bundleRowsHTML(a) {
  var P = nicuPack();
  var byB = {};
  (a.bundles || []).forEach(function (e) { byB[e.bundle] = e; });
  var ids = Object.keys(byB);
  if (!ids.length) return "<div class='hint'>No bundle checks logged.</div>";
  return ids.map(function (id) {
    var e = byB[id], s = bundleScore(id, e.items || {});
    var title = (P && P.bundles && P.bundles[id] && P.bundles[id].title) || id;
    return "<div style='font-size:13px;margin:4px 0'>" + (s.pct === 100 ? "\u2705" : "\u26a0\ufe0f") + " <b>" + esc(title) + "</b> " + esc(e.date) + " \u2014 " + s.done + "/" + s.total + (s.misses.length ? " <span style='color:var(--muted)'>missed: " + esc(s.misses.join("; ")) + "</span>" : "") + "</div>";
  }).join("");
}
function bundleFormHTML() {
  var P = nicuPack();
  var ids = (P && P.bundles) ? Object.keys(P.bundles) : [];
  var opts = ids.map(function (id) { return "<option value='" + esc(id) + "'>" + esc(P.bundles[id].title) + "</option>"; }).join("");
  var today = ""; try { today = todayISO(); } catch (e) {}
  return "<div class='form-grid' style='margin-top:8px'><div><label>Bundle</label><select id='nbBundle' data-onchange='paintBundleItems'>" + opts + "</select></div>" +
    "<div><label>Date</label><input type='date' id='nbDate' value='" + today + "'></div>" +
    "<div><label>Checked by</label><input id='nbBy' placeholder='Dr \u2026'></div></div>" +
    "<div id='nbItems' style='margin-top:6px'>" + bundleItemsHTML(ids[0]) + "</div>" +
    "<button class='btn btn-o btn-sm' style='margin-top:8px' data-act='saveNicuBundle'>+ Log bundle check</button>";
}
function nicuCensusHTML() {
  var list = censusList((typeof DB !== "undefined" && DB.children) || []);
  if (!list.length) return "";
  var today = (typeof todayISO === "function") ? todayISO() : "";
  var rows = list.map(function (e) {
    var due = !(e.adm.rounds || []).some(function (r) { return r.date === today; });
    return "<div style='font-size:13px'>🏥 <b>" + esc(e.child.name) + "</b> · day " + losDays(e.adm.admittedAt, null, today) +
      (due ? " · <b style='color:var(--red)'>round due</b>" : " · ✅ rounded") + "</div>";
  }).join("");
  return "<div class='card' style='margin-top:10px'><h3>NICU census (" + list.length + ")</h3>" + rows +
    "<button class='btn btn-o btn-sm' style='margin-top:6px' data-act=\"goPage\" data-arg=\"nicu\">Open NICU →</button></div>";
}
function renderNicu() {
  var box = $("nicuBox"); if (!box) return;
  var c = child();
  if (!c) { box.innerHTML = "<div class='card'><h3>🏥 NICU</h3><div class='hint'>Select a child first.</div></div>"; return; }
  var N = nicuOf(c), today = todayISO(), act = activeAdmissions(N.admissions)[0];
  var hist = N.admissions.map(function (a) {
    var rounds = (a.rounds || []).map(function (r) {
      return "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.wtG || "—") + "</td><td style='font-size:12.5px'>" + esc(roundRespChip(r) || "—") + "</td><td style='font-size:12.5px'>" + esc(roundBiliChip(r, a.ga) || "—") + "</td><td>" + esc((r.feeds && r.feeds.totalMl) || "—") + "</td><td>" + esc((r.events || []).join(", ") || "—") + "</td><td>" + esc(r.note || "") + "</td></tr>";
    }).join("");
    return "<div class='card'><h3>" + (a.status === "admitted" ? "🟢 Active admission" : "⚪ " + esc(a.status)) + " · " + esc(String(a.admittedAt || "").slice(0, 10)) +
      " (day " + losDays(a.admittedAt, a.dischargedAt, today) + ")</h3>" +
      "<div class='hint'>" + esc(a.indication || "no indication recorded") + (a.birthWtG ? " · " + esc(a.birthWtG) + " g" : "") + (a.ga ? " · " + esc(a.ga) + " wk" : "") + "</div>" +
      (rounds ? "<table class='tbl'><tr><th>Date</th><th>Wt(g)</th><th>Resp</th><th>Bili</th><th>Feeds(mL)</th><th>Events</th><th>Note</th></tr>" + rounds + "</table>" : "<div class='hint'>No rounds yet — add the first round above.</div>") +
      (a.status === "admitted"
        ? "<div class='form-grid' style='margin-top:8px'><div><label>Round date</label><input type='date' id='nrDate' value='" + today + "'></div>" +
          "<div><label>Weight (g)</label><input type='number' id='nrWt' placeholder='e.g. 2450'></div>" +
          "<div><label>SpO₂ %</label><input type='number' id='nrSpo2' placeholder='94'></div>" +
          "<div><label>HR /min</label><input type='number' id='nrHr' placeholder='140'></div>" +
          "<div><label>RR /min</label><input type='number' id='nrRr' placeholder='50'></div>" +
          "<div><label>Temp °C</label><input type='number' step='0.1' id='nrTemp' placeholder='36.8'></div></div>" +
          "<div class='hint' style='margin-top:8px'><b>Respiratory</b></div><div class='form-grid'>" +
          "<div><label>Support</label><select id='nrResp'><option value=''>—</option>" + respModes().map(function (m) { return "<option value='" + m.id + "'>" + esc(m.label) + "</option>"; }).join("") + "</select></div>" +
          "<div><label>FiO₂ %</label><input type='number' id='nrFio2' placeholder='30'></div>" +
          "<div><label>PIP</label><input type='number' id='nrPip' placeholder='18'></div>" +
          "<div><label>PEEP</label><input type='number' id='nrPeep' placeholder='5'></div></div>" +
          "<div class='hint' style='margin-top:8px'><b>Bilirubin</b> (" + esc(biliFormSrcLabel()) + " line drawn on save)" + biliFormPendBadge() + "</div><div class='form-grid'>" +
          "<div><label>TSB / TcB value</label><input type='number' step='0.1' id='nrTsb' placeholder='12'></div>" +
          "<div><label>Unit</label><select id='nrTsbU'><option value='umol'>µmol/L</option><option value='mgdl'>mg/dL</option></select></div>" +
          "<div><label>Sample</label><select id='nrTsbKind'><option value=''>—</option><option value='tsb'>TSB (serum)</option><option value='tcb'>TcB (skin)</option></select></div>" +
          "<div><label>Age at sample (hrs)</label><input type='number' id='nrBiliHrs' placeholder='49'></div>" +
          "<div><label>Phototherapy</label><select id='nrPhoto'><option value=''>—</option><option value='on'>on phototherapy</option><option value='off'>stopped today</option></select></div>" +
          "<div><label>Baby well? (NICE 1.4)</label><select id='nrWell'><option value=''>—</option><option value='yes'>well</option><option value='no'>unwell</option></select></div>" +
          "<div><label>Haemolysis?</label><select id='nrHaem'><option value=''>—</option><option value='no'>no</option><option value='yes'>yes</option></select></div></div>" +
          "<div><label>Jaundice risk factors</label><div style='display:flex;flex-wrap:wrap;gap:4px 12px'>" + biliRiskChecksHTML() + "</div></div>" +
          "<div class='hint' style='margin-top:8px'><b>Sepsis</b></div><div class='form-grid'>" +
          "<div><label>Sepsis screen</label><select id='nrSepsis'><option value=''>—</option><option>Pending</option><option>Negative</option><option>Positive</option></select></div>" +
          "<div><label>Culture</label><input id='nrCulture' placeholder='blood Cx pending'></div>" +
          "<div><label>Antibiotic</label><input id='nrAbx' placeholder='ampi + genta'></div>" +
          "<div><label>Abx start date</label><input type='date' id='nrAbxStart'></div></div>" +
          "<div class='hint' style='margin-top:8px'><b>Fluids & feeds</b></div><div class='form-grid'>" +
          "<div><label>IV fluids (mL/day)</label><input type='number' id='nrIv' placeholder=''></div>" +
          "<div><label>Feed total (mL/day)</label><input type='number' id='nrFeed' placeholder='120'></div>" +
          "<div><label>Feed type</label><select id='nrFeedType'><option value=''>—</option>" + (((nicuPack() || {}).feedTypes || []).map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("")) + "</select></div>" +
          "<div><label>Tone</label><select id='nrTone'><option value=''>—</option>" + (((nicuPack() || {}).tones || ["Normal", "Hypotonic", "Hypertonic"]).map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("")) + "</select></div>" +
          "<div><label>HIE grade</label><select id='nrHie'><option value=''>—</option>" + (((nicuPack() || {}).hieGrades || []).map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("")) + "</select></div>" +
          "<div><label>Seizures today</label><select id='nrSeiz'><option value=''>—</option><option value='no'>none</option><option value='yes'>yes</option></select></div></div>" +
          "<div><label>Events (comma separated)</label><input id='nrEvents' placeholder='apnoea, phototherapy'></div>" +
          "<div><label>Round note</label><input id='nrNote' placeholder='stable, advancing feeds'></div>" +
          "<div style='display:flex;gap:8px;margin-top:8px;flex-wrap:wrap'><button class='btn btn-p btn-sm' data-act='saveNicuRound'>+ Save round</button>" +
          "<button class='btn btn-o btn-sm' data-act='showDischarge'>Discharge…</button></div><div id='disBox'></div>" +
        "<div class='card' style='margin-top:10px'><h3>🩺 Procedures</h3>" + procRowsHTML(a) + procFormHTML() + "</div>" +
        "<div class='card' style='margin-top:10px'><h3>✅ Care bundles</h3>" + bundleRowsHTML(a) + bundleFormHTML() + "</div>"
        : "<div class='hint'>Outcome: " + esc(a.outcome || "—") + " · discharged " + esc(String(a.dischargedAt || "").slice(0, 10)) + "</div>" +
          "<div style='margin-top:8px'><button class='btn btn-o btn-sm' data-act=\"printNicuSummary\" data-arg=\"'" + a.id + "'\">🖨️ Discharge summary</button></div>") +
      "</div>";
  }).join("");
  var dol = c.dob ? dayDiff(c.dob, today) + 1 : 1;
  var lm = (typeof latestMeasure === "function") ? latestMeasure(c) : null;
  var wtKg = (lm && lm.wt) || (c.birthWt ? +c.birthWt : 0) || (act && act.birthWtG ? (+act.birthWtG) / 1000 : 0);
  var fg = feedGuide(dol, wtKg);
  var fl = fluidGuide(dol, act && act.ga, wtKg);
  var flLine = fl && fl.lo ? (" · fluids: <b>" + fl.lo + "–" + fl.hi + " mL/kg/day</b> (≈" + fl.totalLo + "–" + fl.totalHi + " mL/day" + (fl.band === "term" ? ", NICE NG29" : ", RCH preterm") + ")") : (fl && fl.note ? " · fluids: " + esc(fl.note) : "");
  const fence = (!((typeof DB !== "undefined" && DB.settings) || {}).nicuValid)
    ? "<div class='alert a-red no-print'>⚠️ <div><b>NICU tools are NOT case-validated (F25)</b> — confirm every value against your references before acting. Enable “NICU case-validated” in Settings only after sign-off.</div></div>" : "";
  box.innerHTML = nicuBoardHTML() + fence + "<div class='card'><h3>🏥 NICU — " + esc(c.name) + "</h3>" +
    "<div class='hint'>Day of life " + dol + " · feed guide: <b>" + fg.mlPerKg + " mL/kg/day</b> (≈" + fg.totalMl + " mL/day, " + fg.perFeedQ3h + " mL q3h) — " + esc(fg.note) + flLine + "</div>" +
    "<div style='margin-top:8px'><button class='btn btn-o btn-sm' data-act='printNicuHandover'>🖨️ Shift handover</button></div></div>" +
    (act ? "" : "<div class='card'><h3>+ New admission</h3><div class='form-grid'>" +
      "<div><label>Admitted (date/time)</label><input type='datetime-local' id='naAt'></div>" +
      "<div><label>Birth weight (g)</label><input type='number' id='naWt' placeholder='2400'></div>" +
      "<div><label>Gestation (wk)</label><input type='number' id='naGa' placeholder='36'></div>" +
      "<div><label>Indication</label><input id='naInd' placeholder='RDS / sepsis / LBW'></div><div><label>Bed</label><input id='naBed' placeholder='A1'></div></div>" +
      "<button class='btn btn-p btn-sm' style='margin-top:8px' data-act='saveAdmission'>Admit to NICU</button></div>") +
    hist;
}

window.renderNicu = renderNicu;
window.nicuCensusHTML = nicuCensusHTML;

window.saveAdmission = function () {
  var c = child(); if (!c) return;
  var a = { id: uid(), admittedAt: $("naAt").value, birthWtG: $("naWt").value, ga: $("naGa").value, indication: $("naInd").value.trim(), bed: ($("naBed") && $("naBed").value || "").trim(), status: "admitted", rounds: [], procedures: [], bundles: [] };
  var errs = admissionValid(a);
  if (errs.length) { alert(errs.join("\n")); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("nicu-adm")) return;
  nicuOf(c).admissions.unshift(a);
  try { if (typeof auditSafe === "function") auditSafe("NICU admit", c.name + " — " + a.indication); } catch (e) {}
  save(); renderAll();
};
window.saveNicuRound = function () {
  var c = child(); if (!c) return;
  var act = activeAdmissions(nicuOf(c).admissions)[0]; if (!act) return;
  var gv = function (id) { var el = $(id); return el ? el.value : ""; };
  var vit = {};
  if (gv("nrSpo2") !== "") vit.spo2 = +gv("nrSpo2");
  if (gv("nrHr") !== "") vit.hr = +gv("nrHr");
  if (gv("nrRr") !== "") vit.rr = +gv("nrRr");
  if (gv("nrTemp") !== "") vit.temp = +gv("nrTemp");
  var r = {
    id: uid(), date: $("nrDate").value, wtG: $("nrWt").value,
    vitals: vit,
    resp: gv("nrResp") ? { mode: gv("nrResp"), fio2: gv("nrFio2"), pip: gv("nrPip"), peep: gv("nrPeep") } : {},
    bili: gv("nrTsb") !== "" ? { tsb: +gv("nrTsb"), unit: gv("nrTsbU"), kind: gv("nrTsbKind") || null, ageHrs: gv("nrBiliHrs"), photo: gv("nrPhoto"), well: gv("nrWell") === "yes" ? true : gv("nrWell") === "no" ? false : null, haem: gv("nrHaem") === "yes" ? true : gv("nrHaem") === "no" ? false : null, risks: biliCheckedRisks() } : {},
    sepsis: (gv("nrSepsis") || gv("nrCulture") || gv("nrAbx") || gv("nrAbxStart")) ? { screen: gv("nrSepsis"), culture: gv("nrCulture").trim(), abx: gv("nrAbx").trim(), abxStart: gv("nrAbxStart") } : {},
    feeds: $("nrFeed").value ? { totalMl: +$("nrFeed").value } : {},
    fluids: (gv("nrIv") !== "" || gv("nrFeedType")) ? { ivMl: gv("nrIv"), feedType: gv("nrFeedType") } : {},
    neuro: (gv("nrTone") || gv("nrHie") || gv("nrSeiz")) ? { tone: gv("nrTone"), hie: gv("nrHie"), seizures: gv("nrSeiz") } : {},
    events: $("nrEvents").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
    note: $("nrNote").value.trim()
  };
  var errs = roundValid(r, todayISO());
  if (errs.length) { alert(errs.join("\n")); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("nicu-round")) return;
  act.rounds.push(r);
  act.rounds.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  try {
    if (typeof Alerts !== "undefined" && Alerts.raise) {
      var P4 = nicuPack(), conv = (P4 && P4.mgdlToUmol) || 17.1;
      var bTs = parseFloat((r.bili || {}).tsb), bHr = parseFloat((r.bili || {}).ageHrs);
      if (bTs > 0 && bHr >= 0) {
        var umol = (r.bili.unit === "mgdl") ? Math.round(bTs * conv) : Math.round(bTs);
        var bf = biliFlag(umol, act.ga, bHr, { kind: r.bili.kind, risks: r.bili.risks, well: r.bili.well, haem: r.bili.haem, photo: r.bili.photo });
        if (bf && bf.tier === "warn") Alerts.raise("warn", "NICU-BILI", c.name + ": " + bf.text);
        var prev = null;
        (act.rounds || []).forEach(function (x) { if (x.id !== r.id && x.date <= r.date && x.bili && parseFloat(x.bili.tsb) > 0 && parseFloat(x.bili.ageHrs) >= 0) prev = x; });
        if (prev) {
          var pUmol = (prev.bili.unit === "mgdl") ? Math.round(parseFloat(prev.bili.tsb) * conv) : Math.round(parseFloat(prev.bili.tsb));
          var rise = biliRise(pUmol, parseFloat(prev.bili.ageHrs), umol, bHr);
          if (rise.rapid) Alerts.raise("warn", "NICU-BILI", c.name + ": bilirubin rising " + rise.rate + " µmol/L/hr — intensified phototherapy per NICE CG98?");
        }
      }
      if (typeof Ex !== "undefined" && Ex.flagsFor && c.dob) {
        var _dol = dolOf(c.dob, r.date) || 1;
        var _vv = {};
        if ((r.vitals || {}).temp != null) _vv.t = (r.vitals || {}).temp;
        if ((r.vitals || {}).hr != null) _vv.hr = (r.vitals || {}).hr;
        if ((r.vitals || {}).rr != null) _vv.rr = (r.vitals || {}).rr;
        var _vf = Ex.flagsFor(_vv, Math.min(_dol, 28), c.sex);
        _vf.forEach(function (f) { Alerts.raise("warn", "NICU-VITALS", c.name + ": " + f.text); });
      }
      var _abx = (r.sepsis || {}).abxStart;
      if (_abx && sepsisAbxDays(_abx, r.date) >= 2) Alerts.raise("warn", "NICU-SEPSIS", c.name + ": antibiotics day " + sepsisAbxDays(_abx, r.date) + " — culture review due (stop/review by 48h if negative)?");
    }
  } catch (eDx) {}
  try { if (typeof auditSafe === "function") auditSafe("NICU round", c.name + " " + r.date); } catch (e) {}
  save(); renderAll();
};
window.showDischarge = function () {
  var box = $("disBox"); if (!box) return;
  box.innerHTML = "<div class='form-grid' style='margin-top:8px'><div><label>Discharged (date/time)</label><input type='datetime-local' id='ndAt'></div>" +
    "<div><label>Outcome</label><select id='ndOut'><option value=''>—</option><option>stable</option><option>against advice</option><option>referred</option><option>expired</option></select></div></div>" +
    "<div style='margin-top:6px'><label>Follow-up advice (optional — prints on summary)</label><input id='ndFu' placeholder='review after 3 days; exclusive breastfeeds; warmth'></div>" +
    "<button class='btn btn-d btn-sm' style='margin-top:8px' data-act='dischargeNicu'>Confirm discharge</button>";
};
window.dischargeNicu = function () {
  var c = child(); if (!c) return;
  var act = activeAdmissions(nicuOf(c).admissions)[0]; if (!act) return;
  var trial = { status: "admitted", admittedAt: act.admittedAt, dischargedAt: $("ndAt").value, outcome: $("ndOut").value };
  var errs = dischargeValid(trial);
  if (errs.length) { alert(errs.join("\n")); return; }
  act.status = trial.outcome === "expired" ? "expired" : trial.outcome === "referred" ? "transferred" : "discharged";
  act.dischargedAt = trial.dischargedAt; act.outcome = trial.outcome;
  var fuEl = $("ndFu"); act.fuNote = (fuEl && fuEl.value) ? fuEl.value.trim() : "";
  try { if (typeof auditSafe === "function") auditSafe("NICU discharge", c.name + " — " + act.outcome); } catch (e) {}
  save(); renderAll();
};
window.paintBundleItems = function () {
  var box = $("nbItems"); if (!box) return;
  box.innerHTML = bundleItemsHTML($("nbBundle").value);
};
window.saveNicuProc = function () {
  var c = child(); if (!c) return;
  var act = activeAdmissions(nicuOf(c).admissions)[0]; if (!act) return;
  admDefaults(act);
  var p = { id: uid(), date: $("npDate").value || todayISO(), name: $("npName").value, by: $("npBy").value.trim(), note: $("npNote").value.trim() };
  if (!p.name) { alert("Pick a procedure."); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("nicu-proc")) return;
  act.procedures.push(p);
  try {
    if (typeof Alerts !== "undefined" && Alerts.raise && !((c.consents || []).length)) Alerts.raise("info", "NICU-CONSENT", c.name + ": no written consent on file — record consent for " + p.name + ".");
  } catch (e) {}
  try { if (typeof auditSafe === "function") auditSafe("NICU procedure", c.name + " — " + p.name); } catch (e2) {}
  save(); renderAll();
};
window.saveNicuBundle = function () {
  var c = child(); if (!c) return;
  var act = activeAdmissions(nicuOf(c).admissions)[0]; if (!act) return;
  admDefaults(act);
  var bid = $("nbBundle").value;
  var P = nicuPack(); var b = P && P.bundles && P.bundles[bid];
  if (!b) return;
  var items = {};
  b.items.forEach(function (label, i) { var el = $("nbItem" + i); items[i] = !!(el && el.checked); });
  if (typeof guardSubmit === "function" && !guardSubmit("nicu-bundle")) return;
  act.bundles.push({ id: uid(), date: $("nbDate").value || todayISO(), bundle: bid, items: items, by: $("nbBy").value.trim() });
  try { if (typeof auditSafe === "function") auditSafe("NICU bundle", c.name + " — " + b.title); } catch (e) {}
  save(); renderAll();
};
window.printNicuSummary = function (admId) {
  var box = $("nicuPrint"); if (!box) return;
  var c = child(); if (!c) return;
  var adm = (nicuOf(c).admissions || []).filter(function (a) { return a.id === admId; })[0];
  if (!adm) return;
  if (adm.status === "admitted") { alert("This baby is still admitted — the discharge summary prints after discharge."); return; }
  var today = (typeof todayISO === "function") ? todayISO() : "";
  box.innerHTML = dischargeSummaryHTML(c, adm, dischargeSummaryData(c, adm, today));
  try { if (typeof printPage === "function") printPage("pg-nicuprint"); } catch (e) {}
};
window.printNicuHandover = function () {
  var box = $("nicuPrint"); if (!box) return;
  var kids = (typeof DB !== "undefined" && DB.children) || [];
  var list = censusList(kids);
  if (!list.length) { alert("No active NICU admissions — nothing to hand over."); return; }
  var today = (typeof todayISO === "function") ? todayISO() : "";
  box.innerHTML = handoverHTML(list, today);
  try { if (typeof printPage === "function") printPage("pg-nicuprint"); } catch (e) {}
};

})();

/* E2c: delegated actions for templates in this file. */
try {
  ["dischargeNicu", "printNicuHandover", "saveAdmission", "saveNicuBundle", "saveNicuProc", "saveNicuRound", "showDischarge", "paintBundleItems"].forEach(function (n) { actCall0(n); });
} catch (e) {}

/* E2c: backslash-escaped template action. */
try {
  ["printNicuSummary"].forEach(function (n) { actCall0(n); });
} catch (e) {}

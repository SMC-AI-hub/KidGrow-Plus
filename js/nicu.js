/* =====================================================================
   KidGrow Pro — M5 NICU longitudinal: admissions, daily rounds, discharge.
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
function roundRowsHTML(rounds) {
  return (rounds || []).map(function (r) {
    return "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.wtG || "—") + "</td><td>" + esc((r.feeds && r.feeds.totalMl) || "—") + "</td><td>" + esc((r.events || []).join(", ") || "—") + "</td><td>" + esc(r.note || "") + "</td></tr>";
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
    + ((adm.rounds || []).length ? "<table class='tbl'><tr><th>Date</th><th>Wt(g)</th><th>Feeds(mL)</th><th>Events</th><th>Note</th></tr>" + roundRowsHTML(adm.rounds) + "</table>" : "")
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
      ? esc(last.date) + " · " + (last.wtG ? esc(String(last.wtG)) + " g" : "no wt") + ((last.feeds && last.feeds.totalMl) ? " · " + esc(String(last.feeds.totalMl)) + " mL" : "") + ((last.events || []).length ? "<br>" + esc(last.events.join(", ")) : "")
      : "no rounds yet";
    return "<tr><td><b>" + esc(c.name) + "</b><br><span style='font-size:12px'>DOL " + dol + " · day " + losDays(a.admittedAt, null, today) + "</span></td>"
      + "<td>" + esc(a.indication || "—") + "<br><span style='font-size:12px'>" + (a.birthWtG ? esc(String(a.birthWtG)) + " g" : "") + (a.ga ? " · " + esc(String(a.ga)) + " wk" : "") + "</span></td>"
      + "<td style='font-size:12.5px'>" + lastCell + "</td>"
      + "<td>" + (due ? "<b style='color:var(--red)'>round due</b>" : "✅") + "</td></tr>";
  }).join("");
  return head + "<table class='tbl'><tr><th>Baby</th><th>Indication</th><th>Last round</th><th>Status</th></tr>" + rows + "</table>" + docFooter("NICU handover");
}
window.NicuPure = {
  losDays: losDays, activeAdmissions: activeAdmissions, roundsDue: roundsDue,
  admissionValid: admissionValid, dischargeValid: dischargeValid, roundValid: roundValid,
  feedGuide: feedGuide, censusList: censusList,
  weightTrend: weightTrend, eventsUnion: eventsUnion, outcomeLabel: outcomeLabel,
  dischargeSummaryData: dischargeSummaryData, dischargeSummaryHTML: dischargeSummaryHTML,
  handoverHTML: handoverHTML
};

/* ---------------- data helpers ---------------- */
function nicuOf(c) {
  if (!c.nicu || typeof c.nicu !== "object") c.nicu = {};
  if (!Array.isArray(c.nicu.admissions)) c.nicu.admissions = [];
  return c.nicu;
}

/* ---------------- UI ---------------- */
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
    "<button class='btn btn-o btn-sm' style='margin-top:6px' onclick=\"go('nicu')\">Open NICU →</button></div>";
}
function renderNicu() {
  var box = $("nicuBox"); if (!box) return;
  var c = child();
  if (!c) { box.innerHTML = "<div class='card'><h3>🏥 NICU</h3><div class='hint'>Select a child first.</div></div>"; return; }
  var N = nicuOf(c), today = todayISO(), act = activeAdmissions(N.admissions)[0];
  var hist = N.admissions.map(function (a) {
    var rounds = (a.rounds || []).map(function (r) {
      return "<tr><td>" + esc(r.date) + "</td><td>" + esc(r.wtG || "—") + "</td><td>" + esc((r.feeds && r.feeds.totalMl) || "—") + "</td><td>" + esc((r.events || []).join(", ") || "—") + "</td><td>" + esc(r.note || "") + "</td></tr>";
    }).join("");
    return "<div class='card'><h3>" + (a.status === "admitted" ? "🟢 Active admission" : "⚪ " + esc(a.status)) + " · " + esc(String(a.admittedAt || "").slice(0, 10)) +
      " (day " + losDays(a.admittedAt, a.dischargedAt, today) + ")</h3>" +
      "<div class='hint'>" + esc(a.indication || "no indication recorded") + (a.birthWtG ? " · " + esc(a.birthWtG) + " g" : "") + (a.ga ? " · " + esc(a.ga) + " wk" : "") + "</div>" +
      (rounds ? "<table class='tbl'><tr><th>Date</th><th>Wt(g)</th><th>Feeds(mL)</th><th>Events</th><th>Note</th></tr>" + rounds + "</table>" : "<div class='hint'>No rounds yet.</div>") +
      (a.status === "admitted"
        ? "<div class='form-grid' style='margin-top:8px'><div><label>Round date</label><input type='date' id='nrDate' value='" + today + "'></div>" +
          "<div><label>Weight (g)</label><input type='number' id='nrWt' placeholder='e.g. 2450'></div>" +
          "<div><label>SpO₂ %</label><input type='number' id='nrSpo2' placeholder='94'></div>" +
          "<div><label>Feed total (mL/day)</label><input type='number' id='nrFeed' placeholder='120'></div></div>" +
          "<div><label>Events (comma separated)</label><input id='nrEvents' placeholder='apnoea, phototherapy'></div>" +
          "<div><label>Round note</label><input id='nrNote' placeholder='stable, advancing feeds'></div>" +
          "<div style='display:flex;gap:8px;margin-top:8px;flex-wrap:wrap'><button class='btn btn-p btn-sm' onclick='saveNicuRound()'>+ Save round</button>" +
          "<button class='btn btn-o btn-sm' onclick='showDischarge()'>Discharge…</button></div><div id='disBox'></div>"
        : "<div class='hint'>Outcome: " + esc(a.outcome || "—") + " · discharged " + esc(String(a.dischargedAt || "").slice(0, 10)) + "</div>" +
          "<div style='margin-top:8px'><button class='btn btn-o btn-sm' onclick=\"printNicuSummary('" + a.id + "')\">🖨️ Discharge summary</button></div>") +
      "</div>";
  }).join("");
  var dol = c.dob ? dayDiff(c.dob, today) + 1 : 1;
  var lm = (typeof latestMeasure === "function") ? latestMeasure(c) : null;
  var fg = feedGuide(dol, (lm && lm.wt) || (c.birthWt ? +c.birthWt : 0));
  box.innerHTML = "<div class='card'><h3>🏥 NICU — " + esc(c.name) + "</h3>" +
    "<div class='hint'>Day of life " + dol + " · feed guide: <b>" + fg.mlPerKg + " mL/kg/day</b> (≈" + fg.totalMl + " mL/day, " + fg.perFeedQ3h + " mL q3h) — " + esc(fg.note) + "</div>" +
    "<div style='margin-top:8px'><button class='btn btn-o btn-sm' onclick='printNicuHandover()'>🖨️ Shift handover</button></div></div>" +
    (act ? "" : "<div class='card'><h3>+ New admission</h3><div class='form-grid'>" +
      "<div><label>Admitted (date/time)</label><input type='datetime-local' id='naAt'></div>" +
      "<div><label>Birth weight (g)</label><input type='number' id='naWt' placeholder='2400'></div>" +
      "<div><label>Gestation (wk)</label><input type='number' id='naGa' placeholder='36'></div>" +
      "<div><label>Indication</label><input id='naInd' placeholder='RDS / sepsis / LBW'></div></div>" +
      "<button class='btn btn-p btn-sm' style='margin-top:8px' onclick='saveAdmission()'>Admit to NICU</button></div>") +
    hist;
}

window.renderNicu = renderNicu;
window.nicuCensusHTML = nicuCensusHTML;

window.saveAdmission = function () {
  var c = child(); if (!c) return;
  var a = { id: uid(), admittedAt: $("naAt").value, birthWtG: $("naWt").value, ga: $("naGa").value, indication: $("naInd").value.trim(), status: "admitted", rounds: [] };
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
  var r = {
    id: uid(), date: $("nrDate").value, wtG: $("nrWt").value,
    vitals: $("nrSpo2").value ? { spo2: +$("nrSpo2").value } : {},
    feeds: $("nrFeed").value ? { totalMl: +$("nrFeed").value } : {},
    events: $("nrEvents").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean),
    note: $("nrNote").value.trim()
  };
  var errs = roundValid(r, todayISO());
  if (errs.length) { alert(errs.join("\n")); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("nicu-round")) return;
  act.rounds.push(r);
  act.rounds.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  try { if (typeof auditSafe === "function") auditSafe("NICU round", c.name + " " + r.date); } catch (e) {}
  save(); renderAll();
};
window.showDischarge = function () {
  var box = $("disBox"); if (!box) return;
  box.innerHTML = "<div class='form-grid' style='margin-top:8px'><div><label>Discharged (date/time)</label><input type='datetime-local' id='ndAt'></div>" +
    "<div><label>Outcome</label><select id='ndOut'><option value=''>—</option><option>stable</option><option>against advice</option><option>referred</option><option>expired</option></select></div></div>" +
    "<div style='margin-top:6px'><label>Follow-up advice (optional — prints on summary)</label><input id='ndFu' placeholder='review after 3 days; exclusive breastfeeds; warmth'></div>" +
    "<button class='btn btn-d btn-sm' style='margin-top:8px' onclick='dischargeNicu()'>Confirm discharge</button>";
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

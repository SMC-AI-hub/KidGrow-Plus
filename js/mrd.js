/* =====================================================================
   NeoKid Care — M6 MRD registers: admissions, discharges, births, deaths.
   Derived read-only from local records (NICU + registrations) for the
   selected date range. MrdPure.buildRegisters is unit-tested; CSV export
   reuses the csvOf/csvEsc helpers from exports.js.
   ===================================================================== */
(function () {
"use strict";

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function inRange(d, f, t) {
  d = String(d || "").slice(0, 10);
  if (!d) return false;
  if (f && d < f) return false;
  if (t && d > t) return false;
  return true;
}
function byDate(x, y) { return x.date < y.date ? -1 : 1; }

/* ---------------- pures (tested) ---------------- */
function buildRegisters(children, fromISO, toISO) {
  var adm = [], dis = [], bir = [], dth = [];
  (children || []).forEach(function (c) {
    c = c || {};
    if (c.dob && inRange(c.dob, fromISO, toISO)) {
      bir.push({ date: c.dob, name: c.name || "", sex: c.sex || "", ref: "DOB", detail: "birth wt " + (c.birthWt || "—") + " kg, " + (c.gest || "—") + " wk" });
    }
    ((c.nicu && c.nicu.admissions) || []).forEach(function (a) {
      var ad = String(a.admittedAt || "").slice(0, 10);
      if (inRange(ad, fromISO, toISO)) {
        adm.push({ date: ad, name: c.name || "", sex: c.sex || "", ref: "NICU", detail: (a.indication || "—") + " · " + (a.birthWtG || "—") + " g" });
      }
      var dd = String(a.dischargedAt || "").slice(0, 10);
      if (a.status && a.status !== "admitted" && inRange(dd, fromISO, toISO)) {
        dis.push({ date: dd, name: c.name || "", sex: c.sex || "", ref: a.status, detail: "outcome: " + (a.outcome || "—") });
      }
      if (a.outcome === "expired" && inRange(dd || ad, fromISO, toISO)) {
        dth.push({ date: dd || ad, name: c.name || "", sex: c.sex || "", ref: "NICU", detail: a.indication || "—" });
      }
    });
  });
  adm.sort(byDate); dis.sort(byDate); bir.sort(byDate); dth.sort(byDate);
  return { admissions: adm, discharges: dis, births: bir, deaths: dth };
}
function regCsvRows(title, rows) {
  return [[title], ["Date", "Name", "Sex", "Ref", "Detail"]]
    .concat(rows.map(function (r) { return [r.date, r.name, r.sex, r.ref, r.detail]; }));
}
window.MrdPure = { buildRegisters: buildRegisters, regCsvRows: regCsvRows };

/* ---------------- UI ---------------- */
var MRD_FROM = "", MRD_TO = "";
function regTable(title, rows, kind) {
  var body = rows.map(function (r) {
    return "<tr><td>" + esc(r.date) + "</td><td><b>" + esc(r.name) + "</b></td><td>" + esc(r.sex) + "</td><td>" + esc(r.ref) + "</td><td>" + esc(r.detail) + "</td></tr>";
  }).join("") || "<tr><td colspan='5' style='color:var(--muted)'>None in range.</td></tr>";
  return "<div class='card'><h3>" + title + " (" + rows.length + ")</h3>" +
    "<table class='tbl'><tr><th>Date</th><th>Name</th><th>Sex</th><th>Ref</th><th>Detail</th></tr>" + body + "</table>" +
    (rows.length ? "<button class='btn btn-o btn-sm' style='margin-top:6px' onclick='dlMrdCsv(\"" + kind + "\")'>⬇ CSV</button>" : "") + "</div>";
}
function renderMrd() {
  var box = $("mrdBox"); if (!box) return;
  if (typeof DB === "undefined") return;
  var t = (typeof todayISO === "function") ? todayISO() : "";
  if (!MRD_FROM) MRD_FROM = t.slice(0, 7) + "-01";
  if (!MRD_TO) MRD_TO = t;
  var R = buildRegisters(DB.children, MRD_FROM, MRD_TO);
  box.innerHTML = "<div class='card'><h3>📋 MRD registers</h3>" +
    "<div class='hint'>Derived from local records for the selected range. For filing + audits.</div>" +
    "<div class='form-grid'><div><label>From</label><input type='date' value='" + MRD_FROM + "' onchange='MRD_FROM=this.value;renderMrd()'></div>" +
    "<div><label>To</label><input type='date' value='" + MRD_TO + "' onchange='MRD_TO=this.value;renderMrd()'></div></div>" +
    "<button class='btn btn-o btn-sm' style='margin-top:8px' onclick=\"printPage('pg-mrd')\">🖨️ Print registers</button></div>" +
    regTable("🏥 NICU admissions", R.admissions, "admissions") +
    regTable("✅ Discharges / transfers", R.discharges, "discharges") +
    regTable("👶 Births registered", R.births, "births") +
    regTable("🕊️ Deaths", R.deaths, "deaths");
}
window.renderMrd = renderMrd;

window.dlMrdCsv = function (kind) {
  var R = buildRegisters(DB.children, MRD_FROM, MRD_TO);
  var rows = R[kind] || [];
  var titles = { admissions: "NICU admissions", discharges: "Discharges", births: "Births", deaths: "Deaths" };
  try {
    downloadFile("mrd_" + kind + "_" + MRD_FROM + "_to_" + MRD_TO + ".csv", csvOf(regCsvRows(titles[kind] + " " + MRD_FROM + " to " + MRD_TO, rows)), "text/csv");
    if (typeof auditSafe === "function") auditSafe("Export", "MRD " + kind);
  } catch (e) { alert("Export failed."); }
};

})();

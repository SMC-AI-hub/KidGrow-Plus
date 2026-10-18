/* =====================================================================
   NeoKid Care — M6 defined-denominator metrics. Every rate is {n, d, pct}
   so the UI always shows numerator + denominator + period — never a bare
   percent. MetricsPure is unit-tested. Growth rules here mirror growth.js
   thresholds (10% drop, 6/12 mo review) without needing WHO tables.
   ===================================================================== */
(function () {
"use strict";

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function dayDiff(a, b) { return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 864e5); }

/* ---------------- pures (tested) ---------------- */
function rate(n, d) {
  n = +n || 0; d = +d || 0;
  return { n: n, d: d, pct: d > 0 ? Math.round((n / d) * 1000) / 10 : null };
}
function withMinMeasures(children, k) {
  return (children || []).filter(function (c) { return c && (c.measures || []).length >= k; }).length;
}
function nicuStats(children, todayISO) {
  var admitted = 0, losSum = 0, dis30 = 0, cut = "";
  try { cut = new Date(new Date(todayISO + "T00:00:00Z") - 30 * 864e5).toISOString().slice(0, 10); } catch (e) {}
  (children || []).forEach(function (c) {
    ((c && c.nicu && c.nicu.admissions) || []).forEach(function (a) {
      if (a.status === "admitted") {
        admitted++;
        losSum += dayDiff(String(a.admittedAt || todayISO).slice(0, 10), todayISO) + 1;
      } else if (String(a.dischargedAt || "").slice(0, 10) >= cut && cut) dis30++;
    });
  });
  return { admitted: admitted, avgLos: admitted ? Math.round((losSum / admitted) * 10) / 10 : null, dis30: dis30, period: "as of " + todayISO + " / discharges last 30 d" };
}
function marStats(children, dateISO) {
  var given = 0, total = 0;
  (children || []).forEach(function (c) {
    (c.mar || []).forEach(function (e) {
      (e.logs || []).forEach(function (l) {
        if (String(l.at || "").slice(0, 10) === dateISO) {
          total++;
          if (l.status === "given") given++;
        }
      });
    });
  });
  var r = rate(given, total);
  r.period = dateISO;
  return r;
}
function growthAlertCounts(children, todayISO) {
  var red = 0, amber = 0, screened = 0;
  (children || []).forEach(function (c) {
    var ms = ((c && c.measures) || []).filter(function (m) { return m && m.date; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!ms.length) return;
    screened++;
    var ageM = Math.max(0, Math.round(dayDiff(c.dob || todayISO, todayISO) / 30.44));
    var gapM = Math.round(dayDiff(ms[ms.length - 1].date, todayISO) / 30.44);
    if (gapM > (ageM < 24 ? 6 : 12)) amber++;
    for (var i = 1; i < ms.length; i++) {
      var a = +ms[i - 1].wt, b = +ms[i].wt;
      if (a > 0 && b > 0 && b < a * 0.9) { red++; break; }
    }
  });
  return { red: red, amber: amber, screened: screened };
}
window.MetricsPure = {
  rate: rate, withMinMeasures: withMinMeasures, nicuStats: nicuStats,
  marStats: marStats, growthAlertCounts: growthAlertCounts
};

/* ---------------- UI ---------------- */
function metricsClinicalHTML() {
  if (typeof DB === "undefined") return "";
  var t = (typeof todayISO === "function") ? todayISO() : "";
  var ns = nicuStats(DB.children, t), ms = marStats(DB.children, t), gs = growthAlertCounts(DB.children, t);
  function stat(emoji, big, label, denom) {
    return "<div class='stat'><div><div class='n'>" + big + "</div><div class='l'>" + label + "</div>" +
      "<div style='font-size:11px;color:var(--muted)'>" + denom + "</div></div><div class='e'>" + emoji + "</div></div>";
  }
  return "<div class='grid g4'>" +
    stat("🏥", ns.admitted, "NICU occupied now", ns.period) +
    stat("📆", ns.avgLos == null ? "—" : ns.avgLos + " d", "Avg LOS (active)", ns.admitted + " active babies") +
    stat("💊", ms.pct == null ? "—" : ms.pct + "%", "Doses given today", ms.n + "/" + ms.d + " logs · " + ms.period) +
    stat("📈", (gs.red + gs.amber) + " <span style='font-size:13px'>(" + gs.red + "🔴 " + gs.amber + "🟡)</span>", "Growth alerts", "of " + gs.screened + " with measures") +
    "</div>";
}
window.metricsClinicalHTML = metricsClinicalHTML;

})();

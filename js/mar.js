/* =====================================================================
   KidGrow Pro — M5 eMAR: scheduled meds + administration log with
   two-person rule for controlled drugs (witness required — also enforced
   server-side by 0004). Data on child.mar[]; synced via apply_clinical_op().
   Pures in window.MarPure are unit-tested.
   ===================================================================== */
(function () {
"use strict";

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function child() { try { return (typeof window.child === "function") ? window.child() : null; } catch (e) { return null; } }

/* ---------------- pures (tested) ---------------- */
function entryValid(e) {
  e = e || {};
  var errs = [];
  if (!String(e.drug || "").trim()) errs.push("drug name is required");
  if (e.controlled && e.status === "given" && !String(e.witness || "").trim()) errs.push("controlled drug needs a witness");
  return errs;
}
// Log one administration. Returns {ok, error?, entry} — never mutates input.
function logDose(entry, sig) {
  entry = entry || {}; sig = sig || {};
  if (!sig.by) return { ok: false, error: "given-by is required" };
  if (["given", "held", "refused", "missed"].indexOf(sig.status) < 0) return { ok: false, error: "invalid status" };
  if (entry.controlled && sig.status === "given" && !sig.witness) return { ok: false, error: "controlled drug needs a witness" };
  var logs = (entry.logs || []).concat([{ at: sig.at, by: sig.by, status: sig.status, witness: sig.witness || "" }]);
  var next = {};
  for (var k in entry) next[k] = entry[k];
  next.logs = logs; next.status = sig.status;
  if (sig.status === "given") { next.givenAt = sig.at; next.givenBy = sig.by; next.witness = sig.witness || ""; }
  return { ok: true, entry: next };
}
function dosesDue(children, nowISO) {
  var out = [];
  (children || []).forEach(function (c) {
    (c.mar || []).forEach(function (e) {
      if (e && e.status === "scheduled" && (e.scheduledAt || "") <= nowISO) out.push({ child: c, entry: e });
    });
  });
  return out;
}
function marAdherence(entries, dateISO) {
  var logs = [];
  (entries || []).forEach(function (e) { (e.logs || []).forEach(function (l) { if (l && String(l.at || "").slice(0, 10) === dateISO) logs.push(l); }); });
  var given = logs.filter(function (l) { return l.status === "given"; }).length;
  return { given: given, total: logs.length, pct: logs.length ? Math.round((given / logs.length) * 100) : null };
}
window.MarPure = { entryValid: entryValid, logDose: logDose, dosesDue: dosesDue, marAdherence: marAdherence };

/* ---------------- data ---------------- */
function marOf(c) { if (!Array.isArray(c.mar)) c.mar = []; return c.mar; }

/* ---------------- UI ---------------- */
function marDueHTML() {
  var now = new Date().toISOString().slice(0, 16);
  var due = dosesDue((typeof DB !== "undefined" && DB.children) || [], now);
  if (!due.length) return "";
  var rows = due.slice(0, 8).map(function (d) {
    return "<div style='font-size:13px'>💊 <b>" + esc(d.child.name) + "</b> — " + esc(d.entry.drug) + " " + esc(d.entry.dose || "") +
      (d.entry.controlled ? " 🔒" : "") + " <span style='color:var(--muted)'>@" + esc(d.entry.scheduledAt || "") + "</span></div>";
  }).join("");
  return "<div class='card' style='margin-top:10px'><h3>Doses due (" + due.length + ")</h3>" + rows +
    "<button class='btn btn-o btn-sm' style='margin-top:6px' onclick=\"go('mar')\">Open eMAR →</button></div>";
}
function renderMar() {
  var box = $("marBox"); if (!box) return;
  var c = child();
  if (!c) { box.innerHTML = "<div class='card'><h3>💊 eMAR</h3><div class='hint'>Select a child first.</div></div>"; return; }
  var list = marOf(c);
  var cards = list.map(function (e) {
    var logs = (e.logs || []).map(function (l) {
      return "<div style='font-size:12.5px'>" + (l.status === "given" ? "✅" : l.status === "held" ? "⏸️" : l.status === "refused" ? "✋" : "❓") +
        " " + esc(String(l.at || "").slice(0, 16).replace("T", " ")) + " — " + esc(l.status) + " by " + esc(l.by || "") +
        (l.witness ? " (witness: " + esc(l.witness) + ")" : "") + "</div>";
    }).join("") || "<div class='hint'>No administrations logged.</div>";
    return "<div class='card'><h3>💊 " + esc(e.drug) + (e.controlled ? " 🔒<span style='font-size:12px'> controlled</span>" : "") + "</h3>" +
      "<div class='hint'>" + esc([e.dose, e.route, e.freq].filter(Boolean).join(" · ")) + " · scheduled " + esc(String(e.scheduledAt || "").slice(0, 16).replace("T", " ")) + " · <b>" + esc(e.status) + "</b></div>" +
      logs +
      "<div class='form-grid' style='margin-top:8px'><div><label>Given by</label><input id='mlBy_" + e.id + "' placeholder='nurse / doctor'></div>" +
      "<div><label>Status</label><select id='mlSt_" + e.id + "'><option>given</option><option>held</option><option>refused</option><option>missed</option></select></div>" +
      (e.controlled ? "<div><label>Witness (required)</label><input id='mlWt_" + e.id + "' placeholder='second staff'></div>" : "") + "</div>" +
      "<button class='btn btn-p btn-sm' style='margin-top:8px' onclick='logMarDose(\"" + e.id + "\"," + e.controlled + ")'>Log administration</button></div>";
  }).join("");
  var lastRx = (c.rx || [])[(c.rx || []).length - 1];
  box.innerHTML = "<div class='card'><h3>💊 eMAR — " + esc(c.name) + "</h3>" +
    "<div class='form-grid'><div><label>Drug</label><input id='meDrug' placeholder='Paracetamol'></div>" +
    "<div><label>Dose</label><input id='meDose' placeholder='120 mg'></div>" +
    "<div><label>Route</label><select id='meRoute'><option>PO</option><option>IV</option><option>IM</option><option>SC</option><option>INH</option><option>TOP</option><option>PR</option></select></div>" +
    "<div><label>Frequency</label><input id='meFreq' placeholder='q6h'></div>" +
    "<div><label>Scheduled at</label><input type='datetime-local' id='meAt'></div>" +
    "<div><label>Controlled?</label><select id='meCtl'><option value=''>No</option><option value='1'>Yes — needs witness</option></select></div></div>" +
    "<div style='display:flex;gap:8px;margin-top:8px;flex-wrap:wrap'><button class='btn btn-p btn-sm' onclick='saveMarEntry()'>+ Schedule dose</button>" +
    (lastRx ? "<button class='btn btn-o btn-sm' onclick='importRxToMar()'>＋ From latest Rx (" + esc(String(lastRx.date || "")) + ")</button>" : "") + "</div></div>" + cards;
}

window.renderMar = renderMar;
window.marDueHTML = marDueHTML;

window.saveMarEntry = function () {
  var c = child(); if (!c) return;
  var e = {
    id: uid(), drug: $("meDrug").value.trim(), dose: $("meDose").value.trim(),
    route: $("meRoute").value, freq: $("meFreq").value.trim(),
    scheduledAt: $("meAt").value, controlled: $("meCtl").value === "1",
    status: "scheduled", logs: []
  };
  var errs = entryValid(e);
  if (errs.length) { alert(errs.join("\n")); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("mar-entry")) return;
  marOf(c).unshift(e);
  try { if (typeof auditSafe === "function") auditSafe("MAR schedule", e.drug + " for " + c.name); } catch (e2) {}
  save(); renderAll();
};
window.importRxToMar = function () {
  var c = child(); if (!c || !(c.rx || []).length) return;
  var lastRx = c.rx[c.rx.length - 1], n = 0;
  (lastRx.items || []).forEach(function (d) {
    marOf(c).unshift({
      id: uid(), drug: d.drug || "?", dose: [d.take, d.strength].filter(Boolean).join(" ") || "",
      route: "PO", freq: d.freq || "", scheduledAt: "", controlled: false, status: "scheduled", logs: [], note: "from Rx " + (lastRx.date || "")
    });
    n++;
  });
  if (!n) { alert("Latest Rx has no items."); return; }
  try { if (typeof auditSafe === "function") auditSafe("MAR import", n + " item(s) from Rx for " + c.name); } catch (e) {}
  save(); renderAll();
};
window.logMarDose = function (id, isCtl) {
  var c = child(); if (!c) return;
  var list = marOf(c), ix = -1, i;
  for (i = 0; i < list.length; i++) if (list[i].id === id) ix = i;
  if (ix < 0) return;
  var now = new Date();
  var at = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0") +
    "T" + String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  var r = logDose(list[ix], {
    at: at, by: $("mlBy_" + id).value.trim(), status: $("mlSt_" + id).value,
    witness: isCtl ? $("mlWt_" + id).value.trim() : ""
  });
  if (!r.ok) { alert(r.error); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("mar-log-" + id)) return;
  list[ix] = r.entry;
  try { if (typeof auditSafe === "function") auditSafe("MAR log", list[ix].drug + " " + list[ix].status + " — " + c.name); } catch (e) {}
  save(); renderAll();
};

})();

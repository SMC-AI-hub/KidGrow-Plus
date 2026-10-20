/* NeoKid Care — event delegation (E2). Replaces inline on* handlers so CSP can
   drop 'unsafe-inline'. One listener per event type; actions route via
   data-act (click), data-oninput, data-onchange, data-onkey, data-onfocus,
   data-onblur. Args via data-arg / data-arg2. Every action is registered by
   name — tests/csp.test.js proves every used action is registered and no
   inline handlers remain in converted files. */
var Act = {};
function actRegister(name, fn) {
  try { Act[name] = fn; } catch (e) {}
  return fn;
}
function actArg(el, n) {
  try { return el.getAttribute(n === 2 ? "data-arg2" : "data-arg"); } catch (e) { return null; }
}
function actReport(name, e) {
  try { if (typeof errBeaconSend === "function") errBeaconSend("act:" + name, (e && e.message) || "action threw"); } catch (e2) {}
  try { if (typeof console !== "undefined" && console.error) console.error("NeoKid Care action failed: " + name, e); } catch (e3) {} /* LOGGING POLICY: console.error for delegated-action faults only (action name + exception). Never log patient data — see docs/OPERATIONS.md. */
}
function actRun(name, el, ev) {
  var fn = null;
  try { fn = Act[name]; } catch (e) {}
  if (typeof fn !== "function") return false;
  try { fn(el, ev); } catch (e) { actReport(name, e); }
  return true;
}
function actDispatch(ev, attr) {
  try {
    var t = ev && ev.target;
    var el = (t && t.closest) ? t.closest("[" + attr + "]") : null;
    if (!el || (el.disabled && attr === "data-act")) return;
    var name = el.getAttribute(attr);
    if (name) actRun(name, el, ev);
  } catch (e) {}
}
try {
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("click", function (ev) { actDispatch(ev, "data-act"); });
    document.addEventListener("input", function (ev) { actDispatch(ev, "data-oninput"); });
    document.addEventListener("change", function (ev) { actDispatch(ev, "data-onchange"); });
    document.addEventListener("keydown", function (ev) { actDispatch(ev, "data-onkey"); });
    document.addEventListener("focus", function (ev) { actDispatch(ev, "data-onfocus"); }, true);
    document.addEventListener("blur", function (ev) { actDispatch(ev, "data-onblur"); }, true);
  }
} catch (e) {}

/* ---------------- static (index.html) actions ----------------
   Convention: zero-arg globals as () => Name(); literal-arg as read data-arg;
   element-dependent reads el.value / el.checked; event-dependent uses ev. */
function actCall0(name) { actRegister(name, function () { try { window[name](); } catch (e) { actReport(name, e); } }); }
["saveSettings", "printCertificate", "openChildModal", "exportData", "voiceToggle",
  "voiceClear", "undoLastImport", "toggleTheme", "toggleNav", "toggleMeasureTable",
  "toggleFullRange", "snoozeBackup", "saveVisit", "saveVaccine", "saveTanner",
  "saveStock", "saveGrowth", "saveExtra", "saveChild", "saveAppt", "removeLogo",
  "printMilestonesFull", "printGrowthSheet", "printGrowthFull", "openVisitModal",
  "openMergeModal", "openGrowthModal", "kgUpdate", "installApp", "factoryReset",
  "exportMilestonesCSV", "doLogin", "confirmMerge", "clearVaccine", "savePrintPref",
  "renderChildren", "pickFilter"
].forEach(actCall0);
actRegister("toggleNavSec", function (el) { try { toggleNavSec(actArg(el)); } catch (e) { actReport("toggleNavSec", e); } });
actRegister("setTheme", function (el) { try { setTheme(actArg(el)); } catch (e) { actReport("setTheme", e); } });
actRegister("printPage", function (el) { try { printPage(actArg(el)); } catch (e) { actReport("printPage", e); } });
actRegister("goPage", function (el) { try { go(actArg(el)); } catch (e) { actReport("goPage", e); } });
actRegister("closeModal", function (el) { try { closeModal(actArg(el)); } catch (e) { actReport("closeModal", e); } });
actRegister("syncLotFields", function (el) { try { syncLotFields(actArg(el)); } catch (e) { actReport("syncLotFields", e); } });
actRegister("toggleCorrAge", function (el) { try { toggleCorrAge(el.checked); } catch (e) { actReport("toggleCorrAge", e); } });
actRegister("importData", function (el, ev) { try { importData(ev); } catch (e) { actReport("importData", e); } });
actRegister("handleLogoFile", function (el) { try { handleLogoFile(el); } catch (e) { actReport("handleLogoFile", e); } });
actRegister("filterNav", function (el) { try { filterNav(el.value); } catch (e) { actReport("filterNav", e); } });
actRegister("pickKey", function (el, ev) { try { pickKey(ev); } catch (e) { actReport("pickKey", e); } });
actRegister("childSearchKey", function (el, ev) { try { childSearchKey(ev); } catch (e) { actReport("childSearchKey", e); } });
actRegister("clickImportFile", function () { try { document.getElementById("importFile").click(); } catch (e) { actReport("clickImportFile", e); } });
actRegister("backupWatchGo", function () { try { closeModal("mBackupWatch"); go("export"); } catch (e) { actReport("backupWatchGo", e); } });
actRegister("buildSummaryPrint", function () { try { buildSummary(); printPage("pg-summary"); } catch (e) { actReport("buildSummaryPrint", e); } });
actRegister("deleteExtraFromForm", function () { try { deleteExtra(document.getElementById("xId").value); } catch (e) { actReport("deleteExtraFromForm", e); } });
actRegister("exApplyTemplate", function () { try { Ex.applyTemplate(document.getElementById("vsTemplate").value); } catch (e) { actReport("exApplyTemplate", e); } });
actRegister("exInsertExam", function () { try { Ex.insertExam(); } catch (e) { actReport("exInsertExam", e); } });
actRegister("cmdkOpen", function () { try { CmdK.open(); } catch (e) { actReport("cmdkOpen", e); } });
actRegister("navFilterKey", function (el, ev) { try { if (ev.key === "Escape") { el.value = ""; filterNav(""); } } catch (e) { actReport("navFilterKey", e); } });
actRegister("lockPinKey", function (el, ev) { try { if (ev.key === "Enter") doLogin(); } catch (e) { actReport("lockPinKey", e); } });
actRegister("pickBlur", function () { try { setTimeout(function () { var r = document.getElementById("childPickRes"); if (r) r.style.display = "none"; }, 180); } catch (e) { actReport("pickBlur", e); } });

try { if (typeof window !== "undefined") { window.Act = Act; window.actRegister = actRegister; } } catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = { Act, actRegister }; } catch (e2) {}

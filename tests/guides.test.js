// G1 guideline-source framework — resolution + validator gates.
// Proves: defaults, override precedence, global-if-supported, gating to the
// validated status quo (Mayo TSH / NICE jaundice) until the validator enables
// a new mode, and sanitising of unknown values. Wires into no clinical code.
// Use: node tests/guides.test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("FAIL: " + m); } };

const sb = {};
sb.window = sb; sb.self = sb; sb.globalThis = sb;
vm.createContext(sb);
try { vm.runInContext(fs.readFileSync(path.join(R, "js/guides.js"), "utf8"), sb, { filename: "js/guides.js" }); }
catch (e) { console.log("LOAD FAIL: js/guides.js: " + e.message); process.exit(1); }
const ev = (code) => vm.runInContext(code, sb);
const setDB = (settings) => { sb.DB = { settings: settings }; };

// ---- support map + meta ----
ok(ev(`GUIDE_SUPPORT.tsh.join() === "aiims,aap,mayo" && GUIDE_SUPPORT.bili.join() === "nice,iap,nnf,aap"`), "support map: tsh 3, bili 4");
ok(ev(`GUIDE_GLOBAL_CHOICES.join() === "aiims,aap,iap,nnf" && GUIDE_GLOBAL_DEFAULT === "aiims"`), "global choices + aiims default");
ok(ev(`GUIDE_STATUS_QUO.tsh === "mayo" && GUIDE_STATUS_QUO.bili === "nice"`), "status quo: mayo/nice");
ok(ev(`["aiims","aap","mayo","nice","iap","nnf"].every(s => GUIDE_META[s] && GUIDE_META[s].label && GUIDE_META[s].note)`), "meta labels+notes for all 6 sources");

// ---- fresh DB: requested follows global-default, effective stays status quo (gated) ----
setDB({});
ok(ev(`guideRequested("tsh") === "aiims"`), "fresh: tsh requested aiims (global default)");
ok(ev(`guideRequested("bili") === "nice"`), "fresh: bili requested nice (global aiims unsupported -> fallback)");
ok(ev(`guideEffective("tsh") === "mayo" && guideEffective("bili") === "nice"`), "fresh: effective mayo/nice (zero clinical change pre-sign-off)");
ok(ev(`guidePending("tsh") === "aiims" && guidePending("bili") === null`), "fresh: tsh aiims pending, bili nothing pending");

// ---- explicit overrides ----
setDB({ guideTSH: "mayo" });
ok(ev(`guideRequested("tsh") === "mayo" && guideEffective("tsh") === "mayo" && guidePending("tsh") === null`), "override mayo: direct, no pending");
setDB({ guideTSH: "aiims" });
ok(ev(`guideRequested("tsh") === "aiims" && guideEffective("tsh") === "mayo" && guidePending("tsh") === "aiims"`), "override aiims gated until enabled");
setDB({ guideTSH: "aiims", guideEnabled: { tsh_aiims: true } });
ok(ev(`guideEffective("tsh") === "aiims" && guidePending("tsh") === null`), "override aiims flows once enabled");

// ---- global routing ----
setDB({ guideSource: "aap" });
ok(ev(`guideRequested("tsh") === "aap" && guideRequested("bili") === "aap"`), "global aap routes to both modules");
ok(ev(`guideEffective("tsh") === "mayo" && guideEffective("bili") === "nice"`), "global aap gated pre-sign-off");
setDB({ guideSource: "aap", guideEnabled: { tsh_aap: true, bili_aap: true } });
ok(ev(`guideEffective("tsh") === "aap" && guideEffective("bili") === "aap"`), "global aap flows post-sign-off");
setDB({ guideSource: "iap" });
ok(ev(`guideRequested("tsh") === "mayo" && guideRequested("bili") === "iap"`), "global iap: tsh falls back to mayo, bili takes iap");
setDB({ guideSource: "nnf", guideBili: "auto", guideEnabled: { bili_nnf: true } });
ok(ev(`guideRequested("bili") === "nnf" && guideEffective("bili") === "nnf"`), "global nnf + auto bili -> nnf once enabled");
setDB({ guideSource: "nnf", guideTSH: "aap", guideEnabled: { tsh_aap: true } });
ok(ev(`guideEffective("tsh") === "aap"`), "override beats global (tsh aap over global nnf)");

// ---- sanitising ----
setDB({ guideSource: "xyz", guideTSH: "zzz", guideBili: "nope" });
ok(ev(`guideRequested("tsh") === "mayo" && guideRequested("bili") === "nice"`), "garbage values sanitise to status quo");
ok(ev(`guideRequested("zzz") === null && guideEffective("zzz") === null && guidePending("zzz") === null`), "unknown module -> null");
ok(ev(`guideEnabled("tsh", "mayo") && guideEnabled("bili", "nice")`), "status quo always enabled, even with empty gates");
ok(ev(`guideEnabled("tsh", "xyz") === false && guideEnabled("zzz", "mayo") === false`), "unknown mode/module never enabled");

console.log(`guides: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

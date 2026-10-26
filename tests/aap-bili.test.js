// G5 AAP 2022 jaundice engine — own nomogram curves (GA 35-40+ x neurotox
// risk), escalation band, >=2-below-start stop rule, distance-based follow-up,
// post-photo rebound timing, TcB confirmation. Thresholds transcribed from the
// PediTools bili2022 API (Kemper-validated); validator must still verify vs
// CPG print figures before enabling bili_aap.
// Use: node tests/aap-bili.test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("FAIL: " + m); } };

const sb = {};
sb.window = sb; sb.self = sb; sb.globalThis = sb;
sb.document = { querySelectorAll: () => [] };
vm.createContext(sb);
for (const f of ["js/guides.js", "js/cdata.gen.js", "js/nicu.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f }); }
  catch (e) { console.log("LOAD FAIL: " + f + ": " + e.message); process.exit(1); }
}
const ev = (code) => vm.runInContext(code, sb);
const setDB = (s) => { sb.DB = { settings: s }; };
const flag = (v, ga, h, x) => ev(`NicuPure.biliFlag(${v}, ${ga}, ${h}, ${JSON.stringify(x || {})})`);
const advise = (v, ga, h, x) => ev(`NicuPure.biliAdvise(${v}, ${ga}, ${h}, ${JSON.stringify(x || {})})`);
const aapT = (ga, h, x) => ev(`NicuPure.aapThreshold(${ga}, ${h}, ${JSON.stringify(x || {})})`);

// ---- data present (40w 48h photo idx 8 = 17.0; exch 24.0) ----
ok(ev(`KGCONTENT.aapbili.hours.length === 30`), "aapbili: 30 grid hours");
ok(ev(`KGCONTENT.aapbili.photo.none["40"][8] === 17 && KGCONTENT.aapbili.exch.none["40"][8] === 24`), "aapbili: 40w/48h photo 17 exch 24");
ok(ev(`KGCONTENT.aapbili.rules.escalationBelowExchMg === 2 && KGCONTENT.aapbili.rules.followBelow.length === 4`), "aapbili: rules block");

// ---- curve lookup: completed weeks, caps, scope ----
ok((() => { const t = aapT(40, 48, {}); return t.photoMg === 17 && t.exchMg === 24 && t.risk === false && t.gaCol === "40"; })(), "curve 40w48h no-risk");
ok(aapT(35, 24, { risks: ["sepsis"] }).photoMg === 8.9, "curve 35w24h risk = 8.9");
ok(aapT(39, 96, {}).photoMg === 21.5, "curve 39w96h = 21.5");
ok(aapT(35.9, 48, {}).gaCol === "35", "completed weeks: 35.9 -> col 35");
ok((() => { const t = aapT(41, 48, {}); return t.gaCol === "40" && t.dispGa === "≥40"; })(), "41w -> 40+ column");
ok(aapT(34, 48, {}) === null, "<35w -> null (out of scope)");
ok(aapT(null, 48, {}) === null, "unknown GA -> null");
ok((aapT(40, 400, {}) || {}).note === "Beyond AAP figure range (336h) — use unit protocol.", ">336h -> range note");
ok((() => { const a = aapT(40, 48, {}).photoMg, b = aapT(40, 51, {}).photoMg, c = aapT(40, 54, {}).photoMg; return b > a && b < c; })(), "interpolation: 51h between 48h and 54h");

// ---- risk selection: 6 neurotox factors; prematurity via column ----
ok(aapT(38, 48, { risks: ["g6pd"] }).photoMg === 14, "g6pd selects risk curve (14.0)");
ok(aapT(38, 48, { risks: ["sibPhoto"] }).photoMg === 16, "non-AAP risk keeps no-risk curve (16.0)");
ok(ev(`NicuPure.aapHasRisk({ risks: ["datPos"] })`) === true, "datPos is neurotox risk");
ok(ev(`NicuPure.aapHasRisk({ risks: ["bloodIncompat"] })`) === false, "blood-group incompatibility alone is NOT (needs DAT disease)");
ok(ev(`NicuPure.aapHasRisk({})`) === false, "no risks -> false");

setDB({ guideBili: "aap", guideEnabled: { bili_aap: true } });
ok(ev(`NicuPure.biliMode()`) === "aap", "aap: mode effective");

// ---- bands at 40w/72h (photo 19.8, escl 23.9, exch 25.9), >= semantics ----
ok((() => { const r = flag(239, 40, 72, {}); return r.band === "below" && r.tier === "info" && r.src === "aap"; })(), "14.0 mg/dL -> below");
ok((() => { const r = flag(342, 40, 72, {}); return r.band === "photo" && r.tier === "warn" && /intensive phototherapy/.test(r.text); })(), "20.0 -> photo warn");
ok(flag(339, 40, 72, {}).band === "photo", "at-threshold 19.8 -> photo (>=)");
ok((() => { const r = flag(410, 40, 72, {}); return r.band === "escalation" && r.tier === "warn" && /ESCALATION/.test(r.text) && /exchange-capable/.test(r.text); })(), "24.0 -> escalation warn");
ok(flag(407, 40, 72, {}).band === "photo", "23.8 (just under escl 23.9) -> photo");
ok((() => { const r = flag(445, 40, 72, {}); return r.band === "exchange" && /urgent exchange/.test(r.text) && /IVIG/.test(r.text); })(), "26.0 -> exchange + IVIG note");
ok((() => { const a = flag(154, 35, 24, { risks: ["sepsis"] }), b = flag(154, 35, 24, {}); return a.band === "photo" && b.band === "below"; })(), "9.0 @35w24h: photo on risk curve, below on no-risk");

// ---- distance follow-up tiers (40w/72h, photo 19.8) ----
ok(advise(313, 40, 72, {}).join(";").indexOf("TSB in 4 to 24 hours") >= 0, "1.5 below -> strict TSB 4-24h");
ok(advise(313, 40, 72, {}).join(";").indexOf("delay discharge") >= 0, "1.5 below -> discharge options");
ok(advise(296, 40, 72, {}).join(";").indexOf("TSB or TcB in 4 to 24 hours") >= 0, "2.5 below -> TSB-or-TcB 4-24h");
ok(advise(262, 40, 72, {}).join(";").indexOf("1 to 2 days") >= 0, "4.5 below -> 1-2 days");
ok(advise(227, 40, 72, {}).join(";").indexOf("clinical judgment") >= 0, "6.5 below -> clinical judgment");
ok(advise(306, 40, 72, {}).join(";").indexOf("Measure TSB in 4 to 24 hours") >= 0, "boundary 1.9 -> strict");
ok(advise(304, 40, 72, {}).join(";").indexOf("TSB or TcB in 4 to 24 hours") >= 0, "boundary 2.0 -> 4-24h");
ok(advise(280, 40, 72, {}).join(";").indexOf("TSB or TcB in 4 to 24 hours") >= 0, "boundary 3.4 -> 4-24h");
ok(advise(279, 40, 72, {}).join(";").indexOf("1 to 2 days") >= 0, "boundary 3.5 -> 1-2d");
ok(advise(246, 40, 72, {}).join(";").indexOf("1 to 2 days") >= 0, "boundary 5.4 -> 1-2d");
ok(advise(245, 40, 72, {}).join(";").indexOf("clinical judgment") >= 0, "boundary 5.5 -> judgment");

// ---- stop rule: >=2 below START threshold (40w start 48h -> T0 17.0) ----
ok((() => { const s = advise(248, 40, 72, { photo: "on", photoStartHrs: 48 }).join(";"); return s.indexOf("consider stopping") >= 0 && s.indexOf("17") >= 0 && s.indexOf("48h") >= 0; })(), "14.5 on-photo start48 -> stop (quotes T0)");
ok(advise(248, 40, 72, { photo: "on", photoStartHrs: 48 }).join(";").indexOf("consider longer") < 0, "no rebound risks -> no longer-line");
ok(advise(137, 37, 72, { photo: "on", photoStartHrs: 50 }).join(";").indexOf("consider longer") >= 0, "GA37 stop -> consider longer");
ok(advise(282, 40, 72, { photo: "on", photoStartHrs: 48 }).join(";").indexOf("consider stopping") < 0, "16.5 above T0-2 -> no stop");
ok(advise(248, 40, 72, { photo: "on" }).join(";").indexOf("record photo-start age") >= 0, "on-photo unknown start -> record prompt");

// ---- on-photo monitoring cadence (JHACH) ----
ok(advise(359, 40, 72, { photo: "on", photoStartHrs: 60 }).join(";").indexOf("12-24h") >= 0, "above line, low concern -> 12-24h recheck");
ok(advise(359, 40, 72, { photo: "on", photoStartHrs: 60, haem: true }).join(";").indexOf("3-6h") >= 0, "above line + haem -> 3-6h recheck");
ok(advise(359, 40, 72, { photo: "on", photoStartHrs: 40 }).join(";").indexOf("recheck TSB within") < 0, "32h after start -> no initiation recheck");

// ---- post-stop rebound timing ----
ok((() => { const s = advise(250, 40, 72, { photo: "off", photoStartHrs: 30 }).join(";"); return s.indexOf("6-12h") >= 0 && s.indexOf("next day") >= 0; })(), "start<48 -> 6-12h + next day");
ok(advise(250, 40, 72, { photo: "off", photoStartHrs: 60, risks: ["datPos"] }).join(";").indexOf("6-12h") >= 0, "DAT+ -> 6-12h + next day");
ok((() => { const s = advise(250, 40, 72, { photo: "off", photoStartHrs: 60 }).join(";"); return s.indexOf("repeat bilirubin next day") >= 0 && s.indexOf("6-12h") < 0; })(), "low rebound risk -> next day only");
ok(advise(250, 40, 72, { photo: "off" }).join(";").indexOf("start age unknown") >= 0, "unknown start -> safe-side 6-12h");

// ---- TcB confirmation (40w/72h photo 19.8; near = >=16.8) ----
ok(advise(299, 40, 72, { kind: "tcb" }).join(";").indexOf("confirm with TSB") >= 0, "TcB 17.5 near line -> confirm");
ok(advise(265, 40, 72, { kind: "tcb" }).join(";").indexOf("confirm with TSB") >= 0, "TcB 15.5 far but >=15 -> confirm");
ok(advise(239, 40, 72, { kind: "tcb" }).join(";").indexOf("confirm with TSB") < 0, "TcB 14.0 far -> no confirm");

// ---- scope fallback + gating ----
ok(advise(306, 34, 48, {}).join(";").indexOf("Outside AAP scope") >= 0, "advise <35w -> OOS line");
ok(advise(210, null, 48, {}).join(";").indexOf("GA unknown") >= 0, "advise unknown GA -> record line");
ok((flag(300, 40, 400, {}) || {}).band === "info", ">336h flag -> info note");
setDB({ guideBili: "aap" });
ok(ev(`NicuPure.biliMode()`) === "nice", "un-enabled aap request stays NICE");
setDB({});

// ---- chip integration ----
setDB({ guideBili: "aap", guideEnabled: { bili_aap: true } });
ok(ev(`NicuPure.roundBiliChip({ bili: { tsb: 342, ageHrs: 72 } }, 40)`).indexOf("⚠️") === 0, "chip: AAP photo band warns");
ok(ev(`NicuPure.roundBiliChip({ bili: { tsb: 262, ageHrs: 72 } }, 40)`).indexOf("1 to 2 days") >= 0, "chip: follow-up line appended");

console.log(`aap-bili: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

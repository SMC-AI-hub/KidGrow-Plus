// G3 jaundice guideline modes — IAP STG 2022 + NNF CPG 2019 sub-threshold /
// monitoring / follow-up rules on shared NICE thresholds, plus NICE 1.4.1/1.4.2
// completion (FLAG-F25a resolved in nice mode with context).
// Sources: IAP STG 2022 Ch-079 (Jain et al); NNF CPG Dec 2019; MoHFW STG 5461
// Table 1; NICE CG98 sections 1.2.16/1.4.1/1.4.2/1.4.5/1.4.6.
// Use: node tests/bili-guides.test.js
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

// ---- data present ----
ok(ev(`KGCONTENT.nicu.biliGuides.risks.length === 16`), "biliGuides: 16 risk factors (11 G3 + 5 G5 AAP)");
ok(ev(`KGCONTENT.nicu.biliGuides.risks.filter(r => r.aap).map(r => r.id).sort().join(",") === "albuminLow,datPos,g6pd,otherHemolytic,sepsis,unstable24"`), "biliGuides: 6 AAP neurotox tags (prematurity via GA column)");
ok(ev(`KGCONTENT.nicu.biliGuides.risks.filter(r => r.nice141).map(r => r.id).join(",") === "sibPhoto,bfIntent"`), "biliGuides: NICE 1.4.1 subset = sibPhoto + bfIntent");
ok(ev(`KGCONTENT.nicu.biliGuides.nnf.tcbMargin === 50 && KGCONTENT.nicu.biliGuides.iap.followRiskHrs === 24`), "biliGuides: NNF-50 / IAP-24h constants");

// ---- NICE status quo (fresh DB, no context): byte-identical to pre-G3 ----
setDB({});
ok(flag(210, 39, 48).text === "Bilirubin 210 in consider-phototherapy zone (>200) — repeat in 6h." && flag(210, 39, 48).src === "nice", "nice: consider text byte-identical");
ok(flag(160, 39, 48).text === "Bilirubin 160 above repeat line (>150) — repeat in 6-12h.", "nice: repeat text byte-identical");
ok(flag(260, 39, 48).band === "photo" && flag(460, 39, 48).band === "exchange", "nice: photo/exchange bands unchanged");
ok(ev(`NicuPure.biliMode()`) === "nice", "nice: biliMode fresh DB");

// ---- NICE 1.4.1 / 1.4.2 completion (context supplied) ----
ok((() => { const r = flag(210, 39, 48, { well: true, risks: ["sibPhoto"] }); return r.band === "consider" && /repeat in 18h/.test(r.text) && /risk factors present/.test(r.text) && /1\.4\.1/.test(r.text); })(), "nice141: risk -> 18h");
ok((() => { const r = flag(210, 39, 48, { well: true, risks: [] }); return /repeat in 24h/.test(r.text) && /no risk factors/.test(r.text); })(), "nice141: no risk -> 24h");
ok((() => { const r = flag(160, 39, 48, { well: true, risks: [] }); return r.band === "repeat" && /do not routinely repeat/.test(r.text) && /1\.4\.2/.test(r.text); })(), "nice142: >50 below -> do not repeat");
ok(flag(150, 39, 18, { well: true, risks: [] }).text.indexOf("repeat in 6h") >= 0, "nice141 gated: <=24h keeps Table-1 text");
ok(flag(210, 39, 48, { well: false, risks: [] }).text.indexOf("repeat in 6h") >= 0, "nice141 gated: unwell keeps Table-1 text");
ok(flag(210, 39, 48, {}).text.indexOf("repeat in 6h") >= 0, "nice141 gated: unknown well keeps Table-1 text");

// ---- NICE advise lines ----
ok(advise(190, 39, 48, { photo: "on" }).join(";").indexOf("NICE 1.4.5") >= 0, "nice advise: stop line carries 1.4.5");
ok(advise(150, 39, 48, { photo: "off" }).join(";").indexOf("12-18h") >= 0, "nice advise: rebound 12-18h after stop");
ok(advise(260, 39, 48, { kind: "tcb", photo: "on" }).join(";").indexOf("NICE 1.2.16") >= 0, "nice advise: TSB-not-TcB on photo");
ok(advise(150, 39, 48, {}).length === 0, "nice advise: silent below line, no context");

// ---- IAP mode ----
setDB({ guideBili: "iap", guideEnabled: { bili_iap: true } });
ok(ev(`NicuPure.biliMode()`) === "iap", "iap: mode effective");
ok((() => { const r = flag(120, 39, 20, {}); return r.band === "severe" && r.tier === "warn" && /exchange-capable/.test(r.text); })(), "iap: <24h jaundice -> severe warn");
ok((() => { const r = flag(210, 39, 48, { risks: ["sibPhoto"] }); return r.band === "followup" && /within 24h/.test(r.text) && r.src === "iap"; })(), "iap: risk -> review 24h");
ok((() => { const r = flag(150, 36, 48, { risks: [] }); return r.band === "followup" && /within 24h/.test(r.text) && /preterm38/.test(r.text); })(), "iap: preterm36 auto-risk -> 24h");
ok((() => { const r = flag(150, 39, 48, { risks: [] }); return /within 48h/.test(r.text); })(), "iap: no risk <=72h -> 48h");
ok((() => { const r = flag(150, 39, 80, { risks: [] }); return /routine follow-up/.test(r.text); })(), "iap: no risk >72h -> routine");
ok(flag(260, 39, 48, {}).band === "photo", "iap: shared NICE thresholds (photo band)");
ok(advise(190, 39, 48, { photo: "on" }).join(";").indexOf("2-3 mg/dL") >= 0, "iap advise: stop cites 2-3 below");
ok(advise(150, 39, 48, { photo: "off", haem: true }).join(";").indexOf("within 24h") >= 0, "iap advise: post-stop haem -> 24h");
ok(advise(260, 39, 48, { photo: "on" }).join(";").indexOf("photo failure") >= 0, "iap advise: on photo above line -> 4-6h recheck + failure rule");

// ---- NNF mode ----
setDB({ guideBili: "nnf", guideEnabled: { bili_nnf: true } });
ok((() => { const r = flag(230, 39, 48, { kind: "tcb" }); return r.band === "confirm" && /confirm with TSB/.test(r.text) && r.src === "nnf"; })(), "nnf: TcB near line -> confirm TSB");
ok(flag(150, 39, 48, { kind: "tcb" }).band === "observe", "nnf: TcB far from line -> observe");
ok((() => { const r = flag(420, 39, 48, {}); return r.band === "photo" && r.tier === "warn"; })(), "nnf: near exchange keeps photo warn band");
ok(advise(420, 39, 48, {}).join(";").indexOf("every 4-6h") >= 0, "nnf advise: near exchange -> q4-6h");
ok((() => { const s = advise(420, 39, 48, { prevUmol: 430 }).join(";"); return s.indexOf("every 8-12h") >= 0 && s.indexOf("declining") >= 0; })(), "nnf advise: near exchange declining -> q8-12h");
ok((() => { const r = flag(120, 39, 6, {}); return r.band === "monitor" && /every 4-6h/.test(r.text); })(), "nnf: below-photo near line (6h) -> monitor band");
ok((() => { const r = flag(150, 39, 48, {}); return r.band === "observe" && /every 12h/.test(r.text); })(), "nnf: below line -> VA q12h");
ok(advise(150, 39, 30, { risks: ["g6pd"] }).join(";").indexOf("24h after discharge") >= 0, "nnf advise: risk <48h -> 24h visit");
ok(advise(150, 39, 50, {}).join(";").indexOf("48h after discharge") >= 0, "nnf advise: no risk -> 48h visit");
ok(advise(150, 39, 80, {}).join(";").indexOf("optional after discharge") >= 0, "nnf advise: no risk >72h -> optional");
ok(advise(260, 39, 48, { kind: "tcb", photo: "on" }).join(";").indexOf("TSB (not TcB)") >= 0, "nnf advise: TSB-not-TcB on photo");
ok(advise(150, 39, 48, { photo: "off", haem: true }).join(";").indexOf("12-24h") >= 0, "nnf advise: post-stop haem -> 12-24h TSB");
ok(advise(190, 39, 48, { photo: "on", haem: true }).join(";").indexOf("2nd consecutive") >= 0, "nnf advise: haem stop needs 2nd value");

// ---- haem-aware stop gate ----
ok((() => { const a = ev(`NicuPure.biliStop(200, 39, 48, true)`), b = ev(`NicuPure.biliStop(200, 39, 48, false)`), c = ev(`NicuPure.biliStop(200, 39, 48)`); return a.stop && a.needsTwo && b.stop && !b.needsTwo && c.stop && !c.needsTwo; })(), "biliStop: haem-aware needsTwo, default unchanged");

// ---- gating: un-enabled request falls back to NICE ----
setDB({ guideBili: "nnf" });
ok(ev(`NicuPure.biliMode()`) === "nice" && flag(230, 39, 48, { kind: "tcb" }).src === "nice", "gated nnf request still NICE");

// ---- AAP live (G5 engine) + out-of-scope delegation ----
setDB({ guideBili: "aap", guideEnabled: { bili_aap: true } });
ok((() => { const r = flag(210, 39, 48, {}); return r.src === "aap" && r.band === "below"; })(), "aap live: real AAP band (G5 engine)");
ok(advise(210, 39, 48, {}).join(";").indexOf("G5") < 0, "aap live: G5 placeholder gone");
ok((() => { const r = flag(210, 34, 48, {}); return r.src === "aap-oos" && r.band === "photo"; })(), "aap <35w: NICE delegation, labelled oos");
ok(advise(210, 34, 48, {}).join(";").indexOf("Outside AAP scope") >= 0, "aap <35w: explicit out-of-scope line");

// ---- chip integration ----
setDB({});
ok(ev(`NicuPure.roundBiliChip({ bili: { tsb: 190, ageHrs: 48, photo: "on" } }, 39)`).indexOf("consider stopping") >= 0, "chip nice: stop hint kept");
ok(ev(`NicuPure.roundBiliChip({ bili: { tsb: 14.6, ageHrs: 48 } }, 39)`) === "Bili 14.6µ@48h", "chip nice: plain sub-threshold byte-identical");
setDB({ guideBili: "nnf", guideEnabled: { bili_nnf: true } });
ok(ev(`NicuPure.roundBiliChip({ bili: { tsb: 150, ageHrs: 48 } }, 39)`).indexOf("48h after discharge") >= 0, "chip nnf: advise appended");

console.log(`bili-guides: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

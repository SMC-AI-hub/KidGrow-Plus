// G2 TSH guideline modes — ISPAE-2018 (AIIMS) + AAP-2023 vs Mayo status quo.
// Pins: Table II neonatal bands (incl. LAB1 fix), action cutoffs, persistence
// (history-aware), preterm 95th uppers, Mayo hybrid beyond 28d, gating.
// Sources: Behura et al, Indian Pediatr 2023;60:855-856, Tables I+II.
// Use: node tests/tsh-guides.test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("FAIL: " + m); } };

const sb = {};
sb.window = sb; sb.self = sb; sb.globalThis = sb;
vm.createContext(sb);
for (const f of ["js/guides.js", "js/cdata.gen.js", "js/labpanels.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f }); }
  catch (e) { console.log("LOAD FAIL: " + f + ": " + e.message); process.exit(1); }
}
const ev = (code) => vm.runInContext(code, sb);
const setDB = (s) => { sb.DB = { settings: s }; };
const tsh = (ageM, v, x) => ev(`LabX.tsh(${ageM}, ${v}, ${JSON.stringify(x || {})})`);

// ---- data present ----
ok(ev(`KGCONTENT.labpanels.tshNeo.termBands.length === 7 && KGCONTENT.labpanels.tshNeo.pretermHi.length === 2`), "tshNeo: 7 term bands + 2 preterm rows");
ok(ev(`KGCONTENT.labpanels.tshNeo.ispae.treatNow === 80 && KGCONTENT.labpanels.tshNeo.aap.treatNow === 40`), "tshNeo: ISPAE-80 / AAP-40 treat cutoffs");

// ---- Mayo status quo (fresh + gated): byte-identical to pre-G2 ----
setDB({});
ok(tsh(0, 10).label === "High TSH 10 (range 0.7–8.4) — check free T4, growth velocity, antibodies; refer endocrinology." && tsh(0, 10).sev === "amber", "mayo: LAB1 repro pin (byte-identical label)");
ok(tsh(0, 10).src === "mayo", "mayo: src field");
setDB({ guideTSH: "aiims" });
ok(tsh(0, 10).sev === "amber" && tsh(0, 10).src === "mayo", "gated aiims request still Mayo");

// ---- AIIMS mode ----
setDB({ guideTSH: "aiims", guideEnabled: { tsh_aiims: true } });
ok((() => { const r = tsh(0, 10, { ageD: 10 }); return r.sev === "green" && r.src === "aiims" && /10\.72/.test(r.label) && /ISPAE-2018/.test(r.label); })(), "aiims: LAB1 FIXED — d10 TSH 10 in neonatal range");
ok((() => { const r = tsh(0, 22, { ageD: 1 }); return r.sev === "amber" && /repeat TSH in 7-10 days/.test(r.label); })(), "aiims: d1 22 (in-band but 20-40) -> repeat prompt");
ok((() => { const r = tsh(0, 50, { ageD: 3 }); return r.sev === "red" && /immediate confirmatory/.test(r.label); })(), "aiims: d3 50 -> immediate confirmatory");
ok((() => { const r = tsh(0, 85, { ageD: 5 }); return r.sev === "red" && /START L-T4/.test(r.label); })(), "aiims: d5 85 -> treat now");
ok((() => { const r = tsh(0, 12, { ageD: 25 }); return r.sev === "amber" && /beyond 3 wk/.test(r.label) && /1-2 wk/.test(r.label); })(), "aiims: d25 12 no prior -> recheck for persistence");
ok((() => { const r = tsh(0, 12, { ageD: 25, priorV: 11 }); return r.sev === "red" && /persistently/.test(r.label); })(), "aiims: d25 12 + prior 11 -> persistent, treat");
ok((() => { const r = tsh(0, 0.8, { ageD: 10 }); return r.sev === "amber" && /Low TSH/.test(r.label); })(), "aiims: d10 0.8 low");
ok(tsh(0, 10.72, { ageD: 10 }).sev === "green" && tsh(0, 10.73, { ageD: 10 }).sev === "amber", "aiims: Table II d10 upper edge 10.72 exact");

// ---- AIIMS preterm 95th uppers ----
ok(tsh(0, 13, { ageD: 5, gaWk: 30 }).sev === "green", "preterm 30w d5 13 normal (wk1 13.1)");
ok((() => { const r = tsh(0, 14, { ageD: 5, gaWk: 30 }); return r.sev === "amber" && /95th/.test(r.label); })(), "preterm 30w d5 14 high, labelled 95th");
ok(tsh(0, 9.5, { ageD: 20, gaWk: 30 }).sev === "amber", "preterm 30w d20 9.5 high (wk34 9)");
ok(tsh(0, 11, { ageD: 50, gaWk: 25 }).sev === "green", "preterm 25w d50 11 normal (wk34 11.8, PMA 32w)");
ok(tsh(0, 8.5, { ageD: 40, gaWk: 31 }).sev === "amber", "preterm 31w d40 8.5 high (36wk-PMA 8)");

// ---- AIIMS hybrid beyond 28d + unknown ageD ----
ok((() => { const r = tsh(6, 5.5, { ageD: 190 }); return r.sev === "green" && r.src === "aiims" && /Mayo >28d/.test(r.label); })(), "aiims: 6mo uses Mayo band, labelled hybrid");
ok((() => { const r = tsh(0, 10, {}); return r.sev === "amber" && /DOB needed/.test(r.label); })(), "aiims: ageM 0 without ageD -> Mayo + DOB note");

// ---- AAP mode ----
setDB({ guideTSH: "aap", guideEnabled: { tsh_aap: true } });
ok((() => { const r = tsh(0, 36, { ageD: 2 }); return r.sev === "amber" && /24-48h/.test(r.label) && /34/.test(r.label); })(), "aap: d2 36 -> 24-48h screen recall");
ok((() => { const r = tsh(0, 45, { ageD: 5 }); return r.sev === "red" && /START L-T4/.test(r.label) && r.src === "aap"; })(), "aap: d5 45 -> treat now");
ok((() => { const r = tsh(0, 25, { ageD: 10 }); return r.sev === "amber" && /confirm within 24h/.test(r.label); })(), "aap: d10 25 -> confirm/treat-if-venous");
ok((() => { const r = tsh(0, 11, { ageD: 35, priorV: 12 }); return r.sev === "red" && /persistently/.test(r.label) && /4 wk/.test(r.label); })(), "aap: d35 persistent >10 -> treat");
ok((() => { const r = tsh(0, 11, { ageD: 35 }); return r.sev === "amber" && /1-2 wk/.test(r.label); })(), "aap: d35 11 no prior -> recheck");
ok((() => { const r = tsh(0, 0.5, { ageD: 10 }); return r.sev === "amber" && /central hypothyroidism/.test(r.label); })(), "aap: low -> central-hypo note");
ok((() => { const r = tsh(0, 10, { ageD: 10 }); return r.sev === "green" && /AAP-2023/.test(r.label); })(), "aap: LAB1 fixed here too (shared Table II bands)");

console.log(`tsh-guides: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

// G4 F1a — Harriet Lane 2026 age gates (implement-first; validator confirms
// vs print). Ibuprofen min age 3->6mo with HL message; paracetamol <3mo
// prescriber-gate + neonatal 10 mg/kg note. Aid, not blocker: values compute,
// warnings ride along (validator may demand hard block later).
// Use: node tests/f1a-gates.test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("FAIL: " + m); } };

const sb = {};
sb.window = sb; sb.self = sb; sb.globalThis = sb;
vm.createContext(sb);
for (const f of ["js/cdata.gen.js", "js/drugs.js", "js/dose.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f }); }
  catch (e) { console.log("LOAD FAIL: " + f + ": " + e.message); process.exit(1); }
}
const ev = (code) => vm.runInContext(code, sb);
const ageCheck = (id, ageM) => ev(`Dose.ageCheck(${JSON.stringify(id)}, ${ageM})`);
const codes = (flags) => (flags || []).map((f) => f.code);

// ---- data pins ----
ok(ev(`drugById("ibu").ageMinM`) === 6, "ibu row: ageMinM 6");
ok(ev(`drugById("para").ageMinM`) === 3, "para row: ageMinM 3");
ok(ev(`KGCONTENT.formulary.drugs.ibu.ageMinM === 6 && KGCONTENT.formulary.drugs.para.ageMinM === 3`), "formulary mirror synced");

// ---- gate boundaries (plan pins) ----
ok(codes(ageCheck("ibu", 5.9)).includes("AGE-MIN"), "ibu 5.9mo -> gated");
ok(ageCheck("ibu", 6.0).length === 0, "ibu 6.0mo -> clear");
ok(codes(ageCheck("para", 2.9)).includes("AGE-MIN"), "para 2.9mo -> gated");
ok(ageCheck("para", 3.0).length === 0, "para 3.0mo -> clear");

// ---- message content ----
ok(ageCheck("ibu", 5)[0].text.indexOf("HL minimum age") >= 0, "ibu gate cites HL minimum age");
ok(ageCheck("para", 2)[0].text.indexOf("workup") >= 0, "para gate demands workup, prescriber decision");
ok((() => { const f = ageCheck("para", 0.5).filter((x) => x.code === "AGE-NEO"); return f.length === 1 && f[0].text.indexOf("10 mg/kg") >= 0; })(), "para 0.5mo -> neonatal 10 mg/kg note");
ok(codes(ageCheck("para", 1.0)).includes("AGE-NEO") === false, "para 1.0mo -> neonatal note clears");

// ---- aid, not blocker: values still compute ----
ok((() => { const r = ev(`calcDose("ibu", 5, 5.9, 0, "TDS", 3)`); return r.ok === true && /mL/.test(r.take) && r.warns.join(";").indexOf("HL minimum age") >= 0; })(), "calc ibu 5.9mo: dose shown WITH HL warning");
ok((() => { const r = ev(`calcDose("para", 4, 0.5, 0, "TDS", 3)`); return r.ok === true && /mL/.test(r.take) && r.warns.length >= 2; })(), "calc para 0.5mo: dose shown with gate + neonatal warns");
ok((() => { const r = ev(`Dose.checkRx({ drugId: "ibu", wtKg: 5, ageM: 5.9, freq: "TDS", child: { name: "T" }, draftItems: [] })`); return codes(r.flags).includes("AGE-MIN") && r.flags.every((f) => f.tier !== "hard"); })(), "checkRx ibu 5.9mo: warn tier, no hard block");
ok((() => { const r = ev(`Dose.checkRx({ drugId: "para", wtKg: 4, ageM: 0.5, freq: "TDS", child: { name: "T" }, draftItems: [] })`); const c = codes(r.flags); return c.includes("AGE-MIN") && c.includes("AGE-NEO") && r.flags.every((f) => f.tier !== "hard"); })(), "checkRx para 0.5mo: both codes, warn only");

// ---- untouched rows ----
ok((() => { const m = ev(`drugById("mef")`); return m.ageMinM === 6 && !m.ageMinMsg; })(), "mef row untouched");
ok(ageCheck("mef", 5)[0].text.indexOf("usual minimum age") >= 0, "mef keeps generic message");
ok(ev(`calcDose("ibu", 20, 24, 0, "TDS", 3)`).warns.filter((w) => /minimum age|HL/.test(w)).length === 0, "ibu 24mo: no age warns");
ok(ev(`Dose.checkRx({ drugId: "para", wtKg: 15, ageM: 24, freq: "TDS", child: { name: "T" }, draftItems: [] })`).flags.length === 0, "clean adult paracetamol: zero flags");

console.log(`f1a-gates: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

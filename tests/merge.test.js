// NeoKid Care — duplicate-patient merge suite (F16, v10.45). Use: node tests/merge.test.js
const M = require("../js/merge.js");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }

const kids = [
  { id: "a", name: "Aarav Sharma", dob: "2024-01-15", mrn: "M1", phone: "999", visits: [{ id: "v1" }], measures: [], rx: [], vaccines: { BCG: { date: "2024-01-16" } } },
  { id: "b", name: "aarav  sharma", dob: "2024-01-15", mrn: "M2", phone: "888", visits: [{ id: "v2" }], measures: [{ id: "m1" }], rx: [], vaccines: { OPV0: { date: "2024-01-16" } } },
  { id: "c", name: "Diya Nair", dob: "2023-03-03", mrn: "M1", phone: "777", visits: [], measures: [], rx: [] },
  { id: "d", name: "Kabir", dob: "2022-06-06", mrn: "M4", phone: "777", visits: [], measures: [], rx: [] },
];
{
  const pairs = M.findDupCandidates(kids);
  ok(pairs.some((p) => (p.a === "a" && p.b === "b") && /name/.test(p.why)), "same name+DOB detected (case/space-insensitive)");
  ok(pairs.some((p) => /MRN/.test(p.why)), "same MRN detected");
  ok(!pairs.some((p) => (p.a === "c" && p.b === "d") || (p.a === "d" && p.b === "c")), "same phone alone (diff DOB) is not a candidate");
  ok(M.findDupCandidates([{ id: "x", name: "Solo", dob: "2020-01-01" }]).length === 0, "no false positives");
}
{
  const db = { children: JSON.parse(JSON.stringify(kids)) };
  const r = M.mergeChildren(db, "a", "b");
  const keep = db.children.find((c) => c.id === "a"), drop = db.children.find((c) => c.id === "b");
  ok(r.ok, "merge succeeds");
  ok(keep.visits.length === 2 && keep.measures.length === 1, "arrays unioned (visits 2, measures 1)");
  ok(keep.vaccines.BCG && keep.vaccines.OPV0, "vaccines unioned by code");
  ok(keep.mrn === "M1" && keep.phone === "999", "keep identity/scalars preserved");
  ok(drop._deleted === true && drop._mergedInto === "a", "drop soft-deleted with merge pointer");
  ok(M.findDupCandidates(db.children).every((p) => p.a !== "b" && p.b !== "b"), "merged record excluded from future candidates");
}
{
  const db = { children: [{ id: "k", name: "K", dob: "2024-01-01", phone: "", visits: [{ id: "v1" }] }, { id: "d", name: "D", dob: "2024-01-01", phone: "555", visits: [{ id: "v1" }, { id: "v9" }] }] };
  const r = M.mergeChildren(db, "k", "d");
  const keep = db.children[0];
  ok(r.ok && keep.phone === "555" && r.filled.includes("phone"), "blank scalars filled from drop");
  ok(keep.visits.length === 2, "duplicate visit ids merged once (no duplication)");
}
{
  const db = { children: [{ id: "k", name: "K" }] };
  ok(!M.mergeChildren(db, "k", "ghost").ok, "missing drop rejected");
  ok(!M.mergeChildren(db, "k", "k").ok, "self-merge rejected");
  ok(!M.mergeChildren(null, "a", "b").ok, "null db safe");
}

console.log(`merge: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

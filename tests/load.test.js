// NeoKid Care — load budgets (F22/F4, v10.46). Synthetic clinics measure the
// real cost of whole-DB stringify + name search at 1k/10k patients and ground
// the localStorage ceiling estimate. Budgets are generous (CI-safe); the suite
// fails only on pathological blow-ups. Use: node tests/load.test.js
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }

function mkChild(i) {
  return {
    id: "c" + i, name: "Patient " + i + " Testname", dob: "2020-01-15", sex: i % 2 ? "boy" : "girl",
    parent: "Parent " + i, phone: "90000" + String(10000 + i), mrn: "M" + i, created: "2025-01-01",
    problems: [{ label: "Asthma", status: "active" }], allergies: [], birthWt: 2.8,
    vaccines: { BCG: { date: "2020-01-16" }, OPV0: { date: "2020-01-16" }, PENTA1: { date: "2020-03-01" }, PENTA2: { date: "2020-04-01" }, PENTA3: { date: "2020-05-01" }, MR1: { date: "2020-10-15" } },
    visits: [0, 1, 2, 3, 4].map((k) => ({ id: "v" + i + "_" + k, date: "2026-0" + (k + 1) + "-10", type: "Sick", subj: "fever with cough since 2 days", obj: "throat congested, chest clear", plan: "paracetamol, review in 2 days", vitals: { t: "38.6", hr: "132", spo2: "97" } })),
    measures: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ id: "m" + i + "_" + k, date: "2026-0" + ((k % 9) + 1) + "-01", wt: 12.5 + k * 0.3, ht: 90 + k, hc: 47, muac: 14 })),
    rx: [{ id: "r" + i, date: "2026-01-01", dx: "Viral URI", items: [{ drug: "Paracetamol", take: "6.9 mL", freq: "Q6H", days: 3 }, { drug: "Cetirizine", take: "2.5 mL", freq: "OD", days: 5 }] }],
    labs: [{ id: "l" + i, date: "2026-02-01", hb: "11.2" }], aefi: [], consents: [], letters: [],
  };
}
function timeIt(fn) { const t0 = process.hrtime.bigint(); const out = fn(); const ms = Number(process.hrtime.bigint() - t0) / 1e6; return { out, ms }; }

const db1k = { children: [], settings: {}, audit: [] };
for (let i = 0; i < 1000; i++) db1k.children.push(mkChild(i));

{
  const s = timeIt(() => JSON.stringify(db1k));
  const mb = s.out.length / 1048576;
  console.log(`   1k-patient DB: ${mb.toFixed(2)} MB, stringify ${s.ms.toFixed(0)} ms`);
  ok(s.ms < 3000, `1k stringify under 3s (${s.ms.toFixed(0)}ms)`);
  ok(mb < 4.5, `1k DB under localStorage ceiling (${mb.toFixed(2)}MB)`);
  const perPt = s.out.length / 1000;
  const ceiling = Math.floor((5 * 1048576 * 0.9) / perPt); // 90% of 5MB, double-write headroom
  console.log(`   ≈${perPt.toFixed(0)} bytes/patient → practical ceiling ≈${ceiling} patients (single key, 2 writes/save)`);
  const p = timeIt(() => JSON.parse(s.out));
  ok(p.ms < 3000, `1k parse under 3s (${p.ms.toFixed(0)}ms)`);
  const q = "patient 777 testname";
  const f = timeIt(() => db1k.children.filter((c) => (c.name + " " + c.parent + " " + c.phone).toLowerCase().includes(q)));
  ok(f.out.length === 1 && f.ms < 500, `1k linear search finds patient 777 in ${f.ms.toFixed(0)}ms`);
}
{
  const db10k = { children: [] };
  for (let i = 0; i < 10000; i++) db10k.children.push(mkChild(i));
  const s = timeIt(() => JSON.stringify(db10k));
  console.log(`   10k-patient DB: ${(s.out.length / 1048576).toFixed(1)} MB, stringify ${(s.ms / 1000).toFixed(1)}s`);
  ok(s.ms < 30000, `10k stringify completes (${(s.ms / 1000).toFixed(1)}s) — IndexedDB required before this scale (F4)`);
}

console.log(`load: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

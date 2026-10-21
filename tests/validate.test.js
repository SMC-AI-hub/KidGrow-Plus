// NeoKid Care — central validator suite (F15, v10.44). Use: node tests/validate.test.js
const V = require("../js/validate.js");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }

ok(V.check("wt", 11).ok, "wt 11kg ok");
ok(!V.check("wt", 300).ok, "T5: wt 300kg rejected");
ok(!V.check("wt", 0).ok && !V.check("wt", -2).ok, "wt zero/negative rejected");
ok(!V.check("wt", "abc").ok, "wt non-numeric rejected");
ok(V.check("wt", "").empty, "wt blank passes through (optional-field safe)");
ok(V.check("wt", 0.4).warn !== "", "wt 0.4kg warns (unusually low)");
ok(V.check("wt", 160).warn !== "", "wt 160kg warns (unusually high)");
ok(V.check("ht", 95).ok && !V.check("ht", 300).ok, "ht range");
ok(V.check("hc", 45).ok && !V.check("hc", 5).ok, "hc range");
ok(V.check("muac", 14).ok && !V.check("muac", 100).ok, "muac range");
ok(V.check("wtG", 2450).ok && !V.check("wtG", 200).ok && !V.check("wtG", 20000).ok, "NICU grams range");
ok(V.check("temp", 38.6).ok && !V.check("temp", 300).ok, "temp range");
ok(V.check("temp", 34).warn !== "" && V.check("temp", 42).warn !== "", "temp soft bands");
ok(V.check("hr", 132).ok && !V.check("hr", 5).ok, "hr range");
ok(V.check("rr", 50).ok && !V.check("rr", 500).ok, "rr range");
ok(V.check("spo2", 97).ok && !V.check("spo2", 500).ok, "spo2 range");
ok(V.check("spo2", 85).warn !== "", "spo2 85 warns");
ok(V.check("sys", 100).ok && V.check("dia", 60).ok, "BP ok");
ok(!V.check("sys", 10).ok && !V.check("dia", 300).ok, "BP impossible rejected");

{
  const r = V.checkVitals({ t: 38.6, hr: 132, rr: 40, spo2: 97, sys: 100, dia: 60 });
  ok(r.bad.length === 0 && r.warns.length === 0, "vitals: normal set clean");
  const b = V.checkVitals({ t: 300, spo2: 500 });
  ok(b.bad.length === 2, "vitals: impossible values blocked");
  const w = V.checkVitals({ temp: 34, spo2: 85 });
  ok(w.bad.length === 0 && w.warns.length === 2, "vitals: unusual values warn (NICU temp key too)");
  const e = V.checkVitals({});
  ok(e.bad.length === 0 && e.warns.length === 0, "vitals: empty set clean");
}

console.log(`validate: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

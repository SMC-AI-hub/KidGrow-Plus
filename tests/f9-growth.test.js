// F9 self-consistency companion — automated properties for the growth engines.
// Covers js/ref-who.js (WHO_REF) + js/growth.js (whoAgeZ/whoWHZ/LMS) +
// js/cdata.gen.js (KGCONTENT.intergrowth) + js/scores.js (newbornSize).
// This is CONFORMANCE ONLY: it proves the math is internally consistent
// (round-trips, ordering, coverage, clamps). It does NOT replace the human
// validator's >=20-cell official-chart spot-check (docs/F9-GROWTH-SPOTCHECK.md).
// Findings for validator ruling are flagged FC-* in the sign-off report;
// nothing here changes clinical behavior.
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log("FAIL: " + m); } };

const sb = {};
sb.window = sb; sb.self = sb; sb.globalThis = sb;
sb.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
sb.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
vm.createContext(sb);
for (const f of ["js/ref-who.js", "js/cdata.gen.js", "js/growth.js", "js/scores.js"]) {
  try { vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f }); }
  catch (e) { console.log("LOAD FAIL: " + f + ": " + e.message); process.exit(1); }
}
const ev = (code) => vm.runInContext(code, sb);

// ---- 1. WHO table coverage (grids exactly as documented) ----
ok(ev(`["wfa","lhfa","bmifa","hcfa","muacfa","wfl","wfh"].every(t => WHO_REF[t] && WHO_REF[t].b && WHO_REF[t].g)`), "WHO: 7 tables x boy/girl present");
ok(ev(`WHO_REF.wfa.b.age.length === 1827 && WHO_REF.wfa.b.age[0] === 0 && WHO_REF.wfa.b.age[1826] === 1826
  && WHO_REF.wfa.g.age.length === 1827 && ["lhfa","bmifa","hcfa"].every(t => WHO_REF[t].b.age.length === 1827 && WHO_REF[t].g.age.length === 1827)`), "WHO: wfa/lhfa/bmifa/hcfa days 0-1826 both sexes");
ok(ev(`WHO_REF.muacfa.b.age[0] === 91 && WHO_REF.muacfa.g.age[0] === 91 && WHO_REF.muacfa.b.age.length === 1736`), "WHO: muacfa starts day 91 (youngest valid)");
ok(ev(`WHO_REF.wfl.b.x[0] === 45 && WHO_REF.wfl.b.x[WHO_REF.wfl.b.x.length-1] === 110 && WHO_REF.wfh.b.x[0] === 65 && WHO_REF.wfh.b.x[WHO_REF.wfh.b.x.length-1] === 120`), "WHO: wfl 45-110cm, wfh 65-120cm");

// ---- 2. LMS full sweep: finite, M>0, S>0, bands ordered at +/-2 ----
const sweep = ev(`(() => {
  let n = 0, bad = null;
  for (const t of Object.keys(WHO_REF)) for (const s of ["b", "g"]) {
    const T = WHO_REF[t][s], xs = T.x || T.age;
    for (let i = 0; i < xs.length; i++) {
      n++;
      const L = T.L[i], M = T.M[i], S = T.S[i];
      if (![L, M, S].every(isFinite) || !(M > 0) || !(S > 0)) { bad = t + "/" + s + "@" + xs[i] + " LMS"; break; }
      const v = [-2, -1, 0, 1, 2].map((z) => lmsVal(M, S, L, z));
      if (!v.every(isFinite) || !(v[0] < v[1] && v[1] < v[2] && v[2] < v[3] && v[3] < v[4])) { bad = t + "/" + s + "@" + xs[i] + " order"; break; }
      if (Math.abs(lmsVal(M, S, L, 0) - M) > 1e-9) { bad = t + "/" + s + "@" + xs[i] + " median"; break; }
    }
    if (bad) break;
  }
  return { n, bad };
})()`);
ok(!sweep.bad, `WHO: LMS finite/M>0/S>0, -2SD..+2SD ordered, median exact (${sweep.n} grid points)` + (sweep.bad ? " BAD=" + sweep.bad : ""));

// ---- 3. LMS round-trip across sampled coords ----
const rt = ev(`(() => {
  let worst = 0, n = 0;
  for (const t of ["wfa","lhfa","bmifa","hcfa","muacfa","wfl","wfh"]) for (const s of ["b","g"]) {
    const T = WHO_REF[t][s], xs = T.x || T.age;
    for (let i = 0; i < xs.length; i += 37) for (const z of [-2.5, -1, 0, 1.7, 2.9]) {
      const r = lmsAt(T, xs[i]);
      const back = lmsZraw(r.M, r.S, r.L, lmsVal(r.M, r.S, r.L, z));
      worst = Math.max(worst, Math.abs(back - z)); n++;
    }
  }
  return { worst, n };
})()`);
ok(rt.worst < 1e-9, `WHO: z(value(z)) round-trip worst-err ${rt.worst} over ${rt.n} samples`);

// ---- 4. F9 sheet rows 1-12 (age-based): median->z=0, line value->line z ----
const age = ev(`(() => {
  const rows = [["wfa","b",0,0],["wfa","g",0,0],["wfa","b",180,-2],["wfa","g",365,2],
    ["lhfa","b",0,0],["lhfa","g",730,-2],["bmifa","b",365,0],["bmifa","g",1826,2],
    ["hcfa","b",0,0],["hcfa","g",180,3],["muacfa","b",365,0],["muacfa","g",91,0]];
  let worst = 0;
  for (const [t, s, x, z] of rows) {
    const r = lmsAt(WHO_REF[t][s === "b" ? "b" : "g"], x);
    const got = whoAgeZ(s === "b" ? "boy" : "girl", t, x, lmsVal(r.M, r.S, r.L, z));
    worst = Math.max(worst, Math.abs(got.z - z));
  }
  return worst;
})()`);
ok(age < 1e-9, `WHO: F9 rows 1-12 line values recover line z (worst-err ${age})`);

// ---- 5. F9 sheet rows 13-16 (length/height-based) ----
const wh = ev(`(() => {
  const rows = [["wfl","b",45,0,true],["wfl","g",78,-2,true],["wfh","b",65,0,false],["wfh","g",110,2,false]];
  let worst = 0;
  for (const [t, s, x, z, isLen] of rows) {
    const r = lmsAt(WHO_REF[t][s], x);
    const got = whoWHZ(s === "b" ? "boy" : "girl", x, lmsVal(r.M, r.S, r.L, z), isLen);
    worst = Math.max(worst, Math.abs(got.z - z));
  }
  return worst;
})()`);
ok(wh < 1e-9, `WHO: F9 rows 13-16 line values recover line z (worst-err ${wh})`);

// ---- 6. phi/invPhi + cross-implementation agreement ----
ok(ev(`Math.abs(phi(0) - 0.5) < 1e-6 && phi(-1) < phi(0) && phi(0) < phi(1)`), "WHO: phi(0)=0.5 to A-S accuracy, monotonic");
const invC = ev(`(() => { let w = 0; for (let z = -1.9; z <= 1.901; z += 0.1) w = Math.max(w, Math.abs(invPhi(phi(z)) - z)); return w; })()`);
ok(invC < 5e-6, `WHO: invPhi(phi(z)) central-branch worst-err ${invC} over z=-1.9..1.9`);
const invT = ev(`(() => { let w = 0; for (let z = -4; z <= 4.001; z += 0.25) w = Math.max(w, Math.abs(invPhi(phi(z)) - z)); return w; })()`);
ok(invT < 5e-4, `WHO: invPhi(phi(z)) tail-branch worst-err ${invT} over z=-4..4 (documents Acklam tail accuracy)`);
const xphi = ev(`(() => { let w = 0; for (let z = -4; z <= 4.001; z += 0.2) w = Math.max(w, Math.abs(scorePhi(z) - phi(z))); return w; })()`);
ok(xphi < 1e-6, `SELF-CONSISTENCY: growth phi vs scores scorePhi agree to ${xphi}`);

// ---- 7. Extremes: restricted-SD beyond +/-3 + NaN clamp ----
ok(ev(`(() => { const r = lmsAt(WHO_REF.wfa.b, 180);
  const hi = whoAgeZ("boy", "wfa", 180, lmsVal(r.M, r.S, r.L, 5));
  const lo = whoAgeZ("boy", "wfa", 180, lmsVal(r.M, r.S, r.L, -5));
  return hi.z > 3 && hi.z < 6 && lo.z < -3 && lo.z > -6; })()`), "WHO: restricted-SD extends beyond +/-3 monotonically");
ok(ev(`whoExtremeAdj({ M: 5, S: 1, L: 1 }, 0.01, -4) === -3`), "WHO: extreme adjuster clamps to -3 when -3SD line is NaN");

// ---- 8. Range behavior: clamps flagged, out-of-scope refused ----
ok(ev(`whoWHZ("boy", 40, 3, true).oos === true && whoWHZ("girl", 130, 30, false).oos === true`), "WHO: wfl/wfh out-of-scope lengths refused (oos)");
ok(ev(`whoAgeZ("girl", "muacfa", 30, 12).clip === "lo" && whoAgeZ("boy", "wfa", 2000, 15).clip === "hi"`), "WHO: under-91d muacfa / over-5y clamp with clip flag (FC-1: validator to rule on clamp-vs-refuse)");

// ---- 9. Median shape: physiology-aware monotonicity + continuity tripwires ----
ok(ev(`(() => {
  for (const s of ["b","g"]) {
    const M = WHO_REF.wfa[s].M;
    for (let i = 15; i < M.length; i++) if (!(M[i] >= M[i-1] * (1 - 1e-12))) return false;
  }
  return true;
})()`), "WHO: wfa median non-decreasing from day 14 (post-regain)");
ok(ev(`(() => {
  for (const s of ["b","g"]) {
    const M = WHO_REF.wfa[s].M;
    let m = M[0]; for (let i = 1; i <= 13; i++) m = Math.min(m, M[i]);
    if (!(m < M[0])) return false; // day-0 > first-week min: the physiological dip exists
  }
  return true;
})()`), "WHO: wfa shows the physiological first-week weight dip (table matches biology)");
ok(ev(`(() => {
  for (const s of ["b","g"]) {
    const M = WHO_REF.lhfa[s].M, step = M[730] - M[731];
    if (!(step > 0.5 && step < 0.9)) return "disjunction " + step;
    for (let i = 1; i < M.length; i++) {
      if (i === 731) continue; // WHO-documented 0.7cm length->height disjunction at 24mo
      if (!(M[i] >= M[i-1] * (1 - 1e-12))) return "mono @" + i;
    }
  }
  return true;
})() === true`), "WHO: lhfa monotonic except the 0.7cm 24-month disjunction (validated in range)");
ok(ev(`(() => {
  for (const t of ["hcfa","muacfa"]) for (const s of ["b","g"]) {
    const M = WHO_REF[t][s].M;
    for (let i = 1; i < M.length; i++) if (!(M[i] >= M[i-1] * (1 - 1e-12))) return t + "/" + s + "@" + i;
  }
  return true;
})() === true`), "WHO: hcfa/muacfa medians non-decreasing everywhere");
const cont = ev(`(() => {
  const lim = { wfa: 0.025, bmifa: 0.025, lhfa: 0.005, hcfa: 0.005, muacfa: 0.005, wfl: 0.05, wfh: 0.05 };
  let worst = 0, bad = null;
  for (const t of Object.keys(lim)) for (const s of ["b","g"]) {
    const T = WHO_REF[t][s], xs = T.x || T.age;
    for (let i = 1; i < xs.length; i++) {
      if (t === "lhfa" && xs[i] === 731) continue;
      const d = Math.abs(T.M[i] - T.M[i-1]) / T.M[i-1];
      worst = Math.max(worst, d);
      if (d > lim[t]) { bad = t + "/" + s + "@" + xs[i] + " " + (d * 100).toFixed(2) + "%"; break; }
    }
    if (bad) break;
  }
  return { worst, bad };
})()`);
ok(!cont.bad, `WHO: adjacent-grid median jumps within physiology (worst ${(cont.worst * 100).toFixed(2)}%)` + (cont.bad ? " BAD=" + cont.bad : ""));

// ---- 10. INTERGROWTH coverage: every GA day 168-300, 7 ordered values ----
const igc = ev(`(() => {
  let n = 0, bad = null;
  for (const m of ["bw","lt","hc"]) for (const s of ["boys","girls"]) for (let ga = 168; ga <= 300; ga++) {
    const r = igRow(m, s, ga); n++;
    if (!r || r.length !== 7 || !r.every((v) => isFinite(v) && v > 0)) { bad = m + "/" + s + "@" + ga + " shape"; break; }
    for (let i = 1; i < 7; i++) if (!(r[i] > r[i-1])) { bad = m + "/" + s + "@" + ga + " order"; break; }
    if (bad) break;
  }
  return { n, bad };
})()`);
ok(!igc.bad, `IG: bw/lt/hc x boys/girls x GA 168-300 all present, finite, strictly increasing (${igc.n} rows)` + (igc.bad ? " BAD=" + igc.bad : ""));
const igm = ev(`(() => {
  // Within-band monotonicity (168-230 vp, 231-300 nb); the 230->231 step is the
  // documented reference-population switch, measured separately (FC-2).
  for (const m of ["bw","lt","hc"]) for (const s of ["boys","girls"]) for (const [lo, hi] of [[168, 230], [231, 300]]) for (let c = 0; c < 7; c++) {
    let prev = -1;
    for (let ga = lo; ga <= hi; ga++) {
      const v = igRow(m, s, ga)[c];
      if (!(v >= prev * (1 - 1e-12))) return { ok: false, at: m + "/" + s + "/c" + c + "@" + ga };
      prev = v;
    }
  }
  let worst = 0, bad = null;
  const limIG = { bw: 0.08, lt: 0.02, hc: 0.02 }; // bw -3SD line starts tiny (~0.36kg): steep legit growth
  for (const m of ["bw","lt","hc"]) for (const s of ["boys","girls"]) for (const [lo, hi] of [[168, 230], [231, 300]]) {
    for (let c = 0; c < 7; c++) for (let ga = lo + 1; ga <= hi; ga++) {
      const a = igRow(m, s, ga - 1)[c], b = igRow(m, s, ga)[c];
      const d = (b - a) / a;
      worst = Math.max(worst, d);
      if (d > limIG[m]) bad = m + "/" + s + "/c" + c + "@" + ga;
    }
  }
  const steps = {};
  for (const m of ["bw","lt","hc"]) { steps[m] = {}; for (const s of ["boys","girls"]) {
    const a = igRow(m, s, 230), b = igRow(m, s, 231);
    let w = 0; for (let c = 0; c < 7; c++) w = Math.max(w, Math.abs(b[c] - a[c]) / a[c]);
    steps[m][s] = +w.toFixed(4);
  } }
  return { ok: true, worst, bad, steps };
})()`);
ok(igm.ok, "IG: every centile column non-decreasing within each band (168-230, 231-300)" + (igm.ok ? "" : " BAD=" + igm.at));
ok(igm.ok && !igm.bad, `IG: within-band day-to-day jumps within physiology (worst ${(igm.worst * 100).toFixed(2)}%)` + (igm.bad ? " BAD=" + igm.bad : ""));
ok(ev(`newbornSize({ ga: "32+6", sex: "boy", bwKg: 1.7 }).ok === true && newbornSize({ ga: "33+0", sex: "boy", bwKg: 1.7 }).ok === true`),
  `IG: no availability cliff at the 33+0 band switch (FC-2: boundary step up to ${igm.steps ? (Math.max(igm.steps.bw.boys, igm.steps.bw.girls) * 100).toFixed(0) : "?"}% on bw — validator to confirm intended)`);

// ---- 11. IG z engine: knots exact, fractional round-trip ----
ok(ev(`(() => {
  for (const ga of [168, 196, 231, 259, 280, 300]) for (const m of ["bw","lt","hc"]) {
    const r = igRow(m, "boys", ga);
    for (let i = 0; i < 7; i++) { const g = scoreZFromRow(r, r[i]); if (!g.ok || g.z !== -3 + i || g.capped) return false; }
  }
  return true;
})()`), "IG: scoreZFromRow recovers exact integer z at all 7 knots (sampled GAs)");
const igr = ev(`(() => {
  let worst = 0;
  for (const ga of [180, 240, 290]) for (const m of ["bw","lt","hc"]) {
    const r = igRow(m, "girls", ga);
    for (const z of [-2.72, -0.31, 0.58, 1.37, 2.44]) {
      const i = Math.floor(z) + 3, f = z - Math.floor(z);
      const x = r[i] + f * (r[i + 1] - r[i]);
      worst = Math.max(worst, Math.abs(scoreZFromRow(r, x).z - z));
    }
  }
  return worst;
})()`);
ok(igr < 1e-9, `IG: fractional-z round-trip worst-err ${igr}`);

// ---- 12. F9 sheet rows 17-21 via newbornSize ----
const igf9 = ev(`(() => {
  const P10 = -1.2815515655446004, P90 = 1.2815515655446004;
  const at = (m, s, ga, z) => { const r = igRow(m, s, ga); const i = Math.floor(z) + 3, f = z - Math.floor(z); return r[i] + f * (r[i + 1] - r[i]); };
  const out = {};
  let n = newbornSize({ ga: "40+0", sex: "boy", bwKg: at("bw", "boys", 280, 0) });
  out.r17 = n.ok && n.band === "aga" && Math.abs(n.pctW - 50) < 0.2;
  n = newbornSize({ ga: "33+0", sex: "girl", bwKg: at("bw", "girls", 231, P10) });
  out.r18 = n.ok && Math.abs(n.pctW - 10) < 0.2;
  n = newbornSize({ ga: "37+0", sex: "boy", bwKg: at("bw", "boys", 259, 0), lenCm: at("lt", "boys", 259, P90) });
  out.r19 = n.ok && Math.abs(n.pctL - 90) < 0.2;
  n = newbornSize({ ga: "42+0", sex: "girl", bwKg: at("bw", "girls", 294, 0), hcCm: at("hc", "girls", 294, 0) });
  out.r20 = n.ok && n.band === "aga" && Math.abs(n.pctH - 50) < 0.2;
  n = newbornSize({ ga: "28+0", bwKg: at("bw", "boys", 196, 0) });
  out.r21 = n.ok && n.sexKnown === false;
  return out;
})()`);
ok(Object.values(igf9).every(Boolean), "IG: F9 rows 17-21 resolve (50th->AGA, 10th/90th centiles, very-preterm band)" + (Object.values(igf9).every(Boolean) ? "" : " " + JSON.stringify(igf9)));

// ---- 13. Bands, parsing, range guards (pure UI-adjacent logic) ----
ok(ev(`igBand(2.9).band === "sga-severe" && igBand(3).band === "sga" && igBand(9.9).band === "sga"
  && igBand(10).band === "aga" && igBand(90).band === "aga" && igBand(90.1).band === "lga"
  && igBand(97).band === "lga" && igBand(97.1).band === "lga-severe"`), "IG: band boundaries exact (3/10/90/97)");
ok(ev(`scoreParseGA("38+2") === 268 && scoreParseGA("38w2d") === 268 && scoreParseGA(38) === 266
  && scoreParseGA("38.5") === 270 && scoreParseGA("") === null && scoreParseGA("abc") === null && scoreParseGA(99) === null`), "IG: GA parsing (38+2/38w2d/numeric/garbage)");
ok(ev(`newbornSize({ ga: "23+6", sex: "boy", bwKg: 0.6 }).ok === false
  && newbornSize({ ga: "43+0", sex: "boy", bwKg: 3 }).ok === false
  && newbornSize({ ga: "40+0", sex: "boy" }).ok === false`), "IG: out-of-range GA / missing weight refused with reason");

console.log(`\nf9: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

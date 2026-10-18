/* =====================================================================
   NeoKid Care — Growth engine (birth to 18 years)
   EXACT references : WHO MGRS 2006 daily LMS (0-5 y) · CDC 2000 LMS (2-20 y,
                      severe obesity by % of P95) · IAP adult-equiv BMI lines
   SCREENING curves : IAP 2015-aligned (5-18 y, calibrated to published
                      18-y means/P97 — confirm labels on official charts)
   Preterm: corrected age to 24 mo + PMA display (Fenton data not embedded;
   use official Fenton charts in NICU — link in Standards tab).
   ===================================================================== */

/* ---------------- math core ---------------- */
function lmsVal(M, S, L, z) {
  if (!(M > 0) || !(S > 0)) return NaN;
  if (L === 0) return M * Math.exp(S * z);
  const b = 1 + L * S * z;
  return b > 0 ? M * Math.pow(b, 1 / L) : NaN;
}
function lmsZraw(M, S, L, X) {
  if (!(M > 0) || !(S > 0) || !(X > 0)) return NaN;
  if (L === 0) return Math.log(X / M) / S;
  return (Math.pow(X / M, L) - 1) / (L * S);
}
function phi(z) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
function invPhi(p) { // Acklam's approximation
  if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.3577518672690, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425, ph = 1 - pl; let q, x;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  else if (p <= ph) { q = p - 0.5; const r = q*q; x = (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1); }
  else { q = Math.sqrt(-2 * Math.log(1-p)); x = -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1); }
  return x;
}
function interp(xs, ys, x) {
  if (x <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (x <= xs[i]) { const t = (x - xs[i-1]) / (xs[i] - xs[i-1]); return ys[i-1] + t * (ys[i] - ys[i-1]); }
  }
  return ys[ys.length - 1];
}
function lmsAt(T, x) { // T: {x|age, L, M, S} sorted arrays
  const xs = T.x || T.age, n = xs.length;
  if (x <= xs[0]) return { L: T.L[0], M: T.M[0], S: T.S[0], clip: x < xs[0] ? "lo" : "" };
  if (x >= xs[n-1]) return { L: T.L[n-1], M: T.M[n-1], S: T.S[n-1], clip: x > xs[n-1] ? "hi" : "" };
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  return { L: T.L[lo]+t*(T.L[hi]-T.L[lo]), M: T.M[lo]+t*(T.M[hi]-T.M[lo]), S: T.S[lo]+t*(T.S[hi]-T.S[lo]), clip: "" };
}
function fmtPct(p) {
  if (!(p >= 0)) return "—";
  if (p < 0.5) return "<1st"; if (p > 99.5) return ">99th";
  const r = Math.round(p), s = r % 10, h = r % 100;
  const suf = (s === 1 && h !== 11) ? "st" : (s === 2 && h !== 12) ? "nd" : (s === 3 && h !== 13) ? "rd" : "th";
  return r + suf;
}
function zStr(z) { if (!(z >= -99 && z <= 99)) return "—"; return (z >= 0 ? "+" : "") + z.toFixed(2); }
function gInd() { const m = { wt: "wfa", ht: "lhfa", hc: "hc", bmi: "bmi" }; const v = DB.gTab || "wfa"; return m[v] || v; }
function sxB(sex) { // WHO/CDC table keys; tolerant of server/import variants (male/female)
  if (sex === "g" || sex === "girl" || sex === "female" || sex === "f") return "g";
  return "b"; // boy/male/m + other/unknown fallback (boys ref; flagged for clinical sign-off)
}
function sxW(sex) { // IAP table keys
  if (sex === "girl" || sex === "g" || sex === "female" || sex === "f") return "girl";
  return "boy";
}

/* ---------------- age engine ---------------- */
function gestDays(c) { const g = parseFloat(c.gest); return g > 20 && g < 45 ? Math.round(g * 7) : 280; }
function growthAge(c, dateISO) {
  const chronoD = Math.max(0, Math.round((new Date(dateISO + "T00:00:00") - new Date(c.dob + "T00:00:00")) / 86400000));
  const gd = gestDays(c), preterm = gd < 259;
  const corrOn = DB.corrAge !== false;
  const rawCorr = chronoD - (280 - gd);
  const useCorr = preterm && corrOn && chronoD < 730 && rawCorr >= 0;
  return { chronoD, corrD: useCorr ? rawCorr : chronoD, useCorr, corrNeg: rawCorr < 0,
           pmaD: gd + chronoD, preterm, gestWk: gd / 7, corrOn };
}
function pmaStr(pmaD) { return `${Math.floor(pmaD / 7)}w ${pmaD % 7}d`; }
function lbwClass(bw) {
  if (!(bw > 0)) return "";
  if (bw < 1) return "ELBW (<1 kg)"; if (bw < 1.5) return "VLBW (<1.5 kg)"; if (bw < 2.5) return "LBW (<2.5 kg)";
  return "Normal birth weight";
}
function pretermClass(gw) {
  if (!(gw > 0)) return "";
  if (gw < 28) return "Extremely preterm"; if (gw < 32) return "Very preterm";
  if (gw < 34) return "Moderate preterm"; if (gw < 37) return "Late preterm"; return "Term";
}

/* ---------------- reference lookups ---------------- */
function whoExtremeAdj(r, X, z) { // WHO restricted-SD method beyond ±3 (igrowup)
  if (z > 3) {
    const s3 = lmsVal(r.M, r.S, r.L, 3), s2 = lmsVal(r.M, r.S, r.L, 2), d = s3 - s2;
    return d > 0 && isFinite(s3) ? 3 + (X - s3) / d : 3;
  }
  if (z < -3) {
    const s3 = lmsVal(r.M, r.S, r.L, -3), s2 = lmsVal(r.M, r.S, r.L, -2), d = s2 - s3;
    return d > 0 && isFinite(s3) ? -3 + (X - s3) / d : -3;
  }
  return z;
}
function whoAgeZ(sex, ind, ageD, X) { // ind: wfa|lhfa|bmifa|hcfa|muacfa
  if (!(X > 0)) return null;
  const r = lmsAt(WHO_REF[ind][sxB(sex)], ageD);
  let z = lmsZraw(r.M, r.S, r.L, X);
  if (!isFinite(z)) return null;
  z = whoExtremeAdj(r, X, z);
  return { z, pct: phi(z) * 100, M: r.M, clip: r.clip };
}
function whoWHZ(sex, lenhei, wt, isLength) {
  if (!(wt > 0) || !(lenhei > 0)) return null;
  const T = WHO_REF[isLength ? "wfl" : "wfh"][sxB(sex)];
  const xs = T.x;
  if (lenhei < xs[0] - 0.01 || lenhei > xs[xs.length-1] + 0.01) return { oos: true, lo: xs[0], hi: xs[xs.length-1] };
  const r = lmsAt(T, lenhei);
  let z = lmsZraw(r.M, r.S, r.L, wt);
  if (!isFinite(z)) return null;
  z = whoExtremeAdj(r, wt, z);
  return { z, pct: phi(z) * 100, M: r.M };
}
function cdcAgeZ(sex, ind, ageM, X) { // ind: wt|ht|bmi (24-240mo)
  if (!(X > 0)) return null;
  const T = CDC_REF[ind][sxB(sex)], xs = T.x;
  if (ageM < xs[0] - 0.01 || ageM > xs[xs.length-1] + 0.01) return { oos: true };
  const r = lmsAt(T, ageM);
  const z = lmsZraw(r.M, r.S, r.L, X);
  if (!isFinite(z)) return null;
  return { z, pct: phi(z) * 100, M: r.M };
}
function iapLMS(sex, ind, ageM) { // IAP 2015-aligned screening curves (data.js)
  const R = GROWTH_REF[sxW(sex)];
  if (ind === "wt") return { M: interp(G_AGES, R.wtM, ageM), S: interp(G_AGES, R.wtS, ageM), L: LMS_L.wt };
  if (ind === "ht") return { M: interp(G_AGES, R.htM, ageM), S: interp(G_AGES, R.htS, ageM), L: LMS_L.ht };
  const wM = interp(G_AGES, R.wtM, ageM), hM = interp(G_AGES, R.htM, ageM);
  return { M: wM / Math.pow(hM / 100, 2), S: interp(G_AGES, BMI_S, ageM), L: LMS_L.bmi };
}
function iapZ(sex, ind, ageM, X) {
  if (!(X > 0)) return null;
  const r = iapLMS(sex, ind, ageM);
  const z = lmsZraw(r.M, r.S, r.L, X);
  if (!isFinite(z)) return null;
  return { z, pct: phi(z) * 100, M: r.M };
}

/* ---------------- length/height resolution (WHO 0.7 cm rule) ---------------- */
function resolveLenHei(c, m, ga) {
  const refD = ga.useCorr ? ga.corrD : ga.chronoD;
  let pos = (m.pos === "length" || m.pos === "height") ? m.pos : (ga.chronoD < 730 ? "length" : "height");
  const wantLength = refD < 731;
  let v = m.ht, adj = 0;
  if (pos === "height" && wantLength) { v = +(v + 0.7).toFixed(1); adj = 0.7; }
  if (pos === "length" && !wantLength) { v = +(v - 0.7).toFixed(1); adj = -0.7; }
  return { value: v, measured: pos, adj, isLength: wantLength };
}

/* ---------------- grades ---------------- */
function gradeWAZ(z) {
  if (z < -3) return { grade: "Severely underweight", sev: "red" };
  if (z < -2) return { grade: "Underweight", sev: "amber" };
  if (z > 2) return { grade: "High weight-for-age — assess WHZ/BMI", sev: "amber" };
  return { grade: "Normal", sev: "green" };
}
function gradeHAZ(z) {
  if (z < -3) return { grade: "Severe stunting", sev: "red" };
  if (z < -2) return { grade: "Stunting / short stature", sev: "amber" };
  if (z > 3) return { grade: "Very tall — evaluate", sev: "amber" };
  if (z > 2) return { grade: "Tall", sev: "green" };
  return { grade: "Normal", sev: "green" };
}
function gradeWHZ(z) { // WHO <5 wasting / overweight ladder
  if (z < -3) return { grade: "Severe wasting (SAM)", sev: "red" };
  if (z < -2) return { grade: "Wasting (MAM)", sev: "amber" };
  if (z > 3) return { grade: "Obesity", sev: "red" };
  if (z > 2) return { grade: "Overweight", sev: "amber" };
  if (z > 1) return { grade: "Possible risk of overweight", sev: "amber" };
  return { grade: "Normal", sev: "green" };
}
function gradeHCAZ(z) {
  if (z < -3) return { grade: "Severe microcephaly — refer", sev: "red" };
  if (z < -2) return { grade: "Microcephaly — evaluate", sev: "amber" };
  if (z > 3) return { grade: "Marked macrocephaly — evaluate", sev: "amber" };
  if (z > 2) return { grade: "Macrocephaly — evaluate", sev: "amber" };
  return { grade: "Normal", sev: "green" };
}

/* ---------------- full assessment ---------------- */
function assessMeasure(c, m) {
  const ga = growthAge(c, m.date);
  const A = { ga, m, rows: [], triage: [], flags: [], len: null, tooEarly: ga.corrNeg };
  if (ga.corrNeg) return A;
  const ageD = ga.useCorr ? ga.corrD : ga.chronoD, ageM = ageD / 30.4375;
  const ageTag = ga.useCorr ? `corrected ${ageStr({ y: 0, m: 0, d: 0, days: ageD, months: ageM })}` : null;
  const L = resolveLenHei(c, m, ga); A.len = L;
  const push = (r) => A.rows.push(r);

  if (ageD <= 1826) { // ---- WHO 0-5 ----
    const w = whoAgeZ(c.sex, "wfa", ageD, m.wt);
    if (w) push({ key: "WAZ", label: "Weight-for-age", value: `${m.wt} kg`, ref: "WHO", ...w, ...gradeWAZ(w.z),
      note: (w.clip ? "Outside table range — " : "") + (ga.useCorr ? "Corrected age. " : "") + "Screens underweight; use WHZ/BMI for overweight." });
    const h = whoAgeZ(c.sex, "lhfa", ageD, L.value);
    if (h) push({ key: "HAZ", label: (L.isLength ? "Length" : "Height") + "-for-age", value: `${L.value} cm${L.adj ? ` (${m.ht} ${L.measured} ${L.adj > 0 ? "+0.7" : "−0.7"} cm WHO adj.)` : ` (${L.measured})`}`, ref: "WHO", ...h, ...gradeHAZ(h.z), note: "Chronic nutrition / linear growth." });
    const wh = whoWHZ(c.sex, L.value, m.wt, L.isLength);
    if (wh && !wh.oos) push({ key: "WHZ", label: `Weight-for-${L.isLength ? "length" : "height"}`, value: `${m.wt} kg @ ${L.value} cm`, ref: "WHO", ...wh, ...gradeWHZ(wh.z), note: "Best <5 indicator of wasting / overweight." });
    else push({ key: "WHZ", label: "Weight-for-length/height", value: `${m.wt} kg @ ${L.value} cm`, ref: "WHO", pct: NaN, z: NaN, grade: "Not applicable", sev: "gray", note: wh?.oos ? `Valid ${L.isLength ? "45–110 cm (length)" : "65–120 cm (height)"} only — use BMI-for-age.` : "Needs weight + length/height." });
    const b = whoAgeZ(c.sex, "bmifa", ageD, m.bmi);
    if (b) push({ key: "BMIZ", label: "BMI-for-age", value: `${m.bmi} kg/m²`, ref: "WHO", ...b, ...gradeWHZ(b.z), note: "Mirrors WHZ; primary metric after 5 y." });
    if (m.hc) {
      const hc = whoAgeZ(c.sex, "hcfa", ageD, m.hc);
      if (hc) push({ key: "HCAZ", label: "Head circumference-for-age", value: `${m.hc} cm`, ref: "WHO", ...hc, ...gradeHCAZ(hc.z), note: "Always measure parents' HC for context." });
    }
    if (m.muac) {
      const zc = whoAgeZ(c.sex, "muacfa", ageD, m.muac);
      const cut = (ga.chronoD >= 182 && ga.chronoD <= 1826)
        ? (m.muac < 11.5 ? { grade: "SAM by MUAC", sev: "red" } : m.muac < 12.5 ? { grade: "MAM by MUAC", sev: "amber" } : { grade: "Normal (≥12.5)", sev: "green" })
        : { grade: "Cutoffs apply 6–59 mo", sev: "gray" };
      push({ key: "MUAC", label: "MUAC", value: `${m.muac} cm`, ref: "WHO", z: zc?.z ?? NaN, pct: zc?.pct ?? NaN, M: zc?.M, ...cut, note: (zc ? `z ${zStr(zc.z)}. ` : "z valid ≥3 mo. ") + "Screening cutoffs: <11.5 SAM · 11.5–12.4 MAM." });
    }
    A.biv = [];
    const wv = A.rows.find((r) => r.key === "WAZ"), hv = A.rows.find((r) => r.key === "HAZ"), wv2 = A.rows.find((r) => r.key === "WHZ");
    if (wv && (wv.z < -6 || wv.z > 5)) A.biv.push(`WAZ ${zStr(wv.z)} is biologically implausible — re-check weight/age/entry.`);
    if (hv && (hv.z < -6 || hv.z > 6)) A.biv.push(`HAZ ${zStr(hv.z)} is biologically implausible — re-check length/height/age/entry.`);
    if (wv2 && isFinite(wv2.z) && (wv2.z < -5 || wv2.z > 5)) A.biv.push(`WHZ ${zStr(wv2.z)} is biologically implausible — re-check weight/length/entry.`);
  }

  if (ageM >= 60) { // ---- 5-18 y ----
    const ref5 = DB.gRef5 || "iap", R = ref5 === "cdc" ? "CDC" : "IAP*";
    const w5 = ref5 === "cdc" ? cdcAgeZ(c.sex, "wt", ageM, m.wt) : iapZ(c.sex, "wt", ageM, m.wt);
    if (w5 && !w5.oos) push({ key: "WAZ5", label: "Weight-for-age (5+ y)", value: `${m.wt} kg`, ref: R, ...w5, ...gradeWAZ(w5.z), note: ref5 === "iap" ? "IAP 2015-aligned screening curve." : "CDC 2000 exact reference." });
    const h5 = ref5 === "cdc" ? cdcAgeZ(c.sex, "ht", ageM, L.value) : iapZ(c.sex, "ht", ageM, L.value);
    if (h5 && !h5.oos) push({ key: "HAZ5", label: "Height-for-age (5+ y)", value: `${L.value} cm`, ref: R, ...h5, ...gradeHAZ(h5.z), note: ref5 === "iap" ? "IAP 2015-aligned screening curve." : "CDC 2000 exact reference." });
    if (m.bmi) {
      const b5 = ref5 === "cdc" ? cdcAgeZ(c.sex, "bmi", ageM, m.bmi) : iapZ(c.sex, "bmi", ageM, m.bmi);
      const IL = IAP_BMI_LINES[c.sex];
      const ov = interp(IL.ages, IL.ov, Math.min(ageM, 216)), ob = interp(IL.ages, IL.ob, Math.min(ageM, 216)), uw = interp(IL.ages, IL.uw, Math.min(ageM, 216));
      const iapG = m.bmi >= ob ? { grade: "Obese (IAP ≥27 line)", sev: "red" } : m.bmi >= ov ? { grade: "Overweight (IAP ≥23 line)", sev: "amber" } : m.bmi < uw ? { grade: "Underweight (IAP)", sev: "amber" } : { grade: "Normal (IAP)", sev: "green" };
      let cdcNote = "";
      const cb = cdcAgeZ(c.sex, "bmi", ageM, m.bmi);
      if (cb && !cb.oos) {
        const r = lmsAt(CDC_REF.bmi[sxB(c.sex)], ageM), p95 = lmsVal(r.M, r.S, r.L, 1.6449);
        const pct95 = p95 > 0 ? (m.bmi / p95) * 100 : NaN;
        const cls = cb.pct >= 95 ? (pct95 >= 140 ? "Class III (severe)" : pct95 >= 120 ? "Class II" : "Class I") : cb.pct >= 85 ? "Overweight range" : cb.pct < 5 ? "Underweight range" : "Healthy range";
        cdcNote = `CDC: ${fmtPct(cb.pct)} · ${!isNaN(pct95) ? pct95.toFixed(0) + "% of P95 — " : ""}${cls}.`;
        A.pct95 = pct95;
      }
      push({ key: "BMIZ5", label: "BMI-for-age (5+ y)", value: `${m.bmi} kg/m²`, ref: R, z: b5?.z ?? NaN, pct: b5?.pct ?? NaN, ...iapG,
        note: `IAP lines — UW ${uw.toFixed(1)} · OV ${ov.toFixed(1)} · OB ${ob.toFixed(1)}. ${cdcNote}` });
    }
    if (m.hc) push({ key: "HCAZ", label: "Head circumference", value: `${m.hc} cm`, ref: "—", z: NaN, pct: NaN, grade: "Track serially", sev: "gray", note: "No IAP/CDC HC reference beyond 5 y — follow velocity + neuro exam." });
    if (m.muac) push({ key: "MUAC", label: "MUAC", value: `${m.muac} cm`, ref: "—", z: NaN, pct: NaN, grade: "Recorded", sev: "gray", note: "MUAC cutoffs apply 6–59 mo only." });
  }

  /* ----- triage ----- */
  const get = (k) => A.rows.find((r) => r.key === k);
  const whz = get("WHZ")?.z, waz = get("WAZ")?.z ?? get("WAZ5")?.z, haz = get("HAZ")?.z ?? get("HAZ5")?.z;
  const bmiz = get("BMIZ5")?.z ?? get("BMIZ")?.z, hcaz = get("HCAZ")?.z;
  // SAM / MAM
  if (ageM < 60) {
    const samWhy = [];
    if (isFinite(whz) && whz < -3) samWhy.push(`WHZ ${zStr(whz)}`);
    if (ga.chronoD >= 182 && ga.chronoD <= 1826 && m.muac && m.muac < 11.5) samWhy.push(`MUAC ${m.muac} cm`);
    if (m.edema) samWhy.push(`oedema ${m.edema}`);
    if (samWhy.length) {
      const comp = m.edema === "++" || m.edema === "+++" || m.appetite === "poor" || ageM < 6;
      A.triage.push({ sev: "red", title: `Severe acute malnutrition${comp ? " — COMPLICATED" : ""} (${samWhy.join(" · ")})`,
        body: comp
          ? "Admit: oedema ++/+++, poor appetite, age <6 mo or any medical complication. Stabilise (hypoglycaemia, hypothermia, dehydration per WHO), F-75 → F-100, antibiotics, micronutrients. IAP/WHO SAM protocol — do not delay referral."
          : "Uncomplicated SAM: appetite good, alert, no oedema++/+++. Outpatient RUTF + amoxicillin + micronutrients + counselling, weekly review; admit if any deterioration. Confirm on official WHO chart." });
    } else {
      const mamWhy = [];
      if (isFinite(whz) && whz < -2) mamWhy.push(`WHZ ${zStr(whz)}`);
      if (ga.chronoD >= 182 && ga.chronoD <= 1826 && m.muac && m.muac >= 11.5 && m.muac < 12.5) mamWhy.push(`MUAC ${m.muac} cm`);
      if (mamWhy.length) A.triage.push({ sev: "amber", title: `Moderate acute malnutrition (${mamWhy.join(" · ")})`,
        body: "Enhanced counselling (frequency, energy density, animal-source foods), deworm, micronutrients, treat illness, supplementary nutrition per local programme. Re-weigh in 2–4 weeks; escalate if WHZ falls or oedema appears." });
    }
  } else if (m.edema) {
    A.triage.push({ sev: "red", title: `Oedema ${m.edema} — evaluate cause`, body: "Beyond 5 y oedema is rarely nutritional alone — assess cardiac, renal, hepatic, thyroid and protein loss urgently." });
  }
  // short / tall
  if (isFinite(haz) && haz < -2) A.triage.push({ sev: haz < -3 ? "red" : "amber", title: `Short stature (HAZ ${zStr(haz)})`,
    body: "Checklist: growth velocity (tab →) + body proportions + puberty stage + mid-parental height. Screen chronic disease, anaemia, hypothyroidism (TSH/fT4), coeliac (tTG-IgA), renal/hepatic. Bone-age X-ray; refer paediatric endocrinology if velocity low, HAZ <−2.5, dysmorphic or disproportionate." });
  if (isFinite(haz) && haz > 3) A.triage.push({ sev: "amber", title: `Very tall stature (HAZ ${zStr(haz)})`,
    body: "Usually constitutional — compare with parents' heights and puberty timing. Refer if dysmorphic features, developmental delay, Marfanoid habitus (arm span, palate, lens) or precocious puberty." });
  // underweight without wasting
  const wg = get("WAZ") || get("WAZ5");
  if (wg && wg.z < -2 && !(isFinite(whz) && whz < -2)) A.triage.push({ sev: "amber", title: `Underweight (WAZ ${zStr(wg.z)}) without wasting`,
    body: "Often reflects stunting + low intake. 24-hour dietary recall, illness screen, deworm, iron/vitamin D, responsive-feeding counselling. Review weight in 1 month." });
  // overweight / obesity
  const obRow = get("BMIZ5") || get("BMIZ") || get("WHZ");
  if (obRow && (obRow.sev === "red" || /Overweight|Obes/.test(obRow.grade))) A.triage.push({ sev: obRow.sev === "red" ? "red" : "amber", title: `${obRow.grade} — ${obRow.key}`,
    body: "Family-based lifestyle first: balanced thali, water over sugary drinks, no junk/fast food, ≥60 min active play, screen-time + sleep hygiene. Screen: BP (correct cuff), acanthosis, NAFLD (LFT), lipids, glucose/HbA1c, PCOS in adolescent girls, sleep apnoea, orthopaedic pain. 3-monthly follow-up; refer severe/complicated obesity." });
  // head
  if (isFinite(hcaz) && hcaz < -2) A.triage.push({ sev: hcaz < -3 ? "red" : "amber", title: `Microcephaly (z ${zStr(hcaz)})`,
    body: "Re-check technique + plot serial HC. Measure BOTH parents' HC (familial microcephaly is common). Assess milestones/dysmorphism; refer neurology/genetics if <−3 SD, falling centiles, regression or delay." });
  if (isFinite(hcaz) && hcaz > 2) A.triage.push({ sev: "amber", title: `Macrocephaly (z ${zStr(hcaz)})`,
    body: "Parents' HC + serial velocity (parallel curve = reassuring). Neuro exam: fontanelle, sutures, sunset eyes, raised-ICT signs. Urgent imaging if rapidly crossing centiles upward, vomiting, developmental concerns." });
  return A;
}

/* compat for dashboard / summary */
function classifyGrowth(c, m) {
  const A = assessMeasure(c, m), out = {};
  const pick = (k) => A.rows.find((r) => r.key === k);
  const w = pick("WAZ") || pick("WAZ5"), h = pick("HAZ") || pick("HAZ5"),
        b = pick("BMIZ5") || pick("BMIZ"), hc = pick("HCAZ");
  if (w) out.wt = { z: w.z, pct: w.pct, label: w.grade, sev: w.sev };
  if (h) out.ht = { z: h.z, pct: h.pct, label: h.grade, sev: h.sev };
  if (b) out.bmi = { z: b.z, pct: b.pct, label: b.grade, sev: b.sev };
  if (hc && isFinite(hc.z)) out.hc = { z: hc.z, pct: hc.pct, label: hc.grade, sev: hc.sev };
  const mu = pick("MUAC");
  if (mu) out.muac = { v: m.muac, label: mu.grade, sev: mu.sev };
  out._A = A;
  return out;
}

/* ---------------- measures ---------------- */
function latestMeasure(c) { return [...(c.measures || [])].sort((a, b) => a.date.localeCompare(b.date)).pop() || null; }
function birthPoint(c) {
  if (!c.birthWt) return null;
  return { id: "birth", date: c.dob, wt: +c.birthWt, ht: c.birthLen ? +c.birthLen : "", hc: c.birthHC ? +c.birthHC : "",
    muac: "", bmi: c.birthLen ? +((+c.birthWt) / Math.pow((+c.birthLen) / 100, 2)).toFixed(1) : "",
    pos: "length", note: "Birth (profile)", by: "", birth: true };
}
function allMeasures(c) {
  const rows = [...(c.measures || [])].sort((a, b) => a.date.localeCompare(b.date));
  const b = birthPoint(c);
  if (b && !rows.some((r) => r.date === b.date && r.wt)) rows.unshift(b);
  return rows;
}
function openGrowthModal(id) {
  const c = child(); if (!c) return alert("Register a child first.");
  const m = id ? c.measures.find((x) => x.id === id) : null;
  $("gChildLine").textContent = `${c.name} · ${ageStr(ageBetween(c.dob))} · ${c.sex === "boy" ? "Boy" : "Girl"}`;
  $("gId").value = m?.id || ""; $("gDate").value = m?.date || todayISO();
  $("gWt").value = m?.wt ?? ""; $("gHt").value = m?.ht ?? ""; $("gPos").value = m?.pos || "auto";
  $("gHc").value = m?.hc ?? ""; $("gMuac").value = m?.muac ?? "";
  $("gSit").value = m?.sitHt ?? ""; $("gSpan").value = m?.armSpan ?? "";
  $("gEdema").value = m?.edema || ""; $("gApp").value = m?.appetite || "";
  $("gNote").value = m?.note || ""; $("gBy").value = m?.by || "";
  updateGrowthCalc(); openModal("mGrowth");
}
function updateGrowthCalc() {
  const c = child(); if (!c) return;
  const d = $("gDate").value || todayISO();
  const ga = growthAge(c, d);
  let ageLine = ageStr(ageBetween(c.dob, d));
  if (ga.preterm) ageLine += ` · PMA ${pmaStr(ga.pmaD)}` + (ga.useCorr ? ` · corr ${ageStr(ageBetween(c.dob, addDays(d, -(280 - gestDays(c)))))}` : "");
  $("gAgeShow").value = ageLine;
  const wt = parseFloat($("gWt").value), ht = parseFloat($("gHt").value);
  $("gBmiShow").value = wt > 0 && ht > 0 ? (wt / Math.pow(ht / 100, 2)).toFixed(1) : "";
}
["gDate", "gWt", "gHt"].forEach((id) => document.addEventListener("input", (e) => { if (e.target?.id === id) updateGrowthCalc(); }));
function saveGrowth() {
  const c = child();
  const wt = parseFloat($("gWt").value), ht = parseFloat($("gHt").value);
  if (!$("gDate").value || !wt || !ht) return alert("Date, weight and length/height are required.");
  if ($("gDate").value > todayISO()) return alert("Measurement date cannot be in the future.");
  if ($("gDate").value < c.dob) return alert("Measurement date cannot be before birth.");
  if (!(wt >= 0.3 && wt <= 200) || !(ht >= 20 && ht <= 230)) return alert("Please check the values — weight should be 0.3–200 kg and length/height 20–230 cm.");
  const hcV = parseFloat($("gHc").value) || "", muacV = parseFloat($("gMuac").value) || "";
  if (hcV !== "" && !(hcV >= 20 && hcV <= 70)) return alert("Head circumference looks wrong (expected 20–70 cm).");
  if (muacV !== "" && !(muacV >= 5 && muacV <= 40)) return alert("MUAC looks wrong (expected 5–40 cm).");
  const m = { id: $("gId").value || uid(), date: $("gDate").value, wt, ht,
    pos: $("gPos").value, hc: hcV, muac: muacV,
    sitHt: parseFloat($("gSit").value) || "", armSpan: parseFloat($("gSpan").value) || "",
    edema: $("gEdema").value, appetite: $("gApp").value,
    bmi: +(wt / Math.pow(ht / 100, 2)).toFixed(1), note: $("gNote").value.trim(), by: $("gBy").value.trim() };
  const i = c.measures.findIndex((x) => x.id === m.id);
  if (i >= 0) c.measures[i] = m; else c.measures.push(m);
  auditSafe("Growth recorded", c.name + " — " + m.wt + " kg");
  save(); closeModal("mGrowth"); renderAll();
}
function deleteMeasure(id) {
  if (!needSafe(2, "delete measurements")) return;
  const c = child();
  if (!confirm("Delete this measurement?")) return;
  c.measures = c.measures.filter((x) => x.id !== id);
  save(); renderAll();
}
function toggleMeasureTable() { const el = $("measureTableCard"); el.style.display = el.style.display === "none" ? "" : "none"; }
function renderMeasureTable(c) {
  const rows = allMeasures(c);
  $("measureTable").innerHTML = `<tr><th></th><th>Date</th><th>Age</th><th>Wt</th><th>Len/Ht</th><th>BMI</th><th>HC</th><th>MUAC</th><th>Oed</th><th>Note</th><th></th></tr>` +
    (rows.map((m) => { const ga = growthAge(c, m.date);
      return `<tr><td>${m.birth ? '<span class="badge b-violet">B</span>' : ""}</td>
      <td>${fmtDate(m.date)}</td><td>${ageStr(ageBetween(c.dob, m.date))}${ga.useCorr ? " <span class='badge b-blue'>corr</span>" : ""}</td>
      <td><b>${m.wt}</b></td><td><b>${m.ht || "—"}</b> <span style="font-size:11px;color:var(--muted)">${m.ht ? (m.pos === "height" ? "Ht" : m.pos === "length" ? "Len" : "") : ""}</span></td>
      <td>${m.bmi || "—"}</td><td>${m.hc || "—"}</td><td>${m.muac || "—"}</td>
      <td>${m.edema ? `<span class="badge b-red">${esc(m.edema)}</span>` : "—"}</td><td>${esc(m.note || "")}</td>
      <td style="white-space:nowrap">${m.birth ? '<span style="font-size:11px;color:var(--muted)">profile</span>' : `<button class="btn btn-o btn-xs" onclick="openGrowthModal('${m.id}')">Edit</button> <button class="btn btn-danger btn-xs" onclick="deleteMeasure('${m.id}')">✕</button>`}</td></tr>`; }).join("") ||
    `<tr><td colspan="11" style="text-align:center;color:var(--muted)">No measurements yet — click “Record measurements”.</td></tr>`);
}

/* ---------------- growth page ---------------- */
function setGSub(t) {
  DB.gSub = t; save();
  document.querySelectorAll("#growthSubTabs button").forEach((b) => b.classList.toggle("active", b.dataset.gs === t));
  ["charts", "overview", "assess", "velocity", "puberty", "ref"].forEach((k) => ($("gs-" + k).style.display = k === t ? "" : "none"));
  if (t === "charts") setTimeout(drawGrowthChart, 40);
  if (t === "overview") setTimeout(renderGrowthOverview, 40);
  if (t === "assess") renderGAssess(child());
  if (t === "velocity") renderGVelocity(child());
  if (t === "puberty") renderGPuberty(child());
  if (t === "ref") renderGRef();
}
function setGInd(v) { DB.gTab = v; save(); document.querySelectorAll("#growthTabs button").forEach((x) => x.classList.toggle("active", x.dataset.g === v)); drawGrowthChart(); }
function setGLines(v) { DB.gLines = v; save(); document.querySelectorAll("#gLineTabs button").forEach((x) => x.classList.toggle("active", x.dataset.gl === v)); drawGrowthChart(); }
function setGRef5(v) { DB.gRef5 = v; save(); document.querySelectorAll("#gRefTabs button").forEach((x) => x.classList.toggle("active", x.dataset.gr === v)); renderGrowth(); }
function toggleFullRange() { DB.gFull = !DB.gFull; save(); drawGrowthChart(); }
function toggleCorrAge(v) { DB.corrAge = v; save(); renderGrowth(); }
document.querySelectorAll("#growthSubTabs button").forEach((b) => b.addEventListener("click", () => setGSub(b.dataset.gs)));
document.querySelectorAll("#growthTabs button").forEach((b) => b.addEventListener("click", () => setGInd(b.dataset.g)));
document.querySelectorAll("#gLineTabs button").forEach((b) => b.addEventListener("click", () => setGLines(b.dataset.gl)));
document.querySelectorAll("#gRefTabs button").forEach((b) => b.addEventListener("click", () => setGRef5(b.dataset.gr)));

function renderGrowth() {
  const c = child(); if (!c) return;
  document.querySelectorAll("#growthSubTabs button").forEach((b) => b.classList.toggle("active", b.dataset.gs === (DB.gSub || "charts")));
  ["charts", "overview", "assess", "velocity", "puberty", "ref"].forEach((k) => ($("gs-" + k).style.display = (DB.gSub || "charts") === k ? "" : "none"));
  $("corrAgeTgl").checked = DB.corrAge !== false;
  // PMA / preterm banner
  const gaNow = growthAge(c, todayISO());
  if (gaNow.preterm) {
    $("growthPmaLine").innerHTML = `<div class="alert a-blue">👶 <div><b>Born at ${gaNow.gestWk.toFixed(1)} weeks</b> (${pretermClass(gaNow.gestWk)}) · Birth weight ${c.birthWt ? c.birthWt + " kg (" + lbwClass(+c.birthWt) + ")" : "—"} · Today: PMA <b>${pmaStr(gaNow.pmaD)}</b> · Chronological ${ageStr(ageBetween(c.dob))}${gaNow.useCorr ? ` · <b>Corrected ${ageStr(ageBetween(c.dob, addDays(todayISO(), -(280 - gestDays(c)))))} — assessment uses corrected age</b>` : " · <b>chronological age in use</b> (toggle corrected age above)"}.<br><span style="font-size:12px">Standard practice: correct for prematurity till 2 y; vaccinate by chronological age. For PMA &lt;37 w use official Fenton charts in NICU (link in Standards tab).</span></div></div>`;
  } else $("growthPmaLine").innerHTML = "";
  renderMeasureTable(c);
  // stat cards from latest point
  const rows = allMeasures(c), lm = rows[rows.length - 1];
  if (!lm) {
    $("growthStats").innerHTML = "";
    $("growthAlerts").innerHTML = `<div class="alert a-blue">📏 <div>No measurements yet. Record weight & length/height to generate exact WHO/CDC percentiles, z-scores and charts.</div></div>`;
  } else {
    const A = assessMeasure(c, lm), cl = classifyGrowth(c, lm);
    const card = (t, v, sub, sev) => `<div class="stat" style="--ac:${sev === "red" ? "var(--red)" : sev === "amber" ? "var(--amber)" : sev === "gray" ? "var(--muted)" : "var(--green)"}"><div><div class="n" style="font-size:19px">${v}</div><div class="l">${t}</div><div style="font-size:12px;margin-top:4px"><span class="badge ${sev === "red" ? "b-red" : sev === "amber" ? "b-amber" : sev === "gray" ? "b-gray" : "b-green"}">${sub}</span></div></div></div>`;
    const pz = (o) => o && isFinite(o.z) ? `P ${fmtPct(o.pct)} · z ${zStr(o.z)}` : "n/a";
    $("growthStats").innerHTML =
      (cl.wt ? card(`Weight · ${pz(cl.wt)}`, lm.wt + " kg", cl.wt.label, cl.wt.sev) : "") +
      (cl.ht ? card(`Length/Height · ${pz(cl.ht)}`, (lm.ht || "—") + (lm.ht ? " cm" : ""), cl.ht.label, cl.ht.sev) : "") +
      (cl.bmi ? card(`BMI · ${pz(cl.bmi)}`, lm.bmi + "", cl.bmi.label, cl.bmi.sev) : "") +
      (cl.hc ? card(`Head circ · ${pz(cl.hc)}`, lm.hc + " cm", cl.hc.label, cl.hc.sev) : (cl.muac ? card("MUAC", lm.muac + " cm", cl.muac.label, cl.muac.sev) : ""));
    let al = "";
    if (A.tooEarly) al += `<div class="alert a-blue">👶 <div>PMA ${pmaStr(A.ga.pmaD)} (below term-equivalent): plot on the official Fenton chart in NICU. This app assesses from term-equivalent age using corrected age.</div></div>`;
    (A.biv || []).forEach((f) => (al += `<div class="alert a-red">⚠️ <div><b>Data check:</b> ${esc(f)}</div></div>`));
    A.triage.forEach((t) => (al += `<div class="alert ${t.sev === "red" ? "a-red" : "a-amber"}">${t.sev === "red" ? "🔴" : "🟡"} <div><b>${esc(t.title)}</b><br>${esc(t.body)}</div></div>`));
    if (!A.triage.length && !A.tooEarly && !(A.biv || []).length) al += `<div class="alert a-green">🟢 <div><b>Growing well</b> — latest assessment (${fmtDate(lm.date)}) within normal range on exact references. Continue routine surveillance.</div></div>`;
    $("growthAlerts").innerHTML = al;
  }
  const sub = DB.gSub || "charts";
  if (sub === "assess") renderGAssess(c);
  if (sub === "velocity") renderGVelocity(c);
  if (sub === "puberty") renderGPuberty(c);
  if (sub === "ref") renderGRef();
  if ($("pg-growth").classList.contains("active") && sub === "charts") drawGrowthChart();
  if ($("pg-growth").classList.contains("active") && sub === "overview") renderGrowthOverview();
}

/* ---------------- full assessment tab ---------------- */
function renderGAssess(c) {
  const rows = allMeasures(c), box = $("gs-assess");
  if (!rows.length) { box.innerHTML = `<div class="card"><div class="empty"><div class="big">🧾</div>No measurements yet.</div></div>`; return; }
  if (!DB.gAssessId || !rows.some((r) => r.id === DB.gAssessId)) DB.gAssessId = rows[rows.length - 1].id;
  const m = rows.find((r) => r.id === DB.gAssessId), A = assessMeasure(c, m);
  const opts = rows.map((r) => `<option value="${r.id}" ${r.id === m.id ? "selected" : ""}>${fmtDate(r.date)} — ${ageStr(ageBetween(c.dob, r.date))}${r.birth ? " (birth)" : ""}</option>`).join("");
  let body = `<div class="card" style="margin-bottom:16px"><div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
    <h3 style="margin:0">Assessment of ${fmtDate(m.date)}</h3><span class="sp" style="flex:1"></span>
    <select onchange="DB.gAssessId=this.value;save();renderGAssess(child())" style="width:auto;min-width:230px">${opts}</select></div>`;
  if (A.tooEarly) {
    body += `<div class="alert a-blue">👶 <div>PMA ${pmaStr(A.ga.pmaD)} — below term-equivalent age. Use the official Fenton chart (NICU) for PMA-based percentiles. Post-discharge, this app assesses on corrected age with exact WHO standards.</div></div></div>`;
    box.innerHTML = body; return;
  }
  body += `<div class="hint">Age: ${ageStr(ageBetween(c.dob, m.date))} (chrono)${A.ga.useCorr ? ` · <b>corrected ${ageStr(ageBetween(c.dob, addDays(m.date, -(280 - gestDays(c)))))} — used below</b>` : ""} · PMA ${pmaStr(A.ga.pmaD)}${A.len?.adj ? ` · length/height WHO ${A.len.adj > 0 ? "+0.7" : "−0.7"} cm adjusted` : ""}</div>
  <div style="overflow:auto"><table class="tbl"><tr><th>Indicator</th><th>Value</th><th>Ref</th><th>Percentile</th><th>Z</th><th>Grade</th></tr>
  ${A.rows.map((r) => `<tr><td><b>${esc(r.label)}</b><br><span style="font-size:11.5px;color:var(--muted)">${esc(r.note || "")}</span></td>
    <td><b>${esc(r.value)}</b></td><td>${esc(r.ref)}</td>
    <td>${isFinite(r.pct) ? fmtPct(r.pct) : "—"}</td><td>${isFinite(r.z) ? zStr(r.z) : "—"}</td>
    <td><span class="badge ${r.sev === "red" ? "b-red" : r.sev === "amber" ? "b-amber" : r.sev === "gray" ? "b-gray" : "b-green"}">${esc(r.grade)}</span></td></tr>`).join("")}</table></div></div>`;
  (A.biv || []).forEach((f) => (body += `<div class="alert a-red">⚠️ <div><b>Data check:</b> ${esc(f)}</div></div>`));
  A.triage.forEach((t) => (body += `<div class="alert ${t.sev === "red" ? "a-red" : "a-amber"}">${t.sev === "red" ? "🔴" : "🟡"} <div><b>${esc(t.title)}</b><br>${esc(t.body)}</div></div>`));
  if (!A.triage.length) body += `<div class="alert a-green">🟢 <div><b>Normal assessment</b> — no red or amber flags on this visit.</div></div>`;
  box.innerHTML = body;
}

/* ---------------- velocity tab ---------------- */
const VEL_NORMS = [
  { maxD: 93,   label: "0–3 mo",  wt: [20, 35], ht: [20, 30], hc: [1.5, 2.5] },
  { maxD: 186,  label: "3–6 mo",  wt: [12, 22], ht: [15, 22], hc: [0.8, 1.4] },
  { maxD: 279,  label: "6–9 mo",  wt: [9, 17],  ht: [11, 17], hc: [0.3, 0.7] },
  { maxD: 365,  label: "9–12 mo", wt: [7, 14],  ht: [9, 14],  hc: [0.2, 0.5] },
  { maxD: 730,  label: "1–2 y",   wt: [4, 9],   ht: [9, 14],  hc: [0.15, 0.3] },
  { maxD: 1095, label: "2–3 y",   wt: [3, 8],   ht: [6.5, 10], hc: null },
  { maxD: 2190, label: "3–6 y",   wt: [3, 7],   ht: [5.5, 8], hc: null },
  { maxD: 3650, label: "6–10 y",  wt: [3, 8],   ht: [4.5, 7], hc: null },
  { maxD: 1e12,  label: "10 y+ (puberty varies)", wt: [4, 12], ht: [4, 12], hc: null },
];
function velVerdict(v, lo, hi, inv) {
  if (v == null || !isFinite(v)) return { t: "—", s: "gray" };
  if (v < 0 && !inv) return { t: "FALLING ↓", s: "red" };
  if (v >= lo && v <= hi) return { t: "Normal", s: "green" };
  const m = 0.3;
  if (v >= lo * (1 - m) && v <= hi * (1 + m)) return { t: v < lo ? "Low-normal" : "High-normal", s: "amber" };
  return { t: v < lo ? "Low ↓" : "High ↑", s: v < lo ? "red" : "amber" };
}
function renderGVelocity(c) {
  const rows = allMeasures(c).filter((r) => r.wt && r.ht), box = $("gs-velocity");
  if (rows.length < 2) { box.innerHTML = `<div class="card"><div class="empty"><div class="big">🚀</div>Need at least 2 measurements with weight + length/height.<br>Velocity (growth rate) often detects problems before centiles do.</div></div>`; return; }
  let trs = "";
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i-1], b = rows[i];
    const days = Math.max(1, Math.round((new Date(b.date) - new Date(a.date)) / 86400000));
    const gaA = growthAge(c, a.date), gaB = growthAge(c, b.date);
    const dA = gaA.useCorr ? gaA.corrD : gaA.chronoD, dB = gaB.useCorr ? gaB.corrD : gaB.chronoD;
    const mid = (dA + dB) / 2, N = VEL_NORMS.find((n) => mid <= n.maxD);
    const gpd = ((b.wt - a.wt) * 1000) / days;
    const cpy = ((b.ht - a.ht) / days) * 365.25;
    const hcpm = (a.hc && b.hc) ? ((b.hc - a.hc) / days) * 30.4375 : null;
    const vw = velVerdict(gpd, N.wt[0], N.wt[1]), vh = velVerdict(cpy, N.ht[0], N.ht[1]);
    const vhc = N.hc ? velVerdict(hcpm, N.hc[0], N.hc[1]) : { t: hcpm == null ? "—" : `${hcpm.toFixed(2)} cm/mo`, s: "gray" };
    let extra = "";
    if (mid > 1460 && cpy < 4 && cpy >= 0) extra = `<br><span class="badge b-red">Ht vel &lt;4 cm/y after 4 y — evaluate</span>`;
    if (gpd < 0) extra += `<br><span class="badge b-red">Weight loss — urgent review</span>`;
    trs += `<tr><td>${fmtDate(a.date)} →<br>${fmtDate(b.date)}<br><span style="font-size:11px;color:var(--muted)">${days} d · ~${N.label}${gaA.useCorr || gaB.useCorr ? " · corr" : ""}</span></td>
      <td><b>${gpd.toFixed(1)} g/d</b><br><span style="font-size:11.5px;color:var(--muted)">exp ${N.wt[0]}–${N.wt[1]}</span><br><span class="badge ${vw.s === "red" ? "b-red" : vw.s === "amber" ? "b-amber" : "b-green"}">${vw.t}</span></td>
      <td><b>${cpy.toFixed(1)} cm/y</b><br><span style="font-size:11.5px;color:var(--muted)">exp ${N.ht[0]}–${N.ht[1]}</span><br><span class="badge ${vh.s === "red" ? "b-red" : vh.s === "amber" ? "b-amber" : "b-green"}">${vh.t}</span>${extra}</td>
      <td>${hcpm == null ? "—" : `<b>${hcpm.toFixed(2)} cm/mo</b>`}<br>${N.hc ? `<span style="font-size:11.5px;color:var(--muted)">exp ${N.hc[0]}–${N.hc[1]}</span><br><span class="badge ${vhc.s === "red" ? "b-red" : vhc.s === "amber" ? "b-amber" : vhc.s === "gray" ? "b-gray" : "b-green"}">${vhc.t}</span>` : `<span style="font-size:11.5px;color:var(--muted)">track curve</span>`}</td></tr>`;
  }
  box.innerHTML = `<div class="card" style="margin-bottom:16px"><h3>Growth velocity between visits</h3>
    <div class="hint">Expected ranges: standard paediatric norms (Nelson/IAP). Short intervals (&lt;2–3 mo) exaggerate error — interpret with centile trends. Preterm uses corrected age.</div>
    <div style="overflow:auto"><table class="tbl"><tr><th>Interval</th><th>Weight gain</th><th>Height velocity</th><th>Head growth</th></tr>${trs}</table></div></div>
    <div class="alert a-blue">📐 <div><b>Rules of thumb:</b> crossing <b>downward across ≥1 major centile band</b> (e.g. P50→P25→P10) or height velocity <b>&lt;4 cm/y after age 4</b> (outside puberty) needs evaluation even if centiles look “normal”. Catch-up after illness/nutritional rehab may show briefly rapid velocity — confirm it stabilises.</div></div>`;
}

/* ---------------- puberty + body proportions tab ---------------- */
const TANNER_B = ["B1 — prepubertal, no breast tissue", "B2 — breast bud: small mound, areola widens", "B3 — breast + areola enlarge, single contour", "B4 — areola + papilla form secondary mound", "B5 — mature: areola recessed, single contour"];
const TANNER_G = ["G1 — prepubertal: testes 1–3 mL", "G2 — scrotum reddens/thins; testes ≥4 mL", "G3 — penis lengthens; testes enlarge", "G4 — penis broadens, glans develops", "G5 — adult size and shape"];
const TANNER_PH = ["PH1 — no pubic hair", "PH2 — sparse, long, pigmented at base", "PH3 — darker, curlier, more abundant", "PH4 — adult-type, limited area", "PH5 — adult quantity, spread to thigh"];
const USLS_ANCHORS = [[0, 1.7], [365, 1.5], [1095, 1.3], [2555, 1.0], [6570, 0.9]];
function mphTarget(c) {
  const f = parseFloat(c.fHt), m = parseFloat(c.mHt);
  if (!f || !m) return null;
  const mph = c.sex === "boy" ? (f + m + 13) / 2 : (f + m - 13) / 2;
  return { mph, lo: mph - 8.5, hi: mph + 8.5 };
}
function tannerInterpret(c, t) {
  const a = ageBetween(c.dob, t.date), ageY = a.days / 365.25;
  const gon = c.sex === "boy" ? t.g : t.b;
  const tvMax = c.sex === "boy" ? Math.max(+(t.tvL || 0), +(t.tvR || 0)) : 0;
  const started = gon >= 2 || (c.sex === "boy" && tvMax >= 4);
  if (!started) {
    if ((c.sex === "girl" && ageY >= 13) || (c.sex === "boy" && ageY >= 14))
      return { sev: "red", t: "Delayed puberty", b: "No pubertal onset by 13 y (girls) / 14 y (boys). Assess growth velocity, bone age, LH/FSH, TFT; refer paediatric endocrinology. Constitutional delay is common — but exclude hypogonadism, chronic disease, hypothyroidism." };
    return { sev: "green", t: "Prepubertal", b: "No pubertal signs yet — normal for age. Continue annual staging from 8 y." };
  }
  if ((c.sex === "girl" && ageY < 8) || (c.sex === "boy" && ageY < 9))
    return { sev: "red", t: "Precocious puberty — refer promptly", b: `Onset before 8 y (girls) / 9 y (boys). Needs: growth-velocity review, bone age, LH/FSH (± GnRH stimulation), TFT, USG pelvis/adrenals; MRI brain if central cause suspected. Early referral preserves height + addresses cause.` };
  if ((c.sex === "girl" && ageY < 8.5) || (c.sex === "boy" && ageY < 9.5))
    return { sev: "amber", t: "Early puberty — monitor closely", b: "Borderline-early onset. Track velocity + bone-age advancement 6-monthly; evaluate fully if rapid progression, androgen signs or tall-then-short pattern." };
  if (c.sex === "girl" && !t.menarche && (ageY >= 15 || (t.b >= 2 && ageY >= 14)))
    return { sev: "amber", t: "Primary amenorrhoea workup due", b: "No menarche by 15 y (or >3 y after thelarche). Examine (breasts, pubic hair, anatomy), β-hCG if relevant, LH/FSH, TFT, prolactin, pelvic USG. Refer." };
  return { sev: "green", t: "Puberty progressing normally", b: `Onset and tempo normal for age. Expect peak height velocity ~11–12 y (girls) / ~13–14 y (boys); ~25 cm (girls) / ~28 cm (boys) total pubertal gain. Re-stage 6–12 monthly.` };
}
function openTannerModal(id) {
  const c = child(); c.tanner = c.tanner || [];
  const t = id ? c.tanner.find((x) => x.id === id) : null;
  $("tnId").value = t?.id || ""; $("tnDate").value = t?.date || todayISO();
  $("tnGon").value = t ? (c.sex === "boy" ? t.g : t.b) : "1";
  $("tnPH").value = t?.ph || "1";
  $("tnTvL").value = t?.tvL || ""; $("tnTvR").value = t?.tvR || "";
  $("tnMen").value = t?.menarche || "";
  $("tnNote").value = t?.note || "";
  $("tnGonLbl").textContent = c.sex === "boy" ? "Genital stage (G)" : "Breast stage (B)";
  $("tnGon").innerHTML = (c.sex === "boy" ? TANNER_G : TANNER_B).map((d, i) => `<option value="${i + 1}">${d}</option>`).join("");
  $("tnGon").value = t ? (c.sex === "boy" ? t.g : t.b) : "1";
  $("tnPH").innerHTML = TANNER_PH.map((d, i) => `<option value="${i + 1}">${d}</option>`).join("");
  $("tnPH").value = t?.ph || "1";
  $("tnTvRow").style.display = c.sex === "boy" ? "" : "none";
  $("tnMenRow").style.display = c.sex === "girl" ? "" : "none";
  openModal("mTanner");
}
function saveTanner() {
  const c = child(); c.tanner = c.tanner || [];
  if (!$("tnDate").value) return alert("Date required.");
  const t = { id: $("tnId").value || uid(), date: $("tnDate").value,
    b: c.sex === "girl" ? +$("tnGon").value : 0, g: c.sex === "boy" ? +$("tnGon").value : 0,
    ph: +$("tnPH").value, tvL: $("tnTvL").value, tvR: $("tnTvR").value,
    menarche: $("tnMen").value, note: $("tnNote").value.trim() };
  const i = c.tanner.findIndex((x) => x.id === t.id);
  if (i >= 0) c.tanner[i] = t; else c.tanner.push(t);
  save(); closeModal("mTanner"); renderAll();
}
function deleteTanner(id) {
  const c = child();
  if (!confirm("Delete this Tanner staging?")) return;
  c.tanner = (c.tanner || []).filter((x) => x.id !== id);
  save(); renderAll();
}
function renderGPuberty(c) {
  const box = $("gs-puberty");
  c.tanner = c.tanner || [];
  const rows = [...c.tanner].sort((a, b) => a.date.localeCompare(b.date));
  const latest = rows[rows.length - 1];
  const interpHtml = latest ? (() => { const r = tannerInterpret(c, latest);
    return `<div class="alert ${r.sev === "red" ? "a-red" : r.sev === "amber" ? "a-amber" : "a-green"}">${r.sev === "red" ? "🔴" : r.sev === "amber" ? "🟡" : "🟢"} <div><b>${esc(r.t)}</b> (${fmtDate(latest.date)}, age ${ageStr(ageBetween(c.dob, latest.date))})<br>${esc(r.b)}</div></div>`; })() : "";
  // proportions from latest measure with sitHt/span
  const ms = [...allMeasures(c)].reverse().find((m) => m.sitHt || m.armSpan);
  let propHtml = "";
  if (!ms) propHtml = `<div class="empty"><div class="big">🧍</div>No sitting-height / arm-span recorded.<br><button class="btn btn-p btn-sm" onclick="openGrowthModal()">Record now</button></div>`;
  else {
    const ga = growthAge(c, ms.date), d = ga.useCorr ? ga.corrD : ga.chronoD;
    let usls = "";
    if (ms.sitHt && ms.ht) {
      const ls = ms.ht - ms.sitHt, ratio = ls > 0 ? ms.sitHt / ls : NaN;
      const exp = interp(USLS_ANCHORS.map((a) => a[0]), USLS_ANCHORS.map((a) => a[1]), d);
      const flag = isFinite(ratio) && (ratio > exp + 0.25 || ratio < exp - 0.2);
      usls = `<dl class="kv"><dt>Upper : lower segment</dt><dd><b>${isFinite(ratio) ? ratio.toFixed(2) : "—"}</b> (sit ${ms.sitHt} cm / lower ${ls.toFixed(1)} cm) · expected ~${exp.toFixed(2)} ${flag ? '<span class="badge b-red">Disproportionate</span>' : '<span class="badge b-green">Proportionate</span>'}</dd></dl>
      ${flag ? `<div class="alert a-amber">🦴 <div><b>Disproportionate stature:</b> high ratio suggests short limbs; low ratio suggests short trunk. Consider skeletal dysplasia screen (X-ray skeletal survey), rickets, hypothyroidism, Turner (girls) — refer genetics/endocrinology.</div></div>` : ""}`;
    }
    let span = "";
    if (ms.armSpan && ms.ht) {
      const r = ms.armSpan / ms.ht, diff = ms.armSpan - ms.ht;
      span = `<dl class="kv"><dt>Arm span : height</dt><dd><b>${ms.armSpan} cm vs ${ms.ht} cm</b> (diff ${diff >= 0 ? "+" : ""}${diff.toFixed(1)} cm · ratio ${r.toFixed(3)}) ${d > 2555 && r > 1.05 ? '<span class="badge b-amber">↑ screen Marfan habitus</span>' : d > 2555 && r < 0.95 ? '<span class="badge b-amber">↓ short limbs?</span>' : '<span class="badge b-green">Normal</span>'}</dd></dl>`;
    }
    propHtml = `<div class="hint">From ${fmtDate(ms.date)} (age ${ageStr(ageBetween(c.dob, ms.date))}) · sitting height = upper segment; lower segment = height − sitting height</div>${usls}${span}`;
  }
  const mph = mphTarget(c);
  const mphHtml = mph ? `<dl class="kv"><dt>Target (MPH)</dt><dd><b style="font-size:18px">${mph.mph.toFixed(1)} cm</b> · range ${mph.lo.toFixed(0)}–${mph.hi.toFixed(0)} cm (±8.5)</dd><dt>Meaning</dt><dd>Genetic potential from parents' heights. A child tracking far below MPH range (with low velocity) needs evaluation; plotted as a band on the height chart.</dd></dl>`
    : `<span style="font-size:13px;color:var(--muted)">Add both parents' heights in the child profile to compute genetic target height.</span>`;
  box.innerHTML = `
    <div class="card" style="margin-bottom:16px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px"><h3 style="margin:0">Puberty staging (Tanner / SMR)</h3><span class="sp" style="flex:1"></span><button class="btn btn-p btn-sm" onclick="openTannerModal()">+ Stage puberty</button></div>
    <div class="hint">Examine annually from 8 y · onset = B2 (girls) / testes ≥4 mL or G2 (boys) · always chaperoned, consenting adolescent</div>
    ${interpHtml}
    ${rows.length ? `<div style="overflow:auto"><table class="tbl"><tr><th>Date</th><th>Age</th><th>${c.sex === "boy" ? "G" : "B"}</th><th>PH</th>${c.sex === "boy" ? "<th>Testes (mL)</th>" : "<th>Menarche</th>"}<th>Note</th><th></th></tr>
    ${rows.map((t) => `<tr><td>${fmtDate(t.date)}</td><td>${ageStr(ageBetween(c.dob, t.date))}</td><td><b>${c.sex === "boy" ? "G" + t.g : "B" + t.b}</b></td><td><b>PH${t.ph}</b></td><td>${c.sex === "boy" ? (t.tvL || t.tvR ? `${esc(t.tvL || "–")} / ${esc(t.tvR || "–")}` : "—") : (t.menarche ? (t.menarche === "yes" ? "Yes" : t.menarche === "no" ? "No" : esc(t.menarche)) : "—")}</td><td>${esc(t.note || "")}</td><td style="white-space:nowrap"><button class="btn btn-o btn-xs" onclick="openTannerModal('${t.id}')">Edit</button> <button class="btn btn-danger btn-xs" onclick="deleteTanner('${t.id}')">✕</button></td></tr>`).join("")}</table></div>` : `<div class="empty"><div class="big">🧍</div>No staging yet — start annual staging at 8 years.</div>`}
    </div>
    <div class="grid g2"><div class="card"><h3>🦴 Body proportions</h3>${propHtml}</div>
    <div class="card"><h3>🧬 Mid-parental height</h3><div class="hint">Target height ≈ (Father + Mother ± 13)/2 cm (+13 boys, −13 girls)</div>${mphHtml}</div></div>`;
}

/* ---------------- standards tab ---------------- */
function renderGRef() {
  $("gs-ref").innerHTML = `
  <div class="grid g2">
    <div class="card"><h3>📚 References used (exact data)</h3><div style="font-size:13.5px;line-height:1.9">
      • <b>0–5 y — WHO MGRS 2006:</b> daily LMS tables for weight, length/height, BMI, head circumference (0–1826 d), MUAC (91–1826 d), weight-for-length 45–110 cm & weight-for-height 65–120 cm (0.5 cm). Source: WHO igrowup tables (WorldHealthOrganization/anthro).<br>
      • <b>2–20 y alternative — CDC 2000:</b> exact LMS for weight, stature, BMI (24–240 mo); severe obesity classed by % of P95. Source: cdc.gov growth-chart z-score files.<br>
      • <b>5–18 y default — IAP 2015-aligned:</b> screening curves calibrated to revised IAP charts (Khadilkar et al., Indian Pediatr 2015); overweight/obesity = <b>adult-equivalent 23 / 27</b> lines. Confirm diagnostic labels on official IAP charts.<br>
      • <b>Preterm:</b> corrected age to 24 mo (standard practice). Fenton chart data aren't embedded in-app — use official charts: <b>ucalgary.ca/fenton</b> / fentongrowth.ca (now with 2025 3rd-generation charts).</div></div>
    <div class="card"><h3>🧮 Methods & cutoffs</h3><div style="font-size:13.5px;line-height:1.9">
      • z = ((X/M)<sup>L</sup> − 1)/(L·S); WHO extreme values use the <b>restricted-SD method</b> beyond ±3.<br>
      • <b>Length/height:</b> &lt;24 mo compared as length, ≥24 mo as height; wrong position auto-adjusted ±0.7 cm (WHO rule). Record actual position for accuracy.<br>
      • <b>SAM:</b> WHZ &lt;−3 or MUAC &lt;11.5 cm (6–59 mo) or any oedema · <b>MAM:</b> WHZ −3..−2 or MUAC 11.5–12.4 · complicated if oedema ++/+++, poor appetite, &lt;6 mo or ill.<br>
      • <b>CDC BMI:</b> &lt;P5 underweight · P85–95 overweight · ≥P95 obesity (Class II ≥120% of P95, III ≥140%).<br>
      • Implausible-value flags (WHO): WAZ &lt;−6/&gt;+5, HAZ ±6, WHZ ±5.</div></div>
    <div class="card"><h3>📏 Measuring right (IAP/WHO protocol)</h3><div style="font-size:13.5px;line-height:1.9">
      • <b>Weight:</b> calibrated digital scale, light clothing; 10 g (infants) / 100 g precision.<br>
      • <b>Length (&lt;2 y):</b> infantometer supine, head–heel. <b>Height (≥2 y):</b> stadiometer, Frankfurt plane, gentle upward traction.<br>
      • <b>HC:</b> non-stretch tape over glabella–opisthocranion. <b>MUAC:</b> left arm, mid-point shoulder–elbow, arm relaxed.<br>
      • <b>Sitting height:</b> stadiometer sitting, thighs horizontal. <b>Span:</b> back to wall, arms outstretched, fingertip–fingertip.<br>
      • Same equipment + technique each visit; re-measure if a point jumps centiles unexpectedly.</div></div>
    <div class="card"><h3>⚠️ Limitations</h3><div style="font-size:13.5px;line-height:1.9">
      • Screening aid — not a diagnosis. Single points matter less than <b>trends + velocity</b>.<br>
      • IAP 5–18 curves here are <b>aligned approximations</b>; borderline obesity/short-stature calls need official IAP charts.<br>
      • No HC reference beyond 5 y in-app — follow serial measurements clinically.<br>
      • Velocity norms are typical ranges; puberty timing shifts them — interpret with Tanner stage.</div></div>
  </div>`;
}

/* ---------------- printable growth sheet ---------------- */
function printGrowthSheet() {
  const c = child(); if (!c) return;
  const rows = allMeasures(c);
  if (!rows.length) return alert("No measurements to print.");
  const wasSub = DB.gSub || "charts";
  DB.gSub = "charts";
  document.querySelectorAll("#growthSubTabs button").forEach((b) => b.classList.toggle("active", b.dataset.gs === "charts"));
  ["charts", "overview", "assess", "velocity", "puberty", "ref"].forEach((k) => ($("gs-" + k).style.display = k === "charts" ? "" : "none"));
  drawGrowthChart();
  let img = "";
  try { img = $("gChart").toDataURL("image/png"); } catch (e) {}
  const lm = rows[rows.length - 1], A = assessMeasure(c, lm);
  const ga = A.ga;
  let velLine = "Need ≥2 visits for velocity.";
  if (rows.length >= 2) {
    const a = rows[rows.length - 2], b = rows[rows.length - 1];
    const days = Math.max(1, Math.round((new Date(b.date) - new Date(a.date)) / 86400000));
    velLine = `${(((b.wt - a.wt) * 1000) / days).toFixed(1)} g/day · ${(((b.ht - a.ht) / days) * 365.25).toFixed(1)} cm/year over ${days} days (${fmtDate(a.date)} → ${fmtDate(b.date)}).`;
  }
  $("gsheetPrint").innerHTML = `${clinicHeader()}
    <div style="text-align:center;margin:4px 0 10px"><div style="font-size:19px;font-weight:800;color:var(--navy)">GROWTH ASSESSMENT SHEET (IAP / WHO)</div></div>
    ${childHeader(c)}
    <dl class="kv" style="margin-bottom:10px"><dt>Assessment date</dt><dd>${fmtDate(lm.date)} · chrono ${ageStr(ageBetween(c.dob, lm.date))}${ga.useCorr ? ` · <b>corrected ${ageStr(ageBetween(c.dob, addDays(lm.date, -(280 - gestDays(c)))))} (used)</b>` : ""} · PMA ${pmaStr(ga.pmaD)}</dd>
    <dt>Anthropometry</dt><dd>${lm.wt} kg · ${lm.ht} cm (${lm.pos || "auto"}) · BMI ${lm.bmi}${lm.hc ? ` · HC ${lm.hc} cm` : ""}${lm.muac ? ` · MUAC ${lm.muac} cm` : ""}${lm.edema ? ` · <b>oedema ${esc(lm.edema)}</b>` : ""}</dd>
    <dt>Velocity (last)</dt><dd>${velLine}</dd></dl>
    <table class="tbl"><tr><th>Indicator</th><th>%ile</th><th>Z</th><th>Grade</th></tr>
    ${A.rows.map((r) => `<tr><td><b>${esc(r.label)}</b> <span style="font-size:11px;color:var(--muted)">[${esc(r.ref)}]</span></td><td>${isFinite(r.pct) ? fmtPct(r.pct) : "—"}</td><td>${isFinite(r.z) ? zStr(r.z) : "—"}</td><td><b>${esc(r.grade)}</b></td></tr>`).join("")}</table>
    ${img ? `<div style="margin-top:10px;text-align:center"><img src="${img}" style="max-width:100%;border:1px solid #cbd5e1;border-radius:8px"><div style="font-size:11px;color:var(--muted)">${esc($("gChartTitle").textContent)}</div></div>` : ""}
    <h4 style="margin:12px 0 6px;color:var(--navy)">Impression & plan</h4>
    ${(A.biv || []).map((f) => `<div>⚠️ ${esc(f)}</div>`).join("")}
    ${A.triage.map((t) => `<div style="margin-bottom:6px"><b>${esc(t.title)}</b><br>${esc(t.body)}</div>`).join("") || "<div>Growing well — continue routine surveillance.</div>"}
    <div class="footer-note">Exact WHO (0–5 y) / CDC + IAP-aligned (5–18 y) references · ${mphTarget(c) ? `MPH target ${mphTarget(c).mph.toFixed(1)} cm (${mphTarget(c).lo.toFixed(0)}–${mphTarget(c).hi.toFixed(0)}) · ` : ""}Confirm diagnostic labels on official charts.</div>
    ${typeof docFooter === "function" ? docFooter("Growth assessment sheet") : ""}`;
  DB.gSub = wasSub; save(); renderGrowth();
  printPage("pg-gsheet");
}

/* ---------------- M5 growth alerts ----------------
   growthAlerts(measures, dobISO, todayISO, zOf): zOf(m) -> {waz,haz}|null is
   injected so the pure is unit-testable without WHO tables; the dashboard
   passes a whoAgeZ wrapper. Rules: overdue, >10% weight drop, stagnation
   under 1y, WAZ/HAZ below -2. Guidance only — confirm on official charts. */
function growthAlerts(measures, dobISO, todayISO, zOf) {
  const ms = [...(measures || [])].filter((m) => m && m.date).sort((a, b) => (a.date < b.date ? -1 : 1));
  const alerts = [];
  const lastD = ms.length ? ms[ms.length - 1].date : dobISO;
  const ageM = Math.max(0, Math.round(((new Date(todayISO + "T00:00:00Z") - new Date(dobISO + "T00:00:00Z")) / 864e5) / 30.44));
  const gapM = Math.round(((new Date(todayISO + "T00:00:00Z") - new Date(lastD + "T00:00:00Z")) / 864e5) / 30.44);
  const due = ageM < 24 ? 6 : 12;
  if (gapM > due) alerts.push({ level: "amber", msg: `no measurement for ${gapM} mo (due every ${due} mo)` });
  for (let i = 1; i < ms.length; i++) {
    const a = +ms[i - 1].wt, b = +ms[i].wt;
    if (a > 0 && b > 0 && b < a * 0.9) alerts.push({ level: "red", msg: `weight drop ${a} → ${b} kg (>${10}%): review urgently` });
  }
  if (ms.length >= 2 && ageM < 12) {
    const spanD = Math.round((new Date(ms[ms.length - 1].date + "T00:00:00Z") - new Date(ms[0].date + "T00:00:00Z")) / 864e5);
    if (spanD >= 90 && +ms[ms.length - 1].wt <= +ms[0].wt) alerts.push({ level: "amber", msg: "no weight gain in 3+ mo under 1 y — review feeding/illness" });
  }
  if (typeof zOf === "function" && ms.length) {
    try {
      const z = zOf(ms[ms.length - 1]);
      if (z && typeof z.waz === "number" && z.waz < -2) alerts.push({ level: "red", msg: `WAZ ${z.waz.toFixed(2)} (<−2): underweight — confirm on chart` });
      if (z && typeof z.haz === "number" && z.haz < -2) alerts.push({ level: "red", msg: `HAZ ${z.haz.toFixed(2)} (<−2): stunting — confirm on chart` });
    } catch (e) {}
  }
  return alerts;
}
function growthAlertsHTML() {
  if (typeof DB === "undefined" || !DB.children) return "";
  const today = (typeof todayISO === "function") ? todayISO() : "";
  const rows = [];
  DB.children.forEach((c) => {
    const zOf = (m) => {
      try {
        const ga = growthAge(c, m.date);
        return { waz: whoAgeZ(c.sex, "wfa", ga.ageD, +m.wt).z, haz: m.ht ? whoAgeZ(c.sex, "lhfa", ga.ageD, +m.ht).z : 0 };
      } catch (e) { return null; }
    };
    growthAlerts(c.measures, c.dob, today, zOf).forEach((a) => rows.push({ name: c.name, a }));
  });
  if (!rows.length) return "";
  const items = rows.slice(0, 6).map((r) => `<div style='font-size:13px'>${r.a.level === "red" ? "🔴" : "🟡"} <b>${esc(r.name)}</b> — ${esc(r.a.msg)}</div>`).join("");
  return `<div class='card' style='margin-top:10px'><h3>Growth alerts (${rows.length})</h3>${items}<button class='btn btn-o btn-sm' style='margin-top:6px' onclick="go('growth')">Open growth →</button></div>`;
}

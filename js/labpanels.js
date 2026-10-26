/* NeoKid Care — labs mini-panels (Phase 7). CBC (WBC/platelets), TSH and urine
   dipstick flags from data/labpanels.json + an Hb-recheck tracker. Flags are
   screening prompts; the reporting lab's own ranges govern. */
function labxPack() { try { return (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT.labpanels) || null; } catch (e) { return null; } }
function labxBand(bands, ageD, ageM) {
  for (const b of bands || []) {
    if (b.maxD != null && ageD <= b.maxD) return b;
    if (b.maxD == null && b.maxM != null && ageM <= b.maxM) return b;
    if (b.maxD == null && b.maxM == null) return b;
  }
  return null;
}
function wbcFlag(ageD, ageM, v) {
  v = +v;
  if (!(v > 0)) return null;
  const P = labxPack(), b = P && labxBand(P.wbc && P.wbc.bands, ageD, ageM);
  if (!b) return null;
  if (v < b.lo) return { label: `Low WBC ${v} (range ${b.lo}–${b.hi}) — viral suppression / marrow? Repeat + diff.`, sev: "amber" };
  if (v > b.hi) return { label: `High WBC ${v} (range ${b.lo}–${b.hi}) — infection/inflammation? Correlate clinically + diff.`, sev: "amber" };
  return { label: `WBC ${v} in range (${b.lo}–${b.hi})`, sev: "green" };
}
function pltFlag(v) {
  v = +v;
  if (!(v > 0)) return null;
  const p = (labxPack() || {}).platelet || { lo: 150, hi: 450, critLo: 50, critHi: 1000 };
  if (v < p.critLo) return { label: `Critical low platelets ${v} — confirm urgently (repeat + smear), bleed screen, refer.`, sev: "red" };
  if (v < p.lo) return { label: `Low platelets ${v} (<${p.lo}) — dengue/viral/ITP? Repeat + clinical review.`, sev: "amber" };
  if (v > p.critHi) return { label: `Critical high platelets ${v} — confirm + haematology referral.`, sev: "red" };
  if (v > p.hi) return { label: `High platelets ${v} (>${p.hi}) — often reactive (infection/iron deficiency); recheck with cause.`, sev: "amber" };
  return { label: `Platelets ${v} in range`, sev: "green" };
}
function tshFlag(ageM, v, extra) {
  v = +v;
  if (!(v > 0)) return null;
  const mode = (typeof guideEffective === "function") ? guideEffective("tsh") : "mayo";
  if (mode === "aiims" || mode === "aap") return tshChFlag(mode, ageM, v, extra || {});
  return tshMayoFlag(ageM, v);
}
// Validated status-quo path — byte-identical labels to pre-G2.
function tshMayoFlag(ageM, v) {
  const P = labxPack(), b = P && labxBand(P.tsh && P.tsh.bands, 99999, ageM);
  if (!b) return null;
  if (v > b.hi) return { label: `High TSH ${v} (range ${b.lo}–${b.hi}) — check free T4, growth velocity, antibodies; refer endocrinology.`, sev: "amber", src: "mayo" };
  if (v < b.lo) return { label: `Low TSH ${v} (range ${b.lo}–${b.hi}) — check free T4/T3; hyperthyroid workup if symptomatic.`, sev: "amber", src: "mayo" };
  return { label: `TSH ${v} in range (${b.lo}–${b.hi})`, sev: "green", src: "mayo" };
}
// Preterm 95th-%ile upper (Table II): PMA>=36w -> pma36; <=7d -> wk1; else wk34.
function tshPretermHi(gaWk, ageD, rows) {
  gaWk = +gaWk; ageD = +ageD;
  if (!(gaWk >= 22 && gaWk <= 31) || !(ageD >= 0)) return null;
  const row = (rows || []).find((r) => gaWk >= r.gaLo && gaWk <= r.gaHi);
  if (!row) return null;
  if (gaWk * 7 + ageD >= 252) return { hi: row.pma36, tag: "36wk-PMA 95th" };
  if (ageD <= 7) return { hi: row.wk1, tag: "1-wk 95th" };
  return { hi: row.wk34, tag: "3-4-wk 95th" };
}
// CH-guideline interpreter (ISPAE-2018 / AAP-2023). Neonatal bands Table II <=28d
// (preterm 95th uppers to 60d if GA known); persistence to 90d; Mayo beyond.
function tshChFlag(mode, ageM, v, x) {
  const tag = mode === "aiims" ? "[AIIMS · ISPAE-2018]" : "[AAP · AAP-2023]";
  const P = labxPack(), N = (P && P.tshNeo) || {};
  const R = N[mode === "aiims" ? "ispae" : mode] || {};
  const ageD = (x && isFinite(+x.ageD) && +x.ageD >= 0) ? Math.floor(+x.ageD) : null;
  const priorV = (x && isFinite(+x.priorV) && +x.priorV > 0) ? +x.priorV : null;
  const persistWin = N.persistWindowD || 90;
  // --- band first: persistence prompts only fire when ABOVE the age/GA band ---
  // (a preterm TSH normal-for-GA must not attract term persistence noise).
  let band = null, bandNote = "";
  const preHi = (ageD != null && ageD <= (N.pretermWindowD || 60)) ? tshPretermHi(x.gaWk, ageD, N.pretermHi) : null;
  if (preHi) {
    const t = (ageD <= 28 && labxBand(N.termBands, ageD, 99)) || null;
    const fb = (P && labxBand(P.tsh && P.tsh.bands, 99999, ageM)) || { lo: 0.7 };
    band = { lo: t ? t.lo : fb.lo, hi: preHi.hi };
    bandNote = `preterm ${preHi.tag}`;
  } else if (ageD != null && ageD <= 28) {
    band = labxBand(N.termBands, ageD, 99);
    bandNote = band ? band.tag : "";
  }
  // --- persistence (value + age + prior value, gated on above-band) ---
  if (ageD != null && ageD <= persistWin && v > (R.persistTsh || 10) && (!band || v > band.hi)) {
    const over = ageD > (R.persistAgeD || 99);
    if (over && priorV != null && priorV > (R.persistTsh || 10))
      return { label: `TSH ${v} persistently >${R.persistTsh} ${R.persistLabel} — start L-T4 ${tag}.`, sev: "red", src: mode };
    if (over)
      return { label: `TSH ${v} >${R.persistTsh} ${R.persistLabel} — recheck TSH+FT4 in 1-2 wk; if persistent, treat ${tag}.`, sev: "amber", src: mode };
  }
  // --- neonatal action cutoffs (TSH-only; sample-type subtleties in label) ---
  if (ageD != null && ageD <= 28) {
    if (mode === "aiims") {
      if (v > R.treatNow) return { label: `TSH ${v} >${R.treatNow} — take confirmatory serum sample + START L-T4 now (ISPAE-2018) ${tag}.`, sev: "red", src: mode };
      if (v > R.confirmNow) return { label: `TSH ${v} ${R.confirmNow}-${R.treatNow} — immediate confirmatory venous test (ISPAE-2018) ${tag}.`, sev: "red", src: mode };
      if (v > R.repeatLo) return { label: `TSH ${v} ${R.repeatLo}-${R.confirmNow} — repeat TSH in ${R.repeatWindow} (ISPAE-2018) ${tag}.`, sev: "amber", src: mode };
    } else {
      if (v > R.treatNow) return { label: `TSH ${v} >${R.treatNow} — confirmatory serum sample + START L-T4 now (AAP-2023) ${tag}.`, sev: "red", src: mode };
      if (ageD >= 1 && ageD <= 2 && v > R.screen24_48) return { label: `TSH ${v} at 24-48h >${R.screen24_48} screen cutoff — recall for confirmation (AAP-2023) ${tag}.`, sev: "amber", src: mode };
      if (v > R.confirmTreat) return { label: `TSH ${v} >${R.confirmTreat} — if confirmatory venous: start treatment even if FT4 normal; if screen: confirm within 24h (AAP-2023) ${tag}.`, sev: "amber", src: mode };
    }
  }
  // --- band verdict (neonatal bands; else Mayo-hybrid tail below) ---
  if (band) {
    if (v > band.hi) {
      const ft4 = mode === "aiims"
        ? ` If venous sample with FT4<${R.ft4Treat} (or T4<${R.t4Treat}): treat regardless of TSH.`
        : ` If confirmatory venous with low FT4: treat; low FT4 + normal/low TSH: evaluate central hypothyroidism first.`;
      return { label: `High TSH ${v} (neonatal ${band.lo}–${band.hi}, ${bandNote}).${ft4} ${tag}`, sev: "amber", src: mode };
    }
    if (v < band.lo) {
      const low = mode === "aap"
        ? " — check FT4; if FT4 low with normal/low TSH: evaluate central hypothyroidism BEFORE L-T4."
        : " — check FT4/T3.";
      return { label: `Low TSH ${v} (neonatal ${band.lo}–${band.hi}, ${bandNote})${low} ${tag}.`, sev: "amber", src: mode };
    }
    return { label: `TSH ${v} in neonatal range (${band.lo}–${band.hi}, ${bandNote}) ${tag}.`, sev: "green", src: mode };
  }
  // --- beyond neonatal window (or ageD unknown): Mayo bands, mode-tagged hybrid ---
  const m = tshMayoFlag(ageM, v);
  if (!m) return null;
  const why = ageD == null && ageM < 1 ? " (DOB needed for day-level neonatal bands)" : " (band: Mayo >28d)";
  return { label: m.label + ` ${tag}${why}`, sev: m.sev, src: mode };
}
function urineInterp(u) {
  const out = [];
  try {
    const P = labxPack(), notes = ((P && P.urine) || {}).notes || {};
    const rank = (g) => ["Negative", "Trace", "1+", "2+", "3+"].indexOf(g);
    const keys = [["protein", "uProt"], ["leuco", "uLeu"], ["nitrite", "uNit"], ["blood", "uBld"], ["glucose", "uGlu"], ["ketones", "uKet"]];
    for (const [k, f] of keys) {
      const g = (u || {})[f];
      if (rank(g) >= 2 && notes[k]) out.push({ test: k, grade: g, sev: k === "glucose" || k === "ketones" ? "red" : "amber", note: notes[k] });
    }
    if (rank((u || {}).uLeu) >= 2 && rank((u || {}).uNit) >= 2) out.push({ test: "uti", grade: "", sev: "red", note: "Leucocytes + nitrite: UTI likely — urine culture + treat per sensitivity." });
  } catch (e) {}
  return out;
}
/* Recheck tracker: latest Hb band still abnormal and no follow-up report since
   the due date → due. Pure over (labs, hbClassFn, todayISO). */
function labsRecheck(labs, hbClassFn, today) {
  const out = [];
  try {
    const P = labxPack(), rc = ((P && P.recheck) || {});
    const modD = rc.moderate_days || 28, mildD = rc.mild_days || 56;
    const rows = [...(labs || [])].filter((r) => r && +r.hb > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!rows.length) return out;
    const last = rows[rows.length - 1];
    const band = (typeof hbClassFn === "function" ? hbClassFn(last.ageM, +last.hb) : null) || {};
    if (band.band === "normal" || band.band === "infant" || !band.band) return out;
    const dueBy = addDays(last.date, band.band === "mild" ? mildD : modD);
    if (String(today) >= dueBy) out.push({ test: "Hb", band: band.band, lastDate: last.date, dueBy, note: `Hb ${last.hb} (${band.label}) on ${last.date} — recheck was due by ${dueBy}.` });
  } catch (e) {}
  return out;
}
var LabX = { pack: labxPack, wbc: wbcFlag, plt: pltFlag, tsh: tshFlag, urine: urineInterp, recheck: labsRecheck };
try { if (typeof window !== "undefined" && window) window.LabX = LabX; } catch (e) {}

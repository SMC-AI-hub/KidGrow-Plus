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
function tshFlag(ageM, v) {
  v = +v;
  if (!(v > 0)) return null;
  const P = labxPack(), b = P && labxBand(P.tsh && P.tsh.bands, 99999, ageM);
  if (!b) return null;
  if (v > b.hi) return { label: `High TSH ${v} (range ${b.lo}–${b.hi}) — check free T4, growth velocity, antibodies; refer endocrinology.`, sev: "amber" };
  if (v < b.lo) return { label: `Low TSH ${v} (range ${b.lo}–${b.hi}) — check free T4/T3; hyperthyroid workup if symptomatic.`, sev: "amber" };
  return { label: `TSH ${v} in range (${b.lo}–${b.hi})`, sev: "green" };
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

/* =====================================================
   NeoKid Care — Paediatric formulary + dose calculator
   Doses per standard references (IAP / Nelson / formularies).
   ALWAYS verify — screening aid, not a substitute for
   clinical judgement or your hospital protocol.
   ===================================================== */
const FREQ_DIV = { OD: 1, BD: 2, TDS: 3, QID: 4, Q6H: 4, Q8H: 3, Q12H: 2, SOS: 1, Stat: 1, Weekly: 1 };
/* strength: {label, mg, per} syrup · {label, tab} tablet · {label, iu, per} drops
   mgkg = mg/kg PER DOSE · perDay: mgkg is mg/kg/DAY (divided by freq)
   band dose text starting with a number+mg/mL/IU is computed against strength */
const DRUGS = [
  { id: "para", name: "Paracetamol", cat: "Fever / pain", mgkg: 15, maxDose: 1000, freqs: ["Q6H", "Q8H", "SOS"], defFreq: "Q6H", defDays: 3, ageMinM: 3, ageMinMsg: "Fever under 3 mo needs same-day workup, not routine antipyresis — prescriber decision.", neoBelowM: 1, neoMsg: "Neonate — paracetamol traditionally 10 mg/kg single dose; confirm vs HL2026 print.", allergy: ["paracetamol", "crocin", "calpol", "dolo"], notes: "Max 4–5 doses/24 h · 60–75 mg/kg/day ceiling.", strengths: [{ label: "120 mg/5 mL", mg: 120, per: 5 }, { label: "250 mg/5 mL", mg: 250, per: 5 }, { label: "500 mg tab", tab: 500 }, { label: "650 mg tab", tab: 650 }] },
  { id: "ibu", name: "Ibuprofen", cat: "Fever / pain", mgkg: 10, maxDose: 400, freqs: ["Q6H", "Q8H"], defFreq: "Q8H", defDays: 3, ageMinM: 6, ageMinMsg: "Below HL minimum age (6 mo) — avoid ibuprofen; confirm indication.", allergy: ["ibuprofen", "brufen", "nsaid"], notes: "Avoid in dengue, dehydration, gastritis, asthma triggered by NSAIDs.", strengths: [{ label: "100 mg/5 mL", mg: 100, per: 5 }, { label: "200 mg tab", tab: 200 }, { label: "400 mg tab", tab: 400 }] },
  { id: "mef", name: "Mefenamic acid", cat: "Fever / pain", mgkg: 6.5, maxDose: 250, freqs: ["TDS"], defFreq: "TDS", defDays: 3, ageMinM: 6, allergy: ["mefenamic", "meftal", "nsaid"], notes: "Short course ≤3 days · give with food.", strengths: [{ label: "50 mg/5 mL", mg: 50, per: 5 }, { label: "100 mg tab", tab: 100 }] },
  { id: "amox", name: "Amoxicillin", cat: "Antibiotic", mgkg: 15, maxDose: 1000, freqs: ["TDS"], defFreq: "TDS", defDays: 5, allergy: ["penicillin", "amox", "ampicillin", "augmentin", "moxikind"], notes: "45 mg/kg/day · complete the course.", strengths: [{ label: "125 mg/5 mL", mg: 125, per: 5 }, { label: "250 mg/5 mL", mg: 250, per: 5 }, { label: "250 mg cap", tab: 250 }, { label: "500 mg cap", tab: 500 }] },
  { id: "aug", name: "Amoxycillin + Clavulanate", cat: "Antibiotic", mgkg: 15, maxDose: 1000, freqs: ["TDS", "BD"], defFreq: "TDS", defDays: 5, allergy: ["penicillin", "amox", "augmentin", "clavulanate", "moxikind"], notes: "Dose on amoxicillin component · give with food.", strengths: [{ label: "200 mg/5 mL (amox)", mg: 200, per: 5 }, { label: "400 mg/5 mL (amox)", mg: 400, per: 5 }, { label: "500 mg tab (amox)", tab: 500 }] },
  { id: "azi", name: "Azithromycin", cat: "Antibiotic", mgkg: 10, maxDose: 500, freqs: ["OD"], defFreq: "OD", defDays: 3, allergy: ["azithro", "macrolide", "erythro"], notes: "10 mg/kg OD × 3 days.", strengths: [{ label: "100 mg/5 mL", mg: 100, per: 5 }, { label: "200 mg/5 mL", mg: 200, per: 5 }, { label: "250 mg tab", tab: 250 }, { label: "500 mg tab", tab: 500 }] },
  { id: "cefi", name: "Cefixime", cat: "Antibiotic", mgkg: 8, perDay: true, maxDaily: 400, freqs: ["OD", "BD"], defFreq: "OD", defDays: 5, allergy: ["cef", "cephalosporin"], notes: "8 mg/kg/day OD (or ÷ BD) · verify UTI/typhoid protocols.", strengths: [{ label: "50 mg/5 mL", mg: 50, per: 5 }, { label: "100 mg/5 mL", mg: 100, per: 5 }, { label: "50 mg tab", tab: 50 }, { label: "100 mg tab", tab: 100 }, { label: "200 mg tab", tab: 200 }] },
  { id: "cefp", name: "Cefpodoxime", cat: "Antibiotic", mgkg: 10, perDay: true, maxDaily: 400, freqs: ["BD"], defFreq: "BD", defDays: 5, allergy: ["cef", "cephalosporin"], notes: "10 mg/kg/day ÷ BD · give with food.", strengths: [{ label: "50 mg/5 mL", mg: 50, per: 5 }, { label: "100 mg tab", tab: 100 }] },
  { id: "cefa", name: "Cephalexin", cat: "Antibiotic", mgkg: 12.5, maxDose: 500, freqs: ["QID"], defFreq: "QID", defDays: 5, allergy: ["cef", "cephalosporin", "cephalexin"], notes: "25–50 mg/kg/day ÷ QID.", strengths: [{ label: "125 mg/5 mL", mg: 125, per: 5 }, { label: "250 mg/5 mL", mg: 250, per: 5 }, { label: "250 mg cap", tab: 250 }, { label: "500 mg cap", tab: 500 }] },
  { id: "cotri", name: "Cotrimoxazole (TMP-SMX)", cat: "Antibiotic", mgkg: 4, maxDose: 160, freqs: ["BD"], defFreq: "BD", defDays: 5, allergy: ["sulfa", "cotrimoxazole", "septran", "bactrim"], notes: "Dose on trimethoprim · push fluids.", strengths: [{ label: "40 mg TMP/5 mL", mg: 40, per: 5 }, { label: "80 mg TMP tab", tab: 80 }] },
  { id: "metro", name: "Metronidazole", cat: "Antibiotic", mgkg: 7.5, maxDose: 500, freqs: ["TDS"], defFreq: "TDS", defDays: 5, allergy: ["metronidazole", "flagyl"], notes: "Amebiasis/giardiasis regimens differ — verify.", strengths: [{ label: "200 mg/5 mL", mg: 200, per: 5 }, { label: "200 mg tab", tab: 200 }, { label: "400 mg tab", tab: 400 }] },
  { id: "alb", name: "Albendazole", cat: "Antiparasitic", freqs: ["Stat"], defFreq: "Stat", defDays: 1, ageBandsY: [{ maxY: 2, dose: "200 mg single dose" }, { dose: "400 mg single dose" }], allergy: ["albendazole", "zentel", "bendex"], notes: "Deworming · repeat per programme.", strengths: [{ label: "200 mg/5 mL", mg: 200, per: 5 }, { label: "400 mg tab", tab: 400 }] },
  { id: "cet", name: "Cetirizine", cat: "Allergy / cold", mgkg: 0.25, maxDose: 10, freqs: ["OD"], defFreq: "OD", defDays: 5, allergy: ["cetirizine", "alerid", "okacet"], notes: "Give at night.", strengths: [{ label: "5 mg/5 mL", mg: 5, per: 5 }, { label: "10 mg tab", tab: 10 }] },
  { id: "levo", name: "Levocetirizine", cat: "Allergy / cold", mgkg: 0.125, maxDose: 5, freqs: ["OD"], defFreq: "OD", defDays: 5, allergy: ["levocetirizine"], notes: "Give at night.", strengths: [{ label: "2.5 mg/5 mL", mg: 2.5, per: 5 }, { label: "5 mg tab", tab: 5 }] },
  { id: "lora", name: "Loratadine", cat: "Allergy / cold", freqs: ["OD"], defFreq: "OD", defDays: 5, wtBands: [{ max: 30, dose: "5 mg" }, { dose: "10 mg" }], allergy: ["loratadine"], notes: "<30 kg 5 mg · ≥30 kg 10 mg.", strengths: [{ label: "5 mg/5 mL", mg: 5, per: 5 }, { label: "10 mg tab", tab: 10 }] },
  { id: "onda", name: "Ondansetron", cat: "Vomiting", mgkg: 0.15, maxDose: 8, freqs: ["SOS", "TDS"], defFreq: "SOS", defDays: 2, allergy: ["ondansetron", "emet"], notes: "Stop when vomiting settles · watch QT with macrolides.", strengths: [{ label: "2 mg/5 mL", mg: 2, per: 5 }, { label: "4 mg tab", tab: 4 }] },
  { id: "domp", name: "Domperidone", cat: "Vomiting", mgkg: 0.25, maxDose: 10, freqs: ["TDS"], defFreq: "TDS", defDays: 2, allergy: ["domperidone", "domstal"], notes: "Short course · avoid with QT-prolonging drugs / cardiac history.", strengths: [{ label: "1 mg/mL drops", mg: 1, per: 1 }, { label: "5 mg/5 mL", mg: 5, per: 5 }, { label: "10 mg tab", tab: 10 }] },
  { id: "zinc", name: "Zinc", cat: "Diarrhoea / nutrition", freqs: ["OD"], defFreq: "OD", defDays: 14, ageBandsM: [{ maxM: 6, dose: "10 mg" }, { dose: "20 mg" }], allergy: ["zinc"], notes: "With ORS for diarrhoea × 14 days.", strengths: [{ label: "20 mg/5 mL", mg: 20, per: 5 }, { label: "20 mg dispersible tab", tab: 20 }] },
  { id: "ors", name: "ORS (WHO low-osmolarity)", cat: "Diarrhoea / nutrition", freqs: ["SOS"], defFreq: "SOS", defDays: 3, info: "After each loose stool: <2 y 50–100 mL · ≥2 y 100–200 mL, plus after vomiting. Continue breastfeeding & feeds.", allergy: [], strengths: [] },
  { id: "vitd", name: "Vitamin D3 (maintenance)", cat: "Diarrhoea / nutrition", freqs: ["OD"], defFreq: "OD", defDays: 30, ageBandsM: [{ maxM: 12, dose: "400 IU" }, { dose: "600 IU" }], allergy: [], notes: "Maintenance only — deficiency treatment differs.", strengths: [{ label: "400 IU/mL drops", iu: 400, per: 1 }] },
  { id: "iron", name: "Iron (elemental, treatment)", cat: "Diarrhoea / nutrition", mgkg: 3, perDay: true, maxDaily: 200, freqs: ["OD", "BD"], defFreq: "BD", defDays: 30, allergy: ["iron"], notes: "Elemental iron · with Vit C, away from milk/antacid · stools darken.", strengths: [{ label: "25 mg elemental/5 mL", mg: 25, per: 5 }, { label: "50 mg elemental/5 mL", mg: 50, per: 5 }] },
  { id: "salb", name: "Salbutamol syrup", cat: "Wheeze / asthma", mgkg: 0.1, maxDose: 4, freqs: ["TDS"], defFreq: "TDS", defDays: 5, allergy: ["salbutamol", "asthalin"], notes: "Tremor common · prefer MDI + spacer.", strengths: [{ label: "2 mg/5 mL", mg: 2, per: 5 }] },
  { id: "mont", name: "Montelukast", cat: "Wheeze / asthma", freqs: ["OD"], defFreq: "OD", defDays: 30, ageBandsY: [{ maxY: 6, dose: "4 mg" }, { maxY: 15, dose: "5 mg" }, { dose: "10 mg" }], allergy: ["montelukast"], notes: "Evening dose · watch mood/behaviour changes.", strengths: [{ label: "4 mg chewable", tab: 4 }, { label: "5 mg chewable", tab: 5 }, { label: "10 mg tab", tab: 10 }] },
  { id: "ambro", name: "Ambroxol", cat: "Cough", freqs: ["BD", "TDS"], defFreq: "TDS", defDays: 5, ageBandsY: [{ maxY: 2, dose: "2.5 mL" }, { maxY: 6, dose: "2.5 mL" }, { maxY: 12, dose: "5 mL" }, { dose: "10 mL" }], allergy: ["ambroxol"], notes: "<2 y BD · 2–12 y TDS (15 mg/5 mL) · with fluids.", strengths: [{ label: "15 mg/5 mL", mg: 15, per: 5 }] },
  { id: "cala", name: "Calamine lotion", cat: "Skin", freqs: ["SOS"], defFreq: "SOS", defDays: 7, info: "Apply thin layer BD–TDS on itchy lesions. Shake well before use.", allergy: [], strengths: [] },
  { id: "perm", name: "Permethrin 5% cream", cat: "Skin", freqs: ["Stat"], defFreq: "Stat", defDays: 1, info: "Apply neck-down at night, wash after 8–12 h. Repeat day 7–9. Treat close contacts + hot-wash bedding.", allergy: ["permethrin"], strengths: [] },
  { id: "fluco", name: "Fluconazole", cat: "Antifungal", mgkg: 3, maxDose: 200, freqs: ["OD"], defFreq: "OD", defDays: 7, allergy: ["fluconazole", "azole"], notes: "6 mg/kg loading day 1 for systemic use.", strengths: [{ label: "50 mg/5 mL", mg: 50, per: 5 }, { label: "50 mg tab", tab: 50 }, { label: "150 mg tab", tab: 150 }] },
  { id: "omep", name: "Omeprazole", cat: "Gastric", freqs: ["OD"], defFreq: "OD", defDays: 14, wtBands: [{ max: 20, dose: "10 mg" }, { dose: "20 mg" }], allergy: ["omeprazole", "ppi"], notes: "30 min before breakfast.", strengths: [{ label: "10 mg cap", tab: 10 }, { label: "20 mg cap", tab: 20 }] },
  { id: "hc", name: "Hydrocortisone 1% cream", cat: "Skin", freqs: ["SOS"], defFreq: "SOS", defDays: 7, info: "Thin layer BD on affected area, short course. Avoid face/eyes unless advised.", allergy: [], strengths: [] },
  { id: "xylo", name: "Xylometazoline 0.05% drops", cat: "Allergy / cold", freqs: ["SOS"], defFreq: "SOS", defDays: 4, info: "1–2 drops per nostril BD–TDS, max 3–5 days. Not below 3 months.", allergy: [], strengths: [] },
];
function drugById(id) { return DRUGS.find((d) => d.id === id) || null; }

/* ---------------- calculator (pure) ---------------- */
function calcRound(x, dp) { return String(+Number(x).toFixed(dp === undefined ? 2 : dp)); }
function tabFrac(n) {
  // nearest quarter with pretty fractions
  const q = Math.round(n * 4) / 4, whole = Math.floor(q + 1e-9), rem = +(q - whole).toFixed(2);
  const f = rem === 0.25 ? "¼" : rem === 0.5 ? "½" : rem === 0.75 ? "¾" : "";
  if (whole === 0 && !f) return "—";
  return (whole ? whole : "") + f + " tab";
}
function pickBand(bands, key, val) {
  for (const b of bands) { if (val === undefined || val === null || val === "") return bands[bands.length - 1]; if (val < (b[key] === undefined ? Infinity : b[key])) return b; }
  return bands[bands.length - 1];
}
/* Parse "200 mg ..." / "2.5 mL" / "400 IU" at start of band text */
function parseBandDose(txt) {
  const m = String(txt || "").match(/^\s*([\d.]+)\s*(mg|mL|ml|IU)\b/i);
  if (!m) return null;
  const u = m[2].toLowerCase() === "ml" ? "mL" : m[2].toUpperCase() === "IU" ? "IU" : "mg";
  return { qty: parseFloat(m[1]), unit: u };
}
/* Main: returns {ok, why?, mgDose, mlDose, tabText, qtyText, take, capped, warns[]} */
function calcDose(drugId, wt, ageM, strengthIdx, freq, days) {
  const d = drugById(drugId);
  if (!d) return { ok: false, why: "Unknown drug." };
  const warns = [];
  if (d.info) return { ok: true, infoOnly: true, take: d.info, qtyText: "As directed", warns, basis: "Standard directions" };
  wt = Number(wt); ageM = (ageM === "" || ageM === null || ageM === undefined) ? null : Number(ageM);
  const div = FREQ_DIV[freq] || 1;
  let mgDose = null, basis = "";
  if (d.mgkg) {
    if (!(wt > 0)) return { ok: false, why: "Enter weight." };
    try { if (typeof V !== "undefined") { const _vw = V.check("wt", wt); if (!_vw.ok) return { ok: false, why: _vw.why }; } } catch (eV) {}
    if (d.perDay) { mgDose = (d.mgkg * wt) / div; basis = `${d.mgkg} mg/kg/day ÷ ${div}`; }
    else { mgDose = d.mgkg * wt; basis = `${d.mgkg} mg/kg/dose`; }
  } else if (d.wtBands) {
    if (!(wt > 0)) return { ok: false, why: "Enter weight." };
    const b = pickBand(d.wtBands, "max", wt);
    const p = parseBandDose(b.dose);
    if (!p || p.unit !== "mg") return { ok: false, why: "Band dose not computable." };
    mgDose = p.qty; basis = `Weight band (${b.dose})`;
  } else if (d.ageBandsM || d.ageBandsY) {
    const bands = d.ageBandsM || d.ageBandsY, key = d.ageBandsM ? "maxM" : "maxY";
    const aval = ageM === null ? null : (d.ageBandsM ? ageM : ageM / 12);
    if (aval === null) { warns.push("Age unknown — showing adult/upper band; confirm."); }
    const b = pickBand(bands, key, aval === null ? Infinity : aval);
    const p = parseBandDose(b.dose);
    if (!p) return { ok: false, why: "Band dose not computable." };
    if (p.unit === "mL") {
      const ml = p.qty;
      return { ok: true, mgDose: null, mlDose: ml, take: `${calcRound(ml, 1)} mL`, qtyText: `≈ ${calcRound(ml * div * (days || 1), 0)} mL total`, warns, basis: `Age band (${b.dose})`, capped: false };
    }
    if (p.unit === "IU") {
      const st = (d.strengths || [])[strengthIdx || 0] || {};
      const ml = st.iu ? (p.qty / st.iu) * (st.per || 1) : null;
      return { ok: true, mgDose: null, mlDose: ml, take: ml !== null ? `${calcRound(ml, 1)} mL (${p.qty} IU)` : `${p.qty} IU`, qtyText: ml !== null ? `≈ ${calcRound(ml * div * (days || 1), 0)} mL total` : "As directed", warns, basis: `Age band (${b.dose})`, capped: false };
    }
    mgDose = p.qty; basis = `Age band (${b.dose})`;
  } else return { ok: false, why: "No dosing rule." };
  // caps
  let capped = false;
  if (d.maxDose && mgDose > d.maxDose) { mgDose = d.maxDose; capped = true; warns.push(`Capped at adult max single dose (${d.maxDose} mg).`); }
  if (d.perDay && d.maxDaily && mgDose * div > d.maxDaily) { mgDose = d.maxDaily / div; capped = true; warns.push(`Capped at adult max daily dose (${d.maxDaily} mg/day).`); }
  if (d.ageMinM && ageM !== null && ageM < d.ageMinM) warns.push(d.ageMinMsg || `Below usual minimum age (${d.ageMinM} mo) — confirm indication.`);
  if (d.neoBelowM && ageM !== null && ageM < d.neoBelowM) warns.push(d.neoMsg || "Neonatal use — confirm dose vs reference.");
  // strength math
  const st = (d.strengths || [])[strengthIdx || 0] || (d.strengths || [])[0];
  let mlDose = null, tabText = null, qtyText = "As directed", take = "";
  if (st && st.mg) {
    mlDose = (mgDose / st.mg) * (st.per || 5);
    take = `${calcRound(mlDose, 1)} mL (${calcRound(mgDose, mgDose < 10 ? 2 : 0)} mg)`;
    qtyText = `≈ ${calcRound(mlDose * div * (days || 1), 0)} mL total`;
    if (mlDose > 20) warns.push("Large volume — consider tablets/capsules.");
  } else if (st && st.tab) {
    const n = mgDose / st.tab;
    tabText = tabFrac(n);
    const back = Math.round(n * 4) / 4 * st.tab, err = mgDose ? Math.abs(back - mgDose) / mgDose : 0;
    take = `${tabText} (${calcRound(mgDose, mgDose < 10 ? 2 : 0)} mg)`;
    qtyText = `≈ ${Math.ceil(Math.round(n * 4) / 4 * div * (days || 1))} tabs total`;
    if (n < 0.2) warns.push("Tiny fraction — prefer syrup/drops for accuracy.");
    else if (err > 0.12) warns.push("Awkward split — prefer syrup or adjust strength.");
  } else {
    take = `${calcRound(mgDose, mgDose < 10 ? 2 : 0)} mg`;
  }
  return { ok: true, mgDose, mlDose, tabText, qtyText, take, warns, basis, capped };
}
/* Allergy cross-check (pure): keys matched against free-text allergy */
function allergyCheck(drugId, allergyText) {
  const d = drugById(drugId);
  if (!d || !allergyText) return { hit: false, matched: [] };
  const t = String(allergyText).toLowerCase();
  const matched = (d.allergy || []).filter((k) => k && t.includes(k.toLowerCase()));
  return { hit: matched.length > 0, matched };
}

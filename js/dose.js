/* NeoKid Care — decision-support engine (Phase 3).
   Prescribe-time checks over the DRUGS formulary + safety envelopes in
   data/formulary.json. Exactly THREE hard-stops (all near-zero false-positive):
   implausible weight (the 10x-dose vector — doses here are always calculated),
   anaphylaxis-history allergy match, NSAID in dengue. Everything else is
   warn/info. Also: labs critical flags, growth red-flags, EMG allergy cross-check.
   Pure — every function is DOM-free and unit-tested. */
const DOSE_FREQ_FALLBACK = { OD: 1, BD: 2, TDS: 3, QID: 4, Q6H: 4, Q8H: 3, SOS: 1, Stat: 1 };
const DOSE_EMG_DRUGS = [
  { rx: "Paracetamol — fever / pain", keys: ["paracetamol", "crocin", "calpol", "dolo"] },
  { rx: "Ibuprofen — fever / pain", keys: ["ibuprofen", "brufen", "nsaid", "mefenamic", "meftal"] },
  { rx: "Amoxicillin — pneumonia/otitis", keys: ["penicillin", "amox", "ampicillin", "augmentin", "moxikind"] },
  { rx: "Cetirizine — allergy", keys: ["cetirizine", "alerid", "okacet"] },
  { rx: "Ondansetron — vomiting", keys: ["ondansetron", "emet"] },
  { rx: "Salbutamol — wheeze", keys: ["salbutamol", "asthalin"] },
];

function doseEsc(s) {
  if (typeof esc === "function") { try { return esc(s); } catch (e) {} }
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function doseNum(x) { if (x == null || x === "") return null; const n = parseFloat(x); return Number.isFinite(n) ? n : null; }
function dosePack(name) { try { return (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT[name]) || null; } catch (e) { return null; } }
function doseDrug(id) { try { return (typeof drugById === "function" ? drugById(id) : null); } catch (e) { return null; } }
function doseFreqDiv(freq) {
  try { if (typeof FREQ_DIV !== "undefined" && FREQ_DIV && FREQ_DIV[freq]) return FREQ_DIV[freq]; } catch (e) {}
  return DOSE_FREQ_FALLBACK[freq] || 1;
}
function doseWtBand(ageM) {
  try {
    const F = dosePack("formulary");
    if (!F || !(ageM >= 0)) return null;
    return (F.wtBands || []).find((b) => ageM <= b[0]) || null;
  } catch (e) { return null; }
}
function doseWtCheck(wtKg, ageM) {
  const out = [];
  const wt = doseNum(wtKg);
  if (wt === null || wt <= 0) return out; // calcDose reports missing weight
  if (wt > 200 || wt < 0.3) { out.push({ tier: "hard", code: "WT-ABSURD", text: `Weight ${wt} kg is impossible — fix before dosing.` }); return out; }
  const F = dosePack("formulary");
  const band = doseWtBand(ageM);
  if (!band || !F) return out;
  const over = ((F.wtHard || {}).overMult || 3), under = ((F.wtHard || {}).underDiv || 2);
  if (wt > band[2] * over || wt < band[1] / under) {
    out.push({ tier: "hard", code: "WT-IMPLAUSIBLE", text: `Weight ${wt} kg implausible at this age (usual ${band[1]}–${band[2]} kg) — dose would be ~10x off. Recheck weight.` });
  } else if (wt > band[2] || wt < band[1]) {
    out.push({ tier: "warn", code: "WT-OFF", text: `Weight ${wt} kg outside usual ${band[1]}–${band[2]} kg — confirm before dosing.` });
  }
  return out;
}
function doseMgKg(drugId, wtKg, freq) {
  const d = doseDrug(drugId);
  const wt = doseNum(wtKg);
  if (!d || !d.mgkg || !(wt > 0)) return null;
  const div = doseFreqDiv(freq);
  const perDose = d.perDay ? d.mgkg / div : d.mgkg;
  const perDay = d.perDay ? d.mgkg : d.mgkg * div;
  return { perDose, perDay, absMg: perDose * wt };
}
function doseFormularySelfCheck() {
  // Every calculated dose must sit inside its safety envelope — catches
  // transcription errors between drugs.js and formulary.json. Run by tests.
  const out = [];
  try {
    const F = dosePack("formulary");
    const list = (typeof DRUGS !== "undefined" && DRUGS) || [];
    for (const d of list) {
      if (!d.mgkg) continue;
      const f = F && F.drugs && F.drugs[d.id];
      if (!f) { out.push({ id: d.id, ok: false, why: "no formulary envelope" }); continue; }
      const per = d.perDay ? "day" : "dose";
      if (!f.ref || f.ref.per !== per) { out.push({ id: d.id, ok: false, why: "per mismatch" }); continue; }
      if (d.mgkg < f.ref.lo || d.mgkg > f.ref.hi) { out.push({ id: d.id, ok: false, why: `mgkg ${d.mgkg} outside [${f.ref.lo}, ${f.ref.hi}]` }); continue; }
      out.push({ id: d.id, ok: true });
    }
  } catch (e) { out.push({ id: "?", ok: false, why: String(e && e.message || e) }); }
  return out;
}
function doseCurrentCodes(child) {
  const out = { icd: [], problems: [] };
  try {
    const vs = ((child && child.visits) || []).filter((v) => v && v.date).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (vs[0] && Array.isArray(vs[0].icd)) out.icd = vs[0].icd.filter((x) => typeof x === "string");
    out.problems = ((child && child.problems) || []).filter((p) => p && (!p.status || p.status === "active"));
  } catch (e) {}
  return out;
}
function doseIcdHit(code, listed) {
  return (listed || []).some((L) => code === L || String(code || "").startsWith(L + "."));
}
function doseContraCheck(drugId, child, ageM) {
  const out = [];
  try {
    const F = dosePack("formulary");
    if (!F) return out;
    const cur = doseCurrentCodes(child);
    for (const r of (F.contraRules || [])) {
      if (!(r.drugs || []).includes(drugId)) continue;
      const m = r.match || {};
      let hit = false;
      if (m.icd && cur.icd.some((c) => doseIcdHit(c, m.icd))) hit = true;
      if (!hit && m.problems) {
        const pls = cur.problems.map((p) => `${p.label || ""} ${p.code || ""}`.toLowerCase());
        if (m.problems.some((k) => pls.some((l) => l.includes(String(k).toLowerCase())))) hit = true;
      }
      if (!hit && m.ageBelowM != null && ageM != null && ageM < m.ageBelowM) hit = true;
      if (hit) out.push({ tier: r.tier === "hard" ? "hard" : "warn", code: "CONTRA-" + r.id, text: r.text });
    }
  } catch (e) {}
  return out;
}
function doseDraftIds(draftItems) {
  const ids = [];
  try {
    const list = (typeof DRUGS !== "undefined" && DRUGS) || [];
    for (const it of (draftItems || [])) {
      const nm = String((it && it.drug) || "").toLowerCase();
      if (!nm) continue;
      const d = list.find((x) => x.name.toLowerCase() === nm) || list.find((x) => nm.includes(x.name.toLowerCase()));
      if (d && !ids.includes(d.id)) ids.push(d.id);
    }
  } catch (e) {}
  return ids;
}
function doseInteractionCheck(drugId, draftItems) {
  const out = [];
  try {
    const F = dosePack("formulary");
    if (!F) return out;
    const ids = doseDraftIds(draftItems);
    for (const r of (F.interactions || [])) {
      if ((r.drugs || []).includes(drugId) && (r.drugs || []).some((x) => x !== drugId && ids.includes(x))) {
        out.push({ tier: "warn", code: "IX-" + r.id, text: r.text });
      }
    }
  } catch (e) {}
  return out;
}
function doseAllergyTier(drugId, child) {
  const none = { tier: null, matched: [], detail: "" };
  try {
    const d = doseDrug(drugId);
    if (!d) return none;
    const keys = (d.allergy || []).map((k) => String(k).toLowerCase());
    const names = [d.name.toLowerCase(), ...keys];
    const hitKey = (text) => names.some((n) => n && String(text || "").toLowerCase().includes(n));
    let worst = 0; const matched = [];
    for (const a of ((child && child.allergies) || [])) {
      if (!a || !a.agent) continue;
      if (hitKey(a.agent)) {
        matched.push(a.agent);
        const sev = String(a.severity || "");
        worst = Math.max(worst, sev === "Anaphylaxis" ? 3 : sev === "Severe" ? 2 : 1);
      }
    }
    let legacy = [];
    try {
      const txt = (typeof Hx !== "undefined" && Hx.allergyText) ? Hx.allergyText(child) : (child && child.allergy) || "";
      if (typeof allergyCheck === "function") legacy = (allergyCheck(drugId, txt).matched) || [];
    } catch (e) {}
    if (!matched.length && !legacy.length) return none;
    if (worst >= 3) return { tier: "hard", matched, detail: `${d.name} matches ANAPHYLAXIS-history allergy (${matched.join(", ")}) — do not prescribe; choose an alternative.` };
    const all = matched.concat(legacy.filter((x) => !matched.includes(x)));
    return { tier: "warn", matched: all, detail: `${d.name} matches recorded allergy (${all.join(", ")}). Prescribe only if benefit outweighs risk.` };
  } catch (e) { return none; }
}
function doseDuplicateCheck(drugId, draftItems, child) {
  const out = [];
  try {
    const d = doseDrug(drugId);
    if (!d) return out;
    const nm = d.name.toLowerCase();
    if ((draftItems || []).some((it) => String((it && it.drug) || "").toLowerCase() === nm)) {
      out.push({ tier: "warn", code: "DUP-DRAFT", text: `${d.name} is already in this prescription — intentional duplicate?` });
    }
    let cutoff = null;
    try { if (typeof addDays === "function" && typeof todayISO === "function") cutoff = addDays(todayISO(), -7); } catch (e) {}
    if (cutoff) {
      const recent = ((child && child.rx) || []).filter((r) => (r.date || "") >= cutoff && (r.items || []).some((it) => String(it.drug || "").toLowerCase() === nm)).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
      if (recent) out.push({ tier: "warn", code: "DUP-RECENT", text: `${d.name} was also prescribed on ${recent.date} — intentional repeat?` });
    }
  } catch (e) {}
  return out;
}
function doseAgeCheck(drugId, ageM) {
  const out = [];
  try {
    const d = doseDrug(drugId);
    if (d && d.ageMinM && ageM != null && ageM < d.ageMinM) {
      out.push({ tier: "warn", code: "AGE-MIN", text: `Below usual minimum age (${d.ageMinM} mo) — confirm indication.` });
    }
  } catch (e) {}
  return out;
}
function doseCheckRx(o) {
  o = o || {};
  const flags = [];
  const push = (f) => { if (f && f.length) flags.push(...f); };
  push(doseWtCheck(o.wtKg, o.ageM));
  push(doseAgeCheck(o.drugId, o.ageM));
  const al = doseAllergyTier(o.drugId, o.child);
  if (al.tier) flags.push({ tier: al.tier, code: "ALLERGY", text: al.detail });
  push(doseContraCheck(o.drugId, o.child, o.ageM));
  push(doseInteractionCheck(o.drugId, o.draftItems));
  push(doseDuplicateCheck(o.drugId, o.draftItems, o.child));
  let mgKgDose = null, mgKgDay = null, absMg = null;
  try {
    const F = dosePack("formulary");
    const f = F && F.drugs && F.drugs[o.drugId];
    const calc = doseMgKg(o.drugId, o.wtKg, o.freq);
    if (calc) { mgKgDose = calc.perDose; mgKgDay = calc.perDay; absMg = calc.absMg; }
    if (f && calc) {
      if (f.maxSingle && calc.absMg > f.maxSingle * 5) {
        flags.push({ tier: "hard", code: "DOSE-ABSURD", text: `Computed ${Math.round(calc.absMg)} mg is >5x the adult max single dose — check weight.` });
      }
      if (f.maxDailyMgKg && calc.perDay > f.maxDailyMgKg) {
        flags.push({ tier: "warn", code: "DOSE-DAYMAX", text: `${Math.round(calc.perDay * 10) / 10} mg/kg/day exceeds the usual ceiling (${f.maxDailyMgKg}) — confirm.` });
      }
    }
  } catch (e) {}
  return { flags, hard: flags.some((f) => f.tier === "hard"), mgKgDose, mgKgDay, absMg };
}
function doseChecksHTML(ch) {
  const flags = (ch && ch.flags) || [];
  if (!flags.length) return "";
  return flags.map((f) => {
    const cls = f.tier === "hard" ? "a-red" : f.tier === "warn" ? "a-amber" : "a-gray";
    const icon = f.tier === "hard" ? "⛔" : f.tier === "warn" ? "⚠️" : "ℹ️";
    return `<div class="alert ${cls}" style="margin:8px 0 0">${icon} <div>${doseEsc(f.text)}</div></div>`;
  }).join("");
}
function doseLabFlags(rep) {
  const out = [];
  try {
    const P = dosePack("labs");
    const F = (P && P.fields) || {};
    rep = rep || {};
    const hb = doseNum(rep.hb);
    if (hb !== null && F.hb && hb < F.hb.criticalLow) out.push({ tier: "warn", code: "LAB-HB-CRIT", text: `Critical low Hb ${hb} g/dL — urgent review.` });
    const crp = doseNum(rep.crp);
    if (crp !== null && F.crp) {
      if (crp >= F.crp.high) out.push({ tier: "warn", code: "LAB-CRP-HIGH", text: `CRP ${crp} mg/L markedly raised — urgent review.` });
      else if (crp >= F.crp.raised) out.push({ tier: "info", code: "LAB-CRP-RAISED", text: `CRP ${crp} mg/L raised — interpret with clinic.` });
    }
    const fer = doseNum(rep.ferritin);
    if (fer !== null && F.ferritin && fer < F.ferritin.low) out.push({ tier: "info", code: "LAB-FER-LOW", text: `Ferritin ${fer} ng/mL low — iron deficiency?` });
    const b12 = doseNum(rep.b12);
    if (b12 !== null && F.b12 && b12 < F.b12.low) out.push({ tier: "warn", code: "LAB-B12-LOW", text: `B12 ${b12} pg/mL low — replace + find cause.` });
    const vd = doseNum(rep.vitD);
    if (vd !== null && F.vitD) {
      if (vd < F.vitD.deficient) out.push({ tier: "warn", code: "LAB-VITD-DEF", text: `Vitamin D ${vd} ng/mL deficient — treatment dose differs from maintenance.` });
      else if (vd < F.vitD.insufficient) out.push({ tier: "info", code: "LAB-VITD-INS", text: `Vitamin D ${vd} ng/mL insufficient.` });
    }
    const mcv = doseNum(rep.mcv);
    if (mcv !== null && F.mcv && (mcv < F.mcv.low || mcv > F.mcv.high)) {
      out.push({ tier: "info", code: "LAB-MCV", text: mcv < F.mcv.low ? `MCV ${mcv} fL microcytic — iron deficiency / thalassaemia trait?` : `MCV ${mcv} fL macrocytic — B12/folate?` });
    }
  } catch (e) {}
  return out;
}
function doseCrpLabel(v) {
  const n = doseNum(v);
  if (n === null) return "";
  const F = (dosePack("labs") || {}).fields || {};
  if (F.crp && n >= F.crp.high) return "Markedly raised — urgent review";
  if (F.crp && n >= F.crp.raised) return "Raised — interpret with clinic";
  return "Normal";
}
function doseGrowthFlags(child, m) {
  const out = [];
  try {
    m = m || {};
    const prev = ((child && child.measures) || []).filter((x) => x && x.id !== m.id && (x.date || "") <= (m.date || "") && x.wt > 0).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (!prev || !(m.wt > 0)) return out;
    const loss = (prev.wt - m.wt) / prev.wt;
    if (loss > 0.02) {
      out.push({ tier: "warn", code: "GROW-LOSS", text: loss > 0.05
        ? `Marked weight loss ${Math.round(loss * 100)}% since ${prev.date} (${prev.wt} → ${m.wt} kg) — evaluate urgently.`
        : `Weight loss ${Math.round(loss * 100)}% since ${prev.date} (${prev.wt} → ${m.wt} kg) — recheck + review intake/illness.` });
    }
    if (m.ht > 0 && prev.ht > 0 && m.ht < prev.ht - 1) {
      out.push({ tier: "warn", code: "GROW-HT", text: `Height less than last time (${prev.ht} → ${m.ht} cm) — recheck measurement.` });
    }
    try {
      if (typeof whoAgeZ === "function" && typeof growthAge === "function" && child.dob) {
        const gaP = growthAge(child, prev.date), gaM = growthAge(child, m.date);
        if (!gaP.corrNeg && !gaM.corrNeg) {
          const zP = whoAgeZ(child.sex, "wfa", gaP.useCorr ? gaP.corrD : gaP.chronoD, prev.wt);
          const zM = whoAgeZ(child.sex, "wfa", gaM.useCorr ? gaM.corrD : gaM.chronoD, m.wt);
          if (zP && zM && isFinite(zP.z) && isFinite(zM.z) && zP.z - zM.z > 1) {
            out.push({ tier: "warn", code: "GROW-CROSS", text: `Crossing centiles downward (weight-for-age z ${Math.round(zP.z * 10) / 10} → ${Math.round(zM.z * 10) / 10}) — review growth + intake.` });
          }
        }
      }
    } catch (e2) {}
  } catch (e) {}
  return out;
}
function doseEmgAllergyRows(child) {
  const out = [];
  try {
    let txt = "";
    try { txt = (typeof Hx !== "undefined" && Hx.allergyText) ? Hx.allergyText(child) : (child && child.allergy) || ""; } catch (e) {}
    txt = String(txt || "").toLowerCase();
    if (!txt) return out;
    for (const r of DOSE_EMG_DRUGS) {
      if (r.keys.some((k) => txt.includes(k))) out.push(r.rx);
    }
  } catch (e) {}
  return out;
}
function doseEmgAllergyHTML(child) {
  const rows = doseEmgAllergyRows(child);
  if (!rows.length) return "";
  return `<div class="alert a-red" style="margin-top:10px">⚠️ <div><b>Emergency allergy cross-check:</b> recorded allergy matches ${rows.map(doseEsc).join("; ")} — have alternatives ready.</div></div>`;
}
var Dose = {
  wtCheck: doseWtCheck, mgKg: doseMgKg, formularySelfCheck: doseFormularySelfCheck,
  currentCodes: doseCurrentCodes, contraCheck: doseContraCheck, interactionCheck: doseInteractionCheck,
  allergyTier: doseAllergyTier, duplicateCheck: doseDuplicateCheck, ageCheck: doseAgeCheck,
  checkRx: doseCheckRx, checksHTML: doseChecksHTML,
  labFlags: doseLabFlags, crpLabel: doseCrpLabel,
  growthFlags: doseGrowthFlags, emgAllergyRows: doseEmgAllergyRows, emgAllergyHTML: doseEmgAllergyHTML,
};
try { if (typeof window !== "undefined" && window) window.Dose = Dose; } catch (e) {}

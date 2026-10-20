/* NeoKid Care — history module (Phase 1).
   Perinatal / maternal / family cards (Forms schemas), structured allergies,
   problem list, SGA badge (Scores engine), changes-since-last-visit, visit
   ICD wiring, Rx safety strip. Pure helpers stay DOM-free for tests; all
   DOM touchpoints are guarded so the module boots anywhere. */
const HX_SCH = {
  perinatal: { fields: [
    { k: "ga", t: "text", label: "Gestation", ph: "e.g. 38+2", hint: "weeks+days" },
    { k: "delMode", t: "select", label: "Delivery mode", opts: ["Vaginal", "Assisted (forceps/vacuum)", "Elective LSCS", "Emergency LSCS"] },
    { k: "delPlace", t: "select", label: "Delivery place", opts: ["Hospital", "PHC / CHC", "Home", "Other"] },
    { k: "birthWtKg", t: "number", label: "Birth weight", unit: "kg", min: 0.3, max: 7, step: 0.01 },
    { k: "birthLenCm", t: "number", label: "Birth length", unit: "cm", min: 25, max: 60, step: 0.1 },
    { k: "birthHcCm", t: "number", label: "Birth head circ.", unit: "cm", min: 20, max: 45, step: 0.1 },
    { k: "cried", t: "select", label: "Cry at birth", opts: ["Yes — at once", "Delayed cry", "Needed resuscitation"] },
    { k: "nicuDays", t: "number", label: "NICU stay", unit: "days", min: 0, max: 180 },
    { k: "anomalies", t: "text", label: "Anomalies noted", ph: "e.g. None / cleft lip", full: true },
    { k: "pNotes", t: "textarea", label: "Birth notes", ph: "Anything else about the delivery" },
  ] },
  maternal: { fields: [
    { k: "ageAtDel", t: "number", label: "Age at delivery", unit: "yrs", min: 12, max: 60 },
    { k: "gravida", t: "number", label: "Gravida", min: 1, max: 20 },
    { k: "para", t: "number", label: "Para", min: 0, max: 20 },
    { k: "abortions", t: "number", label: "Abortions", min: 0, max: 20 },
    { k: "bloodGroup", t: "select", label: "Mother blood group", opts: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] },
    { k: "conditions", t: "multi", label: "Conditions in pregnancy", opts: ["Anaemia", "Hypertension / pre-eclampsia", "Diabetes / GDM", "Thyroid disorder", "Heart disease", "Epilepsy", "Asthma", "TB", "HIV", "Hepatitis B", "Mental-health condition", "Other"] },
    { k: "meds", t: "text", label: "Regular medicines", ph: "e.g. Iron, calcium, thyroxine", full: true },
    { k: "substance", t: "multi", label: "Tobacco / alcohol", opts: ["None", "Tobacco", "Alcohol", "Other"] },
    { k: "mNotes", t: "textarea", label: "Maternal notes" },
  ] },
  family: { fields: [
    { k: "consang", t: "select", label: "Consanguinity", opts: ["No", "Yes — 2nd degree", "Yes — 3rd degree (first cousins)", "Unknown"] },
    { k: "sibs", t: "text", label: "Siblings", ph: "e.g. 1 brother 6y healthy; 1 sister died day 3", full: true },
    { k: "famHx", t: "multi", label: "Family history", opts: ["Diabetes", "Hypertension", "Asthma / allergy", "Epilepsy", "Heart disease <50y", "TB", "Thalassaemia / sickle-cell", "Mental illness", "Cancer", "Birth defects", "Other"] },
    { k: "housing", t: "select", label: "Housing", opts: ["Pucca", "Semi-pucca", "Kutcha"] },
    { k: "water", t: "select", label: "Drinking water", opts: ["Piped / RO", "Borewell", "Tanker", "Other"] },
    { k: "smokeHome", t: "check", label: "Smoke exposure", ph: "Tobacco smoke at home" },
    { k: "fNotes", t: "textarea", label: "Family / social notes" },
  ] },
};
const HX_SEV = ["Mild", "Moderate", "Severe", "Anaphylaxis"];
const HX_PSTAT = [["active", "Active"], ["resolved", "Resolved"]];
var HXB = { allergies: [], problems: [] }; // modal drafts (live via inline handlers)

function hxEsc(s) {
  if (typeof esc === "function") { try { return esc(s); } catch (e) {} }
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function hxT(k, fb) { try { return (typeof t === "function" ? t(k, fb) : (fb != null ? fb : k)); } catch (e) { return (fb != null ? fb : k); } }
function hxEl(id) { try { return (typeof $ === "function" ? $(id) : document.getElementById(id)); } catch (e) { return null; } }
function hxEnsure(c) {
  if (!c || typeof c !== "object") return c;
  if (!c.perinatal || typeof c.perinatal !== "object") c.perinatal = {};
  if (!c.maternal || typeof c.maternal !== "object") c.maternal = {};
  if (!c.family || typeof c.family !== "object") c.family = {};
  if (!Array.isArray(c.allergies)) c.allergies = [];
  if (!Array.isArray(c.problems)) c.problems = [];
  if (Array.isArray(c.visits)) c.visits.forEach((v) => { if (v && !Array.isArray(v.icd)) v.icd = []; });
  return c;
}
function hxAllergyText(c) {
  c = c || {};
  const parts = [];
  if (c.allergy) parts.push(String(c.allergy).trim());
  (c.allergies || []).forEach((a) => {
    if (!a || !a.agent) return;
    parts.push(String(a.agent).trim() + (a.severity ? ` (${a.severity})` : "") + (a.reaction ? ` — ${String(a.reaction).trim()}` : ""));
  });
  return parts.filter(Boolean).join("; ");
}
function hxSga(c, periOverride) {
  try {
    if (typeof Scores === "undefined" || !Scores || typeof Scores.newbornSize !== "function") return null;
    const p = periOverride || (c && c.perinatal) || {};
    const ga = p.ga || (c && c.gest) || "";
    const bw = parseFloat(p.birthWtKg != null && p.birthWtKg !== "" ? p.birthWtKg : (c && c.birthWt));
    if (!ga || !(bw > 0)) return null;
    const len = parseFloat(p.birthLenCm != null && p.birthLenCm !== "" ? p.birthLenCm : (c && c.birthLen));
    const hc = parseFloat(p.birthHcCm != null && p.birthHcCm !== "" ? p.birthHcCm : (c && c.birthHC));
    return Scores.newbornSize({ ga, sex: (c && c.sex) || "", bwKg: bw, lenCm: len > 0 ? len : undefined, hcCm: hc > 0 ? hc : undefined });
  } catch (e) { return null; }
}
function hxSgaBadgeHTML(c) {
  const r = hxSga(c);
  const head = `<b>${hxEsc(hxT("hx.sga", "Size for gestational age"))}</b> <span style="font-size:11.5px;color:var(--muted)">INTERGROWTH-21st</span>`;
  if (!r) return `${head}<div class="hint">${hxEsc(hxT("hx.sga.na", "Needs gestation + birth weight"))}</div>`;
  if (!r.ok) return `${head}<div class="hint">⚠️ ${hxEsc(r.reason || "")}</div>`;
  const col = /^sga/.test(r.band || "") ? "var(--red)" : /^lga/.test(r.band || "") ? "#b45309" : "var(--teal,#0e7c7b)";
  let line = `<span style="display:inline-block;background:${col};color:#fff;border-radius:20px;padding:3px 12px;font-size:13px;font-weight:700">${hxEsc(r.label || r.band || "")}</span>`;
  if (r.pctW != null) line += ` <span style="font-size:13px">P${hxEsc(String(r.pctW))}</span>`;
  if (r.note) line += ` <span style="font-size:12px;color:var(--muted)">${hxEsc(r.note)}</span>`;
  if (r.sexKnown === false && r.boys && r.girls && r.boys.band !== r.girls.band) {
    line += `<div class="hint">♂ ${hxEsc(r.boys.label)} (P${hxEsc(String(r.boys.pctW))}) · ♀ ${hxEsc(r.girls.label)} (P${hxEsc(String(r.girls.pctW))})</div>`;
  }
  if (r.pctL != null || r.pctH != null) {
    line += ` <span style="font-size:12px;color:var(--muted)">(L${r.pctL != null ? " P" + hxEsc(String(r.pctL)) : ""}${r.pctH != null ? " · HC P" + hxEsc(String(r.pctH)) : ""})</span>`;
  }
  return `${head}<div style="margin-top:6px">${line}</div><div class="hint">Screening aid — clinical judgement prevails</div>`;
}
function hxAlgRowsHTML(list) {
  return (list || []).map((a, i) => `<div style="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:6px;margin-bottom:6px;align-items:end">
    <div><label>Agent *</label><input value="${hxEsc(a.agent || "")}" placeholder="e.g. Amoxicillin" data-oninput="hxEdA" data-arg="${i}" data-arg2="agent"></div>
    <div><label>Reaction</label><input value="${hxEsc(a.reaction || "")}" placeholder="e.g. Rash, wheeze" data-oninput="hxEdA" data-arg="${i}" data-arg2="reaction"></div>
    <div style="display:flex;gap:6px;align-items:end"><div style="flex:1"><label>Severity</label><select data-onchange="hxEdA" data-arg="${i}" data-arg2="severity"><option value="">—</option>${HX_SEV.map((s) => `<option${a.severity === s ? " selected" : ""}>${s}</option>`).join("")}</select></div>
    <button type="button" class="btn btn-danger btn-xs" data-act="hxDelA" data-arg="${i}" title="Remove">✕</button></div></div>`).join("")
    || `<div class="hint">No structured allergies recorded.</div>`;
}
function hxProbRowsHTML(list) {
  return (list || []).map((p, i) => `<div style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:6px;margin-bottom:6px;align-items:end">
    <div><label>Problem *</label><input value="${hxEsc(p.label || "")}" placeholder="e.g. Asthma" data-oninput="hxEdP" data-arg="${i}" data-arg2="label"></div>
    <div><label>ICD-10</label><input value="${hxEsc(p.code || "")}" placeholder="e.g. J45.9" data-oninput="hxEdP" data-arg="${i}" data-arg2="code"></div>
    <div style="display:flex;gap:6px;align-items:end"><div style="flex:1"><label>Since</label><input type="month" value="${hxEsc(p.since || "")}" data-onchange="hxEdP" data-arg="${i}" data-arg2="since"></div></div></div>
    <div style="display:grid;grid-template-columns:1fr auto;gap:6px;margin:-2px 0 8px;align-items:end">
      <div><label>Status</label><select data-onchange="hxEdP" data-arg="${i}" data-arg2="status">${HX_PSTAT.map(([v, l]) => `<option value="${v}"${(p.status || "active") === v ? " selected" : ""}>${l}</option>`).join("")}</select></div>
      <button type="button" class="btn btn-danger btn-xs" data-act="hxDelP" data-arg="${i}" title="Remove">✕ Remove</button></div>`).join("")
    || `<div class="hint">No problems on the list — a healthy child is a fine finding.</div>`;
}
function hxCardsHTML(c) {
  c = hxEnsure(c || {});
  // Prefill perinatal birth numbers from the legacy child fields (display only).
  const peri = Object.assign({ birthWtKg: c.birthWt || "", birthLenCm: c.birthLen || "", birthHcCm: c.birthHC || "", ga: c.gest || "" }, c.perinatal);
  let h = "";
  try {
    h += `<div class="card" style="margin:12px 0 0"><h3>🤰 ${hxEsc(hxT("hx.perinatal", "Birth & perinatal"))}</h3><div class="form-grid">${Forms.render(HX_SCH.perinatal, peri, "hxP")}</div><div id="hxSga" style="margin-top:6px">${hxSgaBadgeHTML(c)}</div></div>`;
    h += `<div class="card" style="margin:12px 0 0"><h3>🤱 ${hxEsc(hxT("hx.maternal", "Maternal profile"))}</h3><div class="form-grid">${Forms.render(HX_SCH.maternal, c.maternal, "hxM")}</div></div>`;
    h += `<div class="card" style="margin:12px 0 0"><h3>👨‍👩‍👧 ${hxEsc(hxT("hx.family", "Family & social"))}</h3><div class="form-grid">${Forms.render(HX_SCH.family, c.family, "hxF")}</div></div>`;
    h += `<div class="card" style="margin:12px 0 0"><h3>⚠️ ${hxEsc(hxT("hx.allergies", "Allergies (structured)"))}</h3><div id="hxAlgRows">${hxAlgRowsHTML(HXB.allergies)}</div><button type="button" class="btn btn-o btn-xs" data-act="hxAddA">＋ Add allergy</button></div>`;
    h += `<div class="card" style="margin:12px 0 0"><h3>📋 ${hxEsc(hxT("hx.problems", "Problem list"))}</h3><div id="hxProbRows">${hxProbRowsHTML(HXB.problems)}</div><button type="button" class="btn btn-o btn-xs" data-act="hxAddP">＋ Add problem</button></div>`;
  } catch (e) { h = `<div class="hint">History section unavailable (${hxEsc(e.message || e)}).</div>`; }
  return h;
}
function hxFill(c) {
  c = hxEnsure(c || {});
  HXB.allergies = JSON.parse(JSON.stringify(c.allergies || []));
  HXB.problems = JSON.parse(JSON.stringify(c.problems || []));
  try {
    const box = hxEl("hxCards");
    if (!box) return;
    box.innerHTML = hxCardsHTML(c);
    box.oninput = () => { try { hxRefreshSga(); } catch (e) {} };
  } catch (e) {}
}
function hxCleanA(list) {
  return (list || []).filter((a) => a && String(a.agent || "").trim()).map((a) => ({ agent: String(a.agent).trim(), reaction: String(a.reaction || "").trim(), severity: a.severity || "", note: String(a.note || "").trim() }));
}
function hxCleanP(list) {
  return (list || []).filter((p) => p && String(p.label || "").trim()).map((p) => ({ label: String(p.label).trim(), code: String(p.code || "").trim().toUpperCase(), since: p.since || "", status: p.status === "resolved" ? "resolved" : "active" }));
}
function hxCollect() {
  let peri = {}, mat = {}, fam = {};
  try {
    peri = Forms.collect("hxP", HX_SCH.perinatal);
    mat = Forms.collect("hxM", HX_SCH.maternal);
    fam = Forms.collect("hxF", HX_SCH.family);
  } catch (e) {}
  return { perinatal: peri, maternal: mat, family: fam, allergies: hxCleanA(HXB.allergies), problems: hxCleanP(HXB.problems) };
}
function hxRefreshSga() {
  try {
    const box = hxEl("hxSga"); if (!box) return;
    const peri = Forms.collect("hxP", HX_SCH.perinatal);
    const sexEl = hxEl("cSex");
    box.innerHTML = hxSgaBadgeHTML({ perinatal: peri, sex: sexEl ? sexEl.value : "", birthWt: "", gest: "" });
  } catch (e) {}
}
function hxVisitIcdHTML(v) {
  const codes = (v && v.icd) || [];
  if (!codes.length) return "";
  return `<div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">` + codes.map((code) => {
    let label = "";
    try { const e = (typeof Terms !== "undefined" && Terms.get) ? Terms.get(code) : null; label = e ? e.label : ""; } catch (e2) {}
    return `<span class="badge b-blue" style="font-size:11.5px">${hxEsc(code)}${label ? " · " + hxEsc(label) : ""}</span>`;
  }).join("") + `</div>`;
}
function hxPrevVisit(c, beforeId) {
  const vs = ((c && c.visits) || []).filter((v) => v && v.id !== beforeId).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return vs[0] || null;
}
function hxChangesHTML(c, v) {
  const prev = hxPrevVisit(c, v && v.id);
  if (!prev) return `<div class="hint">First visit note — no earlier note to compare.</div>`;
  const trunc = (s) => { s = String(s || ""); return s.length > 140 ? s.slice(0, 140) + "…" : s; };
  return `<div class="alert a-gray" style="margin:0 0 4px">📎 <div><b>${hxEsc(hxT("hx.changes", "Changes since last visit"))}</b> <span style="font-size:12px;color:var(--muted)">vs ${hxEsc(prev.date || "")} · ${hxEsc(prev.type || "")}</span>
    ${prev.subj ? `<div style="font-size:12.5px"><b>Was:</b> ${hxEsc(trunc(prev.subj))}</div>` : ""}
    ${prev.plan ? `<div style="font-size:12.5px"><b>Plan was:</b> ${hxEsc(trunc(prev.plan))}</div>` : ""}
    ${hxVisitIcdHTML(prev)}</div></div>`;
}
function hxFillVisit(v, c) {
  try {
    const hid = hxEl("vsIcd"); if (hid) hid.value = JSON.stringify((v && v.icd) || []);
    if (typeof Terms !== "undefined" && Terms.attach) Terms.attach("vsIcdQ", "vsIcdList", "vsIcdChips", "vsIcd");
    const ch = hxEl("vsChanges"); if (ch) ch.innerHTML = hxChangesHTML(c, v);
  } catch (e) {}
}
function hxCollectVisitIcd() {
  try {
    const hid = hxEl("vsIcd");
    const v = JSON.parse((hid && hid.value) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x).slice(0, 12) : [];
  } catch (e) { return []; }
}
function hxActiveProblems(c) { return ((c && c.problems) || []).filter((p) => p && (!p.status || p.status === "active")); }
function hxRxStripHTML(c) {
  const alg = hxAllergyText(c);
  const probs = hxActiveProblems(c);
  let h = "";
  if (alg) h += `<div class="alert a-red" style="margin:0 0 12px">⚠️ <div><b>ALLERGIES:</b> ${hxEsc(alg)}</div></div>`;
  if (probs.length) h += `<div style="font-size:13px;margin:0 0 12px"><b>Active problems:</b> ${probs.map((p) => hxEsc(p.code ? `${p.label} (${p.code})` : p.label)).join("; ")}</div>`;
  return h;
}
function hxChildHeaderProblems(c) {
  const probs = hxActiveProblems(c);
  if (!probs.length) return "";
  return `<dt>Ongoing</dt><dd>${probs.map((p) => hxEsc(p.code ? `${p.label} (${p.code})` : p.label)).join("; ")}</dd>`;
}
var Hx = {
  SCH: HX_SCH, ensure: hxEnsure, allergyText: hxAllergyText, sga: hxSga, sgaBadgeHTML: hxSgaBadgeHTML,
  cardsHTML: hxCardsHTML, fill: hxFill, collect: hxCollect, refreshSga: hxRefreshSga,
  visitIcdHTML: hxVisitIcdHTML, changesHTML: hxChangesHTML, fillVisit: hxFillVisit, collectVisitIcd: hxCollectVisitIcd,
  rxStripHTML: hxRxStripHTML, headerProblems: hxChildHeaderProblems, activeProblems: hxActiveProblems,
  edA(i, k, v) { try { if (HXB.allergies[i]) HXB.allergies[i][k] = v; } catch (e) {} },
  addA() { HXB.allergies.push({ agent: "", reaction: "", severity: "" }); try { const b = hxEl("hxAlgRows"); if (b) b.innerHTML = hxAlgRowsHTML(HXB.allergies); } catch (e) {} },
  delA(i) { HXB.allergies.splice(i, 1); try { const b = hxEl("hxAlgRows"); if (b) b.innerHTML = hxAlgRowsHTML(HXB.allergies); } catch (e) {} },
  edP(i, k, v) { try { if (HXB.problems[i]) HXB.problems[i][k] = v; } catch (e) {} },
  addP() { HXB.problems.push({ label: "", code: "", since: "", status: "active" }); try { const b = hxEl("hxProbRows"); if (b) b.innerHTML = hxProbRowsHTML(HXB.problems); } catch (e) {} },
  delP(i) { HXB.problems.splice(i, 1); try { const b = hxEl("hxProbRows"); if (b) b.innerHTML = hxProbRowsHTML(HXB.problems); } catch (e) {} },
};
try { if (typeof window !== "undefined" && window) window.Hx = Hx; } catch (e) {}

/* E2c: delegated actions for templates in this file. */
try {
  actRegister("hxAddA", function () { try { Hx.addA(); } catch (e) { actReport("hxAddA", e); } });
  actRegister("hxAddP", function () { try { Hx.addP(); } catch (e) { actReport("hxAddP", e); } });
  actRegister("hxDelA", function (el) { try { Hx.delA(Number(actArg(el))); } catch (e) { actReport("hxDelA", e); } });
  actRegister("hxDelP", function (el) { try { Hx.delP(Number(actArg(el))); } catch (e) { actReport("hxDelP", e); } });
  actRegister("hxEdA", function (el) { try { Hx.edA(Number(actArg(el)), actArg(el, 2), el.value); } catch (e) { actReport("hxEdA", e); } });
  actRegister("hxEdP", function (el) { try { Hx.edP(Number(actArg(el)), actArg(el, 2), el.value); } catch (e) { actReport("hxEdP", e); } });
} catch (e) {}

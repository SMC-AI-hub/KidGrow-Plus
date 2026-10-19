/* NeoKid Care — chronic flowsheets (Phase 6). Three exemplar conditions
   (asthma, epilepsy, type 1 diabetes): time-grid over visits/labs/measures
   + small condition logs. Cells match on EXACT date (no carry-forward —
   stale values never masquerade as fresh); each row also shows Latest. */
function chronicPack() { try { return (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT.chronic) || null; } catch (e) { return null; } }
function chronicProfiles() { try { return (chronicPack() || {}).profiles || []; } catch (e) { return []; } }
function chronicEsc(s) {
  if (typeof esc === "function") { try { return esc(s); } catch (e) {} }
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function chronicOf(c) {
  if (!c.chronic || typeof c.chronic !== "object") c.chronic = {};
  const ch = c.chronic;
  if (!ch.asthma || typeof ch.asthma !== "object") ch.asthma = { checks: [], exac: [] };
  if (!Array.isArray(ch.asthma.checks)) ch.asthma.checks = [];
  if (!Array.isArray(ch.asthma.exac)) ch.asthma.exac = [];
  if (!ch.epilepsy || typeof ch.epilepsy !== "object") ch.epilepsy = { seizures: [], aeds: [] };
  if (!Array.isArray(ch.epilepsy.seizures)) ch.epilepsy.seizures = [];
  if (!Array.isArray(ch.epilepsy.aeds)) ch.epilepsy.aeds = [];
  if (!ch.t1dm || typeof ch.t1dm !== "object") ch.t1dm = { readings: [], insulin: "" };
  if (!Array.isArray(ch.t1dm.readings)) ch.t1dm.readings = [];
  return ch;
}
function chronicCodes(c) {
  const out = [];
  try {
    (c.visits || []).forEach((v) => (v.icd || []).forEach((x) => out.push(String(x).toUpperCase())));
    (c.problems || []).filter((p) => p && (!p.status || p.status === "active")).forEach((p) => { if (p.code) out.push(String(p.code).toUpperCase()); });
  } catch (e) {}
  return out;
}
function chronicConds(c) {
  const codes = chronicCodes(c);
  const hit = (listed) => (listed || []).some((L) => {
    L = String(L).toUpperCase();
    return codes.some((x) => x === L || x.startsWith(L + "."));
  });
  const out = [];
  for (const p of chronicProfiles()) if (hit(p.icd)) out.push({ id: p.id, label: p.label });
  try {
    const ch = c.chronic || {};
    if (c.asthma && (c.asthma.pef || []).length && !out.some((x) => x.id === "asthma")) out.push({ id: "asthma", label: "Asthma" });
    if ((((ch.epilepsy || {}).seizures || []).length || ((ch.epilepsy || {}).aeds || []).length) && !out.some((x) => x.id === "epilepsy")) out.push({ id: "epilepsy", label: "Epilepsy" });
    if (((ch.t1dm || {}).readings || []).length && !out.some((x) => x.id === "t1dm")) out.push({ id: "t1dm", label: "Type 1 diabetes" });
  } catch (e) {}
  return out;
}
function chronicDates(c, profileId, n) {
  const ds = new Set();
  const add = (d) => { d = String(d || "").slice(0, 10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) ds.add(d); };
  try {
    (c.measures || []).forEach((m) => add(m.date));
    (c.labs || []).forEach((l) => add(l.date));
    (c.visits || []).forEach((v) => add(v.date));
    const ch = ((c.chronic || {})[profileId]) || {};
    (ch.checks || []).forEach((x) => add(x.date));
    (ch.exac || []).forEach((x) => add(x.date));
    (ch.seizures || []).forEach((x) => add(x.date));
    (ch.readings || []).forEach((x) => add(x.date));
    if (profileId === "asthma") ((c.asthma && c.asthma.pef) || []).forEach((p) => add(p.date));
  } catch (e) {}
  return [...ds].sort().reverse().slice(0, n || 6);
}
function ginaLevel(n) {
  n = +n || 0;
  return n <= 0 ? { level: "Well controlled", short: "Well", sev: "green" }
    : n <= 2 ? { level: "Partly controlled", short: "Partly", sev: "amber" }
    : { level: "Uncontrolled", short: "Uncontrolled", sev: "red" };
}
function hba1cFlag(v) {
  const P = chronicPack(), n = parseFloat(v);
  if (!isFinite(n)) return null;
  const std = (P && P.hba1c && P.hba1c.standard) || 7.0, tech = (P && P.hba1c && P.hba1c.tech) || 6.5;
  if (n <= tech) return { band: "tech", sev: "green", text: `at target (either goal ≤${tech})` };
  if (n <= std) return { band: "standard", sev: "green", text: `meets standard goal (≤${std}); tech goal ≤${tech}` };
  return { band: "above", sev: "warn", text: `above target (>${std}) — review control + hypos` };
}
function chronicCell(c, profileId, key, dateISO) {
  const on = (list) => (list || []).filter((x) => x && String(x.date || "").slice(0, 10) === dateISO);
  try {
    const ch = ((c.chronic || {})[profileId]) || {};
    if (key === "gina") {
      const l = on(ch.checks); if (!l.length) return "";
      const g = ginaLevel(l[l.length - 1].yes); return `${g.short} (${l[l.length - 1].yes}/4)`;
    }
    if (key === "pef") {
      const l = on((c.asthma && c.asthma.pef) || []); if (!l.length) return "";
      const p = l[l.length - 1]; return `${p.am || "—"}/${p.pm || "—"}`;
    }
    if (key === "exac") {
      const l = on(ch.exac); if (!l.length) return "";
      return l.map((e) => `⚠️${e.steroids ? "S" : ""}${e.admission ? "H" : ""}`).join(" ");
    }
    if (key === "seiz") {
      const l = on(ch.seizures); if (!l.length) return "";
      return `${l.length}× ${[...new Set(l.map((s) => s.type || "?"))].join(",")}`;
    }
    if (key === "rescue") {
      const l = on(ch.seizures).filter((s) => s.rescue); return l.length ? `Yes (${l.length})` : "";
    }
    if (key === "hba1c") {
      const l = on(ch.readings).filter((r) => r.kind === "hba1c"); if (!l.length) return "";
      const f = hba1cFlag(l[l.length - 1].value);
      return `${l[l.length - 1].value}${f && f.band === "above" ? " ⚠️" : ""}`;
    }
    if (key === "glu") {
      const l = on(ch.readings).filter((r) => ["fbs", "pp", "rbs"].includes(r.kind)); if (!l.length) return "";
      return l.map((r) => `${String(r.kind).toUpperCase()}${r.value}`).join(" ");
    }
    if (key === "hypo") {
      const l = on(ch.readings).filter((r) => r.kind === "hypo"); if (!l.length) return "";
      return `×${l.length}${l.some((r) => r.value === "severe") ? " (severe)" : ""}`;
    }
    if (key === "wt") {
      const l = on(c.measures).filter((m) => m.wt > 0); return l.length ? String(l[l.length - 1].wt) : "";
    }
    if (key === "hb") {
      const l = on(c.labs).filter((x) => x.hb !== "" && x.hb != null); return l.length ? String(l[l.length - 1].hb) : "";
    }
  } catch (e) {}
  return "";
}
function chronicLatestVal(c, profileId, key) {
  const ds = chronicDates(c, profileId, 999);
  for (const d of ds) { const t = chronicCell(c, profileId, key, d); if (t) return { text: t, date: d }; }
  return null;
}

/* ---------------- UI ---------------- */
let CHRONIC_TAB = null;
function chronicSheetHTML(c, prof) {
  const dates = chronicDates(c, prof.id, 6);
  const fD = (d) => { try { return fmtDate(d); } catch (e) { return d; } };
  const head = `<tr><th style="min-width:130px">Measure</th><th>Latest</th>${dates.map((d) => `<th>${chronicEsc(fD(d))}</th>`).join("")}</tr>`;
  const rows = prof.rows.map((r) => {
    const lat = chronicLatestVal(c, prof.id, r.key);
    const cells = dates.map((d) => `<td>${chronicEsc(chronicCell(c, prof.id, r.key, d) || "—")}</td>`).join("");
    return `<tr><td><b>${chronicEsc(r.label)}</b></td><td style="background:var(--sand, #faf7f0)">${lat ? `<b>${chronicEsc(lat.text)}</b><br><span style="font-size:11px;color:var(--muted)">${chronicEsc(fD(lat.date))}</span>` : "—"}</td>${cells}</tr>`;
  }).join("");
  return `<div style="overflow:auto"><table class="tbl">${head}${rows}</table></div>
  <div class="hint">Cells match on exact date only — blank is missing, not zero. S = steroids, H = hospitalised.</div>`;
}
function chronicLogFormsHTML(c, prof) {
  let t = "";
  try { t = todayISO(); } catch (e) {}
  if (prof.id === "asthma") {
    const qs = prof.gina || [];
    return `<div class="card" style="margin-top:12px"><h3>📝 GINA control check (past 4 weeks)</h3>
      ${qs.map((q, i) => `<label style="display:block;font-size:13.5px;margin:4px 0"><input type="checkbox" id="chGina${i}"> ${chronicEsc(q)}</label>`).join("")}
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><input type="date" id="chGinaDate" value="${t}" style="max-width:160px"><button class="btn btn-p btn-sm" onclick="chronicSaveGina()">Save check</button></div></div>
      <div class="card" style="margin-top:12px"><h3>⚠️ Exacerbation</h3><div class="form-grid">
      <div><label>Date</label><input type="date" id="chExacDate" value="${t}"></div>
      <div><label>Oral steroids?</label><select id="chExacSter"><option value="">No</option><option value="y">Yes</option></select></div>
      <div><label>Hospitalised?</label><select id="chExacAdm"><option value="">No</option><option value="y">Yes</option></select></div>
      <div><label>Note</label><input id="chExacNote" placeholder="trigger, reliever response"></div></div>
      <button class="btn btn-o btn-sm" style="margin-top:8px" onclick="chronicSaveExac()">+ Log exacerbation</button>
      <div class="hint" style="margin-top:6px">PEF diary lives on the Screening page — its dates flow into this sheet.</div></div>`;
  }
  if (prof.id === "epilepsy") {
    const P = chronicPack();
    const types = ((P && P.seizureTypes) || []).map((x) => `<option>${chronicEsc(x)}</option>`).join("");
    const aeds = (chronicOf(c).epilepsy.aeds || []).map((a, i) => `<span class="badge b-gray" style="margin:2px">${chronicEsc(a.name)}${a.dose ? " " + chronicEsc(a.dose) : ""} <a href="#" onclick="chronicDelAed(${i});return false">✕</a></span>`).join("") || `<span class="hint">none listed</span>`;
    return `<div class="card" style="margin-top:12px"><h3>⚡ Seizure diary</h3><div class="form-grid">
      <div><label>Date</label><input type="date" id="chSeizDate" value="${t}"></div>
      <div><label>Type</label><select id="chSeizType">${types}</select></div>
      <div><label>Duration (min)</label><input type="number" step="0.5" id="chSeizDur" placeholder=""></div>
      <div><label>Rescue med used?</label><select id="chSeizRescue"><option value="">No</option><option value="y">Yes</option></select></div></div>
      <button class="btn btn-p btn-sm" style="margin-top:8px" onclick="chronicSaveSeiz()">+ Log seizure</button></div>
      <div class="card" style="margin-top:12px"><h3>💊 Current AEDs</h3><div>${aeds}</div>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><input id="chAedName" placeholder="e.g. Levetiracetam" style="max-width:200px"><input id="chAedDose" placeholder="e.g. 250mg BD" style="max-width:160px"><button class="btn btn-o btn-sm" onclick="chronicAddAed()">+ Add</button></div></div>`;
  }
  const kinds = (((chronicPack() || {}).gluKinds) || ["hba1c", "fbs", "pp", "rbs", "hypo"]).map((k) => `<option value="${k}">${k === "hba1c" ? "HbA1c %" : k === "hypo" ? "Hypo episode" : k.toUpperCase() + " mg/dL"}</option>`).join("");
  return `<div class="card" style="margin-top:12px"><h3>🩸 Glucose / HbA1c log</h3>
    <div class="hint">ISPAD 2024: HbA1c ≤7.0% standard · ≤6.5% with advanced tech/honeymoon. Hypo = one row per episode.</div>
    <div class="form-grid"><div><label>Date</label><input type="date" id="chReadDate" value="${t}"></div>
    <div><label>Kind</label><select id="chReadKind" onchange="document.getElementById('chReadVal').style.display=this.value==='hypo'?'none':'';document.getElementById('chReadSev').style.display=this.value==='hypo'?'':'none'">${kinds}</select></div>
    <div><label>Value</label><input id="chReadVal" placeholder="% or mg/dL"><select id="chReadSev" style="display:none"><option value="mild">mild</option><option value="severe">severe</option></select></div></div>
    <button class="btn btn-p btn-sm" style="margin-top:8px" onclick="chronicSaveReading()">+ Log reading</button></div>
    <div class="card" style="margin-top:12px"><h3>💉 Insulin regimen</h3>
    <input id="chInsulin" value="${chronicEsc((chronicOf(c).t1dm.insulin) || "")}" placeholder="e.g. Glargine 10u nocte + Aspart carb-ratio" oninput="chronicSetInsulin(this.value)"></div>`;
}
function renderChronic() {
  const box = document.getElementById("chronicBox");
  if (!box) return;
  let c = null;
  try { c = (typeof child === "function") ? child() : null; } catch (e) {}
  if (!c) { box.innerHTML = `<div class="empty">No child selected.</div>`; return; }
  const conds = chronicConds(c);
  if (!conds.length) {
    box.innerHTML = `<div class="card"><h3>📊 Chronic flowsheets</h3><div class="hint">No chronic condition detected for <b>${chronicEsc(c.name)}</b>. Add an active problem (asthma J45, epilepsy G40.9, type 1 diabetes E10.9) or start a log below — the flowsheet opens automatically.</div></div>`;
    return;
  }
  if (!CHRONIC_TAB || !conds.some((x) => x.id === CHRONIC_TAB)) CHRONIC_TAB = conds[0].id;
  const prof = chronicProfiles().find((p) => p.id === CHRONIC_TAB);
  const tabs = conds.map((x) => `<button class="btn btn-xs ${x.id === CHRONIC_TAB ? "btn-p" : "btn-o"}" onclick="CHRONIC_TAB='${x.id}';renderChronic()">${chronicEsc(x.label)}</button>`).join("");
  box.innerHTML = `<div class="toolbar"><span style="font-size:13px;color:var(--muted)">Flowsheet for <b>${chronicEsc(c.name)}</b></span><span class="sp"></span>${tabs}</div>
  <div class="card"><h3>📊 ${chronicEsc(prof.label)} flowsheet</h3>${chronicSheetHTML(c, prof)}</div>
  ${chronicLogFormsHTML(c, prof)}`;
}
function chronicSaveGina() {
  const c = (typeof child === "function") ? child() : null; if (!c) return;
  let yes = 0;
  for (let i = 0; i < 4; i++) { const el = document.getElementById("chGina" + i); if (el && el.checked) yes++; }
  const ch = chronicOf(c);
  ch.asthma.checks.push({ date: (document.getElementById("chGinaDate") || {}).value || "", yes });
  const g = ginaLevel(yes);
  try { if (g.sev !== "green" && typeof Alerts !== "undefined" && Alerts.raise) Alerts.raise(g.sev === "red" ? "warn" : "info", "CHRONIC-GINA", `${c.name}: asthma ${g.level} (${yes}/4).`); } catch (e) {}
  try { if (typeof auditSafe === "function") auditSafe("GINA check", `${c.name} — ${g.level}`); } catch (e2) {}
  try { save(); renderChronic(); } catch (e3) {}
}
function chronicSaveExac() {
  const c = (typeof child === "function") ? child() : null; if (!c) return;
  const gv = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  chronicOf(c).asthma.exac.push({ date: gv("chExacDate"), steroids: gv("chExacSter") === "y", admission: gv("chExacAdm") === "y", note: gv("chExacNote") });
  try { if (typeof auditSafe === "function") auditSafe("Asthma exacerbation", c.name); } catch (e) {}
  try { save(); renderChronic(); } catch (e2) {}
}
function chronicSaveSeiz() {
  const c = (typeof child === "function") ? child() : null; if (!c) return;
  const gv = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  if (!gv("chSeizDate")) { alert("Date is required."); return; }
  chronicOf(c).epilepsy.seizures.push({ date: gv("chSeizDate"), type: gv("chSeizType"), dur: gv("chSeizDur"), rescue: gv("chSeizRescue") === "y" });
  try { if (typeof auditSafe === "function") auditSafe("Seizure logged", `${c.name} — ${gv("chSeizType")}`); } catch (e) {}
  try { save(); renderChronic(); } catch (e2) {}
}
function chronicAddAed() {
  const c = (typeof child === "function") ? child() : null; if (!c) return;
  const n = (document.getElementById("chAedName") || {}).value || "", d = (document.getElementById("chAedDose") || {}).value || "";
  if (!n.trim()) return;
  chronicOf(c).epilepsy.aeds.push({ name: n.trim(), dose: d.trim() });
  try { save(); renderChronic(); } catch (e) {}
}
function chronicDelAed(i) {
  const c = (typeof child === "function") ? child() : null; if (!c) return;
  chronicOf(c).epilepsy.aeds.splice(i, 1);
  try { save(); renderChronic(); } catch (e) {}
}
function chronicSaveReading() {
  const c = (typeof child === "function") ? child() : null; if (!c) return;
  const gv = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  const kind = gv("chReadKind"), val = kind === "hypo" ? gv("chReadSev") : gv("chReadVal");
  if (!gv("chReadDate") || val === "") { alert("Date + value are required."); return; }
  chronicOf(c).t1dm.readings.push({ date: gv("chReadDate"), kind, value: val });
  try {
    if (kind === "hba1c" && typeof Alerts !== "undefined" && Alerts.raise) {
      const f = hba1cFlag(val);
      if (f && f.band === "above") Alerts.raise("warn", "CHRONIC-A1C", `${c.name}: HbA1c ${val}% ${f.text}.`);
    }
  } catch (e) {}
  try { if (typeof auditSafe === "function") auditSafe("Diabetes reading", `${c.name} — ${kind} ${val}`); } catch (e2) {}
  try { save(); renderChronic(); } catch (e3) {}
}
function chronicSetInsulin(v) { try { const c = child(); if (c) { chronicOf(c).t1dm.insulin = v; save(); } } catch (e) {} }
var Chronic = {
  pack: chronicPack, profiles: chronicProfiles, of: chronicOf, codes: chronicCodes, conds: chronicConds,
  dates: chronicDates, cell: chronicCell, latestVal: chronicLatestVal,
  gina: ginaLevel, a1c: hba1cFlag,
};
try { if (typeof window !== "undefined" && window) window.Chronic = Chronic; } catch (e) {}

/* =====================================================
   NeoKid Care — Data & exports (Round 4)
   UIP register · due-list · AEFI / birth line-lists ·
   coverage CSV · ABHA/ABDM-ready record JSON.
   ===================================================== */
function csvEsc(x) {
  const s = String(x ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvOf(rows) { return rows.map((r) => r.map(csvEsc).join(",")).join("\n"); }
function downloadFile(name, content, mime) {
  const b = new Blob([content], { type: mime || "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function schedCodes() {
  const out = [];
  VACCINE_SCHEDULE.forEach((v) => v.vaccines.forEach((vx) => out.push({ code: vx.code, name: `${vx.name} ${vx.dose}`.trim(), visit: v })));
  return out;
}
/* ---- UIP immunisation register ---- */
function uipCsv(children) {
  const codes = schedCodes();
  const head = ["Child", "DOB", "Sex", "Father", "Mother", "Phone", "ABHA", ...codes.map((x) => x.code)];
  const rows = (children || []).map((c) => [
    c.name, c.dob, c.sex, c.father || "", c.mother || "", c.phone || "", c.abha || "",
    ...codes.map((x) => { const r = (c.vaccines || {})[x.code]; return r && r.date ? dmy(r.date) : ""; }),
  ]);
  return csvOf([head, ...rows]);
}
/* ---- due-list (microplan style) ---- */
function dueListCsv(children, today, days) {
  const all = clinicDueList(children, today).filter((i) => i.band !== "upcoming");
  const head = ["Child", "DOB", "Age", "Parent", "Phone", "Vaccine", "Due", "Status"];
  const rows = all.map((i) => {
    const c = (children || []).find((x) => x.id === i.childId) || {};
    return [i.child, c.dob || "", c.dob ? ageStr(ageBetween(c.dob)) : "", c.mother || c.father || "", c.phone || "", `${i.name} ${i.dose || ""}`.trim(), dmy(i.due), i.band];
  });
  return csvOf([head, ...rows]);
}
/* ---- coverage ---- */
function covCsv(children, today) {
  const cov = coverageStats(children, today);
  const rows = cov.rows.filter((r) => r.eligible > 0).map((r) => [r.code, `${r.name} ${r.dose || ""}`.trim(), r.given, r.eligible, r.pct + "%"]);
  return csvOf([["Code", "Vaccine", "Given", "Eligible", "Coverage"], ...rows,
    [], ["Fully immunised for age", `${cov.fic}/${cov.total}`],
    ["DTP1-DTP3 dropout", cov.dtpDrop.pct === null ? "—" : cov.dtpDrop.pct + "%"],
    ["BCG-MMR1 dropout", cov.bcgMmrDrop.pct === null ? "—" : cov.bcgMmrDrop.pct + "%"]]);
}
/* ---- AEFI line-list ---- */
function aefiCsvAll(children) {
  const head = ["Child", "DOB", "Event date", "Vaccine", "Brand", "Batch", "Severity", "Symptoms", "Outcome", "Reported"];
  const rows = [];
  (children || []).forEach((c) => (c.aefi || []).forEach((e) => rows.push([
    c.name, c.dob, e.date, e.vacLabel || e.code, e.brand || "", e.batch || "", e.severity || "", (e.symptoms || []).join("; "), e.outcome || "", e.reported || "",
  ])));
  return csvOf([head, ...rows]);
}
/* ---- birth register ---- */
function birthCsv(children) {
  const head = ["DOB", "Baby", "Sex", "Mother", "Wt(kg)", "GA(wk)", "Mode", "APGAR5", "Place", "TSH", "ROP", "Hearing"];
  const rows = [...(children || [])].sort((a, b) => (a.dob || "").localeCompare(b.dob || "")).map((k) => {
    const n = k.nb || {};
    let a5 = "";
    try { const r = apgarTotal(((n.apgar || {}).t5) || []); a5 = r.total === null ? "" : r.total; } catch (e) {}
    const s = n.screen || {};
    return [k.dob, k.name, k.sex, k.mother || "", k.birthWt || "", k.gest || "", n.mode || "", a5, n.place || "", (s.tsh || {}).res || "", (s.rop || {}).res || "", (s.hear || {}).res || ""];
  });
  return csvOf([head, ...rows]);
}
/* ---- ABHA/ABDM-ready record (per child) ---- */
function abhaJson(c) {
  const codes = schedCodes();
  return {
    record: "KidGrowPro-Child-Health-Record", version: 2, abdmReady: true,
    note: "Links to ABHA ID for ABDM HIP/MHR upload via a registered integrator.",
    profile: { name: c.name, dob: c.dob, sex: c.sex, blood: c.blood || "", phone: c.phone || "", father: c.father || "", mother: c.mother || "", abhaId: c.abha || "", address: (DB.settings || {}).addr || "" },
    allergies: c.allergy || "",
    birth: { weightKg: c.birthWt || "", gestationWk: c.gest || "", lengthCm: c.birthLen || "", hcCm: c.birthHC || "" },
    immunization: codes.map((x) => {
      const r = (c.vaccines || {})[x.code];
      return { code: x.code, vaccine: x.name, due: dueDateFor(c, x.visit), given: r ? { date: r.date || "", brand: r.brand || "", manufacturer: r.mfr || "", batch: r.batch || "" } : null };
    }),
    growth: (c.measures || []).map((m) => ({ date: m.date, wtKg: m.wt, htCm: m.ht, hcCm: m.hc || "", muacCm: m.muac || "", bmi: m.bmi })),
    visits: (c.visits || []).map((v) => ({ date: v.date, type: v.type || "", complaints: v.subj || "", examination: v.obj || "", plan: v.plan || "", hasVoiceNote: !!v.voice })),
    prescriptions: (c.rx || []).map((r) => ({ date: r.date, dx: r.dx || "", items: (r.items || []).map((it) => ({ drug: it.drug, strength: it.strength || "", take: it.take || "", freq: it.freq || "", days: it.days || "", qty: it.qty || "", instr: it.instr || "" })), advice: r.advice || "", review: r.review || "" })),
    milestones: { currentBand: MILESTONES[bandForAge(ageBetween(c.dob).months)].band, achieved: Object.keys(c.milestones || {}).filter((k) => c.milestones[k] === "A").length, emerging: Object.keys(c.milestones || {}).filter((k) => c.milestones[k] === "E").length, notYet: Object.keys(c.milestones || {}).filter((k) => c.milestones[k] === "N").length },
    generated: new Date().toISOString(), clinic: DB.settings || {},
  };
}
/* ---------------- page ---------------- */
function renderExport() {
  if (!$("pg-export")) return;
  const t = todayISO(), n = DB.children.length;
  const due = clinicDueList(DB.children, t).filter((i) => i.band !== "upcoming").length;
  const nae = DB.children.reduce((s, c) => s + ((c.aefi || []).length), 0);
  const c = child();
  const card = (icon, title, desc, btn, fn) => `<div class="card"><h3>${icon} ${title}</h3><div class="hint">${desc}</div>
    <button class="btn btn-p btn-sm" onclick="${fn}">${btn}</button></div>`;
  $("expBox").innerHTML = `
  <div class="grid g2">
    ${card("📕", "UIP immunisation register (CSV)", `${n} children × 43 doses — dates in dd/mm/yyyy. For NIS / register transcription.`, "⬇ Download", "dlUip()")}
    ${card("📋", "Due-list / microplan (CSV)", `${due} overdue + upcoming doses with parent phones for mobilisation.`, "⬇ Download", "dlDue()")}
    ${card("📊", "Coverage summary (CSV)", `Per-antigen coverage + dropout + fully-immunised counts.`, "⬇ Download", "dlCov()")}
    ${card("⚠️", "AEFI line-list (CSV)", `${nae} event(s) across all children for DIO reporting.`, "⬇ Download", "dlAefi()")}
    ${card("📖", "Birth register (CSV)", `One row per child with delivery + screening results.`, "⬇ Download", "dlBirth()")}
    ${card("🪪", "ABHA-ready record (JSON)", `${c ? `For <b>${esc(c.name)}</b>${c.abha ? ` · ABHA ${esc(c.abha)}` : " · <span style='color:var(--amber)'>no ABHA linked — add in Children → Edit</span>"}` : "No child selected."} Links demographics + immunisation + growth to the ABHA ID.`, "⬇ Download", "dlAbha()")}
  </div>
  <div style="height:16px"></div>
  <div class="card"><h3>💾 Full backup</h3><div class="hint">Everything in one file. 🔐 Encrypted = safe on Google Drive / WhatsApp / email. Restore JSON from Settings → Import.</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-o btn-sm" onclick="exportData()">⬇ JSON backup</button>
    <button class="btn btn-p btn-sm" onclick="exportEncrypted()">🔐 Encrypted backup</button>
    <button class="btn btn-o btn-sm" onclick="document.getElementById('encFile').click()">🔓 Restore encrypted</button>
    <button class="btn btn-o btn-sm" onclick="undoLastImport()">↩ Undo last import</button>
    <input type="file" id="encFile" accept=".kgenc,.json" style="display:none" onchange="importEncrypted(this.files[0]);this.value=''"></div>
    <div class="hint">${(typeof backupAgeLine === "function") ? backupAgeLine() : ""}</div>
    <div class="hint">${(typeof undoImportLine === "function") ? undoImportLine() : ""}</div></div>
  <div class="hint" style="margin-top:8px">ABDM gateway upload itself needs a registered Health Information Provider + patient consent — these files are integration-ready for that step.</div>`;
}
function dlUip() { downloadFile(`uip_register_${todayISO()}.csv`, uipCsv(DB.children), "text/csv"); auditSafe("Export", "UIP register"); }
function dlDue() { downloadFile(`due_list_${todayISO()}.csv`, dueListCsv(DB.children, todayISO()), "text/csv"); auditSafe("Export", "Due-list"); }
function dlCov() { downloadFile(`coverage_${todayISO()}.csv`, covCsv(DB.children, todayISO()), "text/csv"); auditSafe("Export", "Coverage"); }
function dlAefi() { downloadFile(`aefi_linelist_${todayISO()}.csv`, aefiCsvAll(DB.children), "text/csv"); auditSafe("Export", "AEFI line-list"); }
function dlBirth() { downloadFile(`birth_register_${todayISO()}.csv`, birthCsv(DB.children), "text/csv"); auditSafe("Export", "Birth register"); }
function dlAbha() {
  const c = child(); if (!c) return;
  downloadFile(`${c.name.replace(/[^\w]+/g, "_")}_abha_record.json`, JSON.stringify(abhaJson(c), null, 1), "application/json");
  auditSafe("Export", `ABHA record — ${c.name}`);
}

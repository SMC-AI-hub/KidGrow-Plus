/* =====================================================
   NeoKid Care — AEFI register (Round 3)
   Adverse Events Following Immunisation with severity
   grading + India reporting cues.
   ===================================================== */
const AEFI_SYMPTOMS = ["Fever", "Local pain / swelling", "Persistent crying >3 h", "Vomiting / diarrhoea", "Rash", "HHE (floppy / unresponsive)", "Seizure", "Anaphylaxis", "Abscess", "Lymphadenitis", "Thrombocytopenia / bleeding", "Death"];
const AEFI_SERIOUS_SYM = ["HHE (floppy / unresponsive)", "Seizure", "Anaphylaxis", "Death"];
function aefiSerious(e) {
  if (!e) return false;
  if (e.severity === "Serious" || e.outcome === "Death" || e.outcome === "Hospitalised") return true;
  return (e.symptoms || []).some((s) => AEFI_SERIOUS_SYM.includes(s));
}
function aefiVaccineOptions() {
  const opts = [];
  VACCINE_SCHEDULE.forEach((v) => v.vaccines.forEach((vx) => opts.push({ code: vx.code, label: `${vx.name} ${vx.dose}`.trim() })));
  return opts;
}
function renderAefi() {
  if (!$("pg-aefi")) return;
  const c = child();
  if (!c) { $("aefiBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  c.aefi = c.aefi || [];
  const rows = [...c.aefi].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const serious = rows.filter(aefiSerious);
  $("aefiBox").innerHTML = `
  <div class="toolbar"><span style="font-size:13px;color:var(--muted)">${rows.length} event(s) · ${serious.length} serious</span>
    <span class="sp"></span>
    <button class="btn btn-o btn-sm" onclick="pullAefiFromNotes()">⬇ Pull from vaccine notes</button>
    <button class="btn btn-o btn-sm" onclick="printPage('pg-aefi')">🖨️ Print register</button></div>
  ${serious.length ? `<div class="alert a-red">🚨 <div><b>${serious.length} serious AEFI.</b> India guidelines: report serious AEFI to the Medical Officer / DIO <b>within 24 hours</b> (AEFI register / HMIS), hospitalise & investigate; do not wait for causality proof.</div></div>` : ""}
  <div class="grid g2">
    <div class="card"><h3>📝 Record event</h3>
      <div class="form-grid">
        <div><label>Event date *</label><input type="date" id="aeDate" value="${todayISO()}"></div>
        <div><label>Vaccine</label><select id="aeVac">${aefiVaccineOptions().map((o) => `<option value="${o.code}">${esc(o.label)}</option>`).join("")}<option value="OTHER">Other / extra</option></select></div>
        <div><label>Brand</label><input id="aeBrand" placeholder="e.g. Hexaxim"></div>
        <div><label>Batch</label><input id="aeBatch" placeholder="Batch no."></div>
        <div><label>Severity *</label><select id="aeSev"><option>Mild</option><option>Moderate</option><option>Severe</option><option>Serious</option></select></div>
        <div><label>Outcome</label><select id="aeOut"><option>Recovered</option><option>Recovering</option><option>Hospitalised</option><option>Referred</option><option>Death</option></select></div>
        <div><label>Reported to MO/DIO</label><select id="aeRep"><option>No</option><option>Yes</option></select></div>
        <div><label>Note</label><input id="aeNote" placeholder="e.g. Paracetamol given, review tomorrow"></div>
      </div>
      <div class="hint">Symptoms (tick all that apply)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${AEFI_SYMPTOMS.map((s) => `<label class="sib" style="font-size:12.5px"><input type="checkbox" class="aeSym" value="${esc(s)}"> ${esc(s)}</label>`).join("")}</div>
      <button class="btn btn-p btn-sm" onclick="saveAefi()">＋ Save event</button>
      <div class="hint" style="margin-top:8px">Minor (fever, local swelling) → reassure + document · Severe/serious → manage + report + follow up. Anaphylaxis: adrenaline IM 0.01 mg/kg — see 🚨 Emergency.</div>
    </div>
    <div class="card"><h3>📋 Events</h3>
      ${rows.length ? rows.map((e) => { const ser = aefiSerious(e); return `<div class="vac-row" style="${ser ? "border-left:4px solid var(--red)" : ""}"><div class="grow">
        ${ser ? "🚨" : e.severity === "Mild" ? "🟢" : "🟡"} <b>${fmtDate(e.date)}</b> · ${esc(e.vacLabel || e.code || "")}${e.brand ? ` (${esc(e.brand)})` : ""}
        <span class="badge ${ser ? "b-red" : "b-gray"}">${esc(e.severity || "")}</span><br>
        <span style="font-size:12.5px">${(e.symptoms || []).map(esc).join(", ")}</span><br>
        <span style="font-size:12px;color:var(--muted)">${e.batch ? "Batch " + esc(e.batch) + " · " : ""}Outcome: ${esc(e.outcome || "—")} · Reported: ${esc(e.reported || "No")}${e.note ? " · " + esc(e.note) : ""}</span></div>
        <button class="btn btn-danger btn-xs" onclick="delAefi('${e.id}')">✕</button></div>`; }).join("") : `<div style="font-size:13px;color:var(--muted)">No events recorded — good!</div>`}
    </div>
  </div>`;
}
function saveAefi() {
  const c = child(); if (!c) return;
  c.aefi = c.aefi || [];
  if (!$("aeDate").value) return alert("Event date required.");
  const syms = [...document.querySelectorAll(".aeSym:checked")].map((x) => x.value);
  const code = $("aeVac").value;
  const opt = aefiVaccineOptions().find((o) => o.code === code);
  c.aefi.push({ id: uid(), date: $("aeDate").value, code, vacLabel: opt ? opt.label : "Other", brand: $("aeBrand").value.trim(), batch: $("aeBatch").value.trim(), severity: $("aeSev").value, outcome: $("aeOut").value, reported: $("aeRep").value, note: $("aeNote").value.trim(), symptoms: syms });
  auditSafe("AEFI recorded", `${c.name} — ${$("aeSev").value}`);
  save(); renderAll();
}
function delAefi(id) {
  if (!needSafe(2, "delete AEFI entries")) return;
  const c = child();
  if (!confirm("Delete this AEFI entry?")) return;
  c.aefi = (c.aefi || []).filter((e) => e.id !== id);
  auditSafe("AEFI deleted", c.name);
  save(); renderAll();
}
function pullAefiFromNotes() {
  const c = child(); if (!c) return;
  c.aefi = c.aefi || [];
  let n = 0;
  Object.keys(c.vaccines || {}).forEach((code) => {
    const r = c.vaccines[code];
    if (r && r.aer && !c.aefi.some((e) => e.code === code && e.date === r.date)) {
      const opt = aefiVaccineOptions().find((o) => o.code === code);
      c.aefi.push({ id: uid(), date: r.date, code, vacLabel: opt ? opt.label : code, brand: r.brand || "", batch: r.batch || "", severity: "Mild", outcome: "Recovered", reported: "No", note: "From vaccine note: " + r.aer, symptoms: [] });
      n++;
    }
  });
  if (n) { auditSafe("AEFI pulled", `${n} from notes — ${c.name}`); save(); renderAll(); }
  else alert("No unlinked AEFI notes found in the vaccination record.");
}

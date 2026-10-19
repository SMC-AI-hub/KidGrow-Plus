/* =====================================================
   NeoKid Care — E-consent with signature (Round 4)
   Templates · canvas signature pad · print.
   ===================================================== */
const CONSENT_TYPES = {
  vaccination: { label: "Vaccination", text: "I, the parent/guardian of {child}, give consent for age-appropriate vaccination as advised by the doctor. The benefits, common side effects (fever, pain, swelling) and rare risks have been explained to me in a language I understand. I will stay back 30 minutes after vaccination and report any concern." },
  procedure: { label: "Procedure", text: "I, the parent/guardian of {child}, give consent for the procedure advised (details below) — including the need, benefits, risks and alternatives, explained in a language I understand. Procedure: ______. I can withdraw consent before the procedure starts." },
  sedation: { label: "Sedation / anaesthesia", text: "I, the parent/guardian of {child}, give consent for sedation/anaesthesia as advised for the planned procedure — including fasting instructions, monitoring, benefits and risks (including rare breathing/heart events), explained in a language I understand. Procedure: ______." },
  transfusion: { label: "Blood transfusion", text: "I, the parent/guardian of {child}, give consent for blood/blood-product transfusion as advised — including the need, benefits, risks (reaction, infection) and alternatives, explained in a language I understand. Indication: ______." },
  nicuproc: { label: "NICU procedure", text: "I, the parent/guardian of {child}, give consent for the NICU procedure advised (details below) — including the need, benefits, risks and alternatives, explained in a language I understand. Procedure: ______. I can withdraw consent before the procedure starts." },
  photo: { label: "Clinical photo / video", text: "I give consent for clinical photographs/videos of {child} to be taken for the medical record (and teaching, with identity hidden). I understand records are stored securely and shared only for care or referral." },
  referral: { label: "Referral & data sharing", text: "I, the parent/guardian of {child}, give consent for my child's health information (including reports and prescriptions) to be shared with the referred hospital/doctor for further care. Referred to: ______." },
  custom: { label: "Custom", text: "" },
};
let CONS_TYPE = "vaccination", CONS_TEXT = null, CONS_SIG = null;
function consentFill(type, childName) {
  return ((CONSENT_TYPES[type] || {}).text || "").replaceAll("{child}", childName || "the child");
}
function renderConsent() {
  if (!$("pg-consent")) return;
  const c = child();
  if (!c) { $("conBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  c.consents = c.consents || [];
  if (CONS_TEXT === null) CONS_TEXT = consentFill(CONS_TYPE, c.name);
  const rows = [...c.consents].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const guardian = c.mother || c.father || "";
  $("conBox").innerHTML = `
  <div class="grid g2">
    <div class="card"><h3>✍️ New consent</h3>
      <div class="form-grid">
        <div><label>Type</label><select id="conType" onchange="CONS_TYPE=this.value;CONS_TEXT=consentFill(CONS_TYPE,'${esc(c.name).replace(/'/g, "\\'")}');renderConsent()">
          ${Object.keys(CONSENT_TYPES).map((k) => `<option value="${k}"${CONS_TYPE === k ? " selected" : ""}>${CONSENT_TYPES[k].label}</option>`).join("")}</select></div>
        <div><label>Date</label><input type="date" id="conDate" value="${todayISO()}"></div>
        <div class="full"><label>Consent text (edit as needed)</label><textarea id="conText" rows="5" style="width:100%" oninput="CONS_TEXT=this.value">${esc(CONS_TEXT)}</textarea></div>
        <div><label>Guardian name</label><input id="conGuard" value="${esc(guardian)}"></div>
        <div><label>Relation</label><select id="conRel"><option>Mother</option><option>Father</option><option>Guardian</option></select></div>
        <div><label>Witness</label><input id="conWit" placeholder="Staff / attender"></div>
        <div><label>Taken by</label><input id="conBy" value="${esc(DB.settings.doctor || "")}"></div>
      </div>
      <div class="hint">Guardian signature (draw below with finger / mouse)</div>
      <canvas id="sigPad" width="600" height="170"></canvas>
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-o btn-sm" onclick="sigClear()">Clear</button>
        <button class="btn btn-p btn-sm" onclick="saveConsent()">💾 Save consent</button>
      </div>
    </div>
    <div class="card"><h3>📁 Saved consents</h3>
      ${rows.length ? rows.map((x) => `<div class="vac-row"><div class="grow"><b>${fmtDate(x.date)}</b> · ${esc((CONSENT_TYPES[x.type] || {}).label || x.type)}<br>
        <span style="font-size:12.5px;color:var(--muted)">${esc(x.guardian || "")} (${esc(x.relation || "")})${x.witness ? " · witness: " + esc(x.witness) : ""}</span><br>
        ${x.sig ? `<img src="${x.sig}" style="height:44px;border:1px solid #e2e8f0;border-radius:6px;background:#fff" alt="sig">` : `<span style="font-size:12px;color:var(--muted)">no e-signature (wet-sign printout)</span>`}</div>
        <button class="btn btn-o btn-xs" onclick="printConsent('${x.id}')">🖨️</button>
        <button class="btn btn-danger btn-xs" onclick="delConsent('${x.id}')">✕</button></div>`).join("")
      : `<div style="font-size:13px;color:var(--muted)">No consents yet.</div>`}
    </div>
  </div>`;
  sigInit();
}
function sigInit() {
  const cv = document.getElementById("sigPad");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  ctx.lineWidth = 2.5; ctx.lineCap = "round"; ctx.strokeStyle = "#0f172a";
  if (CONS_SIG) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0); img.src = CONS_SIG; }
  let drawing = false;
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
  cv.onpointerdown = (e) => { drawing = true; ctx.beginPath(); const [x, y] = pos(e); ctx.moveTo(x, y); cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = (e) => { if (!drawing) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
  cv.onpointerup = () => { drawing = false; CONS_SIG = cv.toDataURL("image/png"); };
}
function sigClear() {
  CONS_SIG = null;
  const cv = document.getElementById("sigPad");
  if (cv) cv.getContext("2d").clearRect(0, 0, cv.width, cv.height);
}
function saveConsent() {
  const c = child(); if (!c) return;
  c.consents = c.consents || [];
  const cv = document.getElementById("sigPad");
  if (cv && !CONS_SIG) {
    const blank = document.createElement("canvas"); blank.width = cv.width; blank.height = cv.height;
    if (cv.toDataURL() === blank.toDataURL() && !confirm("No signature drawn — save anyway (wet-sign the printout)?")) return;
    if (cv.toDataURL() !== blank.toDataURL()) CONS_SIG = cv.toDataURL("image/png");
  }
  c.consents.push({ id: uid(), date: document.getElementById("conDate").value || todayISO(), type: CONS_TYPE, text: document.getElementById("conText").value, guardian: document.getElementById("conGuard").value.trim(), relation: document.getElementById("conRel").value, witness: document.getElementById("conWit").value.trim(), by: document.getElementById("conBy").value.trim(), sig: CONS_SIG || "" });
  CONS_TEXT = null; CONS_SIG = null;
  auditSafe("Consent", `${c.name} — ${CONS_TYPE}`);
  save(); renderAll();
}
function delConsent(id) {
  if (!needSafe(2, "delete consents")) return;
  const c = child();
  if (!confirm("Delete this consent?")) return;
  c.consents = (c.consents || []).filter((x) => x.id !== id);
  auditSafe("Consent deleted", c.name);
  save(); renderAll();
}
function printConsent(id) {
  const c = child(); if (!c) return;
  const x = (c.consents || []).find((v) => v.id === id); if (!x) return;
  $("conPrint").innerHTML = `${clinicHeader()}
    <div style="text-align:center;font-weight:800;letter-spacing:1px;margin:6px 0">CONSENT FORM — ${(CONSENT_TYPES[x.type] || {}).label || x.type}</div>
    ${childHeader(c)}
    <div style="border:1px solid #cbd5e1;border-radius:10px;padding:14px;font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(x.text)}</div>
    <dl class="kv" style="margin-top:12px"><dt>Date</dt><dd>${fmtDate(x.date)}</dd><dt>Guardian</dt><dd>${esc(x.guardian || "—")} (${esc(x.relation || "—")})</dd><dt>Witness</dt><dd>${esc(x.witness || "—")}</dd><dt>Taken by</dt><dd>${esc(x.by || "—")}</dd></dl>
    <div style="display:flex;gap:40px;margin-top:20px;flex-wrap:wrap">
      <div style="text-align:center">${x.sig ? `<img src="${x.sig}" style="height:70px"><br>` : "<br><br>"}<div style="border-top:1px solid #333;padding-top:4px;font-size:13px">Guardian signature</div></div>
      <div style="text-align:center"><br><br><div style="border-top:1px solid #333;padding-top:4px;font-size:13px">Doctor / staff signature & seal</div></div>
    </div>`;
  printPage("pg-conprint");
}

/* =====================================================
   KidGrow Pro — Bedside aids (Round 1)
   Emergency drug/fluid ready-reckoner · digital vaccine
   card with QR · record-code import/export.
   ===================================================== */
const EMG = { wt: "", age: "" };
const CARD = { imp: "" };

/* ---------------- emergency doses (pure) ----------------
   wt: kg (>0). ageY: years (optional, for tube/cannula).
   Sources: AHA PALS / IAP ALS / standard formularies.
   ALWAYS verify against your protocol — screening aid. */
function emgRound(x, dp) {
  if (!isFinite(x)) return "—";
  return String(+Number(x).toFixed(dp === undefined ? 2 : dp));
}
function emergencyDoses(wt, ageY) {
  wt = Number(wt);
  if (!(wt > 0) || wt > 300) return null;
  const R = [];
  const cap = (x, mx) => Math.min(x, mx);
  R.push({ rx: "Adrenaline IM 1:1,000 (1 mg/mL) — anaphylaxis", dose: `${emgRound(cap(wt * 0.01, 0.5))} mg = ${emgRound(cap(wt * 0.01, 0.5))} mL IM`, note: "0.01 mg/kg (max 0.5 mg) · anterolateral thigh · repeat q5–15 min" });
  R.push({ rx: "Adrenaline IV/IO 1:10,000 (0.1 mg/mL) — arrest", dose: `${emgRound(cap(wt * 0.01, 1))} mg = ${emgRound(cap(wt * 0.01, 1) * 10)} mL IV/IO`, note: "0.01 mg/kg (max 1 mg) q3–5 min" });
  R.push({ rx: "Normal saline / Ringer bolus — shock", dose: `${emgRound(wt * 20, 0)} mL IV/IO`, note: "20 mL/kg · reassess, repeat if still shocked (caution in SAM/malnutrition, cardiac)" });
  const maint = wt <= 10 ? wt * 4 : wt <= 20 ? 40 + (wt - 10) * 2 : 60 + (wt - 20);
  R.push({ rx: "Maintenance fluids (Holliday–Segar 4-2-1)", dose: `${emgRound(maint, 0)} mL/hour`, note: "Isotonic for most; adjust for DKA/cardiac/renal" });
  R.push({ rx: "10% Dextrose — hypoglycaemia", dose: `${emgRound(wt * 5, 0)} mL IV (0.5 g/kg)`, note: "5 mL/kg · recheck glucose" });
  R.push({ rx: "Lorazepam IV — status epilepticus", dose: `${emgRound(cap(wt * 0.1, 4))} mg IV slow`, note: "0.1 mg/kg (max 4 mg) · may repeat ×1" });
  R.push({ rx: "Midazolam buccal / intranasal — seizure", dose: `${emgRound(cap(wt * 0.2, 10))} mg`, note: "0.2 mg/kg (max 10 mg)" });
  R.push({ rx: "Diazepam PR — seizure", dose: `${emgRound(cap(wt * 0.5, 10))} mg per rectum`, note: "0.5 mg/kg (max 10 mg)" });
  R.push({ rx: "Phenytoin IV loading — status (2nd line)", dose: `${emgRound(cap(wt * 20, 1000), 0)} mg IV slow in NS only`, note: "20 mg/kg (max 1 g) · ≤1 mg/kg/min · cardiac monitoring" });
  R.push({ rx: "Levetiracetam IV — status (2nd line)", dose: `${emgRound(cap(wt * 60, 4500), 0)} mg IV over 15 min`, note: "60 mg/kg (max 4.5 g)" });
  const para = wt * 15;
  R.push({ rx: "Paracetamol — fever / pain", dose: `${emgRound(para, 0)} mg/dose = ${emgRound(para / 120 * 5, 1)} mL of 120 mg/5 mL`, note: "15 mg/kg/dose q4–6h (max 4–5 doses/day)" });
  const ibu = wt * 10;
  R.push({ rx: "Ibuprofen — fever / pain (>3 mo)", dose: `${emgRound(ibu, 0)} mg/dose = ${emgRound(ibu / 100 * 5, 1)} mL of 100 mg/5 mL`, note: "10 mg/kg/dose q6–8h · avoid in dehydration/dengue" });
  R.push({ rx: "Ondansetron — vomiting", dose: `${emgRound(cap(wt * 0.15, 8))} mg`, note: "0.15 mg/kg (max 8 mg)" });
  R.push({ rx: "Amoxicillin — pneumonia/otitis (oral)", dose: `${emgRound(wt * 15, 0)} mg/dose TDS (${emgRound(wt * 45, 0)} mg/kg/day)`, note: "15 mg/kg/dose 8-hourly" });
  R.push({ rx: "Hydrocortisone IV — asthma / anaphylaxis adjunct", dose: `${emgRound(cap(wt * 5, 200), 0)} mg IV`, note: "5 mg/kg (max 200 mg)" });
  R.push({ rx: "Salbutamol nebulisation — wheeze", dose: wt < 20 ? "2.5 mg in 3 mL NS" : "5 mg in 3 mL NS", note: "Repeat q20 min ×3 in attack; MDI+spacer 4–10 puffs equivalent" });
  R.push({ rx: "Cetirizine — allergy (oral)", dose: `${emgRound(cap(wt * 0.25, 10), 1)} mg OD`, note: "0.25 mg/kg once daily (max 10 mg)" });
  R.push({ rx: "ORS — some dehydration (Plan B)", dose: `${emgRound(wt * 75, 0)} mL over 4 hours`, note: "≈75 mL/kg · plus 10 mL/kg per loose stool" });
  R.push({ rx: "Defibrillation (shockable arrest)", dose: `${emgRound(wt * 2, 0)} J → ${emgRound(wt * 4, 0)} J`, note: "2 J/kg first, then 4 J/kg (max 10 J/kg / adult)" });
  R.push({ rx: "Synchronised cardioversion", dose: `${emgRound(wt * 0.5, 1)}–${emgRound(wt * 1, 1)} J`, note: "0.5–1 J/kg · sedate if conscious" });
  let tube = null, cann = null;
  if (isFinite(ageY) && ageY !== "" && ageY !== null) {
    const a = Number(ageY);
    if (a >= 0 && a < 14) {
      const unc = a / 4 + 4, cuf = a / 4 + 3.5;
      tube = `Uncuffed ${emgRound(unc, 1)} mm · Cuffed ${emgRound(cuf, 1)} mm · depth ≈ ${emgRound(unc * 3, 0)} cm at lips`;
    } else if (a >= 14) tube = "Adult: 7.0–7.5 mm cuffed · depth ≈ 21–23 cm";
    cann = a < 1 ? "24 G (yellow)" : a < 6 ? "22 G (blue)" : a < 12 ? "20–22 G (pink/blue)" : "18–20 G (green/pink)";
    R.push({ rx: "Endotracheal tube (oral)", dose: tube, note: "Cuffed preferred beyond infancy · confirm with capnography" });
    R.push({ rx: "IV cannula", dose: cann, note: "Intraosseous if access fails in emergency" });
  }
  R.push({ rx: "CPR (infant/child)", dose: "100–120/min · depth ≈ ⅓ chest (≈4–5 cm)", note: "15:2 with 2 rescuers · allow full recoil · minimise interruptions" });
  return { rows: R, wt, ageY: ageY === "" ? null : Number(ageY) };
}
function emgChip(w) { EMG.wt = String(w); renderEmergency(); }
function renderEmergency() {
  if (!$("pg-emg")) return;
  const c = (typeof child === "function") ? child() : null;
  if (!EMG.wt && c) {
    try {
      const lm = latestMeasure(c);
      if (lm && lm.wt) EMG.wt = lm.wt;
      const a = ageBetween(c.dob);
      EMG.age = +(a.days / 365.25).toFixed(1);
    } catch (e) {}
  }
  $("emgBox").innerHTML = `
    <div class="toolbar" style="margin-bottom:10px">
      <div><label style="font-size:12px">Weight (kg)</label><input id="emgWt" type="number" step="0.1" min="1" max="300" value="${EMG.wt}" placeholder="e.g. 12" style="max-width:120px" oninput="EMG.wt=this.value;renderEmgDoses()"></div>
      <div><label style="font-size:12px">Age (years)</label><input id="emgAge" type="number" step="0.5" min="0" max="18" value="${EMG.age}" placeholder="e.g. 3" style="max-width:120px" oninput="EMG.age=this.value;renderEmgDoses()"></div>
      ${c ? `<button class="btn btn-o btn-sm" onclick="fillEmgFromChild()">⚖️ Use ${esc(c.name)}'s data</button>` : ""}
      <span class="sp"></span><button class="btn btn-o btn-sm" onclick="printPage('pg-emg')">🖨️ Print card</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center"><span style="font-size:12.5px;color:var(--muted);font-weight:700">QUICK WT:</span>
      ${[3, 5, 8, 10, 12, 15, 20, 25, 30, 40].map((w) => `<button class="btn ${String(EMG.wt) === String(w) ? "btn-p" : "btn-o"} btn-xs" onclick="emgChip(${w})">${w} kg</button>`).join("")}</div>
    <div id="emgDoses"></div>
    <div class="alert a-amber" style="margin-top:12px">⚠️ <div><b>Screening aid only.</b> Verify every dose against your hospital protocol / formulary before administering. Not a substitute for PALS/APLS training.</div></div>`;
  renderEmgDoses();
}
function fillEmgFromChild() {
  const c = child(); if (!c) return;
  const lm = latestMeasure(c);
  if (lm && lm.wt) EMG.wt = lm.wt;
  const a = ageBetween(c.dob);
  EMG.age = +(a.years + a.months % 12 / 12).toFixed(1);
  renderEmergency();
}
function renderEmgDoses() {
  const box = $("emgDoses"); if (!box) return;
  const d = emergencyDoses(EMG.wt, EMG.age);
  if (!d) { box.innerHTML = `<div class="alert a-amber" style="margin:0">⚖️ <div>Enter a weight to compute doses.</div></div>`; return; }
  box.innerHTML = `<div class="hint">For <b>${d.wt} kg</b>${d.ageY !== null ? ` · age ${d.ageY} y` : ""} — doses capped at adult maximums.</div>
    <table class="tbl"><tr><th>Drug / intervention</th><th>Dose for this child</th><th>Notes</th></tr>
    ${d.rows.map((r) => `<tr><td><b>${esc(r.rx)}</b></td><td style="white-space:normal"><b>${esc(r.dose)}</b></td><td style="font-size:12.5px;color:var(--muted)">${esc(r.note)}</td></tr>`).join("")}</table>`;
}

/* ---------------- vaccine-card record codec (pure) ----------------
   Compact pipe format. Fits a QR; also pasteable as text. */
const RC_SEP = "|", RC_SUB = "~";
function rcClean(s) { return String(s ?? "").replace(/[|~\n\r]/g, " ").trim().slice(0, 80); }
function encodeRecord(c) {
  c = c || {};
  const v = Object.keys(c.vaccines || {}).sort().map((k) => {
    const r = c.vaccines[k] || {};
    return k + RC_SUB + (r.date || "") + RC_SUB + rcClean(r.brand || "");
  }).join(",");
  const x = (c.extraVac || []).map((e) => rcClean(e.name) + RC_SUB + (e.date || "") + RC_SUB + rcClean(e.brand || "")).join(";");
  return ["KG1", rcClean(c.name), c.dob || "", c.sex || "", rcClean(c.phone || ""),
    rcClean(((c.mother || "") + (c.mother && c.father ? " & " : "") + (c.father || ""))), v, x || ""].join(RC_SEP);
}
function decodeRecord(str) {
  const p = String(str || "").trim().split(RC_SEP);
  if (p[0] !== "KG1" || p.length < 7) return null;
  const c = { name: p[1] || "Imported child", dob: p[2] || "", sex: p[3] === "girl" ? "girl" : "boy", phone: p[4] || "", mother: p[5] || "", vaccines: {}, extraVac: [] };
  (p[6] || "").split(",").filter(Boolean).forEach((t) => {
    const parts = t.split(RC_SUB), code = parts[0];
    if (!code) return;
    c.vaccines[code] = { date: parts[1] || "", brand: parts[2] || "", mfr: "", batch: "", site: "", by: "", aer: "", note: "Imported record" };
  });
  (p[7] || "").split(";").filter(Boolean).forEach((t, i) => {
    const parts = (t || "").split(RC_SUB);
    c.extraVac.push({ id: "imp" + Date.now().toString(36) + i, name: parts[0] || "Vaccine", date: parts[1] || "", brand: parts[2] || "", mfr: "", batch: "", by: "", note: "Imported record" });
  });
  return c;
}
/* QR with auto size: ECC-M first, then ECC-L fallback */
function qrSVG(text) {
  if (typeof qrcode === "undefined") return `<div class="alert a-amber" style="margin:0">QR library not loaded.</div>`;
  const lv = [["M", 4], ["L", 10]];
  for (const [ecl, from] of lv) {
    for (let t = from; t <= 40; t++) {
      try { const qr = qrcode(t, ecl); qr.addData(text); qr.make(); return qr.createSvgTag(4, 2); }
      catch (e) { /* try bigger */ }
    }
  }
  return `<div class="alert a-red" style="margin:0">Record too long for QR — use Copy / Download instead.</div>`;
}
function renderCard() {
  if (!$("pg-card")) return;
  const c = child();
  if (!c) { $("cardBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  const code = encodeRecord(c);
  // Clustered by visit, age-relevant only: given visits + next due visit in full,
  // later visits collapsed to one line (no long future document).
  const vStat = VACCINE_SCHEDULE.map((v) => {
    const done = v.vaccines.filter((vx) => c.vaccines[vx.code]).length;
    return { v, done, total: v.vaccines.length };
  });
  const firstPending = vStat.findIndex((s) => s.done < s.total);
  const showThru = firstPending < 0 ? vStat.length : firstPending + 1;
  const vRow = (vx) => {
    const r = c.vaccines[vx.code];
    return `<tr><td><b>${esc(vx.name)}</b> ${esc(vx.dose)}</td><td>${r ? `<b>${fmtDate(r.date)}</b>${r.brand ? `<br><span style="font-size:11px;color:var(--muted)">${esc(r.brand)}</span>` : ""}` : "—"}</td><td>${r ? "✓" : "○"}</td></tr>`;
  };
  const given = vStat.slice(0, showThru).map(({ v, done, total }) => {
    const st = done === total ? "✅ Complete" : `⏰ Due ${esc(fmtDate(dueDateFor(c, v)))}${done ? ` · ${done}/${total} given` : ""}`;
    return `<tr style="background:#f1f5f9"><td colspan="3"><b>${esc(v.label)}</b> <span style="color:var(--muted)">(${esc(v.sub || "")})</span> — <b>${st}</b></td></tr>` + v.vaccines.map(vRow).join("");
  }).join("");
  const laterDoses = vStat.slice(showThru).reduce((a, s) => a + s.total, 0);
  const laterLine = laterDoses ? `<tr style="background:#f8fafc"><td colspan="3" style="color:var(--muted)">Further visits (${esc(vStat[showThru].v.label)} → ${esc(vStat[vStat.length - 1].v.label)}): ${laterDoses} dose(s) to be scheduled — full list in the app.</td></tr>` : "";
  const ex = (c.extraVac || []).length ? `<tr style="background:#f1f5f9"><td colspan="3"><b>Additional vaccines</b></td></tr>` + (c.extraVac || []).map((x) => `<tr><td><b>${esc(x.name)}</b>${x.brand ? `<br><span style="font-size:11px;color:var(--muted)">${esc(x.brand)}</span>` : ""}</td><td>${x.date ? fmtDate(x.date) : "—"}</td><td>✓</td></tr>`).join("") : "";
  $("cardBox").innerHTML = `
    <div class="toolbar no-print" style="margin-bottom:12px">
      <span style="font-size:13px;color:var(--muted)">Record code: <b>${code.length}</b> chars · QR ${code.length < 1800 ? "fits easily" : "fits (dense)"}</span>
      <span class="sp"></span>
      <button class="btn btn-o btn-sm" onclick="printPage('pg-card')">🖨️ Print card</button>
      <button class="btn btn-o btn-sm" onclick="copyRecordCode()">⧉ Copy record code</button>
      <button class="btn btn-o btn-sm" onclick="downloadRecord()">⬇ Download .json</button>
      <button class="btn btn-p btn-sm" onclick="downloadParentCard()">📱 Parent file (.html)</button>
      <button class="btn btn-o btn-sm" onclick="copyParentSummary()">⧉ Parent summary</button>
    </div>
    <div class="vaxcard">
      <div class="vax-head">
        ${(DB.settings.logo || "") ? `<img src="${DB.settings.logo}" alt="Hospital logo">` : ""}
        <div style="min-width:0">
          <div class="eyebrow">DIGITAL IMMUNISATION CARD</div>
          <h2>${esc(DB.settings.clinic || "KidGrow Pro Clinic")}</h2>
          <div class="sub">${esc(DB.settings.doctor || "")}${DB.settings.addr ? ` · ${esc(DB.settings.addr)}` : ""}${DB.settings.reg ? ` · Reg: ${esc(DB.settings.reg)}` : ""}</div>
        </div>
        ${(typeof parentVerifyCode === "function") ? `<div class="vax-verify">Verify code<br><b>${esc(parentVerifyCode(c))}</b></div>` : ""}
      </div>
      <div class="vax-body">
        <dl class="kv">
          <dt>Child</dt><dd><b>${esc(c.name)}</b> · ${c.sex === "boy" ? "Boy" : "Girl"}</dd>
          <dt>Born</dt><dd>${fmtDate(c.dob)} (${esc(ageStr(ageBetween(c.dob)))})${c.birthWt ? ` · Birth wt ${c.birthWt} kg` : ""}</dd>
          <dt>Parent</dt><dd>${esc([c.mother, c.father].filter(Boolean).join(" & ") || "—")}${c.phone ? ` · ☎ ${esc(c.phone)}` : ""}</dd>
          <dt>Blood</dt><dd>${esc(c.blood || "—")}${c.allergy ? ` · ⚠️ ${esc(c.allergy)}` : ""}</dd>
        </dl>
        <div class="qrbox" style="text-align:center">${qrSVG(code)}<div style="font-size:11px;color:var(--muted);margin-top:4px">Scan at any KidGrow clinic<br>to verify / import this record</div></div>
      </div>
      <table class="tbl" style="margin-top:10px"><tr><th>Vaccine</th><th>Given</th><th>✓</th></tr>${given}${laterLine}${ex}</table>
      <div class="vax-sign"><div>Doctor signature &amp; seal: ______________</div><div style="margin-left:auto">Date: ${fmtDate(todayISO())}</div></div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:6px;text-align:center">${VAX_SCHEDULE_VERSION} schedule · ${esc(DB.settings.doctor || "")} · Generated ${fmtDate(todayISO())} · Computer-assisted record — confirm before filing.</div>
    </div>
    <div style="height:16px"></div>
    <div class="card no-print"><h3>📥 Import a record</h3>
      <div class="hint">Paste a record code (from another device's card / QR scan) or a full child .json backup, then Import. Matching name + DOB merges missing doses; otherwise a new child is created.</div>
      <textarea id="impText" rows="3" style="width:100%;font-family:monospace;font-size:12px" placeholder="KG1|Name|dob|..." oninput="CARD.imp=this.value">${esc(CARD.imp)}</textarea>
      <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-p btn-sm" onclick="importRecordText()">📥 Import pasted record</button>
        <button class="btn btn-o btn-sm" onclick="document.getElementById('impFile').click()">⬆ Choose .json file</button>
        <input type="file" id="impFile" accept=".json,.txt" style="display:none" onchange="importRecordFile(event)">
      </div><div id="impMsg" style="margin-top:8px;font-size:13px"></div>
    </div>`;
}
function copyRecordCode() {
  const c = child(); if (!c) return;
  const code = encodeRecord(c);
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(() => alert("Record code copied."), () => window.prompt("Copy record code:", code));
  else window.prompt("Copy record code:", code);
}
function downloadRecord() {
  const c = child(); if (!c) return;
  const blob = new Blob([JSON.stringify(c, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${c.name.replace(/[^\w]+/g, "_")}_vaccine_record.json`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function mergeImported(inc) {
  if (!inc || !inc.name) { $("impMsg").innerHTML = `<span style="color:var(--red)">❌ Could not read that record.</span>`; return; }
  const same = DB.children.find((c) => c.name.trim().toLowerCase() === String(inc.name).trim().toLowerCase() && (c.dob || "") === (inc.dob || ""));
  if (same) {
    let added = 0;
    Object.keys(inc.vaccines || {}).forEach((k) => { if (!same.vaccines[k] && (inc.vaccines[k].date || inc.vaccines[k].brand)) { same.vaccines[k] = inc.vaccines[k]; added++; } });
    (inc.extraVac || []).forEach((x) => { same.extraVac = same.extraVac || []; if (!same.extraVac.some((e) => e.name === x.name && e.date === x.date)) { x.id = uid(); same.extraVac.push(x); added++; } });
    if (inc.phone && !same.phone) same.phone = inc.phone;
    DB.activeId = same.id; save(); renderAll();
    $("impMsg").innerHTML = `<span style="color:var(--green)">✅ Merged into <b>${esc(same.name)}</b> — ${added} dose(s) added.</span>`;
  } else {
    inc.id = uid();
    inc.measures = inc.measures || []; inc.visits = inc.visits || []; inc.milestones = inc.milestones || {};
    inc.extraVac = inc.extraVac || [];
    DB.children.push(inc); DB.activeId = inc.id; save(); renderAll();
    $("impMsg").innerHTML = `<span style="color:var(--green)">✅ New child <b>${esc(inc.name)}</b> created with ${Object.keys(inc.vaccines || {}).length} dose(s).</span>`;
  }
  CARD.imp = ""; const t = $("impText"); if (t) t.value = "";
}
function importRecordText() {
  const raw = ($("impText").value || "").trim();
  if (!raw) return;
  let inc = decodeRecord(raw);
  if (!inc) { try { const j = JSON.parse(raw); inc = j && j.vaccines ? j : null; } catch (e) { inc = null; } }
  mergeImported(inc);
}
function importRecordFile(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const txt = String(r.result || "").trim();
      mergeImported(decodeRecord(txt) || (JSON.parse(txt).vaccines ? JSON.parse(txt) : null));
    } catch (e) { $("impMsg").innerHTML = `<span style="color:var(--red)">❌ Could not read that file.</span>`; }
    ev.target.value = "";
  };
  r.readAsText(f);
}

/* =====================================================
   KidGrow Pro — Anaemia & micronutrient tracker (Round 3)
   WHO/IAP Hb cutoffs · ferritin · B12 · Vitamin D.
   ===================================================== */
function hbClass(ageM, hb) {
  if (!(hb > 0)) return null;
  if (ageM < 6) return { label: "No WHO cutoff <6 mo — interpret with retic + clinical", sev: "amber", band: "infant" };
  let cut, mild0, mod0;
  if (ageM < 60) { cut = 11; mild0 = 10; mod0 = 7; }
  else if (ageM < 132) { cut = 11.5; mild0 = 11; mod0 = 8; }
  else { cut = 12; mild0 = 11; mod0 = 8; }
  if (hb >= cut) return { label: "Normal", sev: "green", band: "normal" };
  if (hb >= mild0) return { label: "Mild anaemia", sev: "amber", band: "mild" };
  if (hb >= mod0) return { label: "Moderate anaemia", sev: "amber", band: "moderate" };
  return { label: "Severe anaemia", sev: "red", band: "severe" };
}
function hbProtocol(band) {
  return {
    severe: "URGENT: confirm sample, vitals + perfusion, type & crossmatch readiness, refer/admit — do not delay. Work up cause (bleed, hemolysis, marrow).",
    moderate: "Iron 3–6 mg/kg/day + Vit C + deworm (albendazole) + diet counselling. Recheck Hb in 4 weeks — expect +1 g/dL.",
    mild: "Iron + diet (ragi, greens, jaggery, meat/egg if taken) + deworm. Recheck in 4–8 weeks.",
    normal: "Continue age-appropriate iron prophylaxis + diverse diet.",
    infant: "Check retic, bilirubin, feeds & blood loss; discuss with paediatrician.",
  }[band] || "";
}
function ferritinFlag(ageM, f, crp) {
  if (!(f > 0)) return null;
  if (crp && crp > 5) return { label: `Ferritin ${f} with CRP ${crp} — inflammation, interpret cautiously`, sev: "amber" };
  const cut = ageM < 60 ? 12 : 15;
  if (f < cut) return { label: `Depleted iron stores (<${cut})`, sev: "amber" };
  return { label: "Adequate stores", sev: "green" };
}
function vitDFlag(v) {
  if (!(v > 0)) return null;
  if (v < 12) return { label: "Deficient (<12 ng/mL)", sev: "red" };
  if (v < 20) return { label: "Insufficient (12–20)", sev: "amber" };
  if (v <= 100) return { label: "Sufficient (20–100)", sev: "green" };
  return { label: "Excess (>100) — stop supplements", sev: "amber" };
}
function b12Flag(b) {
  if (!(b > 0)) return null;
  if (b < 200) return { label: "Deficient (<200 pg/mL)", sev: "red" };
  if (b <= 300) return { label: "Borderline (200–300)", sev: "amber" };
  return { label: "Normal", sev: "green" };
}
/* ---------------- page ---------------- */
function renderLabs() {
  if (!$("pg-labs")) return;
  const c = child();
  if (!c) { $("labsBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  c.labs = c.labs || [];
  const ageM = ageBetween(c.dob).years * 12 + ageBetween(c.dob).months;
  const rows = [...c.labs].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const latest = rows[rows.length - 1];
  const hb = latest ? hbClass(ageM, +latest.hb) : null;
  const sevBadge = (s) => s === "red" ? "🔴" : s === "amber" ? "🟡" : "🟢";
  const mx = Math.max(1, ...rows.map((r) => +r.hb || 0));
  $("labsBox").innerHTML = `
  <div class="toolbar"><span style="font-size:13px;color:var(--muted)">WHO/IAP cutoffs · age ${ageM} mo</span>
    <span class="sp"></span><button class="btn btn-o btn-sm" onclick="printPage('pg-labs')">🖨️ Print</button></div>
  ${latest && hb && hb.band === "severe" ? `<div class="alert a-red">🚨 <div><b>Severe anaemia (Hb ${esc(String(latest.hb))}).</b> ${esc(hbProtocol("severe"))}</div></div>` : ""}
  <div class="grid g2">
    <div class="card"><h3>🧪 Add lab report</h3>
      <div class="form-grid">
        <div><label>Date *</label><input type="date" id="lbDate" value="${todayISO()}"></div>
        <div><label>Hb (g/dL)</label><input type="number" step="0.1" id="lbHb" placeholder="e.g. 10.2"></div>
        <div><label>MCV (fL)</label><input type="number" step="0.1" id="lbMcv" placeholder="e.g. 72"></div>
        <div><label>Ferritin (ng/mL)</label><input type="number" step="0.1" id="lbFer" placeholder="e.g. 9"></div>
        <div><label>CRP (mg/L)</label><input type="number" step="0.1" id="lbCrp" placeholder="if done"></div>
        <div><label>B12 (pg/mL)</label><input type="number" step="1" id="lbB12" placeholder="if done"></div>
        <div><label>Vit D (ng/mL)</label><input type="number" step="0.1" id="lbVitD" placeholder="if done"></div>
        <div><label>Note</label><input id="lbNote" placeholder="e.g. Post-URI, on iron"></div>
      </div>
      <button class="btn btn-p btn-sm" onclick="saveLab()" style="margin-top:8px">＋ Save report</button>
      <h3 style="margin-top:14px">📈 Hb trend</h3>
      ${rows.filter((r) => +r.hb > 0).length ? `<div style="display:flex;gap:8px;align-items:flex-end;height:110px;margin-top:6px">${rows.filter((r) => +r.hb > 0).slice(-8).map((r) => {
        const cl = hbClass(ageM, +r.hb);
        return `<div style="flex:1;text-align:center"><div style="font-size:12px;font-weight:800">${r.hb}</div>
        <div style="background:${cl.sev === "green" ? "var(--green)" : cl.sev === "red" ? "var(--red)" : "var(--amber)"};border-radius:6px 6px 0 0;height:${Math.round((+r.hb / 15) * 70)}px;min-height:6px"></div>
        <div style="font-size:10px;color:var(--muted)">${esc((r.date || "").slice(5))}</div></div>`; }).join("")}</div>` : `<div style="font-size:13px;color:var(--muted)">No Hb values yet.</div>`}
    </div>
    <div class="card"><h3>📋 Latest interpretation</h3>
      ${latest ? (() => {
        const f = ferritinFlag(ageM, +latest.ferritin, +latest.crp), vd = vitDFlag(+latest.vitD), b12 = b12Flag(+latest.b12);
        return `<dl class="kv">
          <dt>Report</dt><dd>${fmtDate(latest.date)}</dd>
          <dt>Hb ${esc(String(latest.hb || "—"))}</dt><dd>${hb ? `${sevBadge(hb.sev)} ${esc(hb.label)}` : "—"}</dd>
          ${latest.mcv ? `<dt>MCV ${esc(String(latest.mcv))}</dt><dd>${+latest.mcv < 70 ? "Microcytic — iron deficiency / thalassemia trait?" : +latest.mcv > 100 ? "Macrocytic — B12/folate?" : "Normocytic"}</dd>` : ""}
          ${latest.ferritin ? `<dt>Ferritin ${esc(String(latest.ferritin))}</dt><dd>${sevBadge(f.sev)} ${esc(f.label)}</dd>` : ""}
          ${latest.b12 ? `<dt>B12 ${esc(String(latest.b12))}</dt><dd>${sevBadge(b12.sev)} ${esc(b12.label)}</dd>` : ""}
          ${latest.vitD ? `<dt>Vit D ${esc(String(latest.vitD))}</dt><dd>${sevBadge(vd.sev)} ${esc(vd.label)}</dd>` : ""}
        </dl>
        ${hb ? `<div class="alert ${hb.sev === "green" ? "a-green" : hb.sev === "red" ? "a-red" : "a-amber"}" style="margin-top:10px">📋 <div><b>Protocol:</b> ${esc(hbProtocol(hb.band))}</div></div>` : ""}
        ${hb && hb.band !== "normal" && hb.band !== "infant" ? `<button class="btn btn-p btn-sm" onclick="ironToRx()">💊 Send iron to prescription →</button>` : ""}`;
      })() : `<div class="empty">No reports yet.</div>`}
      <h3 style="margin-top:14px">🗂️ History</h3>
      ${rows.length ? [...rows].reverse().map((r) => {
        const cl = hbClass(ageM, +r.hb);
        return `<div class="vac-row"><div class="grow"><b>${fmtDate(r.date)}</b> · Hb ${esc(String(r.hb || "—"))} ${cl ? sevBadge(cl.sev) + " " + esc(cl.label) : ""}
        <br><span style="font-size:12px;color:var(--muted)">${[r.ferritin ? "Ferr " + r.ferritin : "", r.b12 ? "B12 " + r.b12 : "", r.vitD ? "D " + r.vitD : "", r.note ? esc(r.note) : ""].filter(Boolean).join(" · ")}</span></div>
        <button class="btn btn-danger btn-xs" onclick="delLab('${r.id}')">✕</button></div>`; }).join("") : `<div style="font-size:13px;color:var(--muted)">—</div>`}
    </div>
  </div>`;
}
function saveLab() {
  const c = child(); if (!c) return;
  c.labs = c.labs || [];
  if (!$("lbDate").value) return alert("Date required.");
  c.labs.push({ id: uid(), date: $("lbDate").value, hb: $("lbHb").value, mcv: $("lbMcv").value, ferritin: $("lbFer").value, crp: $("lbCrp").value, b12: $("lbB12").value, vitD: $("lbVitD").value, note: $("lbNote").value.trim() });
  auditSafe("Lab report", `${c.name} — Hb ${$("lbHb").value || "—"}`);
  save(); renderAll();
}
function delLab(id) {
  if (!needSafe(2, "delete lab reports")) return;
  const c = child();
  if (!confirm("Delete this lab report?")) return;
  c.labs = (c.labs || []).filter((r) => r.id !== id);
  auditSafe("Lab deleted", c.name);
  save(); renderAll();
}
function ironToRx() {
  try {
    RXB.drugId = "iron"; RXB.stIdx = 0; RXB.freq = "BD";
    const c = child();
    RXB.wt = c ? rxChildWt(c) : "";
  } catch (e) {}
  go("rx");
}

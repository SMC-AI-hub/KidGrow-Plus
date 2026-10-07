/* =====================================================
   KidGrow Pro — Newborn module (Round 3)
   Delivery record · APGAR · New Ballard Score ·
   screening checklist · birth register.
   ===================================================== */
const APGAR_ITEMS = [
  { k: "A", name: "Appearance", opts: ["Blue / pale", "Body pink, limbs blue", "All pink"] },
  { k: "P", name: "Pulse", opts: ["Absent", "<100 /min", "≥100 /min"] },
  { k: "G", name: "Grimace", opts: ["No response", "Grimace", "Cough / sneeze / cry"] },
  { k: "Ac", name: "Activity", opts: ["Limp", "Some flexion", "Active movement"] },
  { k: "R", name: "Respiration", opts: ["Absent", "Weak / irregular", "Strong cry"] },
];
function apgarTotal(sc) {
  sc = sc || [];
  if (sc.some((x) => x === "" || x === null || x === undefined)) return { total: null, interp: "Incomplete" };
  const t = sc.reduce((s, x) => s + (+x || 0), 0);
  return { total: t, interp: t >= 7 ? "Reassuring (7–10)" : t >= 4 ? "Moderately depressed (4–6)" : "Severely depressed (0–3)" };
}
const BALLARD_ITEMS = [
  { k: "posture", name: "Posture", min: 0, max: 4, guide: "0 extended → 4 fully flexed" },
  { k: "square", name: "Square window", min: -1, max: 4, guide: "90° → 0°" },
  { k: "arm", name: "Arm recoil", min: 0, max: 4, guide: "stays 180° → recoils <90°, brisk" },
  { k: "pop", name: "Popliteal angle", min: -1, max: 5, guide: "180° → <90°" },
  { k: "scarf", name: "Scarf sign", min: -1, max: 4, guide: "elbow far past midline → will not reach" },
  { k: "heel", name: "Heel to ear", min: -1, max: 4, guide: "reaches ear easily → high resistance" },
  { k: "skin", name: "Skin", min: -1, max: 5, guide: "sticky, fragile → leathery, cracked, wrinkled" },
  { k: "lanugo", name: "Lanugo", min: -1, max: 4, guide: "none → abundant → mostly bald" },
  { k: "plantar", name: "Plantar creases", min: -1, max: 4, guide: "none (40–50 mm) → over entire sole" },
  { k: "breast", name: "Breast", min: -1, max: 4, guide: "imperceptible → full areola, 5–10 mm bud" },
  { k: "eyeear", name: "Eye / ear", min: -1, max: 4, guide: "lids fused → thick cartilage, stiff" },
  { k: "genital", name: "Genitals", min: -1, max: 4, guide: "flat, smooth → full rugae / majora cover" },
];
/* NBS −10…50 ≈ 20…44 wk: GA = 24 + 0.4 × score */
function ballardGA(scores) {
  scores = scores || {};
  const vals = BALLARD_ITEMS.map((i) => scores[i.k]);
  const complete = vals.every((v) => v !== "" && v !== null && v !== undefined);
  const total = vals.reduce((s, v) => s + (+v || 0), 0);
  const weeks = 24 + total * 0.4;
  const w = Math.floor(weeks), d = Math.round((weeks - w) * 7);
  return { total, complete, weeks, label: `${w}w ${d}d` };
}
/* Screening flags (pure) */
function nbScreenFlags(dob, gestWk, bw, scr, today) {
  scr = scr || {};
  const out = [];
  const ageD = Math.round((new Date(today + "T00:00:00") - new Date(dob + "T00:00:00")) / 86400000);
  const ropRisk = (gestWk && gestWk < 35) || (bw && bw < 2.0);
  if (ropRisk && !(scr.rop && scr.rop.date)) {
    out.push(ageD > 28
      ? { sev: "red", text: "ROP screening OVERDUE — first exam by 4 weeks of age." }
      : { sev: "amber", text: "ROP screening due by 4 weeks of age (preterm / <2 kg)." });
  }
  if (!(scr.tsh && scr.tsh.date) && ageD > 7) out.push({ sev: "amber", text: "TSH (day 3–5 heel-prick) not recorded." });
  if (!(scr.hear && (scr.hear.res === "Normal" || scr.hear.res === "Abnormal")) && ageD > 30) out.push({ sev: "amber", text: "Hearing screen (OAE/BERA) not recorded." });
  if (!(scr.ox && scr.ox.date) && ageD > 2 && ageD < 60) out.push({ sev: "amber", text: "Pulse-oximetry CCHD screen not recorded." });
  return out;
}
function nbOf(c) {
  c.nb = c.nb || {};
  c.nb.apgar = c.nb.apgar || {};
  c.nb.ballard = c.nb.ballard || {};
  c.nb.screen = c.nb.screen || {};
  return c.nb;
}
/* write-through setters (no full re-render; totals updated in place) */
function nbSet(k, v) { const c = child(); if (!c) return; nbOf(c)[k] = v; save(); }
function nbSetApgar(tp, idx, v) {
  const c = child(); if (!c) return;
  const nb = nbOf(c);
  nb.apgar[tp] = nb.apgar[tp] || ["", "", "", "", ""];
  nb.apgar[tp][idx] = v; save();
  const r = apgarTotal(nb.apgar[tp]);
  const el = document.getElementById("apgarT" + tp);
  if (el) el.innerHTML = r.total === null ? "—" : `<b>${r.total}</b> <span style="font-size:12px">${esc(r.interp)}</span>`;
}
function nbSetBallard(k, v) {
  const c = child(); if (!c) return;
  nbOf(c).ballard[k] = v; save(); renderNB();
}
function nbSetScreen(k, f, v) {
  const c = child(); if (!c) return;
  const nb = nbOf(c);
  nb.screen[k] = nb.screen[k] || {};
  nb.screen[k][f] = v; save(); renderNB();
}
/* ---------------- page ---------------- */
function renderNB() {
  if (!$("pg-nb")) return;
  const c = child();
  if (!c) { $("nbBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  const nb = nbOf(c);
  const tps = [["t1", "1 min"], ["t5", "5 min"], ["t10", "10 min"]];
  const b = ballardGA(nb.ballard);
  const gestWk = parseFloat(c.gest) || null;
  const agree = (gestWk && b.complete) ? Math.abs(b.weeks - gestWk) : null;
  const flags = nbScreenFlags(c.dob, gestWk, parseFloat(c.birthWt) || null, nb.screen, todayISO());
  const scrRow = (k, label, hint) => {
    const s = nb.screen[k] || {};
    return `<tr><td><b>${label}</b><br><span style="font-size:11.5px;color:var(--muted)">${hint}</span></td>
      <td><input type="date" value="${s.date || ""}" onchange="nbSetScreen('${k}','date',this.value)" style="max-width:150px"></td>
      <td><select onchange="nbSetScreen('${k}','res',this.value)" style="max-width:140px">
        ${["Pending", "Normal", "Abnormal", "Referred"].map((o) => `<option${(s.res || "Pending") === o ? " selected" : ""}>${o}</option>`).join("")}</select></td></tr>`;
  };
  $("nbBox").innerHTML = `
  <div class="toolbar"><span style="font-size:13px;color:var(--muted)">Birth record for <b>${esc(c.name)}</b> · born ${fmtDate(c.dob)}${c.birthWt ? ` · ${c.birthWt} kg` : ""}${c.gest ? ` · ${c.gest} wk` : ""}</span>
    <span class="sp"></span><button class="btn btn-o btn-sm" onclick="printPage('pg-nb')">🖨️ Print</button></div>
  ${flags.map((f) => `<div class="alert ${f.sev === "red" ? "a-red" : "a-amber"}">⚠️ <div>${esc(f.text)}</div></div>`).join("")}
  <div class="grid g2">
    <div class="card"><h3>🏥 Delivery & resuscitation</h3>
      <div class="form-grid">
        <div><label>Place of birth</label><select onchange="nbSet('place',this.value)">
          ${["", "This clinic", "Hospital", "Home", "Other"].map((o) => `<option value="${o}"${(nb.place || "") === o ? " selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
        <div><label>Mode of delivery</label><select onchange="nbSet('mode',this.value)">
          ${["", "Vaginal", "LSCS", "Forceps", "Vacuum"].map((o) => `<option value="${o}"${(nb.mode || "") === o ? " selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
        <div><label>Cried at birth</label><select onchange="nbSet('cried',this.value)">
          ${["", "Yes — vigorous", "Weak cry", "No"].map((o) => `<option value="${o}"${(nb.cried || "") === o ? " selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
        <div><label>Resuscitation</label><select onchange="nbSet('resus',this.value)">
          ${["", "None needed", "Stimulation / drying", "Bag-mask ventilation", "Intubation", "Chest compressions", "Adrenaline"].map((o) => `<option value="${o}"${(nb.resus || "") === o ? " selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
        <div><label>Vitamin K given</label><select onchange="nbSet('vitK',this.value)">
          ${["", "Yes", "No"].map((o) => `<option value="${o}"${(nb.vitK || "") === o ? " selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
        <div><label>Feeds</label><select onchange="nbSet('feed',this.value)">
          ${["", "Exclusive breastfeeds", "Mixed", "Formula", "IV fluids / NPO"].map((o) => `<option value="${o}"${(nb.feed || "") === o ? " selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
      </div>
      <h3 style="margin-top:14px">🔬 Screening checklist</h3>
      <table class="tbl"><tr><th>Screen</th><th>Date</th><th>Result</th></tr>
      ${scrRow("tsh", "TSH (heel-prick)", "Day 3–5 · congenital hypothyroidism")}
      ${scrRow("rop", "ROP eye exam", "Preterm / <2 kg · first by 4 wk")}
      ${scrRow("hear", "Hearing (OAE/BERA)", "By 1 month")}
      ${scrRow("ox", "Pulse-ox (CCHD)", "After 24 h, before discharge")}
      ${scrRow("bili", "Bilirubin", "If jaundiced · plot on hour-specific chart")}</table>
    </div>
    <div class="card"><h3>📟 APGAR score</h3>
      <div class="hint">Record only — never delay resuscitation to assign scores</div>
      <table class="tbl"><tr><th>Sign</th>${tps.map(([k, l]) => `<th>${l}<br><span id="apgarT${k}" style="font-weight:400"></span></th>`).join("")}</tr>
      ${APGAR_ITEMS.map((it, idx) => `<tr><td><b>${it.name}</b><br><span style="font-size:11px;color:var(--muted)">${it.opts.join(" · ")}</span></td>
        ${tps.map(([k]) => `<td><select onchange="nbSetApgar('${k}',${idx},this.value)" style="max-width:64px">
          <option value="">—</option>${[0, 1, 2].map((v) => `<option value="${v}"${String((nb.apgar[k] || [])[idx]) === String(v) ? " selected" : ""}>${v}</option>`).join("")}</select></td>`).join("")}</tr>`).join("")}</table>
      <h3 style="margin-top:14px">🧮 New Ballard Score</h3>
      <div class="hint">Score each sign per the NBS chart (−10…50 ≈ 20…44 wk)</div>
      ${BALLARD_ITEMS.map((it) => {
        const btns = [];
        for (let v = it.min; v <= it.max; v++) btns.push(`<button class="btn ${String(nb.ballard[it.k]) === String(v) ? "btn-p" : "btn-o"} btn-xs" onclick="nbSetBallard('${it.k}',${v})">${v}</button>`);
        return `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><b style="font-size:13px">${it.name}</b> <span style="font-size:11.5px;color:var(--muted)">${esc(it.guide)}</span><br><div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${btns.join("")}</div></div>`;
      }).join("")}
      <div class="alert ${b.complete ? "a-green" : "a-amber"}" style="margin:10px 0 0">🧮 <div>Ballard total <b>${b.total}</b>${b.complete ? "" : " (incomplete)"} → maturity <b>${b.label}</b> (${b.weeks.toFixed(1)} wk)
      ${agree !== null ? (agree <= 2 ? `<br>✅ Concordant with stated ${gestWk} wk (±2 wk).` : `<br>⚠️ Discordant with stated ${gestWk} wk — review dates / growth.`) : ""}</div></div>
    </div>
  </div>
  <div style="height:16px"></div>
  <div class="card"><h3>📖 Birth register (all children)</h3><div class="hint">One line per child for the clinic register</div>
    <div style="overflow:auto"><table class="tbl"><tr><th>DOB</th><th>Baby</th><th>Sex</th><th>Mother</th><th>Wt (kg)</th><th>GA (wk)</th><th>Mode</th><th>APGAR 5′</th><th>Place</th></tr>
    ${[...DB.children].sort((a, b) => (a.dob || "").localeCompare(b.dob || "")).map((k) => {
      const n2 = k.nb || {}, a5 = apgarTotal((n2.apgar || {}).t5);
      return `<tr><td>${fmtDate(k.dob)}</td><td><b>${esc(k.name)}</b></td><td>${k.sex === "boy" ? "M" : "F"}</td><td>${esc(k.mother || "—")}</td><td>${esc(String(k.birthWt || "—"))}</td><td>${esc(k.gest || "—")}</td><td>${esc(n2.mode || "—")}</td><td>${a5.total === null ? "—" : a5.total}</td><td>${esc(n2.place || "—")}</td></tr>`;
    }).join("")}</table></div></div>`;
  tps.forEach(([k]) => {
    const r = apgarTotal((nb.apgar || {})[k]);
    const el = document.getElementById("apgarT" + k);
    if (el) el.innerHTML = r.total === null ? "—" : `<b>${r.total}</b> <span style="font-size:12px">${esc(r.interp)}</span>`;
  });
}

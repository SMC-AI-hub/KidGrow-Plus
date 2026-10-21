/* =====================================================
   NeoKid Care — Bedside aids (Round 1)
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
      <div><label style="font-size:12px">Weight (kg)</label><input id="emgWt" type="number" step="0.1" min="1" max="300" value="${EMG.wt}" placeholder="e.g. 12" style="max-width:120px" data-oninput="emgWtInput"></div>
      <div><label style="font-size:12px">Age (years)</label><input id="emgAge" type="number" step="0.5" min="0" max="18" value="${EMG.age}" placeholder="e.g. 3" style="max-width:120px" data-oninput="emgAgeInput"></div>
      ${c ? `<button class="btn btn-o btn-sm" data-act="fillEmgFromChild">⚖️ Use ${esc(c.name)}'s data</button>` : ""}
      <span class="sp"></span><button class="btn btn-o btn-sm" data-act="printPage" data-arg="pg-emg">🖨️ Print card</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center"><span style="font-size:12.5px;color:var(--muted);font-weight:700">QUICK WT:</span>
      ${[3, 5, 8, 10, 12, 15, 20, 25, 30, 40].map((w) => `<button class="btn ${String(EMG.wt) === String(w) ? "btn-p" : "btn-o"} btn-xs" data-act="emgChip" data-arg="${w}">${w} kg</button>`).join("")}</div>
    <div id="emgDoses"></div>
    <div class="alert a-amber" style="margin-top:12px">⚠️ <div><b>Screening aid only.</b> Verify every dose against your hospital protocol / formulary before administering. Not a substitute for PALS/APLS training.</div></div>`;
  renderEmgDoses();
}
function fillEmgFromChild() {
  const c = child(); if (!c) return;
  const lm = latestMeasure(c);
  if (lm && lm.wt) EMG.wt = lm.wt;
  const a = ageBetween(c.dob);
  EMG.age = +(ageBetween(c.dob).days / 365.25).toFixed(1);
  renderEmergency();
}
function renderEmgDoses() {
  const box = $("emgDoses"); if (!box) return;
  const d = emergencyDoses(EMG.wt, EMG.age);
  if (!d) { box.innerHTML = `<div class="alert a-amber" style="margin:0">⚖️ <div>Enter a weight to compute doses.</div></div>`; return; }
  box.innerHTML = `<div class="hint">For <b>${d.wt} kg</b>${d.ageY !== null ? ` · age ${d.ageY} y` : ""} — doses capped at adult maximums.</div>
    <table class="tbl"><tr><th>Drug / intervention</th><th>Dose for this child</th><th>Notes</th></tr>
    ${d.rows.map((r) => `<tr><td><b>${esc(r.rx)}</b></td><td style="white-space:normal"><b>${esc(r.dose)}</b></td><td style="font-size:12.5px;color:var(--muted)">${esc(r.note)}</td></tr>`).join("")}</table>
    ${(() => { try { return (typeof Dose !== "undefined" && Dose.emgAllergyHTML) ? Dose.emgAllergyHTML((typeof child === "function") ? child() : null) : ""; } catch (e) { return ""; } })()}`;
}

/* ---------------- vaccine-card record codec (pure) ----------------
   Compact pipe format. Fits a QR; also pasteable as text. */
const RC_SEP = "|", RC_SUB = "~";
function rcClean(s) { return String(s ?? "").replace(/[|~\n\r]/g, " ").trim().slice(0, 80); }
function rcClean2(s) { return String(s ?? "").replace(/[|~;,\n\r]/g, " ").trim().slice(0, 80); } // KG2: also strips list separators
/* Transfer seal: id-independent hash (name+dob+payload), so clinic B can
   verify a code from clinic A. Same KG-XXXXXX style as the card code. */
function xferSeal(str) {
  let h = 0; const s = String(str || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "KG-" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}
function encodeRecord(c) {
  c = c || {};
  const v = Object.keys(c.vaccines || {}).sort().map((k) => {
    const r = c.vaccines[k] || {};
    return [k, r.date || "", rcClean2(r.brand || ""), rcClean2(r.mfr || ""), rcClean2(r.batch || "")].join(RC_SUB);
  }).join(",");
  const x = (c.extraVac || []).map((e) => [rcClean2(e.name), e.date || "", rcClean2(e.brand || ""), rcClean2(e.mfr || ""), rcClean2(e.batch || "")].join(RC_SUB)).join(";");
  const m = (c.measures || []).map((g) => [g.date || "", g.wt ?? "", g.ht ?? "", g.hc ?? "", g.muac ?? "", g.pos || ""].join(RC_SUB)).join(";");
  const core = ["KG2", rcClean2(c.name), c.dob || "", c.sex || "", rcClean2(c.phone || ""),
    rcClean2(((c.mother || "") + (c.mother && c.father ? " & " : "") + (c.father || ""))), v, x || "", m || ""];
  return core.join(RC_SEP) + RC_SEP + xferSeal(core.join(RC_SEP));
}
function decodeRecord(str) {
  const p = String(str || "").trim().split(RC_SEP);
  if ((p[0] !== "KG1" && p[0] !== "KG2") || p.length < 7) return null;
  const isKG2 = p[0] === "KG2";
  const c = { name: p[1] || "Imported child", dob: p[2] || "", sex: p[3] === "girl" ? "girl" : "boy", phone: p[4] || "", mother: p[5] || "", vaccines: {}, extraVac: [] };
  (p[6] || "").split(",").filter(Boolean).forEach((t) => {
    const parts = t.split(RC_SUB), code = parts[0];
    if (!code) return;
    c.vaccines[code] = { date: parts[1] || "", brand: parts[2] || "", mfr: parts[3] || "", batch: parts[4] || "", site: "", by: "", aer: "", note: "Imported record" };
  });
  (p[7] || "").split(";").filter(Boolean).forEach((t, i) => {
    const parts = (t || "").split(RC_SUB);
    c.extraVac.push({ id: "imp" + Date.now().toString(36) + i, name: parts[0] || "Vaccine", date: parts[1] || "", brand: parts[2] || "", mfr: parts[3] || "", batch: parts[4] || "", by: "", note: "Imported record" });
  });
  c.measures = [];
  if (isKG2) {
    (p[8] || "").split(";").filter(Boolean).forEach((t) => {
      const g = (t || "").split(RC_SUB);
      if (!g[0]) return;
      const num = (s) => (s === "" || s == null ? "" : (parseFloat(s) || ""));
      c.measures.push({ date: g[0], wt: num(g[1]), ht: num(g[2]), hc: num(g[3]), muac: num(g[4]), pos: g[5] || "" });
    });
    try { c._sealOk = (xferSeal(p.slice(0, 9).join(RC_SEP)) === (p[9] || "")); } catch (e) { c._sealOk = false; }
  } else { c._sealOk = null; c._legacy = true; }
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
/* Visit clustering (shared by print record + parent export): given doses from
   one sitting (same date + batch) collapse to ONE line — names joined, each
   brand/date/batch shown once. Pending antigens form one muted line. */
function vaxVisitClusters(v, cVx) {
  cVx = cVx || {};
  const clusters = [], pending = [];
  (v.vaccines || []).forEach((vx) => {
    const r = cVx[vx.code];
    if (!r) { pending.push({ name: vx.name || "", dose: vx.dose || "" }); return; }
    const key = (r.date || "") + "~" + (r.batch || "");
    let k = null;
    for (const c of clusters) if (c.key === key) { k = c; break; }
    if (!k) { k = { key, date: r.date || "", names: [], brands: [], batches: [] }; clusters.push(k); }
    k.names.push({ name: vx.name || "", dose: vx.dose || "" });
    if (r.brand) { const b = { b: r.brand, m: r.mfr || "" }; if (!k.brands.some((x) => x.b === b.b && x.m === b.m)) k.brands.push(b); }
    if (r.batch && k.batches.indexOf(r.batch) < 0) k.batches.push(r.batch);
  });
  return { clusters, pending };
}
/* Universal vaccination record — ONE format for every print/export.
   Vaccines-page print, card print and parent-file export all render this:
   clinic letterhead + patient strip + QR + record table + catch-up plan.
   (c) may be a live child or a plain {vaccines,dob,...} object. */
function vaxRecordHTML(c) {
  c = c || {};
    const code = encodeRecord(c);
    const cVx = c.vaccines || {};
    // Record-table card (clinic paper-schedule format): one row per visit —
    // Age | Recommended Vaccines | Due on | Brand given | Given on | Batch.
    // Full schedule prints (a record card needs blank writable rows for future
    // visits); given cells fill from records, pending cells stay blank.
    const vDone = VACCINE_SCHEDULE.map((v) => v.vaccines.filter((vx) => cVx[vx.code]).length);
    const nextIdx = vDone.findIndex((d, i) => d < VACCINE_SCHEDULE[i].vaccines.length);
    const schedRows = VACCINE_SCHEDULE.map((v, vi) => {
      const done = vDone[vi], total = v.vaccines.length;
      const st = done === total ? `<span style="color:var(--green)">✅ Complete</span>`
        : vi === nextIdx ? `⏰ Due ${esc(fmtDate(dueDateFor(c, v)))}${done ? ` · ${done}/${total} given` : ""}`
        : `<span style="color:var(--muted)">○ Upcoming</span>`;
      const cl = vaxVisitClusters(v, cVx);
    const vxCell = cl.clusters.map((k) => k.names.map((n) => `<b>${esc(n.name)}</b> <span style="color:var(--muted)">${esc(n.dose)}</span>`).join(" + "))
      .concat(cl.pending.length ? [`<span style="color:var(--muted)">○ Upcoming: ${cl.pending.map((n) => `${esc(n.name)} ${esc(n.dose)}`).join("; ")}</span>`] : []).join("<br>") || "&nbsp;";
      const pad = (arr) => arr.concat(cl.pending.length && cl.clusters.length ? ["&nbsp;"] : []).join("<br>") || "&nbsp;";
      const brandCell = pad(cl.clusters.map((k) => `${k.date ? `<span style="font-size:11px;color:var(--muted)">${esc(fmtDate(k.date))} \u2014 </span>` : ""}${k.brands.map((b) => `<b>${esc(b.b)}</b>`).join(" · ") || "&nbsp;"}`));
      const givenCell = pad(cl.clusters.map((k) => k.date ? `<b>${esc(fmtDate(k.date))}</b>` : "&nbsp;"));
      const batchCell = pad(cl.clusters.map((k) => k.batches.map(esc).join(" · ") || "&nbsp;"));
      return `<tr${vi === nextIdx ? ` style="background:#fefce8"` : ""}><td><b>${esc(v.label)}</b><br><span style="font-size:11px;color:var(--muted)">${esc(v.sub || "")}</span><br><span style="font-size:11px">${st}</span></td><td>${vxCell}</td><td style="white-space:nowrap">${esc(fmtDate(dueDateFor(c, v)))}</td><td>${brandCell}</td><td style="white-space:nowrap">${givenCell}</td><td>${batchCell}</td></tr>`;
    }).join("");
    const ex = (c.extraVac || []).map((x) => `<tr><td><b>Additional</b></td><td><b>${esc(x.name)}</b></td><td>—</td><td>${x.brand ? `<b>${esc(x.brand)}</b>${x.mfr ? ` (${esc(x.mfr)})` : ""}` : "&nbsp;"}</td><td>${x.date ? `<b>${esc(fmtDate(x.date))}</b>` : "&nbsp;"}</td><td>${x.batch ? esc(x.batch) : "&nbsp;"}</td></tr>`).join("");
    // Compact catch-up appendix (clinic + parent print): only when doses are missed.
    let catchup = "";
    try {
      const plan = (typeof catchupPlan === "function") ? catchupPlan(c, (typeof todayISO === "function") ? todayISO() : "") : [];
      if (plan && plan.length) {
        catchup = `<h3 style="margin:12px 0 6px">\uD83D\uDCCB Catch-up plan — ${plan.length} visit(s)</h3><table class="tbl vaxtbl"><tr><th>Visit</th><th>Earliest</th><th>Vaccines</th></tr>` +
          plan.map((p, i) => `<tr><td><b>Visit ${i + 1}</b><br><span style="font-size:11px;color:var(--muted)">${esc(p.visit)}</span></td><td style="white-space:nowrap">${esc(fmtDate(p.date))}</td><td>${p.items.map((it) => esc(it.name) + (it.dose ? ` <span style="color:var(--muted)">${esc(it.dose)}</span>` : "")).join(" · ")}${p.rota ? `<br><span style="font-size:11px;color:#b45309">\u26A0\uFE0F Includes rotavirus — confirm age eligibility.</span>` : ""}</td></tr>`).join("") +
          `</table><div style="font-size:11px;color:var(--muted);margin-top:4px">Missed doses in schedule order · no need to restart any series · minimum 4-week gaps · verify against the IAP catch-up chart.</div>`;
      }
    } catch (e) {}
  const ccLH = (typeof splitClinicContact === "function") ? splitClinicContact((typeof DB !== "undefined" && DB.settings) || {}) : { doc: "", addr: "" };
  return `
      <div class="vaxcard">
        <div class="vax-head">
          ${(DB.settings.logo || "") ? `<img src="${DB.settings.logo}" alt="Hospital logo">` : ""}
          <div style="min-width:0">
            <div class="eyebrow">DIGITAL IMMUNISATION CARD</div>
            <h2>${esc(DB.settings.clinic || "NeoKid Care Clinic")}</h2>
            ${ccLH.doc ? `<div class="docline">${esc(ccLH.doc)}</div>` : ""}${ccLH.addr ? `<div class="addrline">${esc(ccLH.addr)}</div>` : ""}
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
          <div class="qrbox" style="text-align:center">${qrSVG(code)}<div style="font-size:11px;color:var(--muted);margin-top:4px">Scan at any NeoKid Care clinic<br>to verify / import this record</div></div>
        </div>
        <table class="tbl vaxtbl" style="margin-top:10px"><tr><th>Age</th><th>Recommended Vaccines</th><th>Due on</th><th>Brand given</th><th>Given on</th><th>Batch</th></tr>${schedRows}${ex}</table>
      ${catchup}
        <div class="vax-sign"><div>Doctor signature &amp; seal: ______________</div><div style="margin-left:auto">Date: ${fmtDate(todayISO())}</div></div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:6px;text-align:center">Seasonal influenza vaccine every year · ${VAX_SCHEDULE_VERSION} schedule · ${esc(DB.settings.doctor || "")} · Generated ${fmtDate(todayISO())} · Computer-assisted record — confirm before filing.</div>
      </div>
  `;
}

function renderCard() {
  if (!$("pg-card")) return;
  const c = child();
  if (!c) { $("cardBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  const code = encodeRecord(c); // toolbar char-count (record itself built by vaxRecordHTML)
  $("cardBox").innerHTML = `
    <div class="toolbar no-print" style="margin-bottom:12px">
      <span style="font-size:13px;color:var(--muted)">Record code: <b>${code.length}</b> chars · QR ${code.length < 1800 ? "fits easily" : "fits (dense)"}</span>
      <span class="sp"></span>
      <button class="btn btn-o btn-sm" data-act="printPage" data-arg="pg-card">🖨️ Print card</button>
      <button class="btn btn-o btn-sm" data-act="copyRecordCode">⧉ Copy record code</button>
      <button class="btn btn-o btn-sm" data-act="downloadRecord">⬇ Download .json</button>
      <button class="btn btn-p btn-sm" data-act="downloadParentCard">📱 Parent file (.html)</button>
      <button class="btn btn-o btn-sm" data-act="copyParentSummary">⧉ Parent summary</button>
    </div>
    ${vaxRecordHTML(c)}
    <div style="height:16px"></div>
    <div class="card no-print"><h3>📥 Import a record</h3>
      <div class="hint">From another NeoKid clinic: <b>Scan</b> the card QR, or paste the record code / child .json. You'll preview + verify first — only <b>immunization + growth</b> can arrive. Matching name + DOB merges; otherwise a new child is created.</div>
      <textarea id="impText" rows="3" style="width:100%;font-family:monospace;font-size:12px" placeholder="KG2|Name|dob|... (KG1 works too)" data-oninput="cardImpInput">${esc(CARD.imp)}</textarea>
      <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-p btn-sm" data-act="openScanModal">📷 Scan card QR</button>
        <button class="btn btn-o btn-sm" data-act="importRecordText">📥 Import pasted record</button>
        <button class="btn btn-o btn-sm" data-act="clickImpFile">⬆ Choose .json file</button>
        <input type="file" id="impFile" accept=".json,.txt" style="display:none" data-onchange="importRecordFile">
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
/* v10.29 privilege enforcement: a transfer carries ONLY immunization +
   growth (+identity). Everything else (visits, rx, bills, notes...) never
   leaves the source clinic, even from a full .json backup. */
function scopeTransfer(j) {
  j = j || {};
  const pick = (o, ks) => { const r = {}; ks.forEach((k) => { if (o[k] !== undefined) r[k] = o[k]; }); return r; };
  const vx = {};
  Object.keys(j.vaccines || {}).forEach((k) => { vx[k] = pick(j.vaccines[k] || {}, ["date", "brand", "mfr", "batch", "site", "by", "note"]); });
  return {
    name: j.name || "", dob: j.dob || "", sex: j.sex || "", phone: j.phone || "",
    mother: j.mother || "", father: j.father || "",
    vaccines: vx,
    extraVac: (j.extraVac || []).map((e) => pick(e || {}, ["name", "date", "brand", "mfr", "batch"])),
    measures: (j.measures || []).map((g) => pick(g || {}, ["date", "wt", "ht", "hc", "muac", "pos"])),
    _sealOk: ("_sealOk" in j) ? j._sealOk : null, _legacy: j._legacy === true
  };
}
/* Receive preview: view + verify BEFORE anything is imported. All import
   paths (scan / paste / file) funnel through here. */
let XFER = null;
function previewTransfer(str) {
  const msg = (h) => { const e = $("impMsg"); if (e) e.innerHTML = h; };
  let inc = null, via = "record code";
  try { inc = decodeRecord(str); } catch (e) { inc = null; }
  if (!inc) { try { const j = JSON.parse(str); if (j && j.vaccines) { inc = scopeTransfer(j); inc._sealOk = null; inc._legacy = true; via = "backup file"; } } catch (e) { inc = null; } }
  if (!inc || !inc.name) { msg(`<span style="color:var(--red)">❌ Could not read that ${via}.</span>`); return; }
  inc = scopeTransfer(inc);
  const doses = Object.keys(inc.vaccines || {});
  const dated = doses.filter((k) => (inc.vaccines[k] || {}).date);
  const ms = (inc.measures || []).slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const last = ms[ms.length - 1];
  const same = ((typeof DB !== "undefined" && DB.children) || []).find((c) => (c.name || "").trim().toLowerCase() === String(inc.name).trim().toLowerCase() && (c.dob || "") === (inc.dob || ""));
  const seal = inc._sealOk === true ? `<span style="color:var(--green);font-weight:700">✅ Seal verified</span>`
    : inc._sealOk === false ? `<span style="color:var(--red);font-weight:700">⚠️ Seal FAILED — confirm with the source clinic before importing</span>`
    : `<span style="color:var(--amber,#b45309);font-weight:700">Legacy code — verify name &amp; DOB manually</span>`;
  XFER = inc;
  let box = document.getElementById("mXfer");
  if (box) box.remove();
  box = document.createElement("div");
  box.id = "mXfer"; box.className = "modal-bg open";
  box.innerHTML = `<div class="modal" style="max-width:560px"><h3>📥 Receive from another clinic</h3>
    <div class="hint">Preview only — nothing is imported until you confirm. Only <b>immunization + growth</b> can arrive; visits, prescriptions and bills never transfer.</div>
    <dl class="kv"><dt>Child</dt><dd>${esc(inc.name)} · ${inc.sex === "girl" ? "Girl" : "Boy"} · DOB ${esc(fmtDate(inc.dob))}</dd>
    <dt>Seal</dt><dd>${seal}</dd>
    <dt>Doses</dt><dd>${dated.length} given${doses.length > dated.length ? ` · ${doses.length - dated.length} dateless` : ""}${(inc.extraVac || []).length ? ` · +${inc.extraVac.length} additional` : ""}</dd>
    <dt>Growth</dt><dd>${ms.length ? `${ms.length} record(s)${last ? ` · latest ${esc(fmtDate(last.date))}: ${last.wt ?? "—"} kg · ${last.ht ?? "—"} cm` : ""}` : "none in this transfer"}</dd>
    <dt>Target</dt><dd>${same ? `Merge into existing <b>${esc(same.name)}</b> — only missing doses/dates are added` : `New child <b>${esc(inc.name)}</b> will be created here`}</dd></dl>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px">
    <button class="btn btn-p" data-act="xferDoImport">✅ Import immunization + growth</button>
    <button class="btn btn-o" data-act="xferCancel">Cancel</button></div></div>`;
  document.body.appendChild(box);
}
function xferDoImport() { const inc = XFER; XFER = null; const m = document.getElementById("mXfer"); if (m) m.remove(); if (inc) mergeImported(inc); }
function xferCancel() { XFER = null; const m = document.getElementById("mXfer"); if (m) m.remove(); }
/* Live QR scanner (Chrome/Edge desktop + Android). iPhone Safari has no
   BarcodeDetector — those users paste the WhatsApp'd code instead. */
let SCAN = { stream: null, timer: null };
async function openScanModal() {
  let box = document.getElementById("mScan");
  if (box) box.remove();
  const supported = (typeof window !== "undefined" && "BarcodeDetector" in window);
  box = document.createElement("div");
  box.id = "mScan"; box.className = "modal-bg open";
  box.innerHTML = `<div class="modal" style="max-width:480px;text-align:center"><h3>📷 Scan card QR</h3>
    <div class="hint">Point at the QR on the printed card / parent file${supported ? "" : " — live scanning needs Chrome/Edge on Android or desktop"}.</div>
    ${supported ? `<video id="scanVideo" playsinline muted style="width:100%;border-radius:14px;background:#000;max-height:320px"></video><div class="hint" id="scanMsg">Starting camera…</div>`
    : `<div class="alert a-amber" style="text-align:left">📵 This browser can't scan live (iPhone Safari). Ask clinic A to <b>Copy</b> the record code or WhatsApp it, then paste it on this page.</div>`}
    <div style="margin-top:10px"><button class="btn btn-o" data-act="closeScanModal">Close</button></div></div>`;
  document.body.appendChild(box);
  if (!supported) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    SCAN.stream = stream;
    const v = document.getElementById("scanVideo");
    v.srcObject = stream; await v.play();
    const det = new BarcodeDetector({ formats: ["qr_code"] });
    const m = document.getElementById("scanMsg"); if (m) m.textContent = "Scanning… hold steady";
    SCAN.timer = setInterval(async () => {
      try {
        const vv = document.getElementById("scanVideo"); if (!vv) return;
        const codes = await det.detect(vv);
        if (codes && codes.length && codes[0].rawValue) { const val = codes[0].rawValue; closeScanModal(); previewTransfer(val); }
      } catch (e) {}
    }, 400);
  } catch (e) {
    const m = document.getElementById("scanMsg");
    if (m) m.textContent = "❌ Camera unavailable (" + (e.name || "denied") + ") — paste the code instead.";
  }
}
function closeScanModal() {
  try { if (SCAN.timer) clearInterval(SCAN.timer); } catch (e) {}
  try { if (SCAN.stream) SCAN.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  SCAN = { stream: null, timer: null };
  const m = document.getElementById("mScan"); if (m) m.remove();
}
function mergeImported(inc) {
  const impSay = (h) => { try { const e = $("impMsg"); if (e) e.innerHTML = h; } catch (_) {} };
  if (!inc || !inc.name) { impSay(`<span style="color:var(--red)">❌ Could not read that record.</span>`); return; }
  const same = DB.children.find((c) => c.name.trim().toLowerCase() === String(inc.name).trim().toLowerCase() && (c.dob || "") === (inc.dob || ""));
  if (same) {
    let added = 0;
    Object.keys(inc.vaccines || {}).forEach((k) => { if (!same.vaccines[k] && (inc.vaccines[k].date || inc.vaccines[k].brand)) { same.vaccines[k] = inc.vaccines[k]; added++; } });
    (inc.extraVac || []).forEach((x) => { same.extraVac = same.extraVac || []; if (!same.extraVac.some((e) => e.name === x.name && e.date === x.date)) { x.id = uid(); same.extraVac.push(x); added++; } });
    let mAdded = 0;
    (inc.measures || []).forEach((g) => { same.measures = same.measures || []; if (g && g.date && !same.measures.some((e) => e.date === g.date)) { same.measures.push(Object.assign({ id: uid(), note: "Imported" }, g)); mAdded++; } });
    if (inc.phone && !same.phone) same.phone = inc.phone;
    DB.activeId = same.id; save(); renderAll();
    impSay(`<span style="color:var(--green)">✅ Merged into <b>${esc(same.name)}</b> — ${added} dose(s) + ${mAdded} growth record(s) added.</span>`);
  } else {
    inc.id = uid();
    delete inc._sealOk; delete inc._legacy;
    inc.measures = (inc.measures || []).map((g) => Object.assign({ id: uid(), note: "Imported" }, g)); inc.visits = inc.visits || []; inc.milestones = inc.milestones || {};
    inc.extraVac = inc.extraVac || [];
    DB.children.push(inc); DB.activeId = inc.id; save(); renderAll();
    impSay(`<span style="color:var(--green)">✅ New child <b>${esc(inc.name)}</b> created with ${Object.keys(inc.vaccines || {}).length} dose(s) + ${(inc.measures || []).length} growth record(s).</span>`);
  }
  CARD.imp = ""; const t = $("impText"); if (t) t.value = "";
}
function importRecordText() {
  const raw = ($("impText").value || "").trim();
  if (!raw) return;
  previewTransfer(raw);
}
function importRecordFile(ev) {
  const f = ev.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const txt = String(r.result || "").trim();
      previewTransfer(txt);
    } catch (e) { $("impMsg").innerHTML = `<span style="color:var(--red)">❌ Could not read that file.</span>`; }
    ev.target.value = "";
  };
  r.readAsText(f);
}

/* E2c: delegated actions for templates in this file. */
try {
  ["closeScanModal", "copyParentSummary", "copyRecordCode", "downloadParentCard", "downloadRecord", "emgChip", "fillEmgFromChild", "importRecordText", "openScanModal", "xferCancel", "xferDoImport"].forEach(function (n) { actCall0(n); });
  actRegister("importRecordFile", function (el, ev) { try { importRecordFile(ev); } catch (e) { actReport("importRecordFile", e); } });
  actRegister("clickImpFile", function () { try { document.getElementById("impFile").click(); } catch (e) { actReport("clickImpFile", e); } });
  actRegister("cardImpInput", function (el) { try { CARD.imp = el.value; } catch (e) { actReport("cardImpInput", e); } });
  actRegister("emgAgeInput", function (el) { try { EMG.age = el.value; renderEmgDoses(); } catch (e) { actReport("emgAgeInput", e); } });
  actRegister("emgWtInput", function (el) { try { EMG.wt = el.value; renderEmgDoses(); } catch (e) { actReport("emgWtInput", e); } });
} catch (e) {}

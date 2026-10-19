/* =====================================================
   NeoKid Care — Screening suite (Round 3)
   Asthma action plan + PEF diary · dental eruption chart ·
   RBSK 4Ds checklist.
   ===================================================== */
/* ---------------- asthma ---------------- */
function pefZone(best, v) {
  if (!(best > 0) || !(v > 0)) return null;
  const p = (v / best) * 100;
  return p >= 80 ? "green" : p >= 50 ? "yellow" : "red";
}
function asthmaOf(c) {
  c.asthma = c.asthma || {};
  c.asthma.pef = c.asthma.pef || [];
  c.asthma.triggers = c.asthma.triggers || [];
  return c.asthma;
}
function astSet(k, v) { const c = child(); if (!c) return; asthmaOf(c)[k] = v; save(); }
function astToggleTrigger(t) {
  const c = child(); if (!c) return;
  const a = asthmaOf(c), i = a.triggers.indexOf(t);
  if (i >= 0) a.triggers.splice(i, 1); else a.triggers.push(t);
  save(); renderScreen();
}
function pefAdd() {
  const c = child(); if (!c) return;
  const d = document.getElementById("pefDate").value, am = +document.getElementById("pefAM").value || null, pm = +document.getElementById("pefPM").value || null;
  if (!d || (!am && !pm)) return alert("Date + at least one reading required.");
  asthmaOf(c).pef.push({ id: uid(), date: d, am, pm });
  save(); renderScreen();
}
function pefDel(id) {
  if (!needSafe(2, "delete PEF readings")) return;
  const c = child();
  asthmaOf(c).pef = asthmaOf(c).pef.filter((p) => p.id !== id);
  save(); renderScreen();
}
function asthmaPlanHTML(c) {
  const a = asthmaOf(c);
  const best = +a.best || Math.max(0, ...a.pef.flatMap((p) => [p.am || 0, p.pm || 0]));
  const zoneDot = (z) => z === "green" ? "🟢" : z === "yellow" ? "🟡" : z === "red" ? "🔴" : "—";
  const rows = [...a.pef].sort((x, y) => (x.date || "").localeCompare(y.date || "")).slice(-14);
  return `
  <div class="form-grid">
    <div><label>Severity</label><select onchange="astSet('sev',this.value)">${["", "Intermittent", "Mild persistent", "Moderate persistent", "Severe persistent"].map((o) => `<option value="${o}"${(a.sev || "") === o ? " selected" : ""}>${o || "—"}</option>`).join("")}</select></div>
    <div><label>Personal best PEF (L/min)</label><input type="number" value="${a.best || ""}" placeholder="auto from diary" onchange="astSet('best',this.value);renderScreen()"></div>
    <div><label>Controller (daily)</label><input value="${esc(a.controller || "")}" placeholder="e.g. Budesonide 100 MDI 2 puff BD + spacer" onchange="astSet('controller',this.value)"></div>
    <div><label>Reliever</label><input value="${esc(a.reliever || "")}" placeholder="e.g. Salbutamol MDI 2–4 puff SOS" onchange="astSet('reliever',this.value)"></div>
  </div>
  <div class="hint">Triggers</div>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">${["Dust", "Smoke", "Viral cold", "Exercise", "Weather change", "Pets", "Strong smells", "Cockroach"].map((t) => `<label class="sib" style="font-size:12.5px"><input type="checkbox" ${a.triggers.includes(t) ? "checked" : ""} onchange="astToggleTrigger('${t}')"> ${t}</label>`).join("")}</div>
  <div class="form-grid">
    <div class="full"><label>🟢 Green — doing well (PEF ≥80% best${best ? `, ≥${Math.round(best * 0.8)}` : ""})</label><input value="${esc(a.green || "Continue controller daily.")}" onchange="astSet('green',this.value)"></div>
    <div class="full"><label>🟡 Yellow — getting worse (PEF 50–80%)</label><input value="${esc(a.yellow || "Double reliever via spacer, start oral steroids per doctor, review within 24–48 h.")}" onchange="astSet('yellow',this.value)"></div>
    <div class="full"><label>🔴 Red — emergency (PEF <50%, can't talk/walk, ribs pulling)</label><input value="${esc(a.red || "Reliever now + rush to hospital / call doctor immediately.")}" onchange="astSet('red',this.value)"></div>
  </div>
  <h3 style="margin-top:12px">📓 PEF diary ${best ? `(best ${best} L/min)` : ""}</h3>
  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
    <input type="date" id="pefDate" value="${todayISO()}" style="max-width:150px">
    <input type="number" id="pefAM" placeholder="Morning" style="max-width:110px">
    <input type="number" id="pefPM" placeholder="Evening" style="max-width:110px">
    <button class="btn btn-p btn-sm" onclick="pefAdd()">＋ Add</button>
  </div>
  ${rows.length ? `<table class="tbl"><tr><th>Date</th><th>AM</th><th>PM</th><th></th></tr>${rows.map((p) => `<tr><td>${fmtDate(p.date)}</td><td>${p.am ? zoneDot(pefZone(best, p.am)) + " " + p.am : "—"}</td><td>${p.pm ? zoneDot(pefZone(best, p.pm)) + " " + p.pm : "—"}</td><td><button class="btn btn-danger btn-xs" onclick="pefDel('${p.id}')">✕</button></td></tr>`).join("")}</table>`
  : `<div style="font-size:13px;color:var(--muted)">No readings yet — 2 weeks of twice-daily blows sets the personal best.</div>`}`;
}
/* ---------------- dental ---------------- */
const TEETH_UPPER = ["16", "55", "54", "53", "52", "51", "61", "62", "63", "64", "65", "26"];
const TEETH_LOWER = ["36", "85", "84", "83", "82", "81", "71", "72", "73", "74", "75", "46"];
const TOOTH_REF = { "51": "6–10 mo", "61": "6–10 mo", "71": "6–10 mo", "81": "6–10 mo", "52": "9–13 mo", "62": "9–13 mo", "72": "9–13 mo", "82": "9–13 mo", "53": "16–22 mo", "63": "16–22 mo", "73": "16–22 mo", "83": "16–22 mo", "54": "13–19 mo", "64": "13–19 mo", "74": "13–19 mo", "84": "13–19 mo", "55": "25–33 mo", "65": "25–33 mo", "75": "25–33 mo", "85": "25–33 mo", "16": "~6 y", "26": "~6 y", "36": "~6 y", "46": "~6 y" };
const TOOTH_CYCLE = ["", "g", "e", "x"];
const TOOTH_LBL = { "": "Not erupted", g: "Erupting", e: "Erupted", x: "Lost / extracted" };
function dentalFlag(ageM, eruptedPrimary) {
  if (ageM > 13 && eruptedPrimary === 0) return "No teeth by 13 months — evaluate (hypothyroid, rickets, ectodermal causes).";
  if (ageM > 33 && eruptedPrimary < 20) return `Only ${eruptedPrimary}/20 primary teeth past 33 months — dental review.`;
  return null;
}
function toothToggle(t) {
  const c = child(); if (!c) return;
  c.dental = c.dental || {};
  const cur = (c.dental[t] || {}).st || "";
  const nx = TOOTH_CYCLE[(TOOTH_CYCLE.indexOf(cur) + 1) % TOOTH_CYCLE.length];
  if (!nx) delete c.dental[t];
  else c.dental[t] = { st: nx, d: (c.dental[t] || {}).d || todayISO() };
  save(); renderScreen();
}
function dentalHTML(c) {
  c.dental = c.dental || {};
  const ageM = ageMonths(c.dob);
  const isPrim = (t) => !["16", "26", "36", "46"].includes(t);
  const primErupted = Object.keys(c.dental).filter((t) => isPrim(t) && c.dental[t].st === "e").length;
  const flag = dentalFlag(ageM, primErupted);
  const cell = (t) => {
    const s = (c.dental[t] || {}).st || "";
    const bg = s === "e" ? "var(--green)" : s === "g" ? "var(--amber)" : s === "x" ? "#94a3b8" : "#fff";
    const fg = s ? "#fff" : "var(--navy)";
    return `<button onclick="toothToggle('${t}')" title="${t} · ${TOOTH_REF[t] || ""} · ${TOOTH_LBL[s]}" style="width:44px;height:52px;border:2px solid ${s ? bg : "#cbd5e1"};border-radius:10px;background:${bg};color:${fg};font-weight:800;font-size:13px;cursor:pointer">${t}<div style="font-size:9px;font-weight:600">${s === "e" ? "✓" : s === "g" ? "~" : s === "x" ? "✕" : "·"}</div></button>`;
  };
  return `<div class="hint">Tap a tooth to cycle: blank → erupting (~) → erupted (✓) → lost (✕). Primary teeth in white rows; 16/26/36/46 are first permanent molars (~6 y).</div>
  ${flag ? `<div class="alert a-amber">🦷 <div>${esc(flag)}</div></div>` : ""}
  <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin:8px 0">${TEETH_UPPER.map(cell).join("")}</div>
  <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:center;margin:8px 0">${TEETH_LOWER.map(cell).join("")}</div>
  <div style="font-size:12.5px;color:var(--muted)">Primary erupted: <b>${primErupted}/20</b> · Reference: centrals 6–10 mo · laterals 9–13 mo · canines 16–22 mo · 1st molars 13–19 mo · 2nd molars 25–33 mo.</div>`;
}
/* ---------------- RBSK 4Ds ---------------- */
const RBSK = [
  { g: "A. Defects at birth", items: ["Neural tube defect", "Down syndrome", "Cleft lip / palate", "Clubfoot (CTEV)", "Hip dysplasia (DDH)", "Congenital cataract", "White reflex (retinoblastoma?)", "Congenital deafness", "Heart disease (CHD)", "ROP"] },
  { g: "B. Deficiencies", items: ["Anaemia", "Vitamin A deficiency", "Vitamin D deficiency / rickets", "Severe acute malnutrition", "Goitre"] },
  { g: "C. Diseases of childhood", items: ["Skin conditions", "Otitis media", "Rheumatic heart disease", "Reactive airway disease", "Dental caries", "Convulsions", "Worm infestation"] },
  { g: "D. Developmental delays & disabilities", items: ["Vision impairment", "Hearing impairment", "Neuromotor delay", "Cognitive delay", "Autism features", "ADHD features", "Learning difficulty"] },
];
function rbskOf(c) { c.rbsk = c.rbsk || {}; c.rbsk.items = c.rbsk.items || {}; return c.rbsk; }
function rbskSet(item, v) { const c = child(); if (!c) return; rbskOf(c).items[item] = v; save(); renderScreen(); }
function rbskMeta(k, v) { const c = child(); if (!c) return; rbskOf(c)[k] = v; save(); }
function rbskHTML(c) {
  const r = rbskOf(c);
  const refs = Object.keys(r.items).filter((k) => r.items[k] === "ref");
  return `<div class="form-grid">
    <div><label>Screened on</label><input type="date" value="${r.date || ""}" onchange="rbskMeta('date',this.value)"></div>
    <div><label>Screened by</label><input value="${esc(r.by || "")}" placeholder="Name" onchange="rbskMeta('by',this.value)"></div>
    <div class="full"><label>Refer to (if any)</label><input value="${esc(r.refTo || "")}" placeholder="e.g. DEIC, District Hospital" onchange="rbskMeta('refTo',this.value)"></div>
  </div>
  ${refs.length ? `<div class="alert a-red">🏥 <div><b>${refs.length} condition(s) flagged for referral:</b> ${refs.map(esc).join(" · ")}${r.refTo ? ` → ${esc(r.refTo)}` : ""}. Print this page as the referral slip.</div></div>` : ""}
  ${RBSK.map((sec) => `<h3 style="margin-top:10px;font-size:14px">${esc(sec.g)}</h3>
    ${sec.items.map((it) => { const v = r.items[it] || ""; return `<div class="vac-row"><div class="grow" style="font-size:13.5px">${v === "ref" ? "🔴" : v === "ok" ? "🟢" : "⚪"} ${esc(it)}</div>
      <button class="btn ${v === "ok" ? "btn-p" : "btn-o"} btn-xs" onclick="rbskSet('${esc(it).replace(/'/g, "\\'")}','ok')">Normal</button>
      <button class="btn ${v === "ref" ? "btn-danger" : "btn-o"} btn-xs" onclick="rbskSet('${esc(it).replace(/'/g, "\\'")}','ref')">Refer</button>
      ${v ? `<button class="btn btn-o btn-xs" onclick="rbskSet('${esc(it).replace(/'/g, "\\'")}','')">↩</button>` : ""}</div>`; }).join("")}`).join("")}`;
}
/* ---------------- screening calculators (Phase 5: Scores registry) ---------------- */
function screenCalcsHTML(c) {
  const g = esc(c.gest || ""), dob = c.dob || "", bw = esc(c.birthWt || "");
  return `<div class="hint">ROP first-exam timing (AAP 2018) + CCHD pulse-ox interpretation (AAP 2025). Screening aids — clinical judgement prevails.</div>
  <div class="grid g2">
    <div>
      <h4 style="margin:6px 0">👁️ ROP first exam</h4>
      <div class="form-grid">
        <div><label>GA at birth (wk)</label><input type="number" step="0.1" id="scRopGa" value="${g}"></div>
        <div><label>Date of birth</label><input type="date" id="scRopDob" value="${dob}"></div>
        <div><label>Birth wt (kg)</label><input type="number" step="0.1" id="scRopBw" value="${bw}"></div>
        <div><label>Unstable course</label><select id="scRopUn"><option value="">No</option><option value="y">Yes</option></select></div>
      </div>
      <button class="btn btn-o btn-sm" style="margin-top:6px" onclick="runRopCalc()">Calculate</button>
      <div id="scRopOut" style="margin-top:6px;font-size:13.5px"></div>
    </div>
    <div>
      <h4 style="margin:6px 0">❤️ CCHD pulse-ox</h4>
      <div class="form-grid">
        <div><label>Right hand %</label><input type="number" id="scCchdHand" placeholder="97"></div>
        <div><label>Foot %</label><input type="number" id="scCchdFoot" placeholder="96"></div>
        <div><label>Screen</label><select id="scCchdAtt"><option value="1">First</option><option value="2">Repeat (1h)</option></select></div>
      </div>
      <button class="btn btn-o btn-sm" style="margin-top:6px" onclick="runCchdCalc()">Interpret</button>
      <div id="scCchdOut" style="margin-top:6px;font-size:13.5px"></div>
    </div>
  </div>`;
}
function runRopCalc() {
  const out = document.getElementById("scRopOut");
  try {
    const r = Scores.run("rop-first", { ga: document.getElementById("scRopGa").value, dob: document.getElementById("scRopDob").value, bwKg: document.getElementById("scRopBw").value, unstable: document.getElementById("scRopUn").value === "y" });
    out.innerHTML = !r.ok ? `<span style="color:var(--red)">${esc(r.reason)}</span>`
      : !r.eligible ? `⚪ ${esc(r.interp)}<br><span style="font-size:12px;color:var(--muted)">${esc(r.source)}</span>`
      : `🟡 First ROP exam by <b>${esc(r.date)}</b> (${esc(r.basis)}).<br><span style="font-size:12px;color:var(--muted)">${esc(r.source)}</span>`;
  } catch (e) { out.innerHTML = `<span style="color:var(--red)">Calculator unavailable.</span>`; }
}
function runCchdCalc() {
  const out = document.getElementById("scCchdOut");
  try {
    const r = Scores.run("cchd", { hand: document.getElementById("scCchdHand").value, foot: document.getElementById("scCchdFoot").value, attempt: document.getElementById("scCchdAtt").value });
    if (!r.ok) { out.innerHTML = `<span style="color:var(--red)">${esc(r.reason)}</span>`; return; }
    const dot = r.result === "pass" ? "🟢" : r.result === "retest" ? "🟡" : "🔴";
    out.innerHTML = `${dot} <b>${esc(r.result.toUpperCase())}</b> — ${esc(r.action)}<br><span style="font-size:12px;color:var(--muted)">${esc(r.source)}</span>`;
  } catch (e) { out.innerHTML = `<span style="color:var(--red)">Calculator unavailable.</span>`; }
}
/* ---------------- page ---------------- */
function renderScreen() {
  if (!$("pg-screen")) return;
  const c = child();
  if (!c) { $("screenBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  $("screenBox").innerHTML = `
  <div class="toolbar no-print"><span style="font-size:13px;color:var(--muted)">Screening suite for <b>${esc(c.name)}</b></span>
    <span class="sp"></span><button class="btn btn-o btn-sm" onclick="auditSafe('Screening printed','${esc(c.name)}');printPage('pg-screen')">🖨️ Print all</button></div>
  <div class="card"><h3>🫁 Asthma action plan + PEF diary</h3>${asthmaPlanHTML(c)}</div>
  <div style="height:16px"></div>
  <div class="card"><h3>🦷 Dental eruption chart</h3>${dentalHTML(c)}</div>
  <div style="height:16px"></div>
  <div class="card"><h3>🧮 Newborn screening calculators</h3>${screenCalcsHTML(c)}</div>
  <div style="height:16px"></div>
  <div class="card"><h3>🏥 RBSK 4Ds checklist</h3><div class="hint">Rashtriya Bal Swasthya Karyakram — 0–18 y screening: Defects, Deficiencies, Diseases, Developmental delays</div>${rbskHTML(c)}</div>`;
}

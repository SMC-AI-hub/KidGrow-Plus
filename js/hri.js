/* NeoKid Care — high-risk infant follow-up (Phase 5).
   Enrollment + corrected-age schedule engine + defaulter list, plus two
   newborn-screening calculators registered in Scores (ROP first-exam timing
   per AAP 2018, CCHD pulse-ox interpretation per AAP 2025). Nothing here
   blocks any save — the defaulter list is a prompt, not a gate. */
function hriPack() { try { return (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT.hri) || null; } catch (e) { return null; } }
function hriAddDays(iso, n) {
  try {
    const p = String(iso || "").slice(0, 10).split("-");
    const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + (+n || 0)));
    return d.toISOString().slice(0, 10);
  } catch (e) { return ""; }
}
function hriAddMo(iso, n) {
  try {
    const p = String(iso || "").slice(0, 10).split("-");
    const d = new Date(Date.UTC(+p[0], +p[1] - 1 + (+n || 0), 1));
    const dim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(+p[2] || 1, dim));
    return d.toISOString().slice(0, 10);
  } catch (e) { return ""; }
}
function hriDiffD(a, b) {
  try { return Math.round((new Date(String(b).slice(0, 10) + "T00:00:00Z") - new Date(String(a).slice(0, 10) + "T00:00:00Z")) / 864e5); }
  catch (e) { return 0; }
}
function hriNum(x) { if (x == null || x === "") return null; const n = parseFloat(x); return Number.isFinite(n) ? n : null; }
function hriEsc(s) {
  if (typeof esc === "function") { try { return esc(s); } catch (e) {} }
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function hriGaOf(c) {
  try {
    const g = hriNum(c && c.gest);
    if (g !== null) return g;
    const adms = ((c && c.nicu && c.nicu.admissions) || []).filter((a) => hriNum(a.ga) !== null);
    return adms.length ? hriNum(adms[adms.length - 1].ga) : null;
  } catch (e) { return null; }
}
function hriBwOf(c) {
  try {
    const b = hriNum(c && c.birthWt);
    if (b !== null) return b;
    const adms = ((c && c.nicu && c.nicu.admissions) || []).filter((a) => hriNum(a.birthWtG) !== null);
    return adms.length ? hriNum(adms[adms.length - 1].birthWtG) / 1000 : null;
  } catch (e) { return null; }
}
function hriDischargeDate(c) {
  try {
    const ds = ((c && c.nicu && c.nicu.admissions) || []).map((a) => String(a.dischargedAt || "").slice(0, 10)).filter(Boolean).sort();
    return ds.length ? ds[ds.length - 1] : null;
  } catch (e) { return null; }
}
function hriOf(c) {
  if (!c.hri || typeof c.hri !== "object") c.hri = {};
  const h = c.hri;
  if (!Array.isArray(h.risks)) h.risks = [];
  if (!Array.isArray(h.done)) h.done = [];
  if (typeof h.enrolled !== "boolean") h.enrolled = false;
  return h;
}
/* EDD from GA; corrected age honoured while preterm + under 24 mo. */
function hriEdd(dobISO, gaWk) {
  const ga = hriNum(gaWk);
  if (!dobISO) return null;
  if (ga === null) return String(dobISO).slice(0, 10);
  return hriAddDays(dobISO, Math.round((40 - ga) * 7));
}
function hriCorr(dobISO, gaWk, onISO) {
  try {
    const P = hriPack();
    const chronoD = hriDiffD(dobISO, onISO);
    const ga = hriNum(gaWk);
    const useCorr = ga !== null && ga < ((P && P.termGA) || 37) && chronoD <= (((P && P.correctUntilMo) || 24) * 30.4375);
    return { chronoD, corrD: useCorr ? Math.round(chronoD - (40 - ga) * 7) : chronoD, useCorr };
  } catch (e) { return null; }
}
function hriSchedule(dobISO, gaWk, dischargeISO) {
  const out = [];
  try {
    const P = hriPack();
    if (!P || !dobISO) return out;
    const edd = hriEdd(dobISO, gaWk);
    for (const v of (P.schedule || [])) {
      let date = "";
      const mD = /^edd\+(\d+)d$/.exec(v.basis || ""), mM = /^edd\+(\d+)mo$/.exec(v.basis || "");
      if (v.basis === "edd") date = edd;
      else if (mD) date = hriAddDays(edd, +mD[1]);
      else if (mM) date = hriAddMo(edd, +mM[1]);
      else if (v.basis === "discharge+14d" && dischargeISO) date = hriAddDays(dischargeISO, 14);
      if (date) out.push({ id: v.id, label: v.label, date, focus: v.focus || [] });
    }
    out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  } catch (e) {}
  return out;
}
function hriStatus(vdate, doneList, visitId, today) {
  if ((doneList || []).some((d) => d && d.visitId === visitId)) return "done";
  if (!vdate) return "upcoming";
  if (String(vdate) < String(today)) return "overdue";
  const P = hriPack();
  if (String(vdate) <= hriAddDays(today, (P && P.dueWindowD) || 14)) return "due";
  return "upcoming";
}
/* ROP: eligible ≤1500 g or ≤30 wk (+ unstable); first exam 31 wk PMA or
   4 wk chronological, whichever is LATER (AAP 2018). */
function hriRopEligible(gaWk, bwKg, unstable) {
  try {
    const P = hriPack();
    if (unstable) return true;
    const ga = hriNum(gaWk), bw = hriNum(bwKg);
    return (ga !== null && ga <= ((P && P.rop && P.rop.eligGAwk) || 30)) ||
      (bw !== null && bw <= ((P && P.rop && P.rop.eligBWkg) || 1.5));
  } catch (e) { return false; }
}
function hriRopFirst(gaWk, dobISO) {
  try {
    const P = hriPack();
    const ga = hriNum(gaWk);
    if (ga === null || !dobISO) return null;
    const pmaWk = (P && P.rop && P.rop.pmaFirstWk) || 31;
    const chD = (P && P.rop && P.rop.chronoFirstD) || 28;
    const days = Math.max(chD, Math.round((pmaWk - ga) * 7));
    return { date: hriAddDays(dobISO, days), days, basis: days > chD ? `${pmaWk} wk postmenstrual age` : `${chD / 7} wk chronological` };
  } catch (e) { return null; }
}
/* CCHD pulse-ox (AAP 2025): pass needs ≥95% BOTH sites + ≤3% diff;
   <90% anywhere fails outright; one 1-hour retest only. */
function hriCchd(hand, foot, attempt) {
  const h = hriNum(hand), f = hriNum(foot);
  const P = hriPack();
  const pass = (P && P.cchd && P.cchd.passBoth) || 95, diff = (P && P.cchd && P.cchd.maxDiff) || 3, fail = (P && P.cchd && P.cchd.failAny) || 90;
  if (h === null || f === null) return { result: "invalid", action: "Enter both saturations." };
  if (h < fail || f < fail) return { result: "fail", action: `Any SpO₂ <${fail}% — immediate evaluation + echocardiogram.` };
  if (h >= pass && f >= pass && Math.abs(h - f) <= diff) return { result: "pass", action: "Pass — routine care. (A screen can still miss CCHD — stay alert.)" };
  if ((+attempt || 1) >= 2) return { result: "fail", action: "Still abnormal on repeat — immediate evaluation + echocardiogram." };
  return { result: "retest", action: "Repeat BOTH sites in 1 hour (single retest per AAP 2025)." };
}
function hriEnrollValid(risks) {
  const errs = [];
  if (!(risks || []).length) errs.push("Pick at least one risk factor.");
  return errs;
}
function hriDueFor(child, today) {
  const out = { enrolled: false, ga: null, edd: null, corr: null, visits: [], overdue: [], due: [] };
  try {
    const h = (child && child.hri) || {};
    if (!h.enrolled || h.discharged) return out;
    out.enrolled = true;
    out.ga = hriGaOf(child);
    out.edd = hriEdd(child.dob, out.ga);
    out.corr = hriCorr(child.dob, out.ga, today);
    const sch = hriSchedule(child.dob, out.ga, hriDischargeDate(child));
    out.visits = sch.map((v) => ({ ...v, status: hriStatus(v.date, h.done, v.id, today) }));
    out.overdue = out.visits.filter((v) => v.status === "overdue");
    out.due = out.visits.filter((v) => v.status === "due");
  } catch (e) {}
  return out;
}
function hriDefaulters(children, today) {
  const out = [];
  try {
    for (const c of (children || [])) {
      const d = hriDueFor(c, today);
      if (d.enrolled && d.overdue.length) out.push({ child: c, overdue: d.overdue, due: d.due });
    }
    out.sort((a, b) => String(a.overdue[0].date).localeCompare(String(b.overdue[0].date)));
  } catch (e) {}
  return out;
}
function hriRopLine(c) {
  // ROP first-exam due date vs recorded screen — for the HRI page banner.
  try {
    const ga = hriGaOf(c), bw = hriBwOf(c);
    if (!hriRopEligible(ga, bw, false)) return null;
    const first = hriRopFirst(ga, c.dob);
    if (!first) return null;
    const rec = c && c.nb && c.nb.screen && c.nb.screen.rop;
    return { ...first, recorded: !!(rec && rec.date), res: (rec && rec.res) || "" };
  } catch (e) { return null; }
}

/* ---------------- Scores registry ---------------- */
function hriRopCalc(v) {
  v = v || {};
  const ga = hriNum(v.ga), bw = hriNum(v.bwKg);
  const elig = hriRopEligible(ga, bw, !!v.unstable);
  const first = hriRopFirst(ga, v.dob);
  if (ga === null || !v.dob) return { ok: false, reason: "Gestation + date of birth needed." };
  if (!elig) return { ok: true, eligible: false, interp: "Not in the routine screening group (≤1500 g or ≤30 wk) — screen if unstable course." };
  return { ok: true, eligible: true, date: first.date, basis: first.basis, interp: `First ROP exam by ${first.date} (${first.basis}, whichever later rule).` };
}
function hriCchdCalc(v) {
  v = v || {};
  const r = hriCchd(v.hand, v.foot, v.attempt);
  if (r.result === "invalid") return { ok: false, reason: r.action };
  return { ok: true, result: r.result, action: r.action, interp: r.action };
}
try {
  if (typeof Scores !== "undefined" && Scores && typeof Scores.register === "function") {
    Scores.register({ id: "rop-first", title: "ROP first-exam timing (AAP 2018)", source: "Fierson et al, Pediatrics 2018;142(6):e20183061", calc: hriRopCalc });
    Scores.register({ id: "cchd", title: "CCHD pulse-ox screen (AAP 2025)", source: "AAP clinical report, Pediatrics 2025;155(1):e2024069667", calc: hriCchdCalc });
  }
} catch (e) {}

/* ---------------- UI ---------------- */
function hriDefaulterHTML() {
  let kids = [];
  try { kids = (typeof DB !== "undefined" && DB.children) || []; } catch (e) {}
  let today = "";
  try { today = todayISO(); } catch (e) {}
  const list = hriDefaulters(kids, today);
  if (!list.length) return `<div class="card"><h3>📋 Defaulter list</h3><div class="hint">No overdue HRI visits — all enrolled babies are on schedule. ✅</div></div>`;
  const rows = list.map((e) => {
    const od = e.overdue.map((v) => `${hriEsc(v.label)} (${hriEsc(v.date)})`).join("; ");
    return `<tr><td><b>${hriEsc(e.child.name)}</b></td><td style="font-size:12.5px;color:var(--red)">${od}</td>` +
      `<td style="white-space:nowrap"><button class="btn btn-o btn-xs" onclick="DB.activeId='${hriEsc(e.child.id)}';renderAll()">Open</button> ` +
      `<button class="btn btn-p btn-xs" onclick="hriBook('${hriEsc(e.child.id)}','${hriEsc(e.overdue[0].date)}','HRI: ${hriEsc(e.overdue[0].label)}')">📅 Book</button></td></tr>`;
  }).join("");
  return `<div class="card"><h3>📋 Defaulter list (${list.length})</h3><table class="tbl"><tr><th>Baby</th><th>Overdue</th><th></th></tr>${rows}</table></div>`;
}
function renderHri() {
  const box = document.getElementById("hriBox");
  if (!box) return;
  let c = null;
  try { c = (typeof child === "function") ? child() : null; } catch (e) {}
  if (!c) { box.innerHTML = hriDefaulterHTML() + `<div class="card"><div class="hint">Select a child to enroll or view their schedule.</div></div>`; return; }
  const h = hriOf(c);
  let today = "";
  try { today = todayISO(); } catch (e) {}
  const d = hriDueFor(c, today);
  const P = hriPack();
  let body = "";
  if (!h.enrolled) {
    const risks = (P && P.riskFactors) || [];
    body = `<div class="card"><h3>🍼 Enroll ${hriEsc(c.name)} in HRI follow-up</h3>
      <div class="hint">High-risk infant programme — corrected-age visits to 24 months. GA ${d.ga !== null ? d.ga + " wk" : "—"} · EDD ${d.edd || "—"}.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${risks.map((r, i) => `<label class="sib" style="font-size:12.5px"><input type="checkbox" ${h.risks.includes(r) ? "checked" : ""} onchange="hriToggleRisk(${i})"> ${hriEsc(r)}</label>`).join("")}</div>
      <div><label>Note (optional)</label><input id="hriNote" value="${hriEsc(h.note || "")}" placeholder="e.g. HIE-II, cooled 72h" oninput="hriSetNote(this.value)"></div>
      <button class="btn btn-p btn-sm" style="margin-top:8px" onclick="hriEnroll()">Enroll</button></div>`;
  } else {
    const dot = (s) => s === "done" ? "✅" : s === "overdue" ? "🔴" : s === "due" ? "🟡" : "⚪";
    const rows = d.visits.map((v) => `<tr><td><b>${hriEsc(v.label)}</b><br><span style="font-size:11.5px;color:var(--muted)">${v.focus.map(hriEsc).join(" · ")}</span></td><td>${hriEsc(v.date)}</td><td>${dot(v.status)} ${v.status}</td>
      <td style="white-space:nowrap">${v.status === "done"
        ? `<button class="btn btn-o btn-xs" onclick="hriUndone('${v.id}')">↩</button>`
        : `<button class="btn btn-p btn-xs" onclick="hriDone('${v.id}')">✓ Done</button> <button class="btn btn-o btn-xs" onclick="hriBook('${hriEsc(c.id)}','${hriEsc(v.date)}','HRI: ${hriEsc(v.label)}')">📅</button>`}</td></tr>`).join("");
    const rop = hriRopLine(c);
    let ropBanner = "";
    if (rop) {
      const over = !rop.recorded && rop.date < today;
      ropBanner = `<div class="alert ${over ? "a-red" : rop.recorded ? "a-green" : "a-amber"}" style="margin-top:8px">👁️ <div>ROP: first exam by <b>${hriEsc(rop.date)}</b> (${hriEsc(rop.basis)})${rop.recorded ? ` — recorded (${hriEsc(rop.res || "done")}) ✅` : over ? " — OVERDUE 🔴" : " — due 🟡"}</div></div>`;
    }
    body = `<div class="card"><h3>🍼 HRI — ${hriEsc(c.name)}</h3>
      <div class="hint">Enrolled ${hriEsc(h.date || "")} · GA ${d.ga !== null ? d.ga + " wk" : "—"} · EDD ${d.edd || "—"}${d.corr && d.corr.useCorr ? ` · corrected age ${d.corr.corrD}d today` : ""}<br>Risks: ${h.risks.map(hriEsc).join("; ") || "—"}${h.note ? ` · ${hriEsc(h.note)}` : ""}</div>
      ${d.overdue.length ? `<div class="alert a-red" style="margin-top:8px">🔴 <div><b>${d.overdue.length} overdue:</b> ${d.overdue.map((v) => hriEsc(v.label)).join("; ")} — book + recall.</div></div>` : ""}
      ${ropBanner}
      <table class="tbl" style="margin-top:8px"><tr><th>Visit</th><th>Due</th><th>Status</th><th></th></tr>${rows}</table>
      <button class="btn btn-o btn-sm" style="margin-top:8px" onclick="hriDischarge()">Discharge from HRI</button></div>`;
  }
  box.innerHTML = hriDefaulterHTML() + body;
}
function hriToggleRisk(i) {
  const c = (typeof child === "function") ? child() : null;
  if (!c) return;
  const P = hriPack();
  const risks = (P && P.riskFactors) || [];
  const h = hriOf(c), name = risks[i];
  if (!name) return;
  const ix = h.risks.indexOf(name);
  if (ix >= 0) h.risks.splice(ix, 1); else h.risks.push(name);
  try { save(); renderHri(); } catch (e) {}
}
function hriSetNote(v) { try { const c = child(); if (c) { hriOf(c).note = v; save(); } } catch (e) {} }
function hriEnroll() {
  const c = (typeof child === "function") ? child() : null;
  if (!c) return;
  const h = hriOf(c);
  const errs = hriEnrollValid(h.risks);
  if (errs.length) { alert(errs.join("\n")); return; }
  if (typeof guardSubmit === "function" && !guardSubmit("hri-enroll")) return;
  h.enrolled = true;
  try { h.date = todayISO(); } catch (e) {}
  h.discharged = "";
  try { if (typeof auditSafe === "function") auditSafe("HRI enroll", c.name + " — " + h.risks.join("; ")); } catch (e2) {}
  try { save(); renderAll(); } catch (e3) {}
}
function hriDischarge() {
  const c = (typeof child === "function") ? child() : null;
  if (!c || !confirm(`Discharge ${c.name} from HRI follow-up? Past visits stay on record.`)) return;
  try { hriOf(c).discharged = todayISO(); } catch (e) {}
  try { if (typeof auditSafe === "function") auditSafe("HRI discharge", c.name); } catch (e2) {}
  try { save(); renderAll(); } catch (e3) {}
}
function hriDone(visitId) {
  const c = (typeof child === "function") ? child() : null;
  if (!c) return;
  const h = hriOf(c);
  if (!h.done.some((x) => x && x.visitId === visitId)) {
    let t = "";
    try { t = todayISO(); } catch (e) {}
    h.done.push({ visitId, date: t });
  }
  try { save(); renderHri(); } catch (e) {}
}
function hriUndone(visitId) {
  const c = (typeof child === "function") ? child() : null;
  if (!c) return;
  hriOf(c).done = hriOf(c).done.filter((x) => !x || x.visitId !== visitId);
  try { save(); renderHri(); } catch (e) {}
}
function hriBook(childId, dateISO, label) {
  try {
    DB.activeId = childId; save();
    SCH.date = dateISO;
    if (typeof openApptModal === "function") openApptModal();
    const ty = document.getElementById("aType"), nt = document.getElementById("aNote");
    if (ty) ty.value = "Follow-up";
    if (nt) nt.value = label || "HRI follow-up";
  } catch (e) {}
}
var Hri = {
  pack: hriPack, addDays: hriAddDays, addMo: hriAddMo, diffD: hriDiffD,
  gaOf: hriGaOf, bwOf: hriBwOf, dischargeDate: hriDischargeDate,
  edd: hriEdd, corr: hriCorr, schedule: hriSchedule, status: hriStatus,
  ropEligible: hriRopEligible, ropFirst: hriRopFirst, cchd: hriCchd,
  enrollValid: hriEnrollValid, dueFor: hriDueFor, defaulters: hriDefaulters, ropLine: hriRopLine,
};
try { if (typeof window !== "undefined" && window) window.Hri = Hri; } catch (e) {}

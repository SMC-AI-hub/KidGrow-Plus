/* =====================================================
   NeoKid Care — Clinic ops (Round 1)
   Appointments · vaccine reminders · defaulter tracking ·
   coverage & nutrition analytics.
   Pure engine (testable) + DOM renderers.
   ===================================================== */
const SCH = { date: null, lang: "en" };

/* ---------------- pure helpers ---------------- */
function dayDiff(aISO, bISO) {
  return Math.round((new Date(bISO + "T00:00:00") - new Date(aISO + "T00:00:00")) / 86400000);
}
function dmy(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/* Missing-dose list for one child. band: defaulter(≥30d) · overdue(1–29d) · due14 · upcoming */
function dueItemsForChild(c, today) {
  const out = [];
  if (!c || !c.dob) return out;
  VACCINE_SCHEDULE.forEach((v) => {
    const due = dueDateFor(c, v);
    v.vaccines.forEach((vx) => {
      if (c.vaccines && c.vaccines[vx.code]) return;
      const d = dayDiff(due, today);
      let band = "upcoming";
      if (d >= 30) band = "defaulter";
      else if (d > 0) band = "overdue";
      else if (d >= -14) band = "due14";
      out.push({ childId: c.id, child: c.name, code: vx.code, name: vx.name, dose: vx.dose, visit: v.label, due, daysOver: d, band });
    });
  });
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
function clinicDueList(children, today) {
  const all = [];
  (children || []).forEach((c) => all.push(...dueItemsForChild(c, today)));
  return all.sort((a, b) => a.due.localeCompare(b.due));
}
function actionItemsForChild(c, today) {
  return dueItemsForChild(c, today).filter((i) => i.band !== "upcoming");
}

/* ---------------- appointments (pure) ---------------- */
function apptsOn(appts, dateISO) {
  return (appts || []).filter((a) => a.date === dateISO).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}
function upcomingAppts(appts, today, days) {
  const end = addDays(today, days || 14);
  return (appts || []).filter((a) => !a.done && a.date >= today && a.date <= end)
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}

/* ---------------- WhatsApp + message templates (pure) ---------------- */
function normPhone(p) {
  const d = String(p || "").replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  if (d.length === 11 && d[0] === "0") return "91" + d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return d;
  if (d.length === 13 && d.startsWith("910")) return "91" + d.slice(3);
  return d.length >= 10 ? d : null;
}
function waLink(phone, text) {
  const n = normPhone(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : null;
}
function reminderMsg(c, items, S, lang) {
  S = S || {};
  const parent = c.mother || c.father || "Parent";
  const list = items.slice(0, 4).map((i) => `${i.name} ${i.dose || ""}`.trim()).join(", ") + (items.length > 4 ? ` +${items.length - 4} more` : "");
  const when = dmy(items[0] ? items[0].due : "");
  const missed = items[0] && (items[0].band === "defaulter" || items[0].band === "overdue");
  const clinic = S.clinic || "your clinic", addr = S.addr || "", doc = S.doctor || "";
  if (lang === "ta") {
    return missed
      ? `வணக்கம் ${parent}! ${clinic}: ${c.name} குழந்தைக்கு ${list} தடுப்பூசி தவறிவிட்டது (தேதி: ${when}). விரைவில் வந்து போட்டுக்கொள்ளவும். ${addr} — ${doc}`.trim()
      : `வணக்கம் ${parent}! ${clinic} நினைவூட்டல்: ${c.name} குழந்தைக்கு ${list} தடுப்பூசி போடும் நாள் நெருங்குகிறது (தேதி: ${when}). மறக்காமல் வாருங்கள். ${addr} — ${doc}`.trim();
  }
  if (lang === "hi") {
    return missed
      ? `नमस्ते ${parent}! ${clinic}: ${c.name} की ${list} टीका छूट गया है (तारीख: ${when})। कृपया जल्द आकर लगवाएं। ${addr} — ${doc}`.trim()
      : `नमस्ते ${parent}! ${clinic} से याद: ${c.name} की ${list} टीका तारीख ${when} नज़दीक है। आना न भूलें। ${addr} — ${doc}`.trim();
  }
  return missed
    ? `Hello ${parent}! ${clinic}: ${c.name} has MISSED ${list} (was due ${when}). Please come soon for catch-up. ${addr} — ${doc}`.trim()
    : `Hello ${parent}! Reminder from ${clinic}: ${c.name} is due for ${list} on ${when}. Please visit us: ${addr} — ${doc}`.trim();
}

/* ---------------- analytics engine (pure) ---------------- */
function coverageStats(children, today) {
  const rows = [];
  VACCINE_SCHEDULE.forEach((v) => v.vaccines.forEach((vx) => {
    let el = 0, gv = 0;
    (children || []).forEach((c) => {
      if (!c || !c.dob) return;
      if (dueDateFor(c, v) <= today) { el++; if (c.vaccines && c.vaccines[vx.code]) gv++; }
    });
    rows.push({ code: vx.code, name: vx.name, dose: vx.dose, eligible: el, given: gv, pct: el ? Math.round((gv / el) * 100) : null });
  }));
  const pool = {};
  rows.forEach((r) => {
    const g = (typeof groupForCode === "function") ? groupForCode(r.code) : "other";
    pool[g] = pool[g] || { eligible: 0, given: 0 };
    pool[g].eligible += r.eligible; pool[g].given += r.given;
  });
  Object.keys(pool).forEach((g) => { pool[g].pct = pool[g].eligible ? Math.round((pool[g].given / pool[g].eligible) * 100) : null; });
  const has = (code) => (children || []).filter((c) => c.vaccines && c.vaccines[code]).length;
  const dropout = (a, b) => {
    const s = has(a), e = has(b);
    return { from: a, to: b, started: s, finished: e, pct: s ? Math.round(((s - e) / s) * 100) : null };
  };
  const fic = (children || []).filter((c) => c && c.dob && actionItemsForChild(c, today).filter((i) => i.band === "defaulter" || i.band === "overdue" || (i.band === "due14" && i.daysOver >= 0)).length === 0).length;
  return { rows, pool, dtpDrop: dropout("DTP1", "DTP3"), bcgMmrDrop: dropout("BCG", "MMR1"), fic, total: (children || []).length };
}
function nutritionSnapshot(children) {
  const s = { n: 0, sam: 0, mam: 0, normal: 0, overweight: 0, obese: 0, stunted: 0, noData: 0 };
  (children || []).forEach((c) => {
    const lm = latestMeasure(c);
    if (!lm) { s.noData++; return; }
    s.n++;
    let cl = null;
    try { cl = classifyGrowth(c, lm); } catch (e) { s.noData++; s.n--; return; }
    const wl = ((cl.wt && cl.wt.label) || "").toLowerCase();
    const bl = ((cl.bmi && cl.bmi.label) || "").toLowerCase();
    const hl = ((cl.ht && cl.ht.label) || "").toLowerCase();
    const ml = ((cl.muac && cl.muac.label) || "").toLowerCase();
    if (/severe wasting|severely underweight|sam by/.test(wl + " " + ml)) s.sam++;
    else if (/wasting \(mam\)|underweight|mam by/.test(wl + " " + ml + " " + bl)) s.mam++;
    else if (/obes/.test(bl)) s.obese++;
    else if (/overweight/.test(bl)) s.overweight++;
    else s.normal++;
    if (/stunt/.test(hl)) s.stunted++;
  });
  return s;
}
function falteringFlags(children) {
  const out = [];
  (children || []).forEach((c) => {
    const ms = [...(c.measures || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (ms.length < 2) return;
    const m1 = ms[ms.length - 2], m2 = ms[ms.length - 1];
    const gap = dayDiff(m1.date, m2.date);
    if (gap < 7 || gap > 365) return;
    let z1 = NaN, z2 = NaN;
    try { z1 = (classifyGrowth(c, m1).wt || {}).z; z2 = (classifyGrowth(c, m2).wt || {}).z; } catch (e) { return; }
    if (isFinite(z1) && isFinite(z2) && (z1 - z2) >= 1.0) {
      out.push({ childId: c.id, child: c.name, from: m1.date, to: m2.date, z1: +z1.toFixed(2), z2: +z2.toFixed(2), drop: +(z1 - z2).toFixed(2) });
    }
  });
  return out;
}
function visitVolume(children, today, months) {
  months = months || 6;
  const keys = [], d = new Date(today + "T00:00:00");
  for (let i = months - 1; i >= 0; i--) { const t = new Date(d.getFullYear(), d.getMonth() - i, 1); keys.push(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}`); }
  const counts = {}; keys.forEach((k) => (counts[k] = 0));
  (children || []).forEach((c) => (c.visits || []).forEach((v) => {
    const k = (v.date || "").slice(0, 7);
    if (k in counts) counts[k]++;
  }));
  return keys.map((k) => ({ month: k, n: counts[k] }));
}

/* ---------------- schedule page ---------------- */
function renderSchedule() {
  if (!$("pg-schedule")) return;
  DB.appts = DB.appts || [];
  const t = todayISO();
  if (!SCH.date) SCH.date = t;
  const due = clinicDueList(DB.children, t);
  const nDef = due.filter((i) => i.band === "defaulter").length;
  const nOver = due.filter((i) => i.band === "overdue").length;
  const nDue = due.filter((i) => i.band === "due14").length;
  const tod = apptsOn(DB.appts, SCH.date);
  const todAll = apptsOn(DB.appts, t);
  $("schStats").innerHTML = `
    <div class="stat" style="--ac:var(--blue)"><div><div class="n">${todAll.filter((a) => !a.done).length}</div><div class="l">Appointments today</div></div><div class="e">📅</div></div>
    <div class="stat" style="--ac:var(--red)"><div><div class="n">${nDef}</div><div class="l">Defaulter doses (≥30d)</div></div><div class="e">🔴</div></div>
    <div class="stat" style="--ac:var(--amber)"><div><div class="n">${nOver}</div><div class="l">Overdue doses</div></div><div class="e">🟠</div></div>
    <div class="stat" style="--ac:var(--teal)"><div><div class="n">${nDue}</div><div class="l">Due within 14 days</div></div><div class="e">🟡</div></div>`;
  const up = upcomingAppts(DB.appts, t, 14).filter((a) => a.date !== SCH.date).slice(0, 8);
  const nm = (id) => { const k = DB.children.find((x) => x.id === id); return k ? k.name : "—"; };
  $("apptList").innerHTML = `
    <div class="toolbar" style="margin-bottom:10px">
      <input type="date" value="${SCH.date}" data-onchange="schDateSel" style="max-width:170px">
      <span class="sp"></span><button class="btn btn-p btn-sm" data-act="openApptModal">+ Book</button>
    </div>
    ${tod.length ? tod.map((a) => `
      <div class="vac-row" style="${a.done ? "opacity:.55" : ""}">
        <div class="grow"><b>${esc(a.time || "—")}</b> · ${esc(nm(a.childId))} <span class="badge b-gray">${esc(a.type || "Visit")}</span>
        ${a.note ? `<br><span style="font-size:12.5px;color:var(--muted)">${esc(a.note)}</span>` : ""}</div>
        ${typeof apptMsgBtns === "function" ? apptMsgBtns(a) : ""}
        <button class="btn ${a.done ? "btn-o" : "btn-d"} btn-xs" data-act="toggleAppt" data-arg="${a.id}">${a.done ? "↩ Undo" : "✓ Done"}</button>
        <button class="btn btn-danger btn-xs" data-act="delAppt" data-arg="${a.id}">✕</button>
      </div>`).join("") : `<div style="font-size:13px;color:var(--muted);margin-bottom:8px">No appointments on ${fmtDate(SCH.date)}.</div>`}
    ${up.length ? `<div class="hint" style="margin:10px 0 4px">Coming up (14 days)</div>` + up.map((a) => `
      <div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)"><b>${fmtDate(a.date)}</b> ${esc(a.time || "")} · ${esc(nm(a.childId))} <span style="color:var(--muted)">(${esc(a.type || "Visit")})</span> <button class="btn btn-o btn-xs" data-act="copyAppt" data-arg="${a.id}">⧉</button></div>`).join("") : ""}`;
  renderReminders(due);
}
function renderReminders(due) {
  due = due || clinicDueList(DB.children, todayISO());
  const order = { defaulter: 0, overdue: 1, due14: 2 };
  const act = due.filter((i) => i.band !== "upcoming").sort((a, b) => order[a.band] - order[b.band] || a.due.localeCompare(b.due));
  const byChild = {};
  act.forEach((i) => { (byChild[i.childId] = byChild[i.childId] || []).push(i); });
  const kids = Object.keys(byChild).sort((a, b) => order[byChild[a][0].band] - order[byChild[b][0].band]);
  const dot = { defaulter: "🔴", overdue: "🟠", due14: "🟡" };
  $("remList").innerHTML = `
    <div class="toolbar" style="margin-bottom:10px">
      <span style="font-size:13px;color:var(--muted)">Message language:</span>
      <select data-onchange="schLangSel" style="max-width:150px">
        <option value="en"${SCH.lang === "en" ? " selected" : ""}>English</option>
        <option value="hi"${SCH.lang === "hi" ? " selected" : ""}>हिन्दी (Hindi)</option>
        <option value="ta"${SCH.lang === "ta" ? " selected" : ""}>தமிழ் (Tamil)</option>
      </select>
      <span class="sp"></span><button class="btn btn-o btn-xs" data-act="copyDayList">📋 Copy day list</button><span style="font-size:12.5px;color:var(--muted)">${act.length} dose(s) need action</span>
    </div>
    ${kids.length ? kids.map((id) => {
      const c = DB.children.find((x) => x.id === id);
      const items = byChild[id];
      const msg = c ? reminderMsg(c, items, DB.settings, SCH.lang) : "";
      const wa = c ? waLink(c.phone, msg) : null;
      return `<div class="vac-row"><div class="grow">${dot[items[0].band]} <b>${esc(items[0].child)}</b>
        <span style="font-size:12px;color:var(--muted)">${c && c.phone ? esc(c.phone) : "no phone"}</span>${typeof remindedBadge === "function" ? remindedBadge(id) : ""}<br>
        <span style="font-size:13px">${items.slice(0, 5).map((i) => `${esc(i.name)} ${esc(i.dose || "")} <span style="color:var(--muted)">(${fmtDate(i.due)}${i.daysOver > 0 ? `, +${i.daysOver}d` : ""})</span>`).join(" · ")}</span>
        ${items.length > 5 ? `<span style="font-size:12px;color:var(--muted)"> +${items.length - 5} more</span>` : ""}</div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          ${wa ? `<a class="btn btn-wa btn-xs" href="${wa}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
          <button class="btn btn-o btn-xs" data-act="copyMsg" data-arg="${id}">⧉ Copy</button>
          <button class="btn btn-o btn-xs" title="Tick when messaged" data-act="markReminded" data-arg="${id}">✓</button>
        </div></div>`;
    }).join("") : `<div class="alert a-green" style="margin:0">✅ <div>No overdue or upcoming doses. All children are up to date!</div></div>`}`;
}
function copyMsg(childId) {
  const c = DB.children.find((x) => x.id === childId);
  if (!c) return;
  const msg = reminderMsg(c, actionItemsForChild(c, todayISO()), DB.settings, SCH.lang);
  const done = () => alert("Message copied — paste into SMS / WhatsApp.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(msg).then(done, () => { window.prompt("Copy message:", msg); });
  else window.prompt("Copy message:", msg);
}
/* appointment CRUD */
function openApptModal() {
  if (!DB.children.length) return alert("Register a child first.");
  $("aId").value = "";
  $("aChild").innerHTML = DB.children.map((c) => `<option value="${c.id}"${c.id === DB.activeId ? " selected" : ""}>${esc(c.name)}</option>`).join("");
  $("aDate").value = SCH.date || todayISO();
  $("aTime").value = ""; $("aType").value = "Vaccine"; $("aNote").value = "";
  openModal("mAppt");
}
function saveAppt() {
  DB.appts = DB.appts || [];
  if (!$("aChild").value || !$("aDate").value) return alert("Child and date are required.");
  DB.appts.push({ id: uid(), childId: $("aChild").value, date: $("aDate").value, time: $("aTime").value, type: $("aType").value, note: $("aNote").value.trim(), done: false });
  SCH.date = $("aDate").value;
  auditSafe("Appointment", $("aDate").value + " " + ($("aTime").value || "") + " — " + ((DB.children.find((x) => x.id === $("aChild").value) || {}).name || ""));
  save(); closeModal("mAppt"); renderAll();
}
function toggleAppt(id) {
  const a = (DB.appts || []).find((x) => x.id === id);
  if (a) { a.done = !a.done; save(); renderAll(); }
}
function delAppt(id) {
  if (!needSafe(2, "delete appointments")) return;
  if (!confirm("Delete this appointment?")) return;
  DB.appts = (DB.appts || []).filter((x) => x.id !== id);
  save(); renderAll();
}
/* dashboard pulse */
function clinicPulseHTML() {
  DB.appts = DB.appts || [];
  const t = todayISO();
  const tod = apptsOn(DB.appts, t).filter((a) => !a.done).length;
  const due = clinicDueList(DB.children, t);
  const od = due.filter((i) => i.band === "defaulter" || i.band === "overdue").length;
  const dn = due.filter((i) => i.band === "due14").length;
  const nSt = (typeof stockCritCount === "function") ? stockCritCount() : 0;
  if (!tod && !od && !dn && !nSt) return `<div class="alert a-green" style="margin:0">✅ <div>All clear — no appointments today, no overdue doses, stock healthy.</div></div>`;
  return `<div style="display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:14px">
    <span>📅 <b>${tod}</b> appointment${tod === 1 ? "" : "s"} today</span>
    <span>🔴 <b>${od}</b> overdue dose${od === 1 ? "" : "s"}</span>
    <span>🟡 <b>${dn}</b> due in 14 days</span>
    ${typeof stockPulseBit === "function" ? stockPulseBit(nSt) : ""}
    <span class="sp" style="flex:1"></span>
    <button class="btn btn-p btn-sm" data-act="goPage" data-arg="schedule">Open schedule →</button></div>`;
}

/* ---------------- analytics page ---------------- */
function renderAnalytics() {
  if (!$("pg-analytics")) return;
  const t = todayISO(), cov = coverageStats(DB.children, t);
  let hriDef = 0, chrN = 0;
  try { hriDef = (typeof Hri !== "undefined" && Hri.defaulters) ? Hri.defaulters(DB.children, t).length : 0; } catch (eH) {}
  try { chrN = (typeof Chronic !== "undefined" && Chronic.conds) ? DB.children.filter((cc) => Chronic.conds(cc).length).length : 0; } catch (eC) {}
  const nut = nutritionSnapshot(DB.children), falt = falteringFlags(DB.children), vol = visitVolume(DB.children, t, 6);
  const d = (x, good) => (x.pct === null ? "—" : `${x.pct}%`);
  $("anStats").innerHTML = `
    <div class="stat" style="--ac:var(--teal)"><div><div class="n">${cov.fic}/${cov.total}</div><div class="l">Fully immunised for age</div></div><div class="e">🛡️</div></div>
    <div class="stat" style="--ac:${cov.dtpDrop.pct !== null && cov.dtpDrop.pct > 10 ? "var(--red)" : "var(--green)"}"><div><div class="n">${d(cov.dtpDrop)}</div><div class="l">DTP1→DTP3 dropout (goal &lt;10%)</div></div><div class="e">📉</div></div>
    <div class="stat" style="--ac:${nut.sam ? "var(--red)" : "var(--green)"}"><div><div class="n">${nut.sam + nut.mam}</div><div class="l">SAM+MAM now (${nut.sam} SAM, of ${nut.n} screened)</div></div><div class="e">⚠️</div></div>
    <div class="stat" style="--ac:${falt.length ? "var(--amber)" : "var(--green)"}"><div><div class="n">${falt.length}</div><div class="l">Growth-faltering alerts (of ${(typeof MetricsPure !== "undefined" ? MetricsPure.withMinMeasures(DB.children, 2) : "?")} with 2+ measures)</div></div><div class="e">🚨</div></div>
    <div class="stat" style="--ac:${hriDef ? "var(--amber)" : "var(--green)"}"><div><div class="n">${hriDef}</div><div class="l">HRI defaulters (overdue follow-up)</div></div><div class="e">📅</div></div>
    <div class="stat" style="--ac:var(--blue)"><div><div class="n">${chrN}</div><div class="l">Children on chronic flowsheets</div></div><div class="e">📊</div></div>`;
  const gLabel = { bcg: "BCG", opv: "OPV", hepb: "Hepatitis B", dtp: "DTP / combos", ipv: "Polio (IPV)", hib: "Hib", rota: "Rotavirus", pcv: "Pneumococcal", flu: "Influenza", mmr: "MMR / MR", typhoid: "Typhoid", vita: "Vitamin A", hepa: "Hepatitis A", je: "Japanese encephalitis", varicella: "Varicella", tdap: "Tdap / Td", hpv: "HPV" };
  const pools = Object.keys(cov.pool).filter((g) => cov.pool[g].eligible > 0)
    .sort((a, b) => (cov.pool[a].pct ?? 101) - (cov.pool[b].pct ?? 101));
  $("anCov").innerHTML = `<div class="hint">Share of due doses actually given (eligible = due date passed). Lowest first.</div>
    <table class="tbl"><tr><th>Antigen</th><th>Given / due</th><th style="min-width:130px">Coverage</th></tr>
    ${pools.map((g) => { const p = cov.pool[g]; return `<tr><td><b>${esc(gLabel[g] || g)}</b></td><td>${p.given}/${p.eligible}</td>
      <td><div style="display:flex;gap:8px;align-items:center"><div class="bar" style="flex:1"><i style="width:${p.pct}%;${p.pct < 80 ? "background:var(--red)" : p.pct < 95 ? "background:var(--amber)" : ""}"></i></div><b>${p.pct}%</b></div></td></tr>`; }).join("")}</table>
    <div class="hint">Dropout: DTP1→DTP3 ${cov.dtpDrop.started ? `${cov.dtpDrop.started - cov.dtpDrop.finished}/${cov.dtpDrop.started} (${d(cov.dtpDrop)})` : "—"} · BCG→MMR1 ${cov.bcgMmrDrop.started ? `${cov.bcgMmrDrop.started - cov.bcgMmrDrop.finished}/${cov.bcgMmrDrop.started} (${d(cov.bcgMmrDrop)})` : "—"}</div>`;
  const mx = Math.max(1, nut.sam, nut.mam, nut.normal, nut.overweight, nut.obese);
  const nrow = (label, n, col) => `<tr><td>${label}</td><td><b>${n}</b></td><td><div class="bar"><i style="width:${Math.round((n / mx) * 100)}%;background:${col}"></i></div></td></tr>`;
  $("anNut").innerHTML = `<div class="hint">Latest measurement per child (${nut.n} with data${nut.noData ? `, ${nut.noData} without` : ""}). Stunted (low height-for-age): <b>${nut.stunted}</b>.</div>
    <table class="tbl"><tr><th>Status</th><th>n</th><th></th></tr>
    ${nrow("🔴 Severe (SAM / severe)", nut.sam, "var(--red)")}
    ${nrow("🟠 Moderate (MAM / underweight)", nut.mam, "var(--amber)")}
    ${nrow("🟢 Normal", nut.normal, "var(--green)")}
    ${nrow("🟡 Overweight", nut.overweight, "var(--amber)")}
    ${nrow("🔴 Obesity", nut.obese, "var(--red)")}</table>`;
  $("anFalt").innerHTML = falt.length
    ? `<div class="hint">Weight-for-age z fell ≥ 1.0 between the last two visits — review feeding, illness, psychosocial causes.</div>` + falt.map((f) =>
      `<div class="vac-row"><div class="grow">🚨 <b>${esc(f.child)}</b><br><span style="font-size:12.5px;color:var(--muted)">WAZ ${f.z1} → ${f.z2} (Δ ${f.drop}) · ${fmtDate(f.from)} → ${fmtDate(f.to)}</span></div>
       <button class="btn btn-o btn-xs" data-act="followSetActive" data-arg="${f.childId}">Open growth →</button></div>`).join("")
    : `<div style="font-size:13px;color:var(--muted)">No faltering detected between consecutive visits. Keep measuring!</div>`;
  const vmx = Math.max(1, ...vol.map((v) => v.n));
  $("anVol").innerHTML = `<div class="hint">Recorded clinical visits per month.</div>
    <div style="display:flex;gap:8px;align-items:flex-end;height:110px;margin-top:6px">${vol.map((v) => `
      <div style="flex:1;text-align:center"><div style="font-size:12px;font-weight:800">${v.n}</div>
      <div style="background:var(--blue);border-radius:6px 6px 0 0;height:${Math.round((v.n / vmx) * 70)}px;min-height:${v.n ? 6 : 0}px"></div>
      <div style="font-size:11px;color:var(--muted)">${v.month.slice(5)}/${v.month.slice(2, 4)}</div></div>`).join("")}</div>`;
  if ($("anClin") && typeof metricsClinicalHTML === "function") $("anClin").innerHTML = metricsClinicalHTML();
  if (typeof renderMgmt === "function") renderMgmt();
}

/* E2c: delegated actions for templates in this file. */
try {
  ["copyMsg", "delAppt", "markReminded", "toggleAppt"].forEach(function (n) { actCall0(n); });
  actRegister("followSetActive", function (el) { try { DB.activeId = actArg(el); save(); renderAll(); go("growth"); } catch (e) { actReport("followSetActive", e); } });
  actRegister("schDateSel", function (el) { try { SCH.date = el.value; renderSchedule(); } catch (e) { actReport("schDateSel", e); } });
  actRegister("schLangSel", function (el) { try { SCH.lang = el.value; renderSchedule(); } catch (e) { actReport("schLangSel", e); } });
} catch (e) {}

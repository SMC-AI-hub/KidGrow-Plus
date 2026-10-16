/* =====================================================
   KidGrow Pro — Clinic ops round 2
   Appointment reminders · day-close collections ·
   vaccine stock ledger with auto-deduct.
   Pure engines (testable) + DOM renderers.
   ===================================================== */
const OPS = { day: null };

/* ---------------- shared ---------------- */
function copyText(text, okMsg) {
  const done = () => alert(okMsg || "Copied — paste into SMS / WhatsApp.");
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => { window.prompt("Copy:", text); });
  else window.prompt("Copy:", text);
}
function childById(id) { return (DB.children || []).find((x) => x.id === id) || null; }
function vaxNameFor(code) {
  for (const v of (typeof VACCINE_SCHEDULE !== "undefined" ? VACCINE_SCHEDULE : []))
    for (const vx of v.vaccines) if (vx.code === code) return `${vx.name} ${vx.dose || ""}`.trim();
  return code || "Vaccine";
}

/* ================= A. APPOINTMENT REMINDERS ================= */
function apptMsgBtns(a) {
  if (!a || a.done) return "";
  return `<button class="btn btn-wa btn-xs" onclick="waAppt('${a.id}')">💬</button> <button class="btn btn-o btn-xs" onclick="copyAppt('${a.id}')">⧉</button> `;
}
function remindedBadge(id) {
  const r = remindedOn(id);
  return r ? ` <span class="badge b-green">✓ ${fmtDate(r)}</span>` : "";
}
function stockPulseBit(n) {
  return n ? `<span>⚠️ <b>${n}</b> stock alert${n === 1 ? "" : "s"}</span> <button class="btn btn-o btn-sm" onclick="go('stock')">Stock →</button>` : "";
}
function apptMsg(a, S, lang) {
  S = S || {};
  const c = childById(a.childId) || {};
  const parent = c.mother || c.father || "Parent";
  const when = dmy(a.date) + (a.time ? ` at ${a.time}` : "");
  const clinic = S.clinic || "your clinic", addr = S.addr || "", doc = S.doctor || "";
  const type = a.type || "Visit";
  if (lang === "ta") return `வணக்கம் ${parent}! ${clinic} நினைவூட்டல்: ${c.name || "குழந்தை"}-க்கு ${when} அன்று ${type} சந்திப்பு உள்ளது. தயவுசெய்து நேரத்தில் வாருங்கள். ${addr} — ${doc}`.trim();
  if (lang === "hi") return `नमस्ते ${parent}! ${clinic} से याद: ${c.name || "बच्चे"} की ${type} अपॉइंटमेंट ${when} को है। कृपया समय पर आएं। ${addr} — ${doc}`.trim();
  return `Hello ${parent}! Reminder from ${clinic}: ${c.name || "your child"} has a ${type} appointment on ${when}. Please arrive on time. ${addr} — ${doc}`.trim();
}
function copyAppt(id) {
  const a = (DB.appts || []).find((x) => x.id === id);
  if (!a) return;
  copyText(apptMsg(a, DB.settings, (typeof SCH !== "undefined" ? SCH.lang : "en") || "en"), "Appointment message copied.");
}
function waAppt(id) {
  const a = (DB.appts || []).find((x) => x.id === id);
  if (!a) return;
  const c = childById(a.childId) || {};
  const link = waLink(c.phone, apptMsg(a, DB.settings, (typeof SCH !== "undefined" ? SCH.lang : "en") || "en"));
  if (!link) return alert("No valid phone number for this child — use Copy instead.");
  window.open(link, "_blank");
}
/* Staff day-list: today's appts + vaccine follow-up counts + top defaulters. */
function dayListMsg(dateISO, S) {
  S = S || {};
  const L = [`${S.clinic || "Clinic"} — Day list ${dmy(dateISO)}`];
  const tod = apptsOn(DB.appts || [], dateISO).filter((a) => !a.done);
  L.push(`Appointments (${tod.length}):` + (tod.length ? "" : " none"));
  tod.forEach((a) => {
    const c = childById(a.childId) || {};
    L.push(`• ${a.time || "--:--"} — ${c.name || "?"} (${a.type || "Visit"})${c.phone ? " " + c.phone : ""}`);
  });
  const due = clinicDueList(DB.children, dateISO);
  const nDef = due.filter((i) => i.band === "defaulter").length;
  const nOver = due.filter((i) => i.band === "overdue").length;
  const nDue = due.filter((i) => i.band === "due14").length;
  L.push(`Vaccine follow-ups: ${nDef} defaulter, ${nOver} overdue, ${nDue} due-14d.`);
  due.filter((i) => i.band === "defaulter").slice(0, 8).forEach((i) => {
    const c = childById(i.childId) || {};
    L.push(`• ${i.child} — ${i.name} ${i.dose || ""} (due ${dmy(i.due)}, +${i.daysOver}d)${c.phone ? " " + c.phone : ""}`);
  });
  return L.join("\n");
}
function copyDayList() {
  copyText(dayListMsg((typeof SCH !== "undefined" && SCH.date) || todayISO(), DB.settings), "Day list copied — share with staff.");
}
/* Reminded tick: remember we already messaged this child (avoid duplicates). */
function remindedOn(childId) { return ((DB.remLog || {})[childId]) || null; }
function markReminded(childId) {
  DB.remLog = DB.remLog || {};
  const t = todayISO();
  if (DB.remLog[childId] === t) delete DB.remLog[childId];
  else DB.remLog[childId] = t;
  save(); renderSchedule();
}

/* ================= B. DAY-CLOSE COLLECTIONS ================= */
function dayCloseData(dateISO) {
  const bills = (DB.bills || []).filter((b) => b.date === dateISO);
  const d = { date: dateISO, bills, n: bills.length, billed: 0, collected: 0, byMode: {}, byUser: {} };
  bills.forEach((b) => {
    const t = +b.total || 0, p = +b.paid || 0;
    d.billed += t; d.collected += p;
    const m = d.byMode[b.mode || "—"] = d.byMode[b.mode || "—"] || { n: 0, billed: 0, collected: 0 };
    m.n++; m.billed += t; m.collected += p;
    const u = d.byUser[b.by || "—"] = d.byUser[b.by || "—"] || { n: 0, collected: 0 };
    u.n++; u.collected += p;
  });
  d.balance = d.billed - d.collected;
  return d;
}
function renderDayClose() {
  const box = $("dayCloseBox");
  if (!box) return;
  if (!OPS.day) OPS.day = todayISO();
  const d = dayCloseData(OPS.day);
  const modes = Object.keys(d.byMode), users = Object.keys(d.byUser);
  box.innerHTML = `<div class="card"><h3>🌙 Day close — collections</h3>
    <div class="hint">Reconcile cash before leaving · bills stay editable in the list above</div>
    <div class="toolbar" style="margin-bottom:10px"><input type="date" value="${OPS.day}" onchange="OPS.day=this.value;renderDayClose()" style="max-width:170px">
    <span class="sp"></span>
    <button class="btn btn-o btn-sm" onclick="copyDayClose()">⧉ Copy summary</button>
    <button class="btn btn-o btn-sm" onclick="exportDayCloseCSV()">⬇ CSV</button>
    <button class="btn btn-p btn-sm" onclick="printDayClose()">🖨️ Print day-close</button></div>
    <div class="grid g4" style="margin-bottom:10px">
      <div class="stat" style="--ac:var(--navy)"><div><div class="n">₹${d.billed.toFixed(0)}</div><div class="l">Billed (${d.n})</div></div></div>
      <div class="stat" style="--ac:var(--teal)"><div><div class="n">₹${d.collected.toFixed(0)}</div><div class="l">Collected</div></div></div>
      <div class="stat" style="--ac:${d.balance > 0 ? "var(--red)" : "var(--teal)"}"><div><div class="n">₹${d.balance.toFixed(0)}</div><div class="l">Balance due</div></div></div>
      <div class="stat" style="--ac:var(--blue)"><div><div class="n">${modes.length}</div><div class="l">Payment modes</div></div></div>
    </div>
    <div class="grid g2">
      <div><div class="hint">By mode</div><table class="tbl"><tr><th>Mode</th><th>Bills</th><th>Billed</th><th>Collected</th></tr>
      ${modes.length ? modes.map((m) => `<tr><td><b>${esc(m)}</b></td><td>${d.byMode[m].n}</td><td>₹${d.byMode[m].billed.toFixed(0)}</td><td><b>₹${d.byMode[m].collected.toFixed(0)}</b></td></tr>`).join("") : `<tr><td colspan="4" style="color:var(--muted)">No bills this day.</td></tr>`}</table></div>
      <div><div class="hint">By staff</div><table class="tbl"><tr><th>Staff</th><th>Bills</th><th>Collected</th></tr>
      ${users.length ? users.map((u) => `<tr><td><b>${esc(u)}</b></td><td>${d.byUser[u].n}</td><td><b>₹${d.byUser[u].collected.toFixed(0)}</b></td></tr>`).join("") : `<tr><td colspan="3" style="color:var(--muted)">—</td></tr>`}</table></div>
    </div></div>`;
}
function printDayClose() {
  if (!OPS.day) OPS.day = todayISO();
  const d = dayCloseData(OPS.day);
  $("dayPrint").innerHTML = `${clinicHeader()}
    <div class="doc-title">🌙 DAY COLLECTION SUMMARY — ${fmtDate(d.date)}</div>
    <dl class="kv" style="margin-bottom:10px"><dt>Bills</dt><dd>${d.n}</dd>
    <dt>Billed</dt><dd><b>₹${d.billed.toFixed(0)}</b></dd><dt>Collected</dt><dd><b>₹${d.collected.toFixed(0)}</b></dd>
    <dt>Balance due</dt><dd><b>₹${d.balance.toFixed(0)}</b></dd></dl>
    <table class="tbl"><thead><tr><th>Receipt</th><th>Patient</th><th>Particulars</th><th>Mode</th><th>Staff</th><th>Total</th><th>Paid</th></tr></thead>
    ${d.bills.map((b) => `<tr><td>R-${b.id.slice(-6).toUpperCase()}</td><td>${esc(b.name)}</td><td>${b.items.map((i) => esc(i.desc)).join(" + ")}</td><td>${esc(b.mode || "")}</td><td>${esc(b.by || "")}</td><td>₹${(+b.total || 0).toFixed(0)}</td><td>₹${(+b.paid || 0).toFixed(0)}</td></tr>`).join("") || `<tr><td colspan="7">No bills this day.</td></tr>`}</table>
    ${docFooter("Day collection summary")}`;
  auditSafe("Export", "Day-close printed " + d.date);
  printPage("pg-dayprint");
}
function copyDayClose() {
  if (!OPS.day) OPS.day = todayISO();
  const d = dayCloseData(OPS.day), S = DB.settings || {};
  const L = [`${S.clinic || "Clinic"} — Collections ${dmy(d.date)}`,
    `Bills: ${d.n} · Billed ₹${d.billed.toFixed(0)} · Collected ₹${d.collected.toFixed(0)} · Balance ₹${d.balance.toFixed(0)}`];
  Object.keys(d.byMode).forEach((m) => L.push(`• ${m}: ₹${d.byMode[m].collected.toFixed(0)} (${d.byMode[m].n})`));
  copyText(L.join("\n"), "Day summary copied.");
}
function exportDayCloseCSV() {
  if (!OPS.day) OPS.day = todayISO();
  const d = dayCloseData(OPS.day);
  const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const L = [["Date", "Receipt", "Patient", "Particulars", "Mode", "Staff", "Total", "Paid"].map(q).join(",")];
  d.bills.forEach((b) => L.push([d.date, "R-" + b.id.slice(-6).toUpperCase(), b.name, b.items.map((i) => i.desc).join(" + "), b.mode || "", b.by || "", b.total, b.paid].map(q).join(",")));
  const blob = new Blob([L.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `dayclose-${d.date}.csv`; a.click();
  auditSafe("Export", "Day-close CSV " + d.date);
}

/* ================= C. VACCINE STOCK LEDGER ================= */
function stockLots() { DB.vaxstock = DB.vaxstock || []; return DB.vaxstock; }
function stockLog(why, lotId, lotLabel, change) {
  DB.stocklog = DB.stocklog || [];
  DB.stocklog.push({ date: todayISO(), lotId: lotId || "", lot: lotLabel || "", change: change || 0, why: why || "" });
  if (DB.stocklog.length > 200) DB.stocklog = DB.stocklog.slice(-200);
}
function stockAlerts(today) {
  today = today || todayISO();
  const A = { expired: [], expiring: [], low: [], out: [] };
  stockLots().forEach((l) => {
    const e = (l.expiry || "") ? dayDiff(today, l.expiry) : null;
    if ((+l.qty || 0) <= 0) A.out.push(l);
    else if (+l.qty <= (+l.min || 0)) A.low.push(l);
    if (e !== null && e < 0) A.expired.push(l);
    else if (e !== null && e <= 60) A.expiring.push(l);
  });
  return A;
}
function stockCritCount() {
  const A = stockAlerts();
  return A.expired.length + A.out.length + A.low.length;
}
function vaxCodeOptions() {
  const out = [];
  (typeof VACCINE_SCHEDULE !== "undefined" ? VACCINE_SCHEDULE : []).forEach((v) =>
    v.vaccines.forEach((vx) => out.push({ code: vx.code, label: `${vx.name} ${vx.dose || ""} (${v.label})`.trim() })));
  return out;
}
/* Auto-deduct one dose. code=null for extra/travel vaccines (match batch/brand only). */
function stockDeduct(code, brand, batch, childName) {
  const lots = stockLots().filter((l) => (+l.qty || 0) > 0);
  if (!lots.length) return null;
  // Never auto-consume expired lots (FEFO sort would otherwise pick them FIRST).
  const today = (typeof todayISO === "function") ? todayISO() : "";
  const fresh = lots.filter((l) => !(l.expiry || "") || (today && l.expiry >= today) || !today);
  if (!fresh.length) {
    try { if (typeof toast === "function") toast("⚠️ Stock on hand is expired — dose recorded, NO stock deducted. Quarantine the lot."); } catch (e) {}
    stockLog(`⚠️ expired-only stock blocked · ${childName || ""} · ${code || brand || batch || ""}`.trim(), "", "", 0);
    return null;
  }
  const eq = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  const byExp = (arr) => arr.sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"))[0];
  let hit = null;
  if (code && batch) hit = byExp(fresh.filter((l) => l.code === code && eq(l.batch, batch)));
  if (!hit && code && brand) hit = byExp(fresh.filter((l) => l.code === code && eq(l.brand, brand)));
  if (!hit && batch) hit = byExp(fresh.filter((l) => eq(l.batch, batch)));
  if (!hit && brand) hit = byExp(fresh.filter((l) => eq(l.brand, brand)));
  if (!hit) return null;
  hit.qty = (+hit.qty || 1) - 1; hit.updated = todayISO();
  stockLog(`Auto −1 · ${childName || ""} · ${code || hit.name || ""}`.trim(), hit.id, `${hit.name}${hit.batch ? " · " + hit.batch : ""}`, -1);
  return hit;
}
/* Lots available for the dose-modal picker: in-stock only, earliest-expiry first. code=null → all lots (extras). */
function stockLotsFor(code) {
  return stockLots()
    .filter((l) => l && (+l.qty || 0) > 0 && (!code || l.code === code))
    .sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
}
function lotStatus(l, today) {
  today = today || ((typeof todayISO === "function") ? todayISO() : "");
  if ((l.expiry || "") && today && l.expiry < today) return "expired";
  if ((l.expiry || "") && today && l.expiry <= addDays(today, 60)) return "expiring";
  return "ok";
}
function lotLabel(l) {
  const st = lotStatus(l);
  return `${l.brand || l.name || "?"}${l.batch ? " · " + l.batch : ""} · ${+l.qty || 0} left${l.expiry ? " · exp " + fmtDate(l.expiry) : ""}${st === "expired" ? " ⚠️ EXPIRED" : st === "expiring" ? " · expiring soon" : ""}`;
}
/* <option> list for the picker. Expired lots render disabled (quarantine — visible but unpickable). */
function lotOptionsHTML(code, selected) {
  const lots = stockLotsFor(code);
  let h = `<option value="">Auto — earliest expiry</option>`;
  h += lots.map((l) => `<option value="${l.id}"${l.id === selected ? " selected" : ""}${lotStatus(l) === "expired" ? " disabled" : ""}>${esc(lotLabel(l))}</option>`).join("");
  h += `<option value="none">No deduction — given elsewhere / campaign</option>`;
  return h;
}
function lotHintHTML(code) {
  const n = stockLotsFor(code).length;
  if (!n) return "No matching lot in stock — Auto will try a brand/batch match, else records without deducting.";
  return `${n} lot(s) in stock · Auto picks earliest expiry · expired lots are blocked.`;
}
/* Deduct exactly one dose from an explicitly chosen lot. Never consumes expired/empty lots. */
function stockDeductLot(lotId, code, childName) {
  const l = stockLots().find((x) => x && x.id === lotId);
  if (!l) return { ok: false, reason: "missing" };
  if (!(+l.qty || 0) > 0) return { ok: false, reason: "empty", lot: l };
  const today = (typeof todayISO === "function") ? todayISO() : "";
  if ((l.expiry || "") && today && l.expiry < today) return { ok: false, reason: "expired", lot: l };
  l.qty = (+l.qty || 1) - 1; l.updated = todayISO();
  stockLog(`Manual −1 · ${childName || ""} · ${code || l.name || ""}`.trim(), l.id, `${l.name}${l.batch ? " · " + l.batch : ""}`, -1);
  return { ok: true, lot: l };
}
function renderStock() {
  const box = $("stockBox");
  if (!box) return;
  const lots = [...stockLots()].sort((a, b) => (a.expiry || "9999").localeCompare(b.expiry || "9999"));
  const A = stockAlerts();
  const nCrit = A.expired.length + A.out.length + A.low.length;
  const badge = (l) => {
    const e = (l.expiry || "") ? dayDiff(todayISO(), l.expiry) : null;
    if (e !== null && e < 0) return `<span class="badge b-red">Expired</span>`;
    if ((+l.qty || 0) <= 0) return `<span class="badge b-red">Out of stock</span>`;
    if (e !== null && e <= 60) return `<span class="badge b-amber">Exp ${dmy(l.expiry)}</span>`;
    if (+l.qty <= (+l.min || 0)) return `<span class="badge b-amber">Reorder</span>`;
    return `<span class="badge b-green">OK</span>`;
  };
  const log = [...(DB.stocklog || [])].slice(-12).reverse();
  box.innerHTML = `
  <div class="toolbar"><span style="font-size:13px;color:var(--muted)">Fridge register · auto-deducts when doses are recorded</span>
    <span class="sp"></span>
    <button class="btn btn-o btn-sm" onclick="exportStockCSV()">⬇ CSV</button>
    <button class="btn btn-o btn-sm" onclick="printPage('pg-stock')">🖨️ Print register</button>
    <button class="btn btn-p btn-sm" onclick="openStockModal()">+ Add stock</button></div>
  ${nCrit ? `<div class="alert a-red">⚠️ <div><b>${nCrit} alert(s):</b> ${A.expired.length ? `${A.expired.length} expired · ` : ""}${A.out.length ? `${A.out.length} out of stock · ` : ""}${A.low.length ? `${A.low.length} below reorder level` : ""}${A.expiring.length ? ` · ${A.expiring.length} expiring ≤60d` : ""}. Check rows below.</div></div>`
    : `<div class="alert a-green">✅ <div>Stock healthy — ${lots.length} lot(s) on hand${A.expiring.length ? ` · ${A.expiring.length} expiring within 60 days (use first)` : ""}.</div></div>`}
  <div class="card"><div style="overflow:auto"><table class="tbl"><thead><tr><th>Vaccine</th><th>Brand</th><th>Batch</th><th>Expiry</th><th>Qty</th><th>Min</th><th>Status</th><th class="no-print">Adjust</th></tr></thead>
  ${lots.length ? lots.map((l) => `<tr>
    <td><b>${esc(l.name || l.code || "")}</b><br><span style="font-size:11.5px;color:var(--muted)">${esc(l.code || "")}</span></td>
    <td>${esc(l.brand || "—")}</td><td>${esc(l.batch || "—")}</td>
    <td>${l.expiry ? dmy(l.expiry) : "—"}</td>
    <td><b style="font-size:16px">${+l.qty || 0}</b></td><td>${+l.min || 0}</td><td>${badge(l)}</td>
    <td class="no-print" style="white-space:nowrap">
      <button class="btn btn-o btn-xs" onclick="stockStep('${l.id}',1)" title="Add 1">+1</button>
      <button class="btn btn-o btn-xs" onclick="stockStep('${l.id}',-1)" title="Use 1">−1</button>
      <button class="btn btn-o btn-xs" onclick="stockSetQty('${l.id}')" title="Set exact count">#</button>
      <button class="btn btn-o btn-xs" onclick="openStockModal('${l.id}')">Edit</button>
      <button class="btn btn-danger btn-xs" onclick="delStock('${l.id}')">✕</button></td></tr>`).join("")
    : `<tr><td colspan="8" style="color:var(--muted)">No lots yet — click <b>+ Add stock</b> to open your fridge register.</td></tr>`}</table></div></div>
  <div style="height:14px"></div>
  <div class="card"><h3>📒 Recent movements</h3><div class="hint">Auto-deducts + manual adjustments (last 12)</div>
  ${log.length ? log.map((m) => `<div style="font-size:13px;padding:6px 0;border-bottom:1px solid var(--line)"><b>${fmtDate(m.date)}</b> · ${esc(m.lot)} ·
    <b style="color:${m.change < 0 ? "var(--red)" : "var(--teal-d)"}">${m.change > 0 ? "+" : ""}${m.change}</b>
    <span style="color:var(--muted)">· ${esc(m.why)}</span></div>`).join("") : `<div style="font-size:13px;color:var(--muted)">No movements yet.</div>`}</div>`;
}
function openStockModal(id) {
  const lots = stockLots();
  const l = id ? lots.find((x) => x.id === id) : null;
  const opts = vaxCodeOptions();
  $("kId").value = l?.id || "";
  $("kCode").innerHTML = opts.map((o) => `<option value="${o.code}"${l && l.code === o.code ? " selected" : ""}>${esc(o.label)}</option>`).join("") + `<option value="OTHER"${l && l.code === "OTHER" ? " selected" : ""}>Other (travel / campaign / extra)</option>`;
  $("kNameWrap").style.display = (!l || l.code === "OTHER") && (!l || !opts.some((o) => o.code === l.code)) ? "" : ($("kCode").value === "OTHER" ? "" : "none");
  $("kCode").onchange = () => { $("kNameWrap").style.display = $("kCode").value === "OTHER" ? "" : "none"; };
  $("kName").value = l?.name || "";
  $("kBrandList").innerHTML = allBrandOptions().map((o) => `<option value="${esc(o.b)}">${esc(o.m)}</option>`).join("");
  $("kBrand").value = l?.brand || ""; $("kBatch").value = l?.batch || "";
  $("kExpiry").value = l?.expiry || ""; $("kQty").value = l ? l.qty : ""; $("kMin").value = l ? (l.min || 0) : 2;
  $("kNote").value = l?.note || "";
  $("stockModalTitle").textContent = l ? "Edit lot" : "+ Add stock";
  $("stockModalSub").textContent = l ? "Update lot details" : "Same vaccine + brand + batch twice? Quantities merge automatically.";
  openModal("mStock");
}
function saveStock() {
  const lots = stockLots();
  const id = $("kId").value;
  const code = $("kCode").value;
  const name = code === "OTHER" ? $("kName").value.trim() : (vaxNameFor(code) + (code ? "" : ""));
  if (!name && code === "OTHER") return alert("Vaccine name is required.");
  const qty = Math.max(0, parseInt($("kQty").value, 10) || 0);
  const brand = $("kBrand").value.trim(), batch = $("kBatch").value.trim();
  if (id) {
    const l = lots.find((x) => x.id === id);
    if (!l) return;
    const delta = qty - (+l.qty || 0);
    Object.assign(l, { code, name: name || vaxNameFor(code), brand, batch, expiry: $("kExpiry").value, qty, min: Math.max(0, parseInt($("kMin").value, 10) || 0), note: $("kNote").value.trim(), updated: todayISO() });
    if (delta) stockLog(delta > 0 ? `Restock +${delta}` : `Adjustment ${delta}`, l.id, `${l.name}${l.batch ? " · " + l.batch : ""}`, delta);
  } else {
    const dup = lots.find((x) => x.code === code && String(x.brand || "").toLowerCase() === brand.toLowerCase() && String(x.batch || "").toLowerCase() === batch.toLowerCase());
    if (dup) {
      dup.qty = (+dup.qty || 0) + qty;
      if ($("kExpiry").value) dup.expiry = $("kExpiry").value;
      dup.min = Math.max(0, parseInt($("kMin").value, 10) || 0); dup.updated = todayISO();
      stockLog(`Restock +${qty}`, dup.id, `${dup.name}${dup.batch ? " · " + dup.batch : ""}`, qty);
    } else {
      const l = { id: uid(), code, name: name || vaxNameFor(code), brand, batch, expiry: $("kExpiry").value, qty, min: Math.max(0, parseInt($("kMin").value, 10) || 0), note: $("kNote").value.trim(), updated: todayISO() };
      lots.push(l);
      stockLog(`Opening +${qty}`, l.id, `${l.name}${l.batch ? " · " + l.batch : ""}`, qty);
    }
  }
  auditSafe("Stock", $("stockModalTitle").textContent + " — " + (name || code));
  save(); closeModal("mStock"); renderAll();
}
function delStock(id) {
  if (!needSafe(2, "delete stock lots")) return;
  if (!confirm("Delete this lot from the register?")) return;
  const l = stockLots().find((x) => x.id === id);
  DB.vaxstock = stockLots().filter((x) => x.id !== id);
  if (l) stockLog("Lot deleted", id, `${l.name}${l.batch ? " · " + l.batch : ""}`, 0);
  save(); renderAll();
}
function stockStep(id, d) {
  const l = stockLots().find((x) => x.id === id);
  if (!l) return;
  l.qty = Math.max(0, (+l.qty || 0) + d); l.updated = todayISO();
  stockLog(d > 0 ? "Manual +1" : "Manual −1", l.id, `${l.name}${l.batch ? " · " + l.batch : ""}`, d);
  save(); renderStock();
}
function stockSetQty(id) {
  const l = stockLots().find((x) => x.id === id);
  if (!l) return;
  const v = window.prompt(`Physical count for ${l.name}${l.batch ? " · " + l.batch : ""}:`, l.qty);
  if (v === null || v === "") return;
  const n = Math.max(0, parseInt(v, 10) || 0);
  stockLog(`Count correction → ${n}`, l.id, `${l.name}${l.batch ? " · " + l.batch : ""}`, n - (+l.qty || 0));
  l.qty = n; l.updated = todayISO();
  save(); renderStock();
}
function exportStockCSV() {
  const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const L = [["Vaccine", "Code", "Brand", "Batch", "Expiry", "Qty", "Reorder level", "Updated", "Note"].map(q).join(",")];
  stockLots().forEach((l) => L.push([l.name, l.code, l.brand, l.batch, l.expiry, l.qty, l.min, l.updated, l.note].map(q).join(",")));
  const blob = new Blob([L.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `vaccine-stock-${todayISO()}.csv`; a.click();
  auditSafe("Export", "Stock CSV");
}

/* ================= D. TOKEN DISPLAY MODE (waiting-room TV) ================= */
function displayData() {
  const t = todayISO();
  const tod = (DB.tokens || []).filter((x) => x.date === t).sort((a, b) => a.n - b.n);
  return {
    serving: tod.find((x) => x.status === "in") || null,
    waiting: tod.filter((x) => x.status === "waiting"),
    done: tod.filter((x) => x.status === "done").length,
    total: tod.length,
  };
}
function displayBeep() {
  if (OPS.mute) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    [0, 0.2].forEach((dl, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = i ? 660 : 520;
      g.gain.setValueAtTime(0.001, ctx.currentTime + dl);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + dl + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dl + 0.17);
      o.start(ctx.currentTime + dl); o.stop(ctx.currentTime + dl + 0.19);
    });
  } catch (e) {}
}
function renderDisplay() {
  const box = $("displayBox");
  if (!box || !$("pg-display").classList.contains("active")) return;
  const d = displayData(), S = DB.settings || {};
  const cur = d.serving ? d.serving.n : null;
  if (OPS.lastServing !== cur) {
    OPS.lastServing = cur;
    if (OPS.displaySeen) displayBeep();
    OPS.displaySeen = true;
  }
  const up = d.waiting.slice(0, 6);
  box.innerHTML = `<div class="disp-wrap">
    <div class="disp-top">
      <div class="disp-brand">${S.logo ? `<img src="${S.logo}" alt="">` : "🧸"}<div><b>${esc(S.clinic || "KidGrow Pro")}</b><small>${esc(S.addr || "")}</small></div></div>
      <div class="disp-clock"><b id="dispClock">--:--</b><small>${fmtDate(todayISO())}</small></div>
    </div>
    <div class="disp-main">
      <div class="disp-now"><small>NOW SERVING</small>
        ${d.serving ? `<div class="disp-num">#${d.serving.n}</div><div class="disp-name">${esc(d.serving.name)}</div>` : `<div class="disp-num dim">—</div><div class="disp-name">Please wait to be called</div>`}
      </div>
      <div class="disp-side">
        <div class="disp-card"><small>NEXT UP</small>
          ${up.length ? up.map((x, i) => `<div class="disp-row${i === 0 ? " first" : ""}"><b>#${x.n}</b> ${esc(x.name)}</div>`).join("") : `<div class="disp-row">Queue empty</div>`}
          ${d.waiting.length > 6 ? `<div class="disp-row">+${d.waiting.length - 6} more waiting</div>` : ""}</div>
        <div class="disp-card nums"><div><b>${d.waiting.length}</b><small>waiting</small></div><div><b>${d.done}</b><small>done</small></div></div>
      </div>
    </div>
    ${displayFootHTML()}</div>`;
  tickDispClock();
}
/* Footer is a pure builder (tested) so the exit path can't silently regress. */
function displayFootHTML() {
  return `<div class="disp-foot no-print">
      <button class="btn btn-o btn-sm" onclick="exitDisplay()">← Exit display</button>
      <button class="btn btn-o btn-sm" onclick="toggleDispMute()">${OPS.mute ? "🔇 Unmute bell" : "🔔 Mute bell"}</button>
      <button class="btn btn-o btn-sm" onclick="dispFullscreen()">⛶ Full screen</button>
      <span style="font-size:12px;opacity:.7">Auto-refreshes · press Esc to exit</span>
    </div>`;
}
/* The display page hides all app chrome (kiosk CSS) — this + Esc are the way back. */
function exitDisplay() {
  try {
    const pg = document.getElementById("pg-display");
    if (!pg || !pg.classList.contains("active")) return;
    if (document.querySelector && document.querySelector(".modal-bg.open")) return;
    if (typeof go === "function") go("dashboard");
  } catch (e) {}
}
function displayEscHandler(e) {
  if ((e && e.key) !== "Escape") return;
  exitDisplay();
}
function dispFullscreen() {
  try {
    const el = document.getElementById("pg-display");
    const p = el && el.requestFullscreen ? el.requestFullscreen() : null;
    if (p && p.catch) p.catch(() => { try { toast("Full screen was blocked by the browser."); } catch (e) {} });
  } catch (e) {}
}
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("keydown", displayEscHandler);
}
function tickDispClock() {
  const el = document.getElementById("dispClock");
  if (el) el.textContent = new Date().toTimeString().slice(0, 5);
}
function toggleDispMute() { OPS.mute = !OPS.mute; renderDisplay(); }
setInterval(() => { try { if ($("pg-display") && $("pg-display").classList.contains("active")) renderDisplay(); } catch (e) {} }, 10000);
setInterval(() => { try { tickDispClock(); } catch (e) {} }, 5000);

/* ================= E. PER-DOCTOR LETTERHEADS ================= */
function ensureDoctors() {
  DB.doctors = DB.doctors || [];
  const S = DB.settings || {};
  if (!DB.doctors.length && (S.doctor || S.reg)) {
    DB.doctors.push({ id: uid(), name: S.doctor || "", qual: "", reg: S.reg || "" });
  }
  if (DB.doctors.length && !DB.doctors.some((d) => d.id === S.docId)) S.docId = DB.doctors[0].id;
}
function letterDoc() {
  ensureDoctors();
  const S = DB.settings || {};
  const d = (DB.doctors || []).find((x) => x.id === S.docId) || DB.doctors[0];
  if (d) return { name: d.name || "", qual: d.qual || "", reg: d.reg || "" };
  return { name: S.doctor || "", qual: "", reg: S.reg || "" };
}
function renderDoctors() {
  const box = $("docBox");
  if (!box) return;
  ensureDoctors();
  const S = DB.settings || {};
  box.innerHTML = `${(DB.doctors || []).map((d) => `
    <div class="vac-row"><input type="radio" name="letterDoc" ${S.docId === d.id ? "checked" : ""} onchange="setLetterDoc('${d.id}')" title="Use on letterhead" style="width:18px;flex-shrink:0">
      <div class="grow"><b>${esc(d.name) || "—"}</b>${d.qual ? `, ${esc(d.qual)}` : ""}${d.reg ? `<br><span style="font-size:12px;color:var(--muted)">Reg: ${esc(d.reg)}</span>` : ""}</div>
      <button class="btn btn-o btn-xs" onclick="editDoctor('${d.id}')">Edit</button>
      <button class="btn btn-danger btn-xs" onclick="delDoctor('${d.id}')">✕</button></div>`).join("") || `<div style="font-size:13px;color:var(--muted)">No doctors yet.</div>`}
    <div class="form-grid" style="margin-top:8px">
      <div><label>Name *</label><input id="dName" placeholder="Dr. A. Sharma"></div>
      <div><label>Qualification</label><input id="dQual" placeholder="MD (Paeds)"></div>
      <div class="full"><label>Registration no.</label><input id="dReg" placeholder="MCI / State reg."></div>
    </div>
    <input type="hidden" id="dId" value="">
    <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><button class="btn btn-p btn-sm" onclick="saveDoctor()">💾 Save doctor</button>
    <button class="btn btn-o btn-sm" onclick="clearDoctorForm()">Clear</button></div>
    <div class="hint">● Selected doctor prints on every letterhead + signature block.</div>`;
}
function clearDoctorForm() { $("dId").value = ""; $("dName").value = ""; $("dQual").value = ""; $("dReg").value = ""; }
function syncLegacyDoctor() {
  const ld = letterDoc();
  DB.settings.doctor = ld.name; DB.settings.reg = ld.reg;
}
function saveDoctor() {
  ensureDoctors();
  const name = $("dName").value.trim();
  if (!name) return alert("Doctor name is required.");
  const id = $("dId").value;
  if (id) {
    const d = DB.doctors.find((x) => x.id === id);
    if (d) Object.assign(d, { name, qual: $("dQual").value.trim(), reg: $("dReg").value.trim() });
  } else {
    const d = { id: uid(), name, qual: $("dQual").value.trim(), reg: $("dReg").value.trim() };
    DB.doctors.push(d);
    if (DB.doctors.length === 1) DB.settings.docId = d.id;
  }
  syncLegacyDoctor();
  save(); renderAll();
}
function editDoctor(id) {
  const d = (DB.doctors || []).find((x) => x.id === id);
  if (!d) return;
  $("dId").value = d.id; $("dName").value = d.name || ""; $("dQual").value = d.qual || ""; $("dReg").value = d.reg || "";
  $("dName").focus();
}
function delDoctor(id) {
  if ((DB.doctors || []).length <= 1) return alert("Keep at least one doctor on the letterhead.");
  if (!confirm("Remove this doctor?")) return;
  DB.doctors = DB.doctors.filter((x) => x.id !== id);
  ensureDoctors(); syncLegacyDoctor();
  save(); renderAll();
}
function setLetterDoc(id) {
  DB.settings.docId = id;
  syncLegacyDoctor();
  save(); renderBrand(); renderDoctors();
}

/* ================= F. PARENT-PORTAL CARD (standalone file) ================= */
function parentVerifyCode(c) {
  const s = String(c.id || "") + String(c.dob || "") + String(c.name || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "KG-" + h.toString(36).toUpperCase().padStart(6, "0").slice(-6);
}
function parentCardHTML(c) {
  const S = DB.settings || {};
  const t = todayISO(), age = ageBetween(c.dob);
  const due = dueItemsForChild(c, t).filter((i) => i.band !== "upcoming").slice(0, 12);
  const rows = VACCINE_SCHEDULE.map((v) => v.vaccines.map((vx) => {
    const r = (c.vaccines || {})[vx.code];
    return `<tr><td>${esc(v.label)}</td><td><b>${esc(vx.name)}</b> ${esc(vx.dose || "")}</td><td>${r ? esc(fmtDate(r.date)) + (r.brand ? " · " + esc(r.brand) : "") : "Due " + esc(fmtDate(dueDateFor(c, v)))}</td><td>${r ? "✓" : "○"}</td></tr>`;
  }).join("")).join("");
  const ex = (c.extraVac || []).map((x) => `<tr><td>Additional</td><td><b>${esc(x.name)}</b>${x.brand ? " · " + esc(x.brand) : ""}</td><td>${x.date ? esc(fmtDate(x.date)) : "—"}</td><td>✓</td></tr>`).join("");
  const lm = (typeof latestMeasure === "function") ? latestMeasure(c) : null;
  const qr = (typeof qrSVG === "function" && typeof encodeRecord === "function") ? qrSVG(encodeRecord(c)) : "";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Immunisation Card — ${esc(c.name)}</title>
<style>body{font-family:system-ui,'Segoe UI',Roboto,Arial,sans-serif;background:#f1f5f9;color:#1e293b;margin:0;padding:16px}
.card{max-width:720px;margin:0 auto;background:#fff;border:2px solid #0e7c7b;border-radius:16px;padding:22px}
.head{display:flex;gap:14px;align-items:center;border-bottom:3px solid #0e7c7b;padding-bottom:12px;margin-bottom:12px}
.head img{width:56px;height:56px;object-fit:contain}.head .em{font-size:44px}
.head h1{font-size:20px;margin:0;color:#0f2b4d}.head small{color:#64748b}
.kv{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:14px;margin:10px 0}
.kv dt{color:#64748b}.kv dd{margin:0;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin-top:8px}
th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}
th{background:#f1f5f9}.due{background:#fefce8;border:1px solid #fde68a;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:13.5px}
.qr{text-align:center;margin-top:12px;font-size:12px;color:#64748b}
.foot{font-size:11.5px;color:#64748b;margin-top:10px;text-align:center}</style></head><body><div class="card">
<div class="head">${S.logo ? `<img src="${S.logo}" alt="logo">` : `<div class="em">👶</div>`}
<div><h1>${esc(S.clinic || "KidGrow Pro Clinic")}</h1><small>DIGITAL IMMUNISATION CARD · ${esc(S.addr || "")}</small></div></div>
<dl class="kv"><dt>Child</dt><dd>${esc(c.name)} · ${c.sex === "boy" ? "Boy" : "Girl"}</dd>
<dt>Born</dt><dd>${esc(fmtDate(c.dob))} (${esc(ageStr(age))})</dd>
<dt>Parent</dt><dd>${esc([c.mother, c.father].filter(Boolean).join(" & ") || "—")}${c.phone ? " · " + esc(c.phone) : ""}</dd>
<dt>Blood</dt><dd>${esc(c.blood || "—")}${c.allergy ? " · ⚠️ " + esc(c.allergy) : ""}</dd>
${c.abha ? "<dt>ABHA</dt><dd>" + esc(c.abha) + "</dd>" : ""}
<dt>Growth</dt><dd>${lm ? `${esc(fmtDate(lm.date))}: ${lm.wt} kg · ${lm.ht} cm` : "Not recorded yet"}</dd></dl>
${due.length ? `<div class="due"><b>⏰ Due / overdue:</b> ${due.map((i) => `${esc(i.name)} ${esc(i.dose || "")} (${esc(fmtDate(i.due))})`).join(" · ")}</div>` : `<div class="due"><b>✅ Up to date</b> — no pending doses.</div>`}
<table><tr><th>Visit</th><th>Vaccine</th><th>Given</th><th>✓</th></tr>${rows}${ex}</table>
${qr ? `<div class="qr">${qr}<div>Scan at clinic to verify / import</div></div>` : ""}
<div class="foot">Verify code <b>${parentVerifyCode(c)}</b> · Generated ${esc(fmtDate(t))} · Keep this file safe — show it at every visit.</div>
</div></body></html>`;
}
function downloadParentCard() {
  const c = child(); if (!c) return;
  const blob = new Blob([parentCardHTML(c)], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `parent-card-${(c.name || "child").replace(/\s+/g, "-")}.html`;
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  auditSafe("Export", "Parent card file — " + c.name);
}
function copyParentSummary() {
  const c = child(); if (!c) return;
  const s = vaccineSummary(c), S = DB.settings || {};
  const lm = latestMeasure(c);
  const L = [`${c.name} — health summary from ${S.clinic || "clinic"}`,
    `Vaccines: ${s.done}/${s.total}${s.next ? ` · Next: ${s.next.v.vaccines.filter((x) => !c.vaccines[x.code]).map((x) => x.code).join(", ")} due ${dmy(s.next.due)}` : " · schedule complete"}`,
    lm ? `Growth (${fmtDate(lm.date)}): ${lm.wt} kg · ${lm.ht} cm` : "Growth: not recorded yet",
    `Verify: ${parentVerifyCode(c)} · ${S.addr || ""}`];
  copyText(L.join("\n"), "Parent summary copied.");
}

/* ================= G. ENCRYPTED BACKUPS (cloud-safe files) ================= */
function backupAgeLine() {
  if (!DB.lastBackup) return "Never backed up — export one today.";
  const d = dayDiff(DB.lastBackup, todayISO());
  if (d <= 0) return "Last backup: today ✔";
  return `Last backup: ${d} day(s) ago${d > 7 ? " — overdue, export one now" : ""}.`;
}
function b64enc(buf) {
  const u = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
  return btoa(s);
}
function b64dec(b64) {
  const s = atob(b64), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
async function encKey(password, salt, usage) {
  const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, [usage]);
}
async function exportEncrypted() {
  if (!window.crypto || !crypto.subtle) return alert("This browser cannot encrypt (needs https/localhost). Use the JSON backup instead.");
  const p1 = window.prompt("Password for this backup (min 8 characters — use a strong one, it protects patient data):");
  if (!p1 || p1.length < 8) return alert("Password too short (min 8) — cancelled.");
  if (window.prompt("Repeat password:") !== p1) return alert("Passwords differ — cancelled.");
  try {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aes = await encKey(p1, salt, "encrypt");
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, new TextEncoder().encode(JSON.stringify(DB)));
    downloadFile(`kidgrow-encrypted-${todayISO()}.kgenc`, JSON.stringify({ app: "KidGrowPro", enc: "AES-GCM-256-PBKDF2-100k", salt: b64enc(salt), iv: b64enc(iv), data: b64enc(ct) }), "application/json");
    DB.lastBackup = todayISO(); save();
    auditSafe("Export", "Encrypted backup");
    renderExport();
  } catch (e) { alert("Encryption failed: " + (e && e.message ? e.message : e)); }
}
async function importEncrypted(file) {
  if (!file) return;
  if (!window.crypto || !crypto.subtle) return alert("This browser cannot decrypt (needs https/localhost).");
  try {
    const env = JSON.parse(await file.text());
    if (!env || env.app !== "KidGrowPro" || !env.data) throw new Error("not a KidGrow backup file");
    const p = window.prompt("Backup password:");
    if (!p) return;
    const aes = await encKey(p, b64dec(env.salt), "decrypt");
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64dec(env.iv) }, aes, b64dec(env.data));
    const d = JSON.parse(new TextDecoder().decode(pt));
    if (!d || !Array.isArray(d.children)) throw new Error("backup has no children");
    if (!confirm(`Restore backup with ${d.children.length} child record(s)? This replaces current data.`)) return;
    DB = d; save(); renderAll();
    alert("Backup restored.");
  } catch (e) { alert("Could not restore: " + (e && e.message ? e.message : e)); }
}

/* ================= I. MANAGEMENT DASHBOARD ================= */
function mgmtStats(today) {
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(addDays(today, -i));
  const per = days.map((d) => {
    let visits = 0;
    (DB.children || []).forEach((c) => (c.visits || []).forEach((v) => { if (v.date === d) visits++; }));
    const toks = (DB.tokens || []).filter((x) => x.date === d).length;
    const bills = (DB.bills || []).filter((b) => b.date === d);
    return { date: d, visits, tokens: toks, bills: bills.length, revenue: bills.reduce((s, b) => s + (+b.paid || 0), 0) };
  });
  const mk = today.slice(0, 7);
  const monthBills = (DB.bills || []).filter((b) => (b.date || "").startsWith(mk));
  const dd = new Date(today + "T00:00:00"), regs = [];
  for (let i = 5; i >= 0; i--) regs.push({ month: new Date(dd.getFullYear(), dd.getMonth() - i, 1).toISOString().slice(0, 7), n: 0 });
  let unstamped = 0;
  (DB.children || []).forEach((c) => {
    const r = regs.find((x) => x.month === (c.created || "").slice(0, 7));
    if (r) r.n++; else unstamped++;
  });
  return {
    per,
    rev14: per.reduce((s, d) => s + d.revenue, 0),
    foot14: per.reduce((s, d) => s + d.visits + d.tokens, 0),
    monthRevenue: monthBills.reduce((s, b) => s + (+b.paid || 0), 0),
    monthBills: monthBills.length,
    regs, unstamped,
  };
}
function renderMgmt() {
  const box = $("anMgmt");
  if (!box) return;
  const m = mgmtStats(todayISO());
  const mx = Math.max(1, ...m.per.map((d) => d.revenue));
  const rx = Math.max(1, ...m.regs.map((r) => r.n));
  const kib = (n) => n >= 1000 ? (n / 1000).toFixed(1) + "k" : String(Math.round(n));
  box.innerHTML = `
  <div class="grid g4" style="margin-bottom:10px">
    <div class="stat" style="--ac:var(--teal)"><div><div class="n">₹${m.rev14.toFixed(0)}</div><div class="l">Collected · last 14 days</div></div></div>
    <div class="stat" style="--ac:var(--blue)"><div><div class="n">${m.foot14}</div><div class="l">Footfall · visits + tokens, 14d</div></div></div>
    <div class="stat" style="--ac:var(--navy)"><div><div class="n">₹${m.monthRevenue.toFixed(0)}</div><div class="l">This month · ${m.monthBills} bills</div></div></div>
    <div class="stat" style="--ac:var(--amber)"><div><div class="n">${(DB.children || []).length}</div><div class="l">Children on record</div></div></div>
  </div>
  <div class="grid g2">
    <div><div class="hint">Daily collections (₹) — last 14 days</div>
      <div style="display:flex;gap:5px;align-items:flex-end;height:110px;margin-top:6px">${m.per.map((d) => `
        <div style="flex:1;text-align:center" title="${fmtDate(d.date)} · ₹${d.revenue.toFixed(0)} · ${d.visits + d.tokens} footfall">
        <div style="font-size:10.5px;font-weight:800">${d.revenue ? kib(d.revenue) : ""}</div>
        <div style="background:var(--teal);border-radius:5px 5px 0 0;height:${Math.round((d.revenue / mx) * 70)}px;min-height:${d.revenue ? 5 : 0}px"></div>
        <div style="font-size:10px;color:var(--muted)">${d.date.slice(8)}</div></div>`).join("")}</div></div>
    <div><div class="hint">New registrations per month${m.unstamped ? ` (+${m.unstamped} earlier, unstamped)` : ""}</div>
      <div style="display:flex;gap:8px;align-items:flex-end;height:110px;margin-top:6px">${m.regs.map((r) => `
        <div style="flex:1;text-align:center"><div style="font-size:12px;font-weight:800">${r.n}</div>
        <div style="background:var(--blue);border-radius:6px 6px 0 0;height:${Math.round((r.n / rx) * 70)}px;min-height:${r.n ? 6 : 0}px"></div>
        <div style="font-size:11px;color:var(--muted)">${r.month.slice(5)}/${r.month.slice(2, 4)}</div></div>`).join("")}</div></div>
  </div>`;
}

/* ================= J. VISIT VOICE NOTES ================= */
const VOICE = { rec: null, chunks: [], data: "", dur: 0, timer: null };
function voiceSupported() { return !!(navigator.mediaDevices && window.MediaRecorder); }
function voiceSyncBox() {
  const st = $("voiceStatus"), btn = $("voiceRecBtn"), pl = $("voicePlay"), del = $("voiceDelBtn");
  if (!st || !btn) return;
  if (VOICE.rec) {
    st.textContent = `⏺ Recording… ${VOICE.dur}s / 60s`; btn.textContent = "⏹ Stop";
    if (pl) pl.style.display = "none"; if (del) del.style.display = "none";
  } else if (VOICE.data) {
    st.textContent = `🎙️ Voice note${VOICE.dur ? ` (${VOICE.dur}s)` : ""}`; btn.textContent = "⏺ Re-record";
    if (pl) { pl.src = VOICE.data; pl.style.display = ""; } if (del) del.style.display = "";
  } else {
    st.textContent = voiceSupported() ? "No recording" : "Voice not supported in this browser";
    btn.textContent = "⏺ Record";
    if (pl) pl.style.display = "none"; if (del) del.style.display = "none";
  }
}
function voiceReset(existing) {
  try { if (VOICE.rec && VOICE.rec.state !== "inactive") VOICE.rec.stop(); } catch (e) {}
  clearInterval(VOICE.timer);
  VOICE.rec = null; VOICE.chunks = []; VOICE.data = existing || ""; VOICE.dur = 0;
  voiceSyncBox();
}
async function voiceToggle() {
  if (VOICE.rec) { voiceStop(); return; }
  if (!voiceSupported()) return alert("Voice recording isn't supported in this browser.");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((mm) => { try { return MediaRecorder.isTypeSupported(mm); } catch (e) { return false; } }) || "";
    const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 });
    VOICE.chunks = []; VOICE.dur = 0;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) VOICE.chunks.push(e.data); };
    rec.onstop = () => {
      stream.getTracks().forEach((tr) => tr.stop());
      const blob = new Blob(VOICE.chunks, { type: rec.mimeType || "audio/webm" });
      const rd = new FileReader();
      rd.onload = () => {
        if (String(rd.result).length > 900000) { VOICE.data = ""; alert("Note too long for offline storage — keep it under ~60 seconds."); }
        else VOICE.data = rd.result;
        voiceSyncBox();
      };
      rd.readAsDataURL(blob);
    };
    VOICE.rec = rec; rec.start();
    clearInterval(VOICE.timer);
    VOICE.timer = setInterval(() => { VOICE.dur++; if (VOICE.dur >= 60) voiceStop(); else voiceSyncBox(); }, 1000);
    voiceSyncBox();
  } catch (e) { alert("Microphone blocked — allow mic access to record."); }
}
function voiceStop() {
  try { if (VOICE.rec && VOICE.rec.state !== "inactive") VOICE.rec.stop(); } catch (e) {}
  clearInterval(VOICE.timer);
  VOICE.rec = null; voiceSyncBox();
}
function voiceClear() { VOICE.data = ""; VOICE.dur = 0; voiceSyncBox(); }
function voiceData() { return VOICE.data || ""; }

/* All modules parsed — run the first full render (app.js boots before later scripts load). */
if (typeof renderAll === "function") { try { renderAll(); } catch (e) { if (typeof console !== "undefined" && console.error) console.error("KidGrow boot render:", e); } }
/* Deep link: open #page from app shortcuts / shared links (after every module is ready). */
try { const _h = (location.hash || "").replace("#", ""); if (_h && typeof TITLES !== "undefined" && TITLES[_h] && typeof go === "function" && !(typeof roleBlock === "function" && roleBlock(_h))) go(_h); } catch (e) {}
/* Cloud (Supabase auth/sync + subscriptions) — no-op unless js/config.js has keys. */
try { if (typeof Cloud !== "undefined" && Cloud.init) Cloud.init(); } catch (e) {}

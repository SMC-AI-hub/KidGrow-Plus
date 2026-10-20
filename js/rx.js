/* =====================================================
   NeoKid Care — Prescription builder + print (Round 2)
   Uses DRUGS formulary (drugs.js) for mg/kg math.
   ===================================================== */
const RXB = { drugId: "para", stIdx: 0, freq: "Q6H", days: 3, wt: "", instr: "" };
let RX_DRAFT = null;
function rxDraft() {
  if (!RX_DRAFT) RX_DRAFT = { dx: "", advice: "", review: "", items: [], allergyFlag: "" };
  return RX_DRAFT;
}
function rxChildWt(c) {
  const lm = (typeof latestMeasure === "function") ? latestMeasure(c) : null;
  return (lm && lm.wt) || c.birthWt || "";
}
function rxAgeM(c) {
  return ageMonths(c.dob);
}
function renderRx() {
  if (!$("pg-rx")) return;
  const c = child();
  if (!c) { $("rxBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  c.rx = c.rx || [];
  if (!RXB.wt) RXB.wt = rxChildWt(c);
  const dft = rxDraft();
  const d = drugById(RXB.drugId) || DRUGS[0];
  RXB.drugId = d.id;
  if (RXB.stIdx >= (d.strengths || []).length) RXB.stIdx = 0;
  if (!d.freqs.includes(RXB.freq)) RXB.freq = d.defFreq || d.freqs[0];
  RXB.days = RXB.days || d.defDays || 3;
  const cats = [...new Set(DRUGS.map((x) => x.cat))];
  const calc = d.info ? { ok: true, infoOnly: true, take: d.info, warns: [] }
    : calcDose(d.id, RXB.wt, rxAgeM(c), RXB.stIdx, RXB.freq, RXB.days);
  const hxAlg = ((typeof Hx !== "undefined" && Hx.allergyText) ? Hx.allergyText(c) : c.allergy);
  const al = allergyCheck(d.id, hxAlg);
  const dxChecks = (() => { try { return (typeof Dose !== "undefined" && Dose.checkRx) ? Dose.checkRx({ drugId: d.id, wtKg: RXB.wt, ageM: rxAgeM(c), freq: RXB.freq, child: c, draftItems: dft.items }) : { flags: [], hard: false }; } catch (e) { return { flags: [], hard: false }; } })();
  const prev = [...c.rx].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  $("rxBox").innerHTML = `
  <div class="grid g2">
    <div class="card"><h3>🧮 Dose calculator</h3>
      <div class="hint">Weight defaults to latest measurement · dose packs PENDING clinician validation (F1) — verify every dose against CIMS/IAP before filing</div>
      <div class="form-grid">
        <div><label>Weight (kg)</label><input type="number" step="0.1" min="1" value="${RXB.wt}" oninput="RXB.wt=this.value;renderRxCalc()"></div>
        <div><label>Drug</label><select onchange="RXB.drugId=this.value;RXB.stIdx=0;RXB.days='';renderRx()">
          ${cats.map((g) => `<optgroup label="${esc(g)}">${DRUGS.filter((x) => x.cat === g).map((x) => `<option value="${x.id}"${x.id === d.id ? " selected" : ""}>${esc(x.name)}${(typeof formularyStatus === "function" && formularyStatus(x.id) === "pending") ? " ⚠️" : ""}</option>`).join("")}</optgroup>`).join("")}
        </select></div>
        ${(d.strengths || []).length ? `<div><label>Strength</label><select onchange="RXB.stIdx=+this.value;renderRx()">${d.strengths.map((s, i) => `<option value="${i}"${i === RXB.stIdx ? " selected" : ""}>${esc(s.label)}</option>`).join("")}</select></div>` : ""}
        <div><label>Frequency</label><select onchange="RXB.freq=this.value;renderRxCalc()">${d.freqs.map((f) => `<option${f === RXB.freq ? " selected" : ""}>${f}</option>`).join("")}</select></div>
        <div><label>Days</label><input type="number" min="1" max="90" value="${RXB.days}" oninput="RXB.days=+this.value||'';renderRxCalc()"></div>
        <div><label>Instruction (optional)</label><input value="${esc(RXB.instr)}" placeholder="e.g. After food / SOS fever" oninput="RXB.instr=this.value"></div>
      </div>
      <div id="rxCalc"></div>
      ${(() => { try { return (typeof Dose !== "undefined" && Dose.checksHTML) ? Dose.checksHTML(dxChecks) : (al.hit ? `<div class="alert a-red">⚠️ <div><b>ALLERGY ALERT:</b> ${esc(d.name)} matches recorded allergy.</div></div>` : ""); } catch (e) { return ""; } })()}
      <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-p btn-sm" onclick="rxAddItem(${al.hit})" ${calc.ok && !dxChecks.hard ? "" : "disabled"} title="${dxChecks.hard ? "Blocked by safety check" : "Add to prescription"}">＋ Add to prescription</button>
      </div>
      ${d.notes ? `<div class="hint" style="margin-top:8px">ℹ️ ${esc(d.notes)}</div>` : ""}
    </div>
    <div class="card"><h3>📝 Current prescription</h3>
      <div class="form-grid">
        <div class="full"><label>Diagnosis</label><input id="rxDx" value="${esc(dft.dx)}" placeholder="e.g. Acute URI with fever" oninput="rxDraft().dx=this.value"></div>
      </div>
      <div id="rxItems" style="margin:8px 0"></div>
      <div class="form-grid">
        <div class="full"><label>Advice</label><input id="rxAdv" value="${esc(dft.advice)}" placeholder="e.g. Fluids, saline drops, red-flag review" oninput="rxDraft().advice=this.value"></div>
        <div><label>Review on</label><input type="date" id="rxRev" value="${dft.review}" onchange="rxDraft().review=this.value"></div>
        <div><label>Prescribed by</label><input id="rxBy" value="${esc(dft.by || (DB.settings.doctor || ""))}" oninput="rxDraft().by=this.value"></div>
      </div>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-p btn-sm" onclick="saveRx()" ${dft.items.length ? "" : "disabled"}>💾 Save prescription</button>
        <button class="btn btn-o btn-sm" onclick="RX_DRAFT=null;renderRx()">Clear draft</button>
      </div>
    </div>
  </div>
  <div style="height:16px"></div>
  <div class="card"><h3>📚 Previous prescriptions</h3>
    ${prev.length ? prev.map((r) => `<div class="vac-row"><div class="grow"><b>${fmtDate(r.date)}</b> · ${esc(r.dx || "—")}
      ${r.allergyFlag ? ` <span class="badge" style="background:var(--red);color:#fff">⚠️ allergy flag</span>` : ""}<br>
      <span style="font-size:12.5px;color:var(--muted)">${(r.items || []).map((i) => esc(i.drug) + " " + esc(i.take || "")).join(" · ")}</span></div>
      <button class="btn btn-o btn-xs" onclick="printRx('${r.id}')">🖨️ Print</button>
      <button class="btn btn-danger btn-xs" onclick="delRx('${r.id}')">✕</button></div>`).join("")
    : `<div style="font-size:13px;color:var(--muted)">No prescriptions yet — calculate a dose on the left, then Add.</div>`}</div>`;
  renderRxCalc(); renderRxItems();
}
function renderRxCalc() {
  const box = $("rxCalc"); if (!box) return;
  const c = child(), d = drugById(RXB.drugId);
  const calc = d.info ? { ok: true, infoOnly: true, take: d.info, warns: [], basis: "Standard directions" }
    : calcDose(d.id, RXB.wt, c ? rxAgeM(c) : null, RXB.stIdx, RXB.freq, RXB.days || d.defDays);
  if (!calc.ok) { box.innerHTML = `<div class="alert a-amber" style="margin:8px 0 0">⚠️ <div>${esc(calc.why || "Cannot compute.")}</div></div>`; return; }
  box.innerHTML = `<div class="alert a-green" style="margin:8px 0 0">💊 <div><b style="font-size:15px">${esc(calc.take)}</b> ${RXB.freq} × ${RXB.days || d.defDays || "—"} days<br>
    <span style="font-size:12.5px">${!calc.infoOnly && calc.qtyText ? esc(calc.qtyText) + " · " : ""}Basis: ${esc(calc.basis || "")}${calc.capped ? " · capped at adult max" : ""}</span>
    ${(calc.warns || []).map((w) => `<br><span style="font-size:12.5px">⚠️ ${esc(w)}</span>`).join("")}${(typeof formularyStatus === "function" && d && formularyStatus(d.id) === "pending") ? `<br><span style="font-size:12.5px">⚠️ Formulary entry unverified — confirm against reference.</span>` : ""}</div></div>`;
}
function renderRxItems() {
  const box = $("rxItems"); if (!box) return;
  const dft = rxDraft();
  box.innerHTML = dft.items.length ? dft.items.map((i, n) => `<div class="vac-row"><div class="grow"><b>${n + 1}. ${esc(i.drug)}</b> ${esc(i.strength || "")}<br>
    <span style="font-size:13px">${esc(i.take || "")} · ${esc(i.freq)} × ${esc(String(i.days))} days${i.instr ? ` · <i>${esc(i.instr)}</i>` : ""}</span><br>
    <span style="font-size:12px;color:var(--muted)">${esc(i.qty || "")}</span></div>
    <button class="btn btn-danger btn-xs" onclick="RX_DRAFT.items.splice(${n},1);renderRx()">✕</button></div>`).join("")
    : `<div style="font-size:13px;color:var(--muted)">No medicines yet — calculate on the left, then Add.</div>`;
}
function rxAddItem(isAllergy) {
  const c = child(); if (!c) return;
  const d = drugById(RXB.drugId);
  const calc = d.info ? { ok: true, take: d.info, qtyText: "As directed" }
    : calcDose(d.id, RXB.wt, rxAgeM(c), RXB.stIdx, RXB.freq, RXB.days || d.defDays);
  if (!calc.ok) return alert(calc.why || "Cannot compute dose.");
  const dxAdd = (() => { try { return (typeof Dose !== "undefined" && Dose.checkRx) ? Dose.checkRx({ drugId: d.id, wtKg: RXB.wt, ageM: rxAgeM(c), freq: RXB.freq, child: c, draftItems: rxDraft().items }) : { flags: [], hard: false }; } catch (e) { return { flags: [], hard: false }; } })();
  if (dxAdd.hard) { try { if (typeof Alerts !== "undefined" && Alerts.raise) Alerts.raise("hard", "RX-BLOCKED", ((dxAdd.flags || []).find((f) => f.tier === "hard") || {}).text || "Blocked by safety check."); } catch (e2) {} return; }
  const dft = rxDraft();
  dft.items.push({ drug: d.name, strength: (d.strengths[RXB.stIdx] || {}).label || "", freq: RXB.freq, days: RXB.days || d.defDays || "", take: calc.take, qty: calc.qtyText || "", instr: RXB.instr, checks: (dxAdd.flags || []).map((f) => ({ tier: f.tier, code: f.code, text: f.text })) });
  if (isAllergy) dft.allergyFlag = `Allergy alert acknowledged for ${d.name}`;
  RXB.instr = "";
  renderRx();
}
function saveRx() {
  if (typeof guardSubmit === "function" && !guardSubmit("rx")) return; // M4: no double prescriptions
  const c = child(); if (!c) return;
  c.rx = c.rx || [];
  const dft = rxDraft();
  if (!dft.items.length) return alert("Add at least one medicine.");
  if (dft.items.some((i) => (i.checks || []).some((f) => f.tier === "hard"))) return alert("⛔ A blocked item is in this prescription — remove it before saving.");
  c.rx.push({ id: uid(), date: todayISO(), wt: RXB.wt, dx: dft.dx, items: dft.items, advice: dft.advice, review: dft.review, by: dft.by || DB.settings.doctor || "", allergyFlag: dft.allergyFlag });
  RX_DRAFT = null;
  auditSafe("Prescription", `${dft.items.length} item(s) for ${c.name}${dft.dx ? " — " + dft.dx : ""}${(() => { const _n = dft.items.reduce((s, i) => s + ((i.checks || []).length), 0); return _n ? ` · ${_n} check flag(s)` : ""; })()}`);
  save(); renderAll();
  alert("Prescription saved. Print it from Previous prescriptions.");
}
function delRx(id) {
  if (!needSafe(2, "delete prescriptions")) return;
  const c = child();
  if (!confirm("Delete this prescription?")) return;
  c.rx = (c.rx || []).filter((r) => r.id !== id);
  auditSafe("Prescription deleted", `${c.name}`);
  save(); renderAll();
}
function printRx(id) {
  const c = child(); if (!c) return;
  const r = (c.rx || []).find((x) => x.id === id); if (!r) return;
  $("rxPrint").innerHTML = `${clinicHeader()}${childHeader(c)}${(() => { try { return (typeof Hx !== "undefined" && Hx.rxStripHTML) ? Hx.rxStripHTML(c) : ""; } catch (eHx) { return ""; } })()}
    <div class="alert ${r.allergyFlag ? "a-red" : "a-gray"}" style="margin:0 0 12px">⚠️ <div><b>R<sub>x</sub> — ${fmtDate(r.date)}</b>${r.wt ? ` · Wt ${esc(String(r.wt))} kg` : ""} · Dx: <b>${esc(r.dx || "—")}</b>${r.allergyFlag ? `<br><b>ALLERGY FLAG:</b> ${esc(r.allergyFlag)}` : ""}</div></div>
    <table class="tbl"><tr><th>#</th><th>Medicine</th><th>Dose</th><th>Freq × Days</th><th>Qty</th><th>Instructions</th></tr>
    ${(r.items || []).map((it, n) => `<tr><td>${n + 1}</td><td><b>${esc(it.drug)}</b>${it.strength ? `<br><span style="font-size:11.5px;color:var(--muted)">${esc(it.strength)}</span>` : ""}</td><td><b>${esc(it.take || "—")}</b></td><td>${esc(it.freq)} × ${esc(String(it.days))}</td><td style="font-size:12px">${esc(it.qty || "—")}</td><td style="font-size:12px">${esc(it.instr || "—")}</td></tr>`).join("")}</table>
    ${r.advice ? `<div style="margin-top:10px;font-size:13.5px"><b>Advice:</b> ${esc(r.advice)}</div>` : ""}
    ${r.review ? `<div style="font-size:13.5px"><b>Review on:</b> ${fmtDate(r.review)}</div>` : ""}
    ${(() => { try { const q = "RX|" + c.name + "|" + r.date + "|" + (r.dx || "") + "|" + (r.items || []).map((it) => it.drug + " " + (it.take || "")).join(";"); return '<div style="margin-top:12px;display:flex;gap:12px;align-items:center">' + qrSVG(q) + '<div style="font-size:11px;color:var(--muted)">Scan to verify prescription' + (typeof parentVerifyCode === "function" ? "<br>Card code " + parentVerifyCode(c) : "") + "</div></div>"; } catch (e) { return ""; } })()}
    <div style="display:flex;justify-content:flex-end;margin-top:36px"><div style="text-align:center;font-size:13px">For ${esc(DB.settings.clinic || "")}<br><br><b>${esc(r.by || DB.settings.doctor || "")}</b><br><span style="color:var(--muted)">Signature & seal</span></div></div>`;
  printPage("pg-rxprint");
}

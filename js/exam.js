/* NeoKid Care — visit templates + exam/vitals (Phase 2).
   Template picker fills SOAP boxes (free text stays boss — template text only
   fills empties or appends). Vitals widget with age-aware PALS/AAP flags
   (warn/info only — saving is never blocked). Systems exam composes into the
   Examination box on demand. Pure helpers stay DOM-free for tests. */
const EX_SYSTEMS = [["gen", "General"], ["heent", "HEENT"], ["chest", "Chest"], ["cvs", "CVS"], ["abd", "Abdomen"], ["neuro", "Neuro/Dev"], ["skin", "Skin"], ["gent", "Genitalia"]];
const EX_ST = [["", "—"], ["n", "Normal"], ["ab", "Abnormal"], ["ne", "N.E."]];
var EXB = { exam: {}, dob: "", sex: "" }; // visit-modal draft

function exEsc(s) {
  if (typeof esc === "function") { try { return esc(s); } catch (e) {} }
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function exEl(id) { try { return (typeof $ === "function" ? $(id) : document.getElementById(id)); } catch (e) { return null; } }
function exToast(m) { try { if (typeof toast === "function") toast(m); } catch (e) {} }
function exNum(x) { if (x == null || x === "") return null; const n = parseFloat(x); return Number.isFinite(n) ? n : null; }
function exPack(name) { try { return (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT[name]) || null; } catch (e) { return null; } }
function exAgeDays(dob, on) {
  try {
    if (!dob || typeof ageBetween !== "function") return null;
    const a = ageBetween(dob, on || (typeof todayISO === "function" ? todayISO() : undefined));
    return (a && Number.isFinite(a.days)) ? a.days : null;
  } catch (e) { return null; }
}
function exBandForAge(ageDays) {
  try {
    const P = exPack("vitals");
    if (!P || !(ageDays >= 0)) return null;
    return (P.bands || []).find((b) => ageDays >= b.minDays && ageDays <= b.maxDays) || null;
  } catch (e) { return null; }
}
function exFlagsFor(v, ageDays, sex) {
  v = v || {};
  const out = [];
  const P = exPack("vitals");
  if (!P) return out;
  const t = exNum(v.t);
  if (t !== null) {
    if (t >= (P.tempC.high || 39)) out.push({ sev: "warn", text: `High fever ${t}°C — act now` });
    else if (t >= (P.tempC.fever || 38)) out.push({ sev: "warn", text: `Fever ${t}°C (≥${P.tempC.fever}°C)` });
    else if (t < (P.tempC.hypothermia || 35)) out.push({ sev: "warn", text: `Low temperature ${t}°C — recheck + keep warm` });
  }
  const band = exBandForAge(ageDays);
  const hr = exNum(v.hr);
  if (hr !== null && band) {
    if (hr > band.hr[1]) out.push({ sev: "warn", text: `Tachycardia ${hr}/min (awake range ${band.hr[0]}–${band.hr[1]} — ${band.label})` });
    else if (hr < band.hr[0]) out.push({ sev: "warn", text: `Bradycardia ${hr}/min (awake range ${band.hr[0]}–${band.hr[1]} — ${band.label})` });
  }
  const rr = exNum(v.rr);
  if (rr !== null && band) {
    if (rr > band.rr[1]) out.push({ sev: "warn", text: `Tachypnoea ${rr}/min (range ${band.rr[0]}–${band.rr[1]} — ${band.label})` });
    else if (rr < band.rr[0]) out.push({ sev: "warn", text: `Bradypnoea ${rr}/min (range ${band.rr[0]}–${band.rr[1]} — ${band.label})` });
  }
  const spo2 = exNum(v.spo2);
  if (spo2 !== null) {
    if (spo2 < (P.spo2.critical || 90)) out.push({ sev: "warn", text: `SpO₂ ${spo2}% — critically low, act now` });
    else if (spo2 < (P.spo2.low || 95)) out.push({ sev: "warn", text: `SpO₂ ${spo2}% — low (<${P.spo2.low}%)` });
  }
  const sys = exNum(v.sys), dia = exNum(v.dia);
  if ((sys !== null || dia !== null) && P.bpScreen) {
    const B = P.bpScreen;
    if ((ageDays || 0) >= 4749) { // ≥13 y: AAP adolescent staging (adult-aligned)
      const s1 = B.adolStage.stage1, s2 = B.adolStage.stage2;
      const r = `${sys != null ? sys : "?"} / ${dia != null ? dia : "?"}`;
      if ((sys !== null && sys >= s2[0]) || (dia !== null && dia >= s2[1])) out.push({ sev: "warn", text: `BP ${r} — Stage 2 range (≥${s2[0]}/${s2[1]} at ≥13y). Repeat + confirm.` });
      else if ((sys !== null && sys >= s1[0]) || (dia !== null && dia >= s1[1])) out.push({ sev: "warn", text: `BP ${r} — Stage 1 range (≥${s1[0]}/${s1[1]} at ≥13y). Repeat + confirm.` });
      else if ((sys !== null && sys >= B.adol[0]) || (dia !== null && dia >= B.adol[1])) out.push({ sev: "warn", text: `BP ${r} — elevated (≥${B.adol[0]}/${B.adol[1]} at ≥13y). Repeat.` });
    } else if (Math.floor((ageDays || 0) / 365.25) >= 1) { // 1–12 y: Table 6 screening
      const ageY = Math.min(Math.floor((ageDays || 0) / 365.25), 12);
      const b = (B.boys || {})[String(ageY)], g = (B.girls || {})[String(ageY)];
      let ts = Infinity, td = Infinity;
      if (sex === "boy" && b) { ts = b[0]; td = b[1]; }
      else if (sex === "girl" && g) { ts = g[0]; td = g[1]; }
      else { // unknown sex → more sensitive of the two (screening errs toward flagging)
        if (b) { ts = Math.min(ts, b[0]); td = Math.min(td, b[1]); }
        if (g) { ts = Math.min(ts, g[0]); td = Math.min(td, g[1]); }
      }
      if ((sys !== null && sys >= ts) || (dia !== null && dia >= td)) {
        out.push({ sev: "warn", text: `BP ${sys != null ? sys : "?"} / ${dia != null ? dia : "?"} ≥ screening threshold (${ts}/${td} at ${ageY}y) — repeat + check full AAP tables` });
      }
    } // under 1 y: record only, no screening threshold exists
  }
  return out;
}
function exFlagsHTML(v, ageDays, sex) {
  const entered = v && ["t", "hr", "rr", "spo2", "sys", "dia"].some((k) => v[k] !== "" && v[k] != null);
  if (!entered) return `<div class="hint">Enter vitals for age-aware flags (PALS / AAP screening).</div>`;
  const flags = exFlagsFor(v, ageDays, sex);
  if (!flags.length) return `<div style="font-size:13px;color:var(--teal,#0e7c7b)">✓ Vitals in range (PALS / AAP screening)</div>`;
  return flags.map((f) => `<div style="font-size:13px;color:var(--red);margin-bottom:2px">⚠️ ${exEsc(f.text)}</div>`).join("");
}
function exVitalsHTML(v) {
  v = v || {};
  const inp = (id, label, val, ph) => `<div><label>${label}</label><input id="${id}" inputmode="decimal" value="${exEsc(val == null ? "" : val)}" placeholder="${ph}"></div>`;
  return `<div class="form-grid" style="margin-top:6px">`
    + inp("vxT", "Temp (°C)", v.t, "e.g. 38.2") + inp("vxHr", "Heart rate (/min)", v.hr, "e.g. 120")
    + inp("vxRr", "Resp. rate (/min)", v.rr, "e.g. 28") + inp("vxSpo2", "SpO₂ (%)", v.spo2, "e.g. 98")
    + inp("vxSys", "BP systolic", v.sys, "e.g. 100") + inp("vxDia", "BP diastolic", v.dia, "e.g. 60")
    + `</div><div id="vxFlags" style="margin-top:6px"></div><div id="vxFhint" class="hint"></div>`;
}
function exExamHTML(ex) {
  ex = ex || {};
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">` + EX_SYSTEMS.map(([k, label]) => {
    const s = ex[k] || {};
    return `<div style="display:flex;gap:6px;align-items:center"><span style="font-size:12.5px;min-width:64px">${label}</span>`
      + `<select style="max-width:104px" onchange="Ex.edE('${k}','st',this.value)">${EX_ST.map(([val, l]) => `<option value="${val}"${(s.st || "") === val ? " selected" : ""}>${l}</option>`).join("")}</select>`
      + `<input value="${exEsc(s.note || "")}" placeholder="note" oninput="Ex.edE('${k}','note',this.value)" style="flex:1;min-width:0"></div>`;
  }).join("") + `</div>`;
}
function exTemplates() { try { return (exPack("templates") || {}).templates || []; } catch (e) { return []; } }
function exTemplate(id) { return exTemplates().find((x) => x.id === id) || null; }
function exComposeExam(ex) {
  ex = ex || EXB.exam || {};
  const parts = [];
  for (const [k, label] of EX_SYSTEMS) {
    const s = ex[k] || {};
    if (s.st === "n") parts.push(`${label}: normal${s.note ? ` (${s.note})` : ""}`);
    else if (s.st === "ab") parts.push(`${label}: ABNORMAL${s.note ? ` — ${s.note}` : ""}`);
  }
  return parts.join("; ");
}
function exAppendBox(id, text) {
  const box = exEl(id);
  if (!box || !text) return;
  box.value = box.value ? box.value.replace(/\s+$/, "") + "\n\n" + text : text;
}
function exInsertExam() {
  try {
    const s = exComposeExam();
    if (!s) { exToast("Assess a system first (Normal / Abnormal)."); return; }
    exAppendBox("vsObj", "Exam: " + s);
    exToast("Exam inserted — edit freely.");
  } catch (e) {}
}
function exTplButtonsHTML(tpl) {
  if (!tpl || !tpl.suggestIcd || !tpl.suggestIcd.length) return "";
  return `<span style="font-size:12px;color:var(--muted)">Suggested codes: </span>` + tpl.suggestIcd.map((code) => {
    let label = "";
    try { const e = (typeof Terms !== "undefined" && Terms.get) ? Terms.get(code) : null; label = e ? e.label : ""; } catch (e2) {}
    return `<button type="button" class="btn btn-o btn-xs" style="margin:2px 4px 2px 0" onclick="Ex.addSuggest('${exEsc(code)}')">${exEsc(code)}${label ? " · " + exEsc(label) : ""}</button>`;
  }).join("");
}
function exApplyTemplate(id) {
  try {
    const tpl = exTemplate(id);
    const hid = exEl("vsTemplate");
    if (hid) hid.value = id || "";
    const box = exEl("vsTplIcd");
    if (box) box.innerHTML = tpl ? exTplButtonsHTML(tpl) : "";
    if (!tpl) return;
    exAppendBox("vsSubj", (tpl.s || []).join("\n"));
    exAppendBox("vsObj", (tpl.o || []).join("\n"));
    exAppendBox("vsPlan", (tpl.p || []).join("\n"));
    exToast(`“${tpl.title}” applied — edit freely.`);
  } catch (e) {}
}
function exAddSuggest(code) {
  try {
    if (typeof Terms !== "undefined" && Terms.pick) Terms.pick("vsIcd", "vsIcdChips", "vsIcdList", "vsIcdQ", code);
  } catch (e) {}
}
function exPaintFlags() {
  try {
    const box = exEl("vxFlags");
    if (!box) return;
    const d = exEl("vsDate");
    const ageDays = exAgeDays(EXB.dob, (d && d.value) || undefined);
    const v = exCollectVitals();
    box.innerHTML = exFlagsHTML(v, ageDays, EXB.sex);
    const fh = exEl("vxFhint");
    if (fh) { const t = exNum(v.t); fh.textContent = t !== null ? `= ${Math.round((t * 9 / 5 + 32) * 10) / 10}°F` : ""; }
  } catch (e) {}
}
function exCollectVitals() {
  const g = (id) => { const el = exEl(id); return el ? String(el.value).trim() : ""; };
  const num = (s) => (s === "" ? "" : (isNaN(parseFloat(s)) ? s : parseFloat(s)));
  return { t: num(g("vxT")), hr: num(g("vxHr")), rr: num(g("vxRr")), spo2: num(g("vxSpo2")), sys: num(g("vxSys")), dia: num(g("vxDia")) };
}
function exCleanExam(ex) {
  const out = {};
  for (const [k] of EX_SYSTEMS) {
    const s = (ex || {})[k] || {};
    if ((s.st && s.st !== "") || (s.note && String(s.note).trim())) out[k] = { st: s.st || "", note: String(s.note || "").trim() };
  }
  return out;
}
function exFillVisit(v, c) {
  try {
    v = v || {}; c = c || {};
    EXB.exam = JSON.parse(JSON.stringify(v.exam || {}));
    EXB.dob = c.dob || ""; EXB.sex = c.sex || "";
    const vv = v.vitals || {};
    const vb = exEl("vsVitalsBox");
    if (vb) {
      vb.innerHTML = exVitalsHTML(vv); // same widget nb/nicu/emg can reuse
      if (!vb._exWired) { vb._exWired = true; vb.oninput = () => { try { exPaintFlags(); } catch (e) {} }; }
    }
    const sel = exEl("vsTemplate");
    if (sel) {
      sel.innerHTML = `<option value="">— No template —</option>` + exTemplates().map((x) => `<option value="${exEsc(x.id)}">${exEsc(x.title)}</option>`).join("");
      sel.value = v.template || "";
    }
    const xr = exEl("exRows");
    if (xr) xr.innerHTML = exExamHTML(EXB.exam);
    const box = exEl("vsTplIcd");
    if (box) { const tpl = exTemplate(v.template); box.innerHTML = tpl ? exTplButtonsHTML(tpl) : ""; }
    exPaintFlags();
  } catch (e) {}
}
function exCollectVisit() {
  let template = "";
  try { const sel = exEl("vsTemplate"); template = sel ? sel.value : ""; } catch (e) {}
  return { vitals: exCollectVitals(), exam: exCleanExam(EXB.exam), template };
}
function exVisitVitalsHTML(v, c) {
  try {
    const vv = (v && v.vitals) || {};
    const has = ["t", "hr", "rr", "spo2", "sys", "dia"].some((k) => vv[k] !== "" && vv[k] != null);
    if (!has) return "";
    const chips = [];
    if (vv.t !== "" && vv.t != null) chips.push(`T ${vv.t}°C`);
    if (vv.hr !== "" && vv.hr != null) chips.push(`HR ${vv.hr}`);
    if (vv.rr !== "" && vv.rr != null) chips.push(`RR ${vv.rr}`);
    if (vv.spo2 !== "" && vv.spo2 != null) chips.push(`SpO₂ ${vv.spo2}%`);
    if ((vv.sys !== "" && vv.sys != null) || (vv.dia !== "" && vv.dia != null)) chips.push(`BP ${vv.sys != null && vv.sys !== "" ? vv.sys : "?"} / ${vv.dia != null && vv.dia !== "" ? vv.dia : "?"}`);
    const flags = exFlagsFor(vv, exAgeDays(c && c.dob, v && v.date), c && c.sex);
    return `<div style="font-size:12.5px;color:var(--muted);margin-top:4px">🩺 ${chips.map(exEsc).join(" · ")}${flags.length ? ` <span style="color:var(--red)">⚠️ ${flags.length} flag${flags.length > 1 ? "s" : ""}</span>` : ""}</div>`;
  } catch (e) { return ""; }
}
function exRaiseFlagsOnSave(v, c) {
  try {
    const flags = exFlagsFor((v && v.vitals) || {}, exAgeDays(c && c.dob, v && v.date), c && c.sex);
    if (flags.length && typeof Alerts !== "undefined" && Alerts.raise) {
      Alerts.raise("warn", "VITALS", `${flags.length} vital-sign flag(s) on ${((c && c.name) || "child")}: ${flags.map((f) => f.text).join("; ")}`);
    }
    return flags.length;
  } catch (e) { return 0; }
}
var Ex = {
  systems: EX_SYSTEMS, bandForAge: exBandForAge, flagsFor: exFlagsFor, flagsHTML: exFlagsHTML,
  vitalsHTML: exVitalsHTML, examHTML: exExamHTML, templates: exTemplates, template: exTemplate,
  composeExam: exComposeExam, insertExam: exInsertExam, applyTemplate: exApplyTemplate, addSuggest: exAddSuggest,
  fillVisit: exFillVisit, collectVisit: exCollectVisit, collectVitals: exCollectVitals,
  paintFlags: exPaintFlags, visitVitalsHTML: exVisitVitalsHTML, raiseFlagsOnSave: exRaiseFlagsOnSave,
  edE(sys, k, val) { try { EXB.exam[sys] = EXB.exam[sys] || {}; EXB.exam[sys][k] = val; } catch (e) {} },
};
try { if (typeof window !== "undefined" && window) window.Ex = Ex; } catch (e) {}

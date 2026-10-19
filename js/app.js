/* ================= NeoKid Care — App logic ================= */
const LS_KEY = "kidgrow_pro_v1";
const $ = (id) => document.getElementById(id);
const uid = () => "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayISO = () => { const d = new Date(); const p = (x) => String(x).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };
const addDays = (iso, n) => { const p = String(iso || "").split("-"); const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + (+n || 0))); return d.toISOString().slice(0, 10); };

function ageBetween(dobISO, onISO) {
  const b = new Date(dobISO + "T00:00:00"), o = new Date((onISO || todayISO()) + "T00:00:00");
  let y = o.getFullYear() - b.getFullYear(), m = o.getMonth() - b.getMonth(), d = o.getDate() - b.getDate();
  if (d < 0) { m--; d += new Date(o.getFullYear(), o.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const days = Math.max(0, Math.round((o - b) / 86400000));
  return { y, m, d, days, months: days / 30.4375 };
}
function ageMonths(dobISO, onISO) { const a = ageBetween(dobISO, onISO); return a.y * 12 + a.m + a.d / 30.4375; }
function ageStr(a) {
  if (a.days < 60) return `${a.days} days`;
  if (a.y < 1) { const mo = Math.floor(a.months); return `${mo} mo ${a.d} d`; }
  if (a.y < 5) return `${a.y} y ${a.m} mo`;
  return `${a.y} y ${a.m} mo`;
}

/* ---------------- Store ---------------- */
let DB = { children: [], activeId: null, settings: { clinic: "", doctor: "", reg: "", addr: "" }, msBand: null, gTab: "wt" };
let MEM_FALLBACK = null; // in-memory fallback if storage blocked (e.g. sandboxed preview)
function auditSafe(a, d) { try { if (typeof log === "function") log(a, d); } catch (e) {} }
function needSafe(r, w) { try { if (typeof need === "function") return need(r, w); } catch (e) {} return true; }
function save() {
  let json = null;
  try { json = JSON.stringify(DB); }
  catch (e) { alert("Cannot save — data contains an invalid value. Please Export a backup and contact support."); return; }
  try { localStorage.setItem(LS_KEY, json); }
  catch (e) {
    try { MEM_FALLBACK = json; } catch (_) {}
    alert("Device storage is full — changes kept in memory only. Please Export a backup now, free space, then re-import.");
    return;
  }
  try { localStorage.setItem(LS_KEY + "_auto", json); } catch (_) {}
  try { if (typeof CloudSchedulePush === "function") CloudSchedulePush(); } catch (_) {}
}
function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function parseDB(raw) {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.children)) return null;
    const merged = Object.assign({ children: [], activeId: null, settings: {}, msBand: null, gTab: "wt" }, d);
    merged.children.forEach(normalizeChild);
    ensureMrns(merged.children);
    try { if (typeof migrateDB === "function") migrateDB(merged); } catch (e2) {}
    if (!merged.children.some((c) => c.id === merged.activeId)) merged.activeId = (merged.children[0] || {}).id || null;
    return merged;
  } catch (e) { return null; }
}
function load() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = MEM_FALLBACK; }
  if (raw) {
    const main = parseDB(raw);
    if (main) { DB = main; return; }
    const auto = parseDB(safeGet(LS_KEY + "_auto"));
    if (auto) {
      DB = auto;
      setTimeout(() => alert("Recovered your data from the automatic backup (main copy was damaged). Please Export a fresh backup."), 600);
      return;
    }
    try { localStorage.setItem(LS_KEY + "_corrupt_" + Date.now(), String(raw).slice(0, 50000)); } catch (_) {}
    setTimeout(() => alert("Saved data was damaged and could not be recovered. Starting fresh — if you have an exported backup, please Import it."), 600);
  }
  seedDemo();
  try { if (typeof migrateDB === "function") migrateDB(DB); } catch (e) {}
  try { save(); } catch (e) {}
}
function normalizeChild(c) {
  if (!c || typeof c !== "object") return c;
  if (!Array.isArray(c.measures)) c.measures = [];
  if (!c.vaccines || typeof c.vaccines !== "object") c.vaccines = {};
  if (!c.milestones || typeof c.milestones !== "object") c.milestones = {};
  if (!Array.isArray(c.visits)) c.visits = [];
  if (!Array.isArray(c.rx)) c.rx = [];
  if (!Array.isArray(c.labs)) c.labs = [];
  if (!Array.isArray(c.aefi)) c.aefi = [];
  if (!Array.isArray(c.tanner)) c.tanner = [];
  if (!Array.isArray(c.consents)) c.consents = [];
  if (!Array.isArray(c.extraVac)) c.extraVac = [];
  // IAP 2025 retired the routine typhoid booster — preserve any recorded TCVB as history.
  if (c.vaccines.TCVB && !c.extraVac.some((x) => x && x.name === "Typhoid Conjugate Booster")) {
    const _t = c.vaccines.TCVB || {};
    c.extraVac.push({ id: (typeof uid === "function" ? uid() : "leg-" + Date.now()), name: "Typhoid Conjugate Booster", brand: _t.brand || "", mfr: _t.mfr || "", date: _t.date || "", batch: _t.batch || "", by: _t.by || "", note: "Given under pre-2025 schedule" });
    delete c.vaccines.TCVB;
  }
  if (!c.nicu || typeof c.nicu !== "object") c.nicu = { admissions: [] };
  if (!Array.isArray(c.nicu.admissions)) c.nicu.admissions = [];
  if (!Array.isArray(c.mar)) c.mar = [];
  if (!c.dental || typeof c.dental !== "object") c.dental = {};
  if (!c.diet || typeof c.diet !== "object") c.diet = { type: "veg" };
  if (!c.perinatal || typeof c.perinatal !== "object") c.perinatal = {};
  if (!c.maternal || typeof c.maternal !== "object") c.maternal = {};
  if (!c.family || typeof c.family !== "object") c.family = {};
  if (!Array.isArray(c.allergies)) c.allergies = [];
  if (!Array.isArray(c.problems)) c.problems = [];
  if (Array.isArray(c.visits)) c.visits.forEach((v) => { if (!v) return; if (!Array.isArray(v.icd)) v.icd = []; if (!v.vitals || typeof v.vitals !== "object") v.vitals = {}; if (!v.exam || typeof v.exam !== "object") v.exam = {}; if (typeof v.template !== "string") v.template = ""; });
  if (!c.asthma || typeof c.asthma !== "object") c.asthma = { pef: [], triggers: [] };
  if (!Array.isArray(c.asthma.pef)) c.asthma.pef = [];
  if (!Array.isArray(c.asthma.triggers)) c.asthma.triggers = [];
  return c;
}
function child() { return normalizeChild(DB.children.find((c) => c.id === DB.activeId) || DB.children[0] || null); }

/* ================= PATIENT HEADER (unified, every clinical screen) ================= */
const PH_SLOTS = ["visits", "timeline", "rx", "vaccines", "card", "growth", "labs", "aefi", "nicu", "mar", "nb", "screen", "diet", "consent"];
function patientHeaderData(c) {
  if (!c) return null;
  const ms = [...(c.measures || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const lastW = ms.find((m) => m.wt > 0);
  const t = todayISO();
  const tok = (DB.tokens || []).filter((x) => x.date === t && x.childId === c.id && (x.status === "waiting" || x.status === "in"))
    .sort((a, b) => (a.n || 0) - (b.n || 0))[0] || null;
  let overdue = 0;
  try { overdue = vaccineSummary(c).overdue || 0; } catch (e) {}
  let red = [];
  try { red = growthAlerts(c.measures || [], c.dob, t).filter((a) => a.level === "red"); } catch (e) {}
  return {
    name: c.name || "", age: ageStr(ageBetween(c.dob)), dob: c.dob || "",
    sex: c.sex === "boy" ? "♂ Boy" : c.sex === "girl" ? "♀ Girl" : "",
    allergy: (c.allergy || "").trim(),
    wt: lastW ? lastW.wt : null, wtDate: lastW ? lastW.date : "",
    token: tok ? { n: tok.n, status: tok.status, reason: tok.reason || "" } : null,
    overdue, growthRed: red.length
  };
}
function patientHeaderHTML(c) {
  const d = patientHeaderData(c);
  if (!d) return "";
  const bits = [];
  bits.push(`<b style="font-size:15px;color:var(--navy)">${esc(d.name)}</b> <span style="color:var(--muted);font-size:12.5px">${esc(d.sex)}${d.sex ? " · " : ""}${esc(d.age)} · DOB ${esc(fmtDate(d.dob))}</span>`);
  bits.push(d.allergy ? `<span class="badge b-red">⚠️ ${esc(d.allergy)}</span>` : `<span class="badge b-green">No known allergy</span>`);
  if (d.wt != null) bits.push(`<span class="badge b-teal">⚖️ ${esc(String(d.wt))} kg <span style="font-weight:400">(${esc(fmtDate(d.wtDate))})</span></span>`);
  if (d.token) bits.push(`<span class="badge ${d.token.status === "in" ? "b-green" : "b-amber"}">🎫 Token #${esc(String(d.token.n))} · ${esc(d.token.status)}${d.token.reason ? " · " + esc(d.token.reason) : ""}</span>`);
  if (d.overdue) bits.push(`<span class="badge b-red">💉 ${d.overdue} overdue</span>`);
  if (d.growthRed) bits.push(`<span class="badge b-red">📉 growth flag</span>`);
  return `<div class="card ph-card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${bits.join("")}</div></div>`;
}
function renderPatientHeaders() {
  const c = (typeof child === "function") ? child() : null;
  const html = patientHeaderHTML(c);
  PH_SLOTS.forEach((s) => { const el = document.getElementById("ph-" + s); if (el) el.innerHTML = html; });
}
function setActive(id) { DB.activeId = id; DB.msBand = null; pushRecentId(id); save(); syncChildPicker(); renderAll(); }

/* ---------------- Recent patients (type-ahead ranking) ---------------- */
function getRecentIds() { try { const r = JSON.parse(localStorage.getItem("kgRecent") || "[]"); return Array.isArray(r) ? r.filter((x) => typeof x === "string") : []; } catch (e) { return []; } }
function pushRecentId(id) {
  if (!id) return;
  try {
    const r = getRecentIds().filter((x) => x !== id);
    r.unshift(id);
    localStorage.setItem("kgRecent", JSON.stringify(r.slice(0, 8)));
  } catch (e) {}
}

/* ---------------- Demo seed ---------------- */
function seedDemo() {
  const dob = "2025-01-15";
  const c = {
    id: uid(), name: "Aarav Sharma", sex: "boy", dob, mrn: "0001", blood: "B+", birthWt: 2.9, gest: 39,
    father: "Rohit Sharma", mother: "Priya Sharma", fHt: 172, mHt: 160, phone: "98765 43210",
    ped: "Dr. A. Sharma", allergy: "None known",
    measures: [], vaccines: {}, milestones: {}, visits: []
  };
  const M = (date, wt, ht, hc, note) => ({ id: uid(), date, wt, ht, hc: hc || "", muac: "", bmi: +(wt / Math.pow(ht / 100, 2)).toFixed(1), note: note || "", by: "Clinic" });
  c.measures = [
    M("2025-01-15", 2.9, 49.0, 34.0, "Birth"),
    M("2025-02-26", 4.4, 55.2, 37.4, "6-week visit"),
    M("2025-03-26", 5.5, 59.0, 39.2, "10-week visit"),
    M("2025-04-23", 6.3, 62.0, 40.6, "14-week visit"),
    M("2025-07-15", 7.8, 67.8, 43.4, "6-month review"),
    M("2025-10-15", 8.8, 72.2, 45.1, "9-month review"),
    M("2026-01-15", 9.7, 76.0, 46.2, "1-year review"),
    M("2026-04-15", 10.4, 79.5, 47.0, "15-month review"),
    M("2026-07-15", 11.0, 82.5, 47.5, "18-month review"),
  ];
  const V = (date, by) => ({ date, batch: "D-" + date.slice(2, 4) + date.slice(5, 7), site: "Thigh", by: by || "Dr. A. Sharma", aer: "", note: "" });
  ["BCG", "OPV0", "HEPB-B"].forEach((k) => (c.vaccines[k] = V("2025-01-16")));
  ["DTP1", "IPV1", "HIB1", "HEPB2", "ROTA1", "PCV1"].forEach((k) => (c.vaccines[k] = V("2025-02-26")));
  ["DTP2", "IPV2", "HIB2", "HEPB3", "ROTA2", "PCV2"].forEach((k) => (c.vaccines[k] = V("2025-03-26")));
  ["DTP3", "IPV3", "HIB3", "HEPB4", "ROTA3", "PCV3"].forEach((k) => (c.vaccines[k] = V("2025-04-23")));
  c.vaccines["FLU1"] = V("2025-07-15"); c.vaccines["FLU2"] = V("2025-08-14");
  c.vaccines["MMR1"] = V("2025-10-15"); c.vaccines["TCV1"] = V("2025-10-15"); c.vaccines["VITA1"] = { date: "2025-10-15", batch: "", site: "Oral", by: "Nurse", aer: "", note: "" };
  c.vaccines["HEPA1"] = V("2026-01-15");
  c.vaccines["MMR2"] = V("2026-04-15"); c.vaccines["VAR1"] = V("2026-04-15"); c.vaccines["PCVB"] = V("2026-04-15");
  const BR = (codes, brand, mfr) => codes.forEach((k) => { if (c.vaccines[k]) { c.vaccines[k].brand = brand; c.vaccines[k].mfr = mfr; } });
  BR(["BCG", "OPV0"], "Govt. UIP supply", "Govt. of India");
  BR(["HEPB-B"], "Genevac-B", "Serum Institute");
  BR(["DTP1", "IPV1", "HIB1", "HEPB2", "DTP2", "IPV2", "HIB2", "HEPB3", "DTP3", "IPV3", "HIB3", "HEPB4"], "Hexaxim", "Sanofi");
  BR(["ROTA1", "ROTA2", "ROTA3"], "Rotavac", "Bharat Biotech");
  BR(["PCV1", "PCV2", "PCV3", "PCVB"], "Prevenar 13", "Pfizer");
  BR(["FLU1", "FLU2"], "Vaxigrip", "Sanofi");
  BR(["MMR1", "MMR2"], "Priorix", "GSK");
  BR(["TCV1"], "Typbar TCV", "Bharat Biotech");
  BR(["VITA1"], "Govt. supply", "Govt. of India");
  BR(["HEPA1"], "Havrix", "GSK");
  BR(["VAR1"], "Varilrix", "GSK");
  MILESTONES.forEach((b, bi) => { if (bi <= 7) b.items.forEach((_, ii) => (c.milestones[bi + "_" + ii] = "A")); });
  c.visits = [
    { id: uid(), date: "2026-04-15", type: "Vaccination", subj: "Well child for 15-mo shots; eating well, active.", obj: "Wt 10.4 kg, playful, no pallor; milestones age-appropriate.", plan: "MMR-2, Varicella-1, PCV booster given. Counselled on diet & next visit at 16–18 mo." },
    { id: uid(), date: "2026-07-15", type: "Routine / Well-child", subj: "18-mo review; walks, runs, says 15+ words.", obj: "Wt 11.0 kg, Ht 82.5 cm; growth along 50th centile.", plan: "Due: DTP-B1, Hib-B, IPV-B1, HepA-2. Continue iron-rich diet; dental review." },
  ];
  // --- second demo: preterm infant (corrected-age showcase) ---
  const c2 = {
    id: uid(), name: "Diya Nair", sex: "girl", dob: "2026-01-20", blood: "O+", birthWt: 1.7, birthLen: 42, birthHC: 29.5, gest: 33,
    father: "Arun Nair", mother: "Lakshmi Nair", fHt: 168, mHt: 155, phone: "98111 22334",
    ped: "Dr. A. Sharma", allergy: "None known",
    measures: [], vaccines: {}, milestones: {}, visits: [], tanner: []
  };
  const M2 = (date, wt, ht, hc, muac, note) => ({ id: uid(), date, wt, ht, hc: hc || "", muac: muac || "", pos: "length", sitHt: "", armSpan: "", edema: "", appetite: "", bmi: +(wt / Math.pow(ht / 100, 2)).toFixed(1), note: note || "", by: "Clinic" });
  c2.measures = [
    M2("2026-02-20", 2.3, 45.5, 32.0, "", "PMA 37.5 w"),
    M2("2026-03-22", 3.2, 50.0, 34.5, "", "Term equivalent+"),
    M2("2026-05-20", 5.0, 57.0, 39.5, "", "Corr 2.7 mo"),
    M2("2026-07-20", 6.2, 62.0, 41.5, 13.5, "Corr 4.7 mo"),
    M2("2026-09-20", 7.1, 66.0, 43.0, 14.0, "Corr 6.7 mo"),
  ];
  const V2 = (date) => ({ date, batch: "D-" + date.slice(2, 4) + date.slice(5, 7), site: "Thigh", by: "Dr. A. Sharma", aer: "", note: "By chronological age (preterm protocol)" });
  ["BCG", "OPV0", "HEPB-B"].forEach((k) => (c2.vaccines[k] = V2("2026-01-22")));
  ["DTP1", "IPV1", "HIB1", "HEPB2", "ROTA1", "PCV1"].forEach((k) => (c2.vaccines[k] = V2("2026-03-03")));
  ["DTP2", "IPV2", "HIB2", "HEPB3", "ROTA2", "PCV2"].forEach((k) => (c2.vaccines[k] = V2("2026-03-31")));
  ["DTP3", "IPV3", "HIB3", "HEPB4", "ROTA3", "PCV3"].forEach((k) => (c2.vaccines[k] = V2("2026-04-28")));
  const BR2 = (codes, brand, mfr) => codes.forEach((k) => { if (c2.vaccines[k]) { c2.vaccines[k].brand = brand; c2.vaccines[k].mfr = mfr; } });
  BR2(["BCG", "OPV0", "HEPB-B"], "Govt. UIP supply", "Govt. of India");
  BR2(["DTP1", "IPV1", "HIB1", "HEPB2", "DTP2", "IPV2", "HIB2", "HEPB3", "DTP3", "IPV3", "HIB3", "HEPB4"], "EasySix", "Panacea Biotec");
  BR2(["ROTA1", "ROTA2", "ROTA3"], "Rotavac", "Bharat Biotech");
  BR2(["PCV1", "PCV2"], "Pneumosil", "Serum Institute");
  MILESTONES.forEach((b, bi) => { if (bi <= 3) b.items.forEach((_, ii) => (c2.milestones[bi + "_" + ii] = "A")); });
  c2.visits = [
    { id: uid(), date: "2026-09-20", type: "Growth review", subj: "Preterm (33 w) high-risk follow-up; feeding well, corr age 6.7 mo.", obj: "Wt 7.1 kg, thriving on corrected curve; tone normal.", plan: "Continue breastfeeds + iron; ROP/hearing done; review 2-monthly." },
  ];
  DB.children = [c, c2]; DB.activeId = c.id;
  const T0 = todayISO();
  DB.appts = [
    { id: uid(), childId: c.id, date: T0, time: "10:30", type: "Vaccine", note: "MMR-2 + Varicella catch-up", done: false },
    { id: uid(), childId: c2.id, date: T0, time: "12:00", type: "Growth review", note: "Preterm follow-up, review feeds", done: false },
    { id: uid(), childId: c.id, date: addDays(T0, 3), time: "18:00", type: "Review", note: "Cold/cough follow-up if needed", done: false },
    { id: uid(), childId: c2.id, date: addDays(T0, -1), time: "11:00", type: "Vaccine", note: "PCV-2 given", done: true }
  ];
  DB.tokens = [
    { id: uid(), n: 1, date: T0, time: "10:20", childId: c.id, name: c.name, reason: "Vaccination", status: "done" },
    { id: uid(), n: 2, date: T0, time: "11:45", childId: c2.id, name: c2.name, reason: "Growth review", status: "in" },
    { id: uid(), n: 3, date: T0, time: "12:10", childId: "", name: "Walk-in — Sara", reason: "Fever", status: "waiting" }
  ];
  DB.bills = [
    { id: uid(), date: T0, time: "10:45", childId: c.id, name: c.name, items: [{ desc: "Consultation", amt: 300 }, { desc: "Vaccination charge", amt: 100 }], total: 400, paid: 400, mode: "UPI", by: "Frontdesk" },
    { id: uid(), date: addDays(T0, -1), time: "11:20", childId: c2.id, name: c2.name, items: [{ desc: "Follow-up", amt: 200 }], total: 200, paid: 200, mode: "Cash", by: "Frontdesk" }
  ];
  c.rx = [{ id: uid(), date: addDays(T0, -6), wt: 14.2, dx: "Acute URI with fever", by: "Dr. A. Sharma", review: addDays(T0, 1), advice: "Plenty of fluids, saline nasal drops. Review if fever >3 days, breathing difficulty or poor feeds.", allergyFlag: "", items: [
    { drug: "Paracetamol", strength: "250 mg/5 mL", freq: "Q6H", days: 3, take: "4.5 mL (213 mg)", qty: "≈ 135 mL total", instr: "For fever >100.4°F" },
    { drug: "Cetirizine", strength: "5 mg/5 mL", freq: "OD", days: 5, take: "3.5 mL (3.5 mg)", qty: "≈ 18 mL total", instr: "At night for cold" }
  ]}];
  c2.nb = { place: "Hospital", mode: "LSCS", cried: "Weak cry", resus: "Stimulation / drying", vitK: "Yes", feed: "Exclusive breastfeeds",
    apgar: { t1: [1, 2, 1, 1, 1], t5: [2, 2, 2, 2, 1], t10: ["", "", "", "", ""] },
    ballard: { posture: 2, square: 2, arm: 2, pop: 2, scarf: 2, heel: 2, skin: 2, lanugo: 2, plantar: 1, breast: 2, eyeear: 2, genital: 1 },
    screen: { tsh: { date: addDays(c2.dob, 4), res: "Normal" }, rop: { date: addDays(c2.dob, 30), res: "Normal" }, hear: { date: "", res: "Pending" }, ox: { date: addDays(c2.dob, 2), res: "Normal" }, bili: { date: "", res: "Pending" } } };
  c.labs = [
    { id: uid(), date: addDays(T0, -90), hb: "9.8", mcv: "70", ferritin: "7", crp: "", b12: "", vitD: "", note: "Started iron" },
    { id: uid(), date: addDays(T0, -14), hb: "10.6", mcv: "73", ferritin: "11", crp: "2", b12: "280", vitD: "14", note: "Improving" }
  ];
  c.aefi = [{ id: uid(), date: addDays(c.dob, 75), code: "DTP2", vacLabel: "DTP 2", brand: "Hexaxim", batch: "", severity: "Mild", outcome: "Recovered", reported: "No", note: "Fever 101°F + local swelling, settled in 2 days", symptoms: ["Fever", "Local pain / swelling"] }];
  c.asthma = { sev: "Mild persistent", best: "", controller: "Budesonide 100 MDI 2 puff BD + spacer", reliever: "Salbutamol MDI 2-4 puff SOS", triggers: ["Dust", "Viral cold", "Weather change"], green: "Continue controller daily.", yellow: "Reliever q4h via spacer + review within 24-48 h.", red: "Reliever now + rush to hospital.", pef: [] };
  c.dental = {}; ["55", "54", "53", "52", "51", "61", "62", "63", "64", "65", "75", "74", "73", "72", "71", "81", "82", "83", "84", "85"].forEach((t, i) => (c.dental[t] = { st: "e", d: addDays(c.dob, 200 + i * 12) }));
  c2.dental = {}; ["51", "61", "71", "81"].forEach((t, i) => (c2.dental[t] = { st: "e", d: addDays(c2.dob, 210 + i * 20) }));
  c.abha = "91-2345-6789-0123";
  c.diet = { type: "nonveg" }; c2.diet = { type: "veg" };
  DB.settings = { clinic: "Smile Child Care Clinic", doctor: "Dr. A. Sharma, MD (Paediatrics)", reg: "TNMC 12345", addr: "12 Anna Nagar, Coimbatore", phone: "0422-4001234" };
}

/* ---------------- Navigation ---------------- */
const TITLES = { dashboard: "Dashboard", billing: "Subscription & Billing", children: "Children", nb: "Newborn Care", schedule: "Schedule & Reminders", milestones: "Milestone Assessment", vaccines: "Vaccination Digital Record", card: "Digital Vaccine Card", aefi: "AEFI Register", growth: "Growth Assessment (IAP / WHO)", labs: "Labs & Anaemia", screen: "Screening Suite", diet: "Diet Planner", hand: "Parent Handouts", visits: "Visits & Clinical Notes", timeline: "Patient Timeline", rx: "Prescription", consent: "E-Consent", nicu: "NICU", mar: "eMAR", calc: "Calculators", mrd: "MRD Registers", formulary: "Formulary Review", front: "Frontdesk — Tokens & Billing", analytics: "Clinic Analytics", emg: "Emergency Ready-Reckoner", reports: "Reports & Certificates", export: "Data & Exports", users: "Users & Audit", settings: "Settings", stock: "Vaccine Stock & Ledger", display: "Token Display" };
const ROUTE_ALIASES = { pricing: "billing" }; // merged pages: old route → canonical (deep links keep working)
const RENDER_FOR = { dashboard: "renderDashboard", billing: "renderBilling", children: "renderChildren", nb: "renderNB", schedule: "renderSchedule", milestones: "renderMilestones", vaccines: "renderVaccines", card: "renderCard", aefi: "renderAefi", growth: "renderGrowth", labs: "renderLabs", screen: "renderScreen", diet: "renderDiet", hand: "renderHand", visits: "renderVisits", timeline: "renderTimeline", rx: "renderRx", consent: "renderConsent", nicu: "renderNicu", mar: "renderMar", calc: "renderCalc", mrd: "renderMrd", formulary: "renderFormulary", front: "renderFront", analytics: "renderAnalytics", emg: "renderEmergency", export: "renderExport", users: "renderUsers", stock: "renderStock", display: "renderDisplay" };
function toast(m) {
  try {
    let t = document.getElementById("appToast");
    if (!t) { t = document.createElement("div"); t.id = "appToast"; t.style.cssText = "position:fixed;left:50%;bottom:64px;transform:translateX(-50%);background:#0c2340;color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;z-index:10002;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:92vw;text-align:center"; document.body.appendChild(t); }
    t.textContent = m; t.style.display = "block";
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.display = "none"; }, 3400);
  } catch (e) {}
}
function go(page) {
  page = (typeof ROUTE_ALIASES !== "undefined" && ROUTE_ALIASES[page]) || page;
  if (typeof roleBlock === "function" && roleBlock(page)) { alert("🔒 Your role cannot open this page."); return; }
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $("pg-" + page).classList.add("active");
  document.querySelectorAll("#sideNav button, #mobNav button").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("pageTitle").textContent = TITLES[page] || page;
  try { history.replaceState(null, "", "#" + page); } catch (e) {}
  if (typeof callRender === "function" && RENDER_FOR[page]) callRender(RENDER_FOR[page]);
  if (page === "growth") setTimeout(drawGrowthChart, 60);
  window.scrollTo({ top: 0 });
  try { applyFolds(); } catch (e) {}
  try { if (typeof renderShareBars === "function") renderShareBars(); } catch (e) {}
}
document.querySelectorAll("#sideNav button, #mobNav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.page)));
document.addEventListener("keydown", globalSlashKey); // "/" jumps to patient search from anywhere

/* ---------------- Theme + sidebar ---------------- */
const THEME_ORDER = ["light", "sunrise", "dark", "ember", "violet", "forest", "clay", "lagoon", "midnight", "berry"];
const THEME_META = { light: "#0e7c7b", sunrise: "#f6f1e6", dark: "#0a1424", ember: "#431f10", violet: "#2a1650", forest: "#18251d", clay: "#4a2a1e", lagoon: "#17383f", midnight: "#0b132b", berry: "#2b3370" };
const THEME_LABEL = { light: "Classic", sunrise: "Sunrise", dark: "Night", ember: "Ember", violet: "Violet", forest: "Forest", clay: "Clay", lagoon: "Lagoon", midnight: "Midnight", berry: "Berry" };
function applyTheme() {
  let t = (DB.settings || {}).theme;
  if (!t || !THEME_ORDER.includes(t)) t = "sunrise"; // fresh installs start on Sunrise; saved prefs untouched
  document.documentElement.dataset.theme = t;
  const b = document.getElementById("themeToggle");
  if (b) { const classic = (t === "light" || t === "sunrise" || t === "dark"); b.textContent = classic ? (t === "dark" ? "☀️" : t === "sunrise" ? "🌞" : "🌙") : "🎨"; b.title = `Theme: ${THEME_LABEL[t] || t} (tap to change)`; }
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = THEME_META[t] || "#0e7c7b";
  try { document.querySelectorAll(".theme-sw").forEach((el) => el.classList.toggle("sel", el.dataset.theme === t)); } catch (e) {}
}
function setTheme(t) {
  if (!THEME_ORDER.includes(t)) return false;
  DB.settings = Object.assign({}, DB.settings, { theme: t });
  save(); applyTheme();
  return true;
}
function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  DB.settings.theme = THEME_ORDER[(THEME_ORDER.indexOf(cur) + 1) % THEME_ORDER.length] || "light";
  save(); applyTheme();
}
function applyGlass() {
  document.body.classList.toggle("glass", true); // v10.31: glass is a permanent part of the look
  return true;
}
function applyMotion() {
  let on = true; // v10.31: animations are a permanent part of the app
  try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) on = false; } catch (e) {} // except for users who ask their phone for stillness
  document.body.classList.toggle("motion", on);
  return on;
}
function renderBrand() {
  const s = DB.settings || {};
  const nm = $("brandName"), sb = $("brandSub"), lg = $("brandLogo");
  if (nm) nm.textContent = s.clinic || "NeoKid Care";
  if (sb) { const ld = (typeof letterDoc === "function") ? letterDoc() : { name: s.doctor || "" }; sb.textContent = ld.name || s.addr || "Neonatal · Pediatric · IAP"; }
  if (lg) lg.innerHTML = s.logo ? `<img src="${s.logo}" alt="">` : "👶";
}
function handleLogoFile(input) {
  const f = input && input.files && input.files[0];
  if (!f) return;
  if (!/^image\//.test(f.type || "")) return alert("Please choose an image file (PNG/JPG).");
  const rd = new FileReader();
  rd.onload = () => {
    const img = new Image();
    img.onload = () => {
      try {
        const sc = Math.min(1, 192 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(img.width * sc)); cv.height = Math.max(1, Math.round(img.height * sc));
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        DB.settings = Object.assign({}, DB.settings, { logo: cv.toDataURL("image/png") });
        save(); loadSettings(); renderBrand();
      } catch (e) { alert("Could not process that image."); }
    };
    img.src = rd.result;
  };
  rd.readAsDataURL(f);
}
function removeLogo() {
  DB.settings = Object.assign({}, DB.settings, { logo: "" });
  save(); loadSettings(); renderBrand();
}
function applyNavMini() {
  document.body.classList.toggle("nav-mini", !!((DB.settings || {}).navMini));
  document.querySelectorAll("#sideNav button").forEach((b) => { b.title = b.textContent.trim(); });
}
function toggleNav() {
  if (typeof window !== "undefined" && window.innerWidth <= 1100) { document.body.classList.toggle("nav-full"); return; } // tablet: pin / unpin full menu
  DB.settings.navMini = !document.body.classList.contains("nav-mini");
  save(); applyNavMini();
  const f = document.getElementById("navFilter"); // mini mode hides the filter — clear it so nothing stays hidden
  if (f) { f.value = ""; filterNav(""); }
}
/* ---- v10.28.4: foldable cards. Any .card[data-fold="id"] collapses via its
   first header (h3 onclick="toggleFold('id')"). State persists in
   DB.settings.fold (default open); printing always unfolds first. ---- */
function foldOpen(id) { return !(((DB.settings || {}).fold || {})[id]); }
function toggleFold(id) {
  const f = Object.assign({}, (DB.settings || {}).fold);
  if (foldOpen(id)) f[id] = true; else delete f[id];
  DB.settings = Object.assign({}, DB.settings, { fold: f });
  save(); applyFolds();
}
function applyFolds() {
  document.querySelectorAll(".card[data-fold]").forEach((el) => {
    el.classList.toggle("folded", !foldOpen(el.getAttribute("data-fold")));
  });
}

/* ---------------- Collapsible nav sections + filter ---------------- */
const NAV_SECS = ["home", "patients", "ops", "clinical", "immun", "specialty", "reports", "system"];
const NAV_SEC_DEFAULT_CLOSED = ["specialty", "reports", "system"]; // rarely-daily sections start collapsed
const NAV_COL_KEY = "kgNavCol2"; // bumped on IA regroup so stale v1 prefs don't linger
function navSecCollapsed() {
  try { return JSON.parse(localStorage.getItem(NAV_COL_KEY) || "null") || [...NAV_SEC_DEFAULT_CLOSED]; }
  catch (e) { return [...NAV_SEC_DEFAULT_CLOSED]; }
}
function setNavSecCollapsed(sec, closed) {
  const arr = navSecCollapsed().filter((s) => s !== sec);
  if (closed) arr.push(sec);
  try { localStorage.setItem(NAV_COL_KEY, JSON.stringify(arr)); } catch (e) {}
}
function toggleNavSec(sec) {
  const box = document.querySelector(`.navsec[data-sec="${sec}"]`);
  if (!box) return;
  box.classList.toggle("closed");
  setNavSecCollapsed(sec, box.classList.contains("closed"));
}
function navMatch(label, q) {
  q = (q || "").trim().toLowerCase();
  if (!q) return true;
  return String(label || "").toLowerCase().includes(q);
}
function filterNav(q) {
  const query = (q || "").trim().toLowerCase();
  document.querySelectorAll("#sideNav .navsec").forEach((box) => {
    let vis = 0;
    box.querySelectorAll("button[data-page]").forEach((b) => {
      const blocked = (typeof roleBlock === "function") ? roleBlock(b.dataset.page) : false;
      const show = !blocked && navMatch(b.textContent, query);
      b.style.display = show ? "" : "none";
      if (show) vis++;
    });
    if (query) box.classList.remove("closed"); // auto-expand while filtering
    box.style.display = vis ? "" : "none";
  });
  refreshNavSecs();
}
/* Hide sections whose buttons are all hidden (role filter). Called on boot + after applyRole. */
function refreshNavSecs() {
  document.querySelectorAll("#sideNav .navsec").forEach((box) => {
    const any = [...box.querySelectorAll("button[data-page]")].some((b) => b.style.display !== "none");
    box.style.display = any ? "" : "none";
  });
}
function restoreNavSecs() {
  const closed = navSecCollapsed();
  const f = document.getElementById("navFilter");
  const q = f ? f.value : "";
  document.querySelectorAll("#sideNav .navsec").forEach((box) => {
    box.classList.toggle("closed", !q && closed.includes(box.dataset.sec));
  });
  refreshNavSecs();
}

/* ---------------- Child picker / CRUD ---------------- */
function syncChildPicker() {
  const sel = $("childSelect"); sel.innerHTML = "";
  if (!DB.children.length) { sel.innerHTML = "<option>No children</option>"; return; }
  DB.children.forEach((c) => {
    const o = document.createElement("option"); o.value = c.id;
    o.textContent = `${c.name} · ${c.sex === "boy" ? "♂" : "♀"}`;
    if (c.id === DB.activeId) o.selected = true; sel.appendChild(o);
  });
  const c = child();
  if (c) {
    $("childAvatar").textContent = c.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    $("childAgeLine").textContent = ageStr(ageBetween(c.dob)) + " old";
    $("clinicLine").textContent = (DB.settings.clinic || "NeoKid Care Clinic") + (DB.settings.doctor ? " · " + DB.settings.doctor : "");
  }
}
$("childSelect").addEventListener("change", (e) => setActive(e.target.value));

function openChildModal(id) {
  const c = id ? DB.children.find((x) => x.id === id) : null;
  $("childModalTitle").textContent = c ? "Edit child" : "Register child";
  $("cId").value = c?.id || ""; $("cName").value = c?.name || ""; $("cSex").value = c?.sex || "boy";
  $("cDob").value = c?.dob || ""; $("cBlood").value = c?.blood || ""; $("cBirthWt").value = c?.birthWt || "";
  $("cGest").value = c?.gest || ""; $("cBirthLen").value = c?.birthLen || ""; $("cBirthHC").value = c?.birthHC || "";
  $("cFather").value = c?.father || ""; $("cMother").value = c?.mother || "";
  $("cFHt").value = c?.fHt || ""; $("cMHt").value = c?.mHt || ""; $("cPhone").value = c?.phone || "";
  $("cPed").value = c?.ped || ""; $("cAllergy").value = c?.allergy || ""; $("cAbha").value = c?.abha || "";
  try { if (typeof Hx !== "undefined" && Hx.fill) Hx.fill(c); } catch (eHx) {}
  openModal("mChild");
}
/* ---------------- MRN (medical record number, auto-assigned) ---------------- */
function nextMrn(kids) {
  let mx = 0;
  (kids || []).forEach((c) => { const n = parseInt(String((c && c.mrn) || "").replace(/\D/g, ""), 10); if (n > mx) mx = n; });
  return String(mx + 1).padStart(4, "0");
}
function ensureMrns(kids) {
  (kids || []).forEach((c) => { if (c && !c.mrn) c.mrn = nextMrn(kids); });
  return kids;
}
function saveChild() {
  if (typeof guardSubmit === "function" && !guardSubmit("child")) return; // M4: no duplicate registrations
  const name = $("cName").value.trim(), dob = $("cDob").value;
  if (!name || !dob) return alert("Name and date of birth are required.");
  if (dob > todayISO()) return alert("Date of birth cannot be in the future.");
  const id = $("cId").value;
  const dups = findDupChildren({ name, dob, phone: $("cPhone").value }, DB.children, id || null);
  if (dups.length && !confirm(`⚠️ Possible duplicate record:\n${dups.slice(0, 3).map((d) => `• ${d.c.name} (DOB ${fmtDate(d.c.dob)}) — ${d.why}`).join("\n")}\n\nSave anyway?`)) return;
  const data = { name, sex: $("cSex").value, dob, blood: $("cBlood").value, birthWt: parseFloat($("cBirthWt").value) || "", gest: $("cGest").value, birthLen: parseFloat($("cBirthLen").value) || "", birthHC: parseFloat($("cBirthHC").value) || "", father: $("cFather").value.trim(), mother: $("cMother").value.trim(), fHt: parseFloat($("cFHt").value) || "", mHt: parseFloat($("cMHt").value) || "", phone: $("cPhone").value.trim(), abha: $("cAbha").value.trim(), ped: $("cPed").value.trim(), allergy: $("cAllergy").value.trim() };
  try { if (typeof Hx !== "undefined" && Hx.collect) Object.assign(data, Hx.collect()); } catch (eHx) {}
  if (id) { const ex = DB.children.find((x) => x.id === id); if (ex) normalizeChild(Object.assign(ex, data)); }
  else DB.children.push(normalizeChild(Object.assign({ id: uid(), created: todayISO(), mrn: nextMrn(DB.children) }, data)));
  if (!DB.activeId) DB.activeId = DB.children[0].id;
  auditSafe(id ? "Child updated" : "Child registered", name);
  save(); closeModal("mChild"); syncChildPicker(); renderAll();
}
function deleteChild(id) {
  if (!needSafe(3, "delete child records")) return;
  const c = DB.children.find((x) => x.id === id);
  if (!confirm(`Delete ${c.name}'s entire record? This cannot be undone.`)) return;
  DB.children = DB.children.filter((x) => x.id !== id);
  if (DB.activeId === id) DB.activeId = DB.children[0]?.id || null;
  auditSafe("Child deleted", c.name);
  save(); syncChildPicker(); renderAll();
}
/* ---------------- Type-ahead patient search (pure matcher) ---------------- */
function childHay(c) {
  return {
    name: String(c.name || "").toLowerCase(),
    parents: `${c.father || ""} ${c.mother || ""}`.toLowerCase(),
    digits: String(c.phone || "").replace(/\D/g, ""),
    abha: String(c.abha || "").replace(/\D/g, ""),
    mrn: String(c.mrn || "").toLowerCase(),
    dob: String(c.dob || ""),
  };
}
// Ranked multi-field match: every token must hit (AND). Returns [{c, score, why}].
function matchChildren(q, kids, recentIds) {
  const rec = recentIds || [];
  const toks = String(q || "").toLowerCase().split(/\s+/).filter(Boolean);
  const out = [];
  for (const c of (kids || [])) {
    const h = childHay(c), why = [];
    const recIdx = rec.indexOf(c.id);
    if (!toks.length) { out.push({ c, score: recIdx >= 0 ? 100 - recIdx : 0, why: recIdx >= 0 ? ["recent"] : [] }); continue; }
    let score = 0, okAll = true;
    for (const t of toks) {
      const td = t.replace(/\D/g, "");
      let s = 0, w = "";
      if (h.name.startsWith(t)) { s = 60; w = "name"; }
      else if (h.name.includes(t)) { s = 40; w = "name"; }
      if (t.length >= 2 && h.parents.includes(t) && s < 25) { s = 25; w = "parent"; }
      if (td.length >= 3 && h.digits.includes(td) && s < 50) { s = 50; w = "phone"; }
      if (t.length >= 2 && h.mrn.includes(t) && s < 45) { s = 45; w = "MRN"; }
      if (td.length >= 4 && h.abha.includes(td) && s < 30) { s = 30; w = "ABHA"; }
      if (td.length >= 4 && h.dob.includes(t) && s < 20) { s = 20; w = "DOB"; }
      if (!s) { okAll = false; break; }
      score += s; if (w && !why.includes(w)) why.push(w);
    }
    if (!okAll) continue;
    if (recIdx >= 0) { score += Math.max(0, 10 - recIdx); why.push("recent"); }
    out.push({ c, score, why });
  }
  out.sort((a, b) => b.score - a.score || String(a.c.name || "").localeCompare(String(b.c.name || "")));
  return out;
}
// Duplicate-registration screen. Returns [{c, why}] — strong first.
function findDupChildren(data, kids, selfId) {
  const nm = String(data.name || "").trim().toLowerCase();
  const dob = String(data.dob || "");
  const ph = String(data.phone || "").replace(/\D/g, "");
  const out = [];
  for (const c of (kids || [])) {
    if (selfId && c.id === selfId) continue;
    const cn = String(c.name || "").trim().toLowerCase();
    const sameName = !!nm && cn === nm;
    const sameDob = !!dob && String(c.dob || "") === dob;
    const samePhone = ph.length >= 7 && String(c.phone || "").replace(/\D/g, "") === ph;
    if (sameName && sameDob) out.push({ c, why: "same name + DOB", strong: true });
    else if (samePhone && sameDob) out.push({ c, why: "same phone + DOB", strong: true });
    else if (sameName) out.push({ c, why: "same name, different DOB — verify", strong: false });
  }
  out.sort((a, b) => (b.strong - a.strong) || String(a.c.name || "").localeCompare(String(b.c.name || "")));
  return out;
}
/* ---------------- Patient-search keyboard support ---------------- */
function childCardsFocus(i) {
  const cards = document.querySelectorAll("#childCards .card[data-cid]");
  if (!cards.length) return false;
  const el = cards[Math.max(0, Math.min(cards.length - 1, i == null ? 0 : i))];
  if (el && el.focus) el.focus();
  return true;
}
function childCardsKey(e) {
  if (!e || !e.key) return;
  const box = $("childCards");
  const cards = [...(box ? box.querySelectorAll(".card[data-cid]") : [])];
  if (!cards.length) return;
  const cur = cards.indexOf(document.activeElement);
  if (cur < 0) return; // focus is on an inner button — leave native behaviour alone
  if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); (cards[cur + 1] || cards[0]).focus(); }
  else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); (cards[cur - 1] || cards[cards.length - 1]).focus(); }
  else if (e.key === "Enter") { e.preventDefault(); setActive(cards[cur].dataset.cid); go("dashboard"); }
  else if (e.key === "Escape") { const s = $("childSearch"); if (s) { s.value = ""; renderChildren(); s.focus(); } }
}
function childSearchKey(e) {
  if (!e || !e.key) return;
  if (e.key === "ArrowDown") { e.preventDefault(); childCardsFocus(0); }
  else if (e.key === "Enter") {
    const first = document.querySelector("#childCards .card[data-cid]");
    if (first && first.dataset.cid) { e.preventDefault(); setActive(first.dataset.cid); go("dashboard"); }
  }
  else if (e.key === "Escape") { e.target.value = ""; renderChildren(); }
}
// Global "/" focuses patient search from anywhere (returns true when it acts).
function globalSlashKey(e) {
  if (!e || e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return false;
  const t = e.target || {};
  if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable) return false;
  if (document.querySelector(".modal-bg.open")) return false;
  if (typeof roleBlock === "function" && roleBlock("children")) return false;
  if (e.preventDefault) e.preventDefault();
  go("children");
  setTimeout(() => { const s = $("childSearch"); if (s && s.focus) { s.focus(); if (s.select) s.select(); } }, 60);
  return true;
}
function renderChildren() {
  const q = ($("childSearch").value || "");
  const box = $("childCards"); box.innerHTML = "";
  box.setAttribute("role", "listbox"); box.setAttribute("aria-label", "Patients");
  box.onkeydown = childCardsKey;
  const hits = matchChildren(q, DB.children, getRecentIds());
  if (!hits.length) {
    box.innerHTML = q.trim()
      ? `<div class="card" style="grid-column:1/-1"><div class="empty"><div class="big">🔍</div>No matches for “${esc(q.trim())}”.<br><button class="btn btn-p btn-sm" style="margin-top:10px" onclick="openChildModal()">+ Register this child</button></div></div>`
      : `<div class="card" style="grid-column:1/-1"><div class="empty"><div class="big">🧒</div>No children found. Register your first child to begin.</div></div>`;
    return;
  }
  hits.forEach(({ c, why }) => {
    const a = ageBetween(c.dob);
    const vac = vaccineSummary(c);
    const div = document.createElement("div"); div.className = "card";
    div.setAttribute("tabindex", "0"); div.setAttribute("role", "option"); div.dataset.cid = c.id;
    div.setAttribute("aria-label", `${c.name}, ${ageStr(a)}`);
    const whyLine = why.length ? `<div style="font-size:11.5px;color:var(--muted);margin-bottom:8px">matched: ${esc(why.join(" · "))}</div>` : "";
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
        <div class="avatar" style="width:48px;height:48px;font-size:18px">${esc(c.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</div>
        <div><b style="font-size:16px;color:var(--navy)">${esc(c.name)}</b><br>
        <span style="font-size:12.5px;color:var(--muted)">${c.sex === "boy" ? "♂ Boy" : "♀ Girl"} · ${ageStr(a)} · DOB ${fmtDate(c.dob)}${c.mrn ? ` · MRN ${esc(c.mrn)}` : ""}</span></div>
      </div>
      ${whyLine}
      <dl class="kv" style="margin-bottom:10px">
        <dt>Parents</dt><dd>${esc(c.father || "—")} · ${esc(c.mother || "—")}</dd>
        <dt>Vaccines</dt><dd>${vac.done}/${vac.total} done ${vac.overdue ? `· <span class="badge b-red">${vac.overdue} overdue</span>` : ""}</dd>
        <dt>Measures</dt><dd>${c.measures.length} records · ${c.visits.length} visits</dd>
      </dl>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-p btn-sm" onclick="setActive('${c.id}');go('dashboard')">Open</button>
        <button class="btn btn-o btn-sm" onclick="openChildModal('${c.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteChild('${c.id}')">Delete</button>
      </div>`;
    box.appendChild(div);
  });
}

/* ================= UNIFIED TIMELINE ================= */
let TIMELINE_FILTER = "all";
const TIMELINE_FILTERS = [["all", "All"], ["visit", "🩺 Visits"], ["rx", "💊 Rx"], ["vax", "💉 Vaccines"], ["growth", "📏 Growth"], ["labs", "🩸 Labs"], ["aefi", "⚠️ AEFI"]];
function vaxLabel(code) {
  try {
    for (const v of (VACCINE_SCHEDULE || [])) for (const x of (v.vaccines || []))
      if (x.code === code) return `${x.name}${x.dose ? " " + x.dose : ""}`;
  } catch (e) {}
  return code;
}
function timelineEvents(c) {
  if (!c) return [];
  const ev = [];
  const ts = (d) => (d || "").slice(0, 10);
  (c.visits || []).forEach((v) => ev.push({ date: ts(v.date), kind: "visit", icon: "🩺", title: v.type || "Visit",
    sub: [v.subj && ("S: " + v.subj), v.obj && ("O: " + v.obj), v.plan && ("A/P: " + v.plan)].filter(Boolean).join(" · ") }));
  (c.rx || []).forEach((r) => ev.push({ date: ts(r.date), kind: "rx", icon: "💊", title: "Rx" + (r.dx ? " — " + r.dx : ""),
    sub: (r.items || []).map((i) => i.drug).filter(Boolean).join(", ") + (r.allergyFlag ? " ⚠️ allergy flag" : "") }));
  Object.entries(c.vaccines || {}).forEach(([code, r]) => ev.push({ date: ts(r.date), kind: "vax", icon: "💉",
    title: vaxLabel(code), sub: [r.brand, r.batch && ("batch " + r.batch), r.by && ("by " + r.by)].filter(Boolean).join(" · ") }));
  (c.extraVac || []).forEach((x) => ev.push({ date: ts(x.date), kind: "vax", icon: "➕", title: x.name || "Vaccine",
    sub: [x.brand, x.batch && ("batch " + x.batch)].filter(Boolean).join(" · ") }));
  (c.measures || []).forEach((m) => ev.push({ date: ts(m.date), kind: "growth", icon: "📏", title: "Growth",
    sub: [m.wt > 0 && (`${m.wt} kg`), m.ht > 0 && (`${m.ht} cm`), m.hc > 0 && (`HC ${m.hc}`), m.muac > 0 && (`MUAC ${m.muac}`)].filter(Boolean).join(" · ") }));
  (c.labs || []).forEach((l) => {
    const p = ["mcv", "ferritin", "crp", "b12", "vitD"].map((k) => l[k] ? `${k} ${l[k]}` : "").filter(Boolean);
    if (l.note) p.push(l.note);
    ev.push({ date: ts(l.date), kind: "labs", icon: "🩸", title: "Lab" + (l.hb ? ` — Hb ${l.hb}` : ""), sub: p.join(" · ") });
  });
  (c.aefi || []).forEach((e) => ev.push({ date: ts(e.date), kind: "aefi", icon: "⚠️", title: `AEFI — ${e.vacLabel || e.code || ""}`,
    sub: [e.severity, e.outcome && ("Outcome: " + e.outcome), e.reported === "Yes" && "Reported"].filter(Boolean).join(" · ") }));
  const ko = { visit: 0, rx: 1, vax: 2, growth: 3, labs: 4, aefi: 5 };
  ev.sort((a, b) => (b.date || "").localeCompare(a.date || "") || ((ko[a.kind] ?? 9) - (ko[b.kind] ?? 9)));
  return ev;
}
function timelineHTML(c, filter) {
  const f = filter || "all";
  const all = timelineEvents(c);
  const list = f === "all" ? all : all.filter((e) => e.kind === f);
  const chips = TIMELINE_FILTERS.map(([k, l]) => {
    const n = k === "all" ? all.length : all.filter((e) => e.kind === k).length;
    return `<button class="btn btn-xs ${k === f ? "btn-p" : "btn-o"}" onclick="TIMELINE_FILTER='${k}';renderTimeline()">${esc(l)} (${n})</button>`;
  }).join("");
  const rows = list.slice(0, 200).map((e) => `<div class="vac-row"><div class="grow"><span style="font-size:12px;color:var(--muted)">${esc(fmtDate(e.date))}</span> ${e.icon} <b>${esc(e.title)}</b><br>${e.sub ? `<span style="font-size:13px">${esc(e.sub.length > 160 ? e.sub.slice(0, 160) + "…" : e.sub)}</span>` : ""}</div></div>`).join("");
  return `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">${chips}</div>` +
    (rows || `<div class="hint">No ${f === "all" ? "" : f + " "}records yet for this child.</div>`) +
    (list.length > 200 ? `<div class="hint">Showing latest 200 of ${list.length}.</div>` : "");
}
function renderTimeline() {
  const el = $("timelineList"); if (!el) return;
  el.innerHTML = timelineHTML(child(), (typeof TIMELINE_FILTER !== "undefined") ? TIMELINE_FILTER : "all");
}

/* ================= VACCINES ================= */
function dueDateFor(c, v) { return addDays(c.dob, v.dueDays); }
function vaccineSummary(c) {
  let total = 0, done = 0, overdue = 0;
  const t = todayISO();
  VACCINE_SCHEDULE.forEach((v) => {
    const due = dueDateFor(c, v);
    v.vaccines.forEach((vx) => {
      total++;
      if (c.vaccines[vx.code]) done++;
      else if (t > addDays(due, 30)) overdue++;
    });
  });
  const next = VACCINE_SCHEDULE.map((v) => ({ v, due: dueDateFor(c, v) }))
    .filter((x) => x.v.vaccines.some((vx) => !c.vaccines[vx.code]))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  return { total, done, overdue, pct: total ? Math.round((done / total) * 100) : 0, next };
}
function vacStatus(c, visit, vx) {
  if (c.vaccines[vx.code]) return "done";
  const t = todayISO(), due = dueDateFor(c, visit);
  if (t > addDays(due, 30)) return "overdue";
  if (t >= addDays(due, -14)) return "due";
  return "upcoming";
}
/* ---- catch-up planner: missed visits in schedule order, earliest-possible dates ----
   Conservative mechanical rule: same-visit antigens together; ≥28 days between
   catch-up visits AND ≥28 days after any already-given dose of the same series
   (series = leading letters, so boosters chain after primaries). Per-antigen
   exact minimum intervals need IAP-chart verification (see M7 sign-off) — the
   plan labels every date "earliest" and carries the verify disclaimer. */
function vaxSeries(code) {
  let s = String(code || "").toUpperCase().replace(/-.*$/, "").replace(/[0-9]+$/, "");
  // Trailing-B booster marker (DTPB/HIBB/PCVB/IPVB) chains onto the primary
  // series — except HEPB, where B means Hep-B, not booster.
  if (s !== "HEPB" && s.endsWith("B")) s = s.slice(0, -1);
  return s || String(code || "");
}
function catchupPlan(c, today) {
  today = today || todayISO();
  const done = (c && c.vaccines) || {};
  const seriesLast = {};
  Object.keys(done).forEach((cd) => {
    const d = (done[cd] || {}).date || "";
    const s = vaxSeries(cd);
    if (d && (!seriesLast[s] || d > seriesLast[s])) seriesLast[s] = d;
  });
  const sched = (typeof VACCINE_SCHEDULE !== "undefined" ? VACCINE_SCHEDULE : []);
  const missed = sched.filter((v) => dueDateFor(c, v) <= today && (v.vaccines || []).some((x) => !done[x.code]));
  const plan = [];
  let prev = null;
  missed.forEach((v) => {
    const items = v.vaccines.filter((x) => !done[x.code])
      .map((x) => ({ visitId: v.id, visit: v.label, code: x.code, name: x.name, dose: x.dose }));
    let earliest = prev ? addDays(prev, 28) : today;
    items.forEach((it) => {
      const g = seriesLast[vaxSeries(it.code)];
      if (g) { const eg = addDays(g, 28); if (eg > earliest) earliest = eg; }
    });
    plan.push({ date: earliest, visit: v.label, items, rota: (v.vaccines || []).some((x) => /^ROTA/i.test(x.code)) });
    prev = earliest;
  });
  return plan;
}
function catchupHTML(c, plan) {
  if (!plan || !plan.length) return "";
  const rows = plan.map((p, i) => {
    const isToday = p.date === todayISO();
    return `<div class="vac-row"><div class="grow"><b>Visit ${i + 1} — earliest ${fmtDate(p.date)}</b>${isToday ? ` <span class="badge b-green">today</span>` : ""}<br>`
      + `<span style="font-size:12.5px">${p.items.map((it) => `${esc(it.name)} ${esc(it.dose || "")}`).join(" · ")}</span>`
      + `${p.rota ? `<br><span style="font-size:12px;color:#b45309">⚠️ Includes rotavirus — confirm age eligibility before giving.</span>` : ""}</div>`
      + `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end">${p.items.map((it) => `<button class="btn btn-p btn-xs" onclick="openVacModal('${it.visitId}','${it.code}')">Record ${esc(it.code)}</button>`).join("")}</div></div>`;
  }).join("");
  return `<div class="card"><h3>📋 Catch-up plan — ${plan.length} visit(s)</h3><div class="hint">Missed doses in schedule order · no need to restart any series · minimum 4-week gap between visits. Planning aid — verify against the IAP catch-up chart; clinical judgement prevails.</div>${rows}</div>`;
}
function renderVaccines() {
  const c = child();
  const vp0 = $("vacPrint"); if (vp0) vp0.innerHTML = "";
  if (!c) return;
  const s = vaccineSummary(c);
  $("vacBar").style.width = s.pct + "%"; $("vacPct").textContent = `${s.done}/${s.total} (${s.pct}%)`;
  let al = "";
  if (s.overdue) al += `<div class="alert a-red">⚠️ <div><b>${s.overdue} vaccine(s) overdue.</b> Please schedule catch-up at the earliest. IAP: no need to restart a series — continue from where it stopped, keeping minimum intervals.</div></div>`;
  if (s.next) al += `<div class="alert a-blue">📅 <div><b>Next:</b> ${esc(s.next.v.label)} visit — due <b>${fmtDate(s.next.due)}</b> (${esc(s.next.v.vaccines.filter((x) => !c.vaccines[x.code]).map((x) => x.code).join(", "))}).</div></div>`;
  else al += `<div class="alert a-green">✅ <div><b>Schedule complete</b> till 16–18 y. Continue annual influenza & adolescent boosters as advised.</div></div>`;
  const _plan = catchupPlan(c, todayISO());
  if (_plan.length) al += catchupHTML(c, _plan);
  $("vacAlerts").innerHTML = al;
  const tl = $("vacTimeline"); tl.innerHTML = "";
  VACCINE_SCHEDULE.forEach((v) => {
    const due = dueDateFor(c, v);
    const doneCount = v.vaccines.filter((x) => c.vaccines[x.code]).length;
    const cls = doneCount === v.vaccines.length ? "done" : (todayISO() > addDays(due, 30) ? "overdue" : (s.next?.v.id === v.id ? "next" : ""));
    const d = document.createElement("div"); d.className = "tl-item " + cls;
    d.innerHTML = `<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <b style="color:var(--navy);font-size:15px">${esc(v.label)}</b>
        <span class="badge b-gray">Due ${fmtDate(due)}</span>
        <span class="badge ${doneCount === v.vaccines.length ? "b-green" : "b-amber"}">${doneCount}/${v.vaccines.length} given</span>
        <span style="font-size:12px;color:var(--muted)">${esc(v.note)}</span></div>
      <div>${v.vaccines.map((vx) => {
        const st = vacStatus(c, v, vx), r = c.vaccines[vx.code];
        const badge = st === "done" ? `<span class="badge b-green">✓ Given ${fmtDate(r.date)}</span>` : st === "overdue" ? `<span class="badge b-red">Overdue</span>` : st === "due" ? `<span class="badge b-amber">Due now</span>` : `<span class="badge b-blue">Upcoming</span>`;
        return `<div class="vac-row"><div class="grow"><b>${esc(vx.name)}</b> <span style="color:var(--muted);font-size:12px">· ${esc(vx.dose)} · ${esc(vx.protects)}</span><br>
          <span style="font-size:12px;color:var(--muted)">${esc(vx.route)} · ${esc(vx.site)} · ${esc(vx.cat)}${r?.brand ? ` · 💊 <b>${esc(r.brand)}</b>${r.mfr ? ` (${esc(r.mfr)})` : ""}` : ""}${r?.batch ? ` · Batch ${esc(r.batch)}` : ""}${r?.aer ? ` · <span style="color:var(--red)">AEFI: ${esc(r.aer)}</span>` : ""}</span></div>
          ${badge}<button class="btn ${r ? "btn-o" : "btn-p"} btn-xs" onclick="openVacModal('${v.id}','${vx.code}')">${r ? "Edit" : "Record"}</button></div>`;
      }).join("")}</div>`;
    tl.appendChild(d);
  });
  renderExtras(c);
  try { const vp = $("vacPrint"); if (vp && typeof vaxRecordHTML === "function") vp.innerHTML = vaxRecordHTML(c); } catch (e) {}
}
function openVacModal(visitId, code) {
  const c = child(); const v = VACCINE_SCHEDULE.find((x) => x.id === visitId);
  const vx = v.vaccines.find((x) => x.code === code);
  const r = c.vaccines[code] || {};
  VAX_EDITING = c.vaccines[code] ? { code, date: c.vaccines[code].date || "" } : null;
  $("vacModalTitle").textContent = `${vx.name} — ${vx.dose}`;
  $("vacModalSub").textContent = `${v.label} visit · due ${fmtDate(dueDateFor(c, v))} · ${vx.route}`;
  $("vCode").value = code; $("vVisit").value = visitId;
  $("vDate").value = r.date || todayISO(); $("vBatch").value = r.batch || "";
  $("vSite").value = r.site || vx.site; $("vBy").value = r.by || (DB.settings.doctor || "");
  $("vAer").value = r.aer || ""; $("vNote").value = r.note || "";
  const bl = brandsFor(code);
  $("vBrandList").innerHTML = bl.map((x) => `<option value="${esc(x.b)}">${esc(x.m)}${x.n ? " · " + esc(x.n) : ""}</option>`).join("");
  $("vBrand").value = r.brand || ""; $("vMfr").value = r.mfr || "";
  $("vBrand").oninput = (e) => { const hit = brandsFor(code).find((x) => x.b.toLowerCase() === e.target.value.trim().toLowerCase()); if (hit) $("vMfr").value = hit.m; };
  if (typeof lotOptionsHTML === "function") {
    $("vLot").innerHTML = lotOptionsHTML(code, r.lot || "");
    $("vLot").value = r.lot || "";
    $("vLotHint").textContent = r.date ? "Editing an existing entry — saving won't deduct stock again." : lotHintHTML(code);
  }
  const sibs = v.vaccines.filter((x) => x.code !== code && !c.vaccines[x.code]);
  const sibBox = $("vSibBox");
  if (sibs.length && !r.date) {
    sibBox.style.display = "";
    sibBox.innerHTML = `<label style="margin-bottom:2px">💉 Same visit/shot also covers — tick to record together</label>
      <div style="font-size:11.5px;color:var(--muted);margin-bottom:4px">Same date, brand, batch & site will be applied (AEFI stays on this antigen only). Ideal for hexavalent/pentavalent single shots.</div>` +
      sibs.map((x) => `<label class="sib"><input type="checkbox" class="vSib" value="${x.code}"> ${esc(x.name)} <span style="color:var(--muted);font-weight:400">(${esc(x.dose)})</span></label>`).join("");
  } else { sibBox.style.display = "none"; sibBox.innerHTML = ""; }
  $("vClearBtn").style.display = r.date ? "" : "none";
  openModal("mVac");
}
function vaxDupCheck(c, code, dateISO) {
  const ex = ((c || {}).vaccines || {})[code];
  if (!ex) return { dup: false };
  return { dup: true, sameDay: (ex.date || "") === (dateISO || ""), existing: ex };
}
function extraDupCheck(c, name, dateISO, selfId) {
  const hit = ((c || {}).extraVac || []).find((v) => v.id !== selfId &&
    String(v.name || "").trim().toLowerCase() === String(name || "").trim().toLowerCase() &&
    (v.date || "") === (dateISO || ""));
  return hit ? { dup: true, existing: hit } : { dup: false };
}
let VAX_EDITING = null; // {code, date} snapshot when modal opened on an existing record
/* Autofill batch/brand from the picked lot (only into empty fields). prefix: v = routine, x = extra. */
function syncLotFields(prefix) {
  const sel = $(prefix === "x" ? "xLot" : "vLot");
  if (!sel || !sel.value || sel.value === "none") return;
  const l = (typeof stockLots === "function") ? stockLots().find((x) => x && x.id === sel.value) : null;
  if (!l) return;
  const b = $(prefix === "x" ? "xBatch" : "vBatch"), br = $(prefix === "x" ? "xBrand" : "vBrand");
  if (b && !b.value && l.batch) b.value = l.batch;
  if (br && !br.value && l.brand) br.value = l.brand;
}
/* One physical shot = exactly one deduction, even when it covers several
   antigens (combos). Returns lot id, null (auto/none), or undefined = abort save. */
function vaxDeduct(codes, lotChoice, brand, batch, childName) {
  codes = codes || [];
  if (!codes.length || lotChoice === "none") return null;
  if (lotChoice && typeof stockDeductLot === "function") {
    const r = stockDeductLot(lotChoice, codes[0], childName);
    if (!r.ok) {
      alert(r.reason === "expired" ? "⚠️ That lot is EXPIRED — nothing recorded. Quarantine the lot and pick another."
        : r.reason === "empty" ? "⚠️ That lot is out of stock — nothing recorded. Pick another lot."
        : "⚠️ That lot is no longer available — nothing recorded. Pick another lot.");
      return undefined;
    }
    return r.lot.id;
  }
  if (typeof stockDeduct === "function") codes.forEach((cd) => stockDeduct(cd, brand, batch, childName));
  return null;
}
function saveVaccine() {
  const c = child(), code = $("vCode").value;
  if (!$("vDate").value) return alert("Date given is required.");
  const date = $("vDate").value;
  // dup-dose guard: same code+date blocked; same code new date needs explicit confirm.
  // The record being edited (same code+date as modal-open) is exempt.
  const codes = [code];
  document.querySelectorAll(".vSib:checked").forEach((cb) => codes.push(cb.value));
  const same = [], diff = [];
  codes.forEach((cd) => {
    if (VAX_EDITING && cd === VAX_EDITING.code && date === VAX_EDITING.date) return;
    const d = vaxDupCheck(c, cd, date);
    if (d.dup) (d.sameDay ? same : diff).push({ cd, ex: d.existing });
  });
  if (same.length) return alert("⚠️ Already recorded: " + same.map((s) => `${s.cd} on ${fmtDate(s.ex.date)}${s.ex.batch ? " (batch " + s.ex.batch + ")" : ""}`).join("; ") + ". Same-day duplicate blocked — delete the existing entry first if this is a correction.");
  if (diff.length && !confirm("Overwrite existing record(s)?\n" + diff.map((s) => `• ${s.cd}: recorded ${fmtDate(s.ex.date)}${s.ex.batch ? " (batch " + s.ex.batch + ")" : ""}`).join("\n") + "\n\nOK = replace with the new entry. Cancel = keep existing.")) return;
  VAX_EDITING = null;
  const bm = matchBrand(code, $("vBrand").value, $("vMfr").value);
  const prevLot = (c.vaccines[code] || {}).lot || "";
  const _newVx = [];
  if (!c.vaccines[code]) _newVx.push(code);
  document.querySelectorAll(".vSib:checked").forEach((cb) => { if (!c.vaccines[cb.value]) _newVx.push(cb.value); });
  const lotChoice = ($("vLot") || {}).value || "";
  const lotId = (typeof vaxDeduct === "function") ? vaxDeduct(_newVx, lotChoice, bm.brand, $("vBatch").value.trim(), c.name) : null;
  if (lotId === undefined) return; // chosen lot invalid — abort before writing anything
  const rec = (aer) => ({ date: $("vDate").value, brand: bm.brand, mfr: bm.mfr, batch: $("vBatch").value.trim(), site: $("vSite").value.trim(), by: $("vBy").value.trim(), aer, note: $("vNote").value.trim(), lot: lotId || prevLot });
  c.vaccines[code] = rec($("vAer").value.trim());
  document.querySelectorAll(".vSib:checked").forEach((cb) => { c.vaccines[cb.value] = rec(""); });
  auditSafe("Vaccine recorded", code + " — " + c.name);
  save(); closeModal("mVac"); renderAll();
}
function clearVaccine() {
  if (!needSafe(2, "delete vaccine entries")) return;
  const c = child(), code = $("vCode").value;
  if (!confirm("Remove this vaccination entry?")) return;
  delete c.vaccines[code]; auditSafe("Vaccine deleted", code + " — " + c.name); save(); closeModal("mVac"); renderAll();
}

/* ---- additional / travel / seasonal vaccines ---- */
function renderExtras(c) {
  c.extraVac = c.extraVac || [];
  const rows = [...c.extraVac].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  $("vacExtras").innerHTML = `<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px">
    <h3 style="margin:0">➕ Additional / travel / seasonal vaccines</h3><span class="sp" style="flex:1"></span>
    <button class="btn btn-p btn-sm" onclick="openExtraModal()">+ Add</button></div>
    <div class="hint">Rabies, cholera, meningococcal, COVID-19, campaign OPV doses, extra boosters — included in the certificate.</div>
    ${rows.length ? rows.map((x) => `<div class="vac-row"><div class="grow"><b>${esc(x.name)}</b>${x.brand ? ` · 💊 <b>${esc(x.brand)}</b>${x.mfr ? ` (${esc(x.mfr)})` : ""}` : ""}<br>
      <span style="font-size:12px;color:var(--muted)">${x.date ? fmtDate(x.date) : "Date —"}${x.batch ? ` · Batch ${esc(x.batch)}` : ""}${x.by ? ` · ${esc(x.by)}` : ""}${x.note ? ` · ${esc(x.note)}` : ""}</span></div>
      <button class="btn btn-o btn-xs" onclick="openExtraModal('${x.id}')">Edit</button>
      <button class="btn btn-danger btn-xs" onclick="deleteExtra('${x.id}')">✕</button></div>`).join("")
    : `<div style="font-size:13px;color:var(--muted)">None recorded. Use for anything outside the routine IAP timetable.</div>`}</div>`;
}
function openExtraModal(id) {
  const c = child(); c.extraVac = c.extraVac || [];
  const x = id ? c.extraVac.find((v) => v.id === id) : null;
  $("xId").value = x?.id || "";
  $("xNameList").innerHTML = EXTRA_VACCINE_NAMES.map((n) => `<option value="${n}">`).join("");
  $("xBrandList").innerHTML = allBrandOptions().map((o) => `<option value="${esc(o.b)}">${esc(o.m)} · ${esc(o.g)}</option>`).join("");
  $("xName").value = x?.name || ""; $("xBrand").value = x?.brand || ""; $("xMfr").value = x?.mfr || "";
  $("xDate").value = x?.date || todayISO(); $("xBatch").value = x?.batch || "";
  $("xBy").value = x?.by || (DB.settings.doctor || ""); $("xNote").value = x?.note || "";
  $("xBrand").oninput = (e) => { const hit = allBrandOptions().find((o) => o.b.toLowerCase() === e.target.value.trim().toLowerCase()); if (hit) $("xMfr").value = hit.m; };
  if (typeof lotOptionsHTML === "function") {
    $("xLot").innerHTML = lotOptionsHTML(null, (x && x.lot) || "");
    $("xLot").value = (x && x.lot) || "";
    $("xLotHint").textContent = x ? "Editing an existing entry — saving won't deduct stock again." : lotHintHTML(null);
  }
  $("xDelBtn").style.display = x ? "" : "none";
  openModal("mExtra");
}
function saveExtra() {
  const c = child(); c.extraVac = c.extraVac || [];
  if (!$("xName").value.trim() || !$("xDate").value) return alert("Vaccine name and date are required.");
  const bm = matchBrand(null, $("xBrand").value, $("xMfr").value);
  const x = { id: $("xId").value || uid(), name: $("xName").value.trim(), brand: bm.brand, mfr: bm.mfr, date: $("xDate").value, batch: $("xBatch").value.trim(), by: $("xBy").value.trim(), note: $("xNote").value.trim() };
  const i = c.extraVac.findIndex((v) => v.id === x.id);
  if (i < 0) {
    const lotChoice = ($("xLot") || {}).value || "";
    const lotId = (typeof vaxDeduct === "function") ? vaxDeduct([x.name], lotChoice, x.brand, x.batch, c.name + " · " + x.name) : null;
    if (lotId === undefined) return; // chosen lot invalid — abort before writing anything
    x.lot = lotId || "";
    c.extraVac.push(x);
  } else { x.lot = (c.extraVac[i].lot || ""); c.extraVac[i] = x; }
  auditSafe("Extra vaccine", x.name + " — " + c.name);
  save(); closeModal("mExtra"); renderAll();
}
function deleteExtra(id) {
  if (!needSafe(2, "delete vaccine entries")) return;
  const c = child(); c.extraVac = c.extraVac || [];
  if (!id || !confirm("Delete this additional-vaccine entry?")) return;
  c.extraVac = c.extraVac.filter((v) => v.id !== id);
  auditSafe("Extra vaccine deleted", c.name);
  save(); closeModal("mExtra"); renderAll();
}

/* ================= MILESTONES ================= */
function bandForAge(months) {
  for (let i = 0; i < MILESTONES.length; i++) if (months <= MILESTONES[i].max) return i;
  return MILESTONES.length - 1;
}
function renderMilestones() {
  const c = child(); if (!c) return;
  const age = ageBetween(c.dob);
  if (DB.msBand === null || DB.msBand === undefined) DB.msBand = bandForAge(age.months);
  const tabs = $("msTabs"); tabs.innerHTML = "";
  MILESTONES.forEach((b, i) => {
    const btn = document.createElement("button");
    btn.textContent = b.band; if (i === DB.msBand) btn.classList.add("active");
    if (i === bandForAge(age.months)) btn.textContent = "● " + b.band;
    btn.title = i === bandForAge(age.months) ? "Child's current age band" : "";
    btn.onclick = () => { DB.msBand = i; save(); renderMilestones(); };
    tabs.appendChild(btn);
  });
  const bi = DB.msBand, b = MILESTONES[bi];
  $("msBandTitle").textContent = `${b.band} ${bi === bandForAge(age.months) ? "(current age band)" : ""}`;
  $("msBandHint").textContent = `${c.name} is ${ageStr(age)} old · Mark each item: Achieved ✓ / Emerging ◐ / Not yet ✗`;
  const list = $("msList"); list.innerHTML = "";
  let counts = { A: 0, E: 0, N: 0 }, dom = { GM: { a: 0, t: 0 }, FM: { a: 0, t: 0 }, LG: { a: 0, t: 0 }, SC: { a: 0, t: 0 } };
  b.items.forEach((it, ii) => {
    const key = bi + "_" + ii, val = c.milestones[key] || "";
    dom[it.d].t++; if (val === "A") { dom[it.d].a++; counts.A++; } else if (val === "E") counts.E++; else if (val === "N") counts.N++;
    const meta = DOMAIN_META[it.d];
    const row = document.createElement("div"); row.className = "ms-item";
    row.innerHTML = `<span class="badge" style="background:${meta.color}1f;color:${meta.color}">${meta.icon} ${meta.label}</span>
      <span style="font-size:14px">${esc(it.t)}</span>
      <span class="st">
        <button class="pill ${val === "A" ? "on-A" : ""}" onclick="markMs(${bi},${ii},'A')">✓ Done</button>
        <button class="pill ${val === "E" ? "on-E" : ""}" onclick="markMs(${bi},${ii},'E')">◐ Emerging</button>
        <button class="pill ${val === "N" ? "on-N" : ""}" onclick="markMs(${bi},${ii},'N')">✗ Not yet</button>
      </span>`;
    list.appendChild(row);
  });
  const total = b.items.length, scored = counts.A + counts.E + counts.N;
  const curBi = bandForAge(age.months);
  let verdict, cls;
  if (bi > curBi && !scored) { verdict = "Not due yet — this band is ahead of the child's age; its items still have time."; cls = "a-blue"; }
  else if (bi > curBi) { verdict = `<b>Assessed ahead:</b> scored before this age band — not-yet items still have time; review again at the right age.`; cls = "a-blue"; }
  else if (!scored) { verdict = "Not yet assessed — complete this band during the visit."; cls = "a-blue"; }
  else if (counts.N >= 2 || (bi <= bandForAge(age.months) && counts.N >= 1 && counts.A / total < 0.5)) { verdict = `<b>Needs attention:</b> ${counts.N} item(s) not yet achieved in an age-appropriate band. Counsel parents, re-check in 4–6 weeks; refer to early intervention / developmental paediatrics if red flags or regression.`; cls = "a-red"; }
  else if (counts.N === 1 || counts.E >= 2) { verdict = `<b>Monitor closely:</b> mostly on track with ${counts.E} emerging / ${counts.N} not-yet. Give home stimulation activities and review next visit.`; cls = "a-amber"; }
  else { verdict = `<b>On track:</b> ${counts.A}/${total} achieved. Praise parents, share next-band activities.`; cls = "a-green"; }
  $("msAlert").innerHTML = `<div class="alert ${cls}">🌟 <div>${verdict}</div></div>`;
  $("msDomainStats").innerHTML = Object.keys(DOMAIN_META).map((k) => {
    const m = DOMAIN_META[k], d = dom[k], pct = d.t ? Math.round((d.a / d.t) * 100) : 0;
    return `<div class="stat" style="--ac:${m.color}"><div><div class="n">${d.a}/${d.t}</div><div class="l">${m.icon} ${m.label}</div><div class="progress" style="margin-top:8px;width:120px"><div style="width:${pct}%"></div></div></div></div>`;
  }).join("");
  $("msRed").innerHTML = b.red.map((r) => `<div class="alert a-red" style="margin-bottom:8px">🚩 <div>${esc(r)}</div></div>`).join("");
}
function markMs(bi, ii, v) {
  const c = child(); const key = bi + "_" + ii;
  c.milestones[key] = c.milestones[key] === v ? "" : v;
  if (!c.milestones[key]) delete c.milestones[key];
  save(); renderMilestones(); renderDashboard();
}

/* Growth engine moved to js/growth.js + js/growth-chart.js (exact WHO/CDC references). */
/* ================= VISITS ================= */
function openVisitModal(id) {
  const c = child(); if (!c) return alert("Register a child first.");
  const v = id ? c.visits.find((x) => x.id === id) : null;
  $("vsId").value = v?.id || ""; $("vsDate").value = v?.date || todayISO();
  $("vsType").value = v?.type || "Routine / Well-child";
  $("vsSubj").value = v?.subj || ""; $("vsObj").value = v?.obj || ""; $("vsPlan").value = v?.plan || "";
  if (typeof voiceReset === "function") voiceReset(v?.voice || "");
  try { if (typeof Hx !== "undefined" && Hx.fillVisit) Hx.fillVisit(v, c); } catch (eHx) {}
  try { if (typeof Ex !== "undefined" && Ex.fillVisit) Ex.fillVisit(v, c); } catch (eEx) {}
  openModal("mVisit");
}
function saveVisit() {
  const c = child();
  if (!$("vsDate").value) return alert("Date required.");
  const v = { id: $("vsId").value || uid(), date: $("vsDate").value, type: $("vsType").value, subj: $("vsSubj").value.trim(), obj: $("vsObj").value.trim(), plan: $("vsPlan").value.trim() };
  if (typeof voiceData === "function" && voiceData()) v.voice = voiceData();
  try { if (typeof Hx !== "undefined" && Hx.collectVisitIcd) v.icd = Hx.collectVisitIcd(); } catch (eHx) {}
  try { if (typeof Ex !== "undefined" && Ex.collectVisit) Object.assign(v, Ex.collectVisit()); } catch (eEx) {}
  const i = c.visits.findIndex((x) => x.id === v.id);
  if (i >= 0) c.visits[i] = v; else c.visits.push(v);
  try { if (typeof Ex !== "undefined" && Ex.raiseFlagsOnSave) Ex.raiseFlagsOnSave(v, c); } catch (eEx) {}
  auditSafe("Visit note", v.type + " — " + c.name);
  save(); closeModal("mVisit"); renderAll();
}
function deleteVisit(id) {
  if (!needSafe(2, "delete visit notes")) return;
  const c = child();
  if (!confirm("Delete this visit note?")) return;
  c.visits = c.visits.filter((x) => x.id !== id); auditSafe("Visit deleted", c.name); save(); renderAll();
}
function renderVisits() {
  const c = child(); if (!c) return;
  const rows = [...c.visits].sort((a, b) => b.date.localeCompare(a.date));
  $("visitList").innerHTML = rows.map((v) => `<div class="card" style="margin-bottom:12px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
      <b style="color:var(--navy)">${fmtDate(v.date)}</b><span class="badge b-teal">${esc(v.type)}</span>
      <span class="sp" style="flex:1"></span>
      <button class="btn btn-o btn-xs" onclick="openVisitModal('${v.id}')">Edit</button>
      <button class="btn btn-danger btn-xs" onclick="deleteVisit('${v.id}')">Delete</button></div>
    ${v.subj ? `<div style="font-size:13.5px;margin-bottom:6px"><b>S:</b> ${esc(v.subj)}</div>` : ""}
    ${v.obj ? `<div style="font-size:13.5px;margin-bottom:6px"><b>O:</b> ${esc(v.obj)}</div>` : ""}
    ${v.plan ? `<div style="font-size:13.5px"><b>A/P:</b> ${esc(v.plan)}</div>` : ""}
    ${(() => { try { return (typeof Hx !== "undefined" && Hx.visitIcdHTML) ? Hx.visitIcdHTML(v) : ""; } catch (eHx) { return ""; } })()}
    ${(() => { try { return (typeof Ex !== "undefined" && Ex.visitVitalsHTML) ? Ex.visitVitalsHTML(v, c) : ""; } catch (eEx) { return ""; } })()}
    ${v.voice ? '<div style="margin-top:6px"><audio controls src="' + v.voice + '" style="height:32px;max-width:260px;vertical-align:middle"></audio></div>' : ""}</div>`).join("") ||
    `<div class="card"><div class="empty"><div class="big">🩺</div>No visit notes yet.</div></div>`;
}

/* ================= DASHBOARD ================= */
/* ================= ROLE DASHBOARDS ================= */
const CLINICAL_ROLES = ["Doctor", "Nurse", "Pharmacist"];
function myAppRole() { try { const u = (typeof currentUser === "function") ? currentUser() : null; return (u && u.role) || "Doctor"; } catch (e) { return "Doctor"; } }
function greetName() { try { const u = (typeof currentUser === "function") ? currentUser() : null; if (u && u.name && !u.open) return u.name.split(" ")[0]; } catch (e) {} return myAppRole(); }
function queueToday() {
  const t = todayISO();
  return (DB.tokens || []).filter((x) => x.date === t && (x.status === "waiting" || x.status === "in"))
    .sort((a, b) => (a.n || 0) - (b.n || 0)).map((x) => ({ ...x, child: childById(x.childId) }));
}
function billsToday() {
  const t = todayISO(), bs = (DB.bills || []).filter((b) => b.date === t);
  return { n: bs.length, total: bs.reduce((s, b) => s + (+b.total || 0), 0), paid: bs.reduce((s, b) => s + (+b.paid || 0), 0) };
}
function rxToday() {
  const t = todayISO(), out = [];
  (DB.children || []).forEach((c) => (c.rx || []).forEach((r) => {
    if ((r.date || "") === t) (r.items || []).forEach((it, idx) => out.push({ child: c, rx: r, item: it, idx }));
  }));
  return out;
}
function toggleDispense(childId, rxId, idx) {
  const c = childById(childId); if (!c) return;
  const r = (c.rx || []).find((x) => x.id === rxId); if (!r || !r.items || !r.items[idx]) return;
  const it = r.items[idx];
  if (it.dispensed) delete it.dispensed;
  else it.dispensed = { by: ((typeof currentUser === "function" && currentUser()) || {}).name || "", at: new Date().toISOString() };
  auditSafe(it.dispensed ? "Dispensed" : "Dispense undone", `${it.drug || ""} — ${c.name}`);
  save(); renderAll();
}
function growthReds() {
  const t = todayISO(), out = [];
  (DB.children || []).forEach((c) => {
    try {
      const reds = growthAlerts(c.measures || [], c.dob, t).filter((a) => a.level === "red");
      if (reds.length) out.push({ child: c, msg: reds[0].msg });
    } catch (e) {}
  });
  return out;
}
function roleDashHTML(role) {
  const t = todayISO();
  if (role === "Frontdesk") {
    const tod = (DB.tokens || []).filter((x) => x.date === t);
    const w = tod.filter((x) => x.status === "waiting").length, inn = tod.filter((x) => x.status === "in").length, done = tod.filter((x) => x.status === "done").length;
    const b = billsToday(), ap = apptsOn(DB.appts || [], t).filter((a) => !a.done);
    return `<div class="card"><h3>🎟️ Reception — today</h3><div class="statrow">`
      + `<div class="stat" style="--ac:var(--amber)"><div><div class="n">${w}</div><div class="l">Waiting</div></div><div class="e">⏳</div></div>`
      + `<div class="stat" style="--ac:var(--green)"><div><div class="n">${inn}</div><div class="l">In consult</div></div><div class="e">🩺</div></div>`
      + `<div class="stat" style="--ac:var(--blue)"><div><div class="n">${done}/${tod.length}</div><div class="l">Done</div></div><div class="e">✅</div></div></div>`
      + `<dl class="kv" style="margin-top:8px"><dt>Bills</dt><dd>${b.n} · ₹${b.paid} collected${b.total - b.paid > 0 ? ` · <b>₹${b.total - b.paid} pending</b>` : ""}</dd>`
      + `<dt>Appointments</dt><dd>${ap.length} open today</dd></dl>`
      + `<button class="btn btn-p btn-sm" onclick="go('front')">Open frontdesk →</button> `
      + `<button class="btn btn-o btn-sm" onclick="copyDayList()">📋 Copy day list</button></div>`;
  }
  if (role === "Nurse") {
    let due = [];
    try { due = clinicDueList(DB.children || [], t); } catch (e) {}
    const df = due.filter((i) => i.band === "defaulter"), ov = due.filter((i) => i.band === "overdue"), d14 = due.filter((i) => i.band === "due14");
    const reds = growthReds();
    let mar = "";
    try { mar = (typeof marDueHTML === "function") ? marDueHTML() : ""; } catch (e) {}
    return `<div class="card"><h3>💉 Nurse — care tasks</h3><div class="statrow">`
      + `<div class="stat" style="--ac:var(--red)"><div><div class="n">${df.length}</div><div class="l">Defaulters</div></div><div class="e">🚨</div></div>`
      + `<div class="stat" style="--ac:var(--amber)"><div><div class="n">${ov.length + d14.length}</div><div class="l">Due/overdue</div></div><div class="e">💉</div></div>`
      + `<div class="stat" style="--ac:var(--blue)"><div><div class="n">${reds.length}</div><div class="l">Growth flags</div></div><div class="e">📉</div></div></div>`
      + (df.slice(0, 5).map((i) => `<div style="font-size:13px">• <b>${esc(i.child)}</b> — ${esc(i.name)} ${esc(i.dose || "")} <span style="color:var(--muted)">(due ${esc(dmy(i.due))}, +${i.daysOver}d)</span></div>`).join("") || `<div class="hint">No defaulters. 🎉</div>`)
      + `<div style="margin-top:8px"><button class="btn btn-o btn-sm" onclick="go('vaccines')">Vaccines →</button> <button class="btn btn-o btn-sm" onclick="go('mar')">eMAR →</button></div></div>` + mar;
  }
  if (role === "Pharmacist") {
    const lines = rxToday(), left = lines.filter((l) => !l.item.dispensed);
    const rows = lines.slice(0, 12).map((l) => `<div class="vac-row"><div class="grow"><b>${esc(l.item.drug || "")}</b> ${esc(l.item.strength || "")} <span style="color:var(--muted)">· ${esc(l.child.name)}${l.item.take ? " · " + esc(l.item.take) : ""}</span><br>`
      + `<span style="font-size:12px;color:var(--muted)">${esc(l.rx.dx || "")}${l.item.dispensed ? ` · ✅ by ${esc(l.item.dispensed.by || "")}` : ""}</span></div>`
      + `<button class="btn ${l.item.dispensed ? "btn-o" : "btn-p"} btn-xs" onclick="toggleDispense('${l.child.id}','${l.rx.id}',${l.idx})">${l.item.dispensed ? "Undo" : "Dispense"}</button></div>`).join("");
    return `<div class="card"><h3>💊 Pharmacy — dispensing queue</h3>`
      + `<div style="font-size:13px;margin-bottom:8px">${left.length} of ${lines.length} items pending today</div>`
      + (rows || `<div class="hint">No prescriptions written today.</div>`)
      + (lines.length > 12 ? `<div class="hint">Showing 12 of ${lines.length}.</div>` : "")
      + `<div style="margin-top:8px"><button class="btn btn-o btn-sm" onclick="go('rx')">Prescriptions →</button> <button class="btn btn-o btn-sm" onclick="go('stock')">Stock →</button></div></div>`;
  }
  if (role === "Admin") {
    const users = DB.users || [];
    let cloud = "Local mode";
    try { cloud = (typeof Cloud !== "undefined" && Cloud.enabled && Cloud.user && Cloud.user()) ? ("Cloud · " + Cloud.user().email) : "Local mode"; } catch (e) {}
    let plan = "";
    try { plan = (typeof T !== "undefined" && T.tenant && T.tenant.plan) ? ` · Plan: <b>${esc(T.tenant.plan)}</b>` : ""; } catch (e) {}
    const au = (DB.audit || []).slice(0, 6).map((a) => `<div style="font-size:12.5px">• ${esc(a.action || "")} <span style="color:var(--muted)">— ${esc(a.user || "")}</span></div>`).join("");
    return `<div class="card"><h3>⚙️ Admin — clinic overview</h3><div class="statrow">`
      + `<div class="stat" style="--ac:var(--blue)"><div><div class="n">${(DB.children || []).length}</div><div class="l">Patients</div></div><div class="e">🧒</div></div>`
      + `<div class="stat" style="--ac:var(--teal)"><div><div class="n">${users.length}</div><div class="l">Staff</div></div><div class="e">👥</div></div>`
      + `<div class="stat" style="--ac:var(--amber)"><div><div class="n">${(DB.tokens || []).filter((x) => x.date === t).length}</div><div class="l">Visits today</div></div><div class="e">🎟️</div></div></div>`
      + `<dl class="kv" style="margin-top:8px"><dt>Sync</dt><dd>${esc(cloud)}${plan}</dd>`
      + `<dt>Staff</dt><dd>${users.map((u) => esc(u.name) + " (" + esc(u.role) + ")").join(", ") || "—"}</dd></dl>`
      + (au ? `<div style="font-size:13px"><b>Recent activity</b></div>${au}` : "")
      + `<div style="margin-top:8px"><button class="btn btn-o btn-sm" onclick="go('users')">Users & audit →</button> <button class="btn btn-o btn-sm" onclick="go('settings')">Settings →</button></div></div>`;
  }
  // Doctor (default): today's queue + attention flags
  const q = queueToday(), reds = growthReds();
  let conf = 0;
  try { conf = (JSON.parse(localStorage.getItem("kidgrow_conflicts") || "[]") || []).length; } catch (e) {}
  const qrows = q.slice(0, 8).map((x) => `<div style="font-size:13px">${x.status === "in" ? "🟢" : "⏳"} <b>#${esc(String(x.n))} ${esc((x.child && x.child.name) || x.name || "Walk-in")}</b> <span style="color:var(--muted)">· ${esc(x.reason || "")}</span></div>`).join("");
  return `<div class="card"><h3>🩺 Doctor — today</h3><div class="statrow">`
    + `<div class="stat" style="--ac:var(--amber)"><div><div class="n">${q.filter((x) => x.status === "waiting").length}</div><div class="l">Waiting</div></div><div class="e">⏳</div></div>`
    + `<div class="stat" style="--ac:var(--green)"><div><div class="n">${q.filter((x) => x.status === "in").length}</div><div class="l">In consult</div></div><div class="e">🩺</div></div>`
    + `<div class="stat" style="--ac:${reds.length || conf ? "var(--red)" : "var(--blue)"}"><div><div class="n">${reds.length + conf}</div><div class="l">Flags</div></div><div class="e">🚩</div></div></div>`
    + (qrows || `<div class="hint">No patients in queue.</div>`)
    + (reds.slice(0, 4).map((r) => `<div style="font-size:13px">📉 <b>${esc(r.child.name)}</b> <span style="color:var(--muted)">· ${esc(r.msg.split(".")[0])}</span></div>`).join(""))
    + (conf ? `<div style="font-size:13px">🔀 <b>${conf} sync conflict(s)</b> need review.</div>` : "")
    + `<div style="margin-top:8px"><button class="btn btn-p btn-sm" onclick="go('front')">Open queue →</button> <button class="btn btn-o btn-sm" onclick="go('timeline')">Timeline →</button></div></div>`;
}
/* ---------------- Sunrise home: clinic-level data (pure) ---------------- */
function homeStatsData(children, tokens, appts, today) {
  const t = today || todayISO();
  const todToks = (tokens || []).filter((x) => x.date === t);
  const todAppts = (appts || []).filter((a) => a.date === t);
  const seen = todToks.filter((x) => x.status === "done").length + todAppts.filter((a) => a.done).length;
  const due = (typeof clinicDueList === "function") ? clinicDueList(children, t) : [];
  const wk = addDays(t, 7), soon2 = addDays(t, 2);
  const dueWeek = due.filter((i) => i.due <= wk).length;
  const dueSoon = due.filter((i) => (i.band === "due14" || i.band === "upcoming") && i.due <= soon2).length;
  const overdueKids = new Set(due.filter((i) => i.band === "defaulter" || i.band === "overdue").map((i) => i.childId)).size;
  let flags = 0;
  try { flags = (typeof falteringFlags === "function" ? falteringFlags(children) : []).length; } catch (e) { flags = 0; }
  const patients = todToks.length + todAppts.length;
  return { patients, seen, waiting: patients - seen, dueWeek, dueSoon, overdueKids, flags };
}
function homeQueueRows(tokens, appts, children, today) {
  const t = today || todayISO(), byId = {};
  (children || []).forEach((c) => { byId[c.id] = c; });
  const sub = (c) => {
    if (!c) return "";
    try {
      let s = ageStr(ageBetween(c.dob));
      const lm = latestMeasure(c); if (lm && lm.wt) s += ` · ${lm.wt} kg`;
      return s;
    } catch (e) { return ""; }
  };
  const rows = [];
  (tokens || []).filter((x) => x.date === t).forEach((x) => {
    const c = byId[x.childId];
    rows.push({ key: "t:" + x.id, time: x.time || "", tag: x.n != null ? "#" + x.n : "", name: x.name || (c && c.name) || "—",
      sub: sub(c), reason: x.reason || "General", status: x.status || "waiting", childId: x.childId || "" });
  });
  (appts || []).filter((a) => a.date === t).forEach((a) => {
    const c = byId[a.childId];
    rows.push({ key: "a:" + a.id, time: a.time || "", tag: "", name: (c && c.name) || "—",
      sub: sub(c), reason: a.type || "Visit", status: a.done ? "done" : "booked", childId: a.childId || "" });
  });
  rows.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  return rows;
}
function queueStatusBadge(st) {
  const m = { waiting: ["b-amber", "Waiting"], in: ["b-green", "In consult"], booked: ["b-teal", "Booked"], done: ["b-gray", "Done"] };
  const b = m[st] || ["b-gray", st || "—"];
  return `<span class="badge ${b[0]}">${esc(b[1])}</span>`;
}
function homeQueueHTML(rows) {
  if (!rows.length) return `<div class="empty"><div class="big">🕘</div>No tokens or appointments today.<br><button class="btn btn-p btn-sm" style="margin-top:10px" onclick="go('front')">Open frontdesk →</button></div>`;
  return `<div style="overflow:auto"><table class="tbl"><tr><th>Time</th><th>Child</th><th>Reason</th><th>Status</th><th></th></tr>${rows.map((r) => {
    const act = !r.childId ? "" : (r.status === "waiting" || r.status === "booked")
      ? `<button class="btn btn-p btn-xs" onclick="queueStart('${r.key}')">Start</button> <a href="#" onclick="queueOpen('${r.key}');return false">Open</a>`
      : r.status === "in" ? `<a href="#" onclick="queueOpen('${r.key}');return false">Open</a>` : "";
    return `<tr style="${r.status === "done" ? "opacity:.55" : ""}"><td>${esc(r.time || "—")}${r.tag ? `<br><b>${esc(r.tag)}</b>` : ""}</td>`
      + `<td><b>${esc(r.name)}</b>${r.sub ? `<br><span style="font-size:11.5px;color:var(--muted)">${esc(r.sub)}</span>` : ""}</td>`
      + `<td>${esc(r.reason)}</td><td>${queueStatusBadge(r.status)}</td><td style="white-space:nowrap">${act}</td></tr>`;
  }).join("")}</table></div>`;
}
function queueFind(key) {
  const [kind, id] = String(key || "").split(":");
  const row = kind === "t" ? (DB.tokens || []).find((x) => x.id === id) : (DB.appts || []).find((a) => a.id === id);
  return row && row.childId ? row : null;
}
function queueOpen(key) {
  const row = queueFind(key); if (!row) return;
  setActive(row.childId); go("timeline");
}
function queueStart(key) {
  const row = queueFind(key); if (!row) return;
  setActive(row.childId); openVisitModal();
}
function homeAlertsData(o) {
  o = o || {};
  const out = [];
  if (o.overdueKids > 0) out.push({ sev: "red", title: `${o.overdueKids} children overdue`, body: "for vaccines", cta: "Send WhatsApp reminders", page: "schedule" });
  if (o.flags > 0) out.push({ sev: "amber", title: `${o.flags} growth red flags`, body: "z-drop ≥ 1 between visits", cta: "Review list", page: "analytics" });
  if (o.stockN > 0) out.push({ sev: "amber", title: "Vaccine stock low", body: o.stockDetail || "lots under reorder level", cta: "Open stock", page: "stock" });
  if (o.labsN > 0) out.push({ sev: "blue", title: `${o.labsN} lab results`, body: "awaiting review (last 60 days)", cta: "Open labs", page: "labs" });
  return out;
}
function homeAlertsHTML(list) {
  if (!list || !list.length) return `<div class="alert a-green" style="margin:0">✅ <div><b>All clear</b> — nothing needs review.</div></div>`;
  const cls = { red: "a-red", amber: "a-amber", blue: "a-blue" };
  return list.map((a) => `<div class="alert ${cls[a.sev] || "a-amber"}" style="margin:0 0 10px"><div><b>${esc(a.title)}</b> ${esc(a.body)}<br><a href="#" onclick="go('${a.page}');return false">${esc(a.cta)} →</a></div></div>`).join("");
}
function homeStatsHTML(s) {
  const card = (ac, n, l, sub, page, aria) => `<div class="stat" style="--ac:${ac};cursor:pointer" tabindex="0" role="button" aria-label="${aria}" onclick="go('${page}')" onkeydown="if(event.key==='Enter')go('${page}')"><div><div class="n">${n}</div><div class="l">${l}</div><div style="font-size:11.5px;color:var(--muted)">${sub}</div></div></div>`;
  return card("var(--blue)", s.patients, "Patients today", `${s.seen} seen · ${s.waiting} waiting`, "front", "Open frontdesk")
    + card("var(--teal)", s.dueWeek, "Vaccines due this week", `${s.dueSoon} due in 2 days`, "schedule", "Open schedule")
    + card(s.overdueKids ? "var(--red)" : "var(--green)", s.overdueKids, "Overdue defaulters", s.overdueKids ? "Send reminders" : "None overdue", "schedule", "Open due list")
    + card(s.flags ? "var(--amber)" : "var(--green)", s.flags, "Growth red flags", s.flags ? "Review needed" : "All clear", "analytics", "Open analytics");
}
/* ---------------- dashboard search + visit entry ---------------- */
function startVisit() {
  const c = child();
  if (!c) { toast("Select a patient first — search above or open Patients."); go("children"); return; }
  openVisitModal();
}
function dashSearchHTML(q, kids, recentIds) {
  q = (q || "").trim();
  if (q.length < 2) return "";
  const hits = matchChildren(q, kids, recentIds).slice(0, 6);
  return hits.length ? hits.map((h) => `<button class="sr-row" onclick="dashPick('${h.c.id}')"><b>${esc(h.c.name)}</b><span style="font-size:12px;color:var(--muted)">${esc(ageStr(ageBetween(h.c.dob)))}${h.c.mrn ? ` · MRN ${esc(h.c.mrn)}` : ""}</span><span class="why">${esc(h.why.join(" · "))}</span></button>`).join("")
    : `<div class="empty" style="padding:12px">No matches for “${esc(q)}”.<br><button class="btn btn-p btn-sm" style="margin-top:8px" onclick="openChildModal()">+ Register this child</button></div>`;
}
function dashSearch() {
  const inp = $("dashSearch"), box = $("dashSearchRes");
  if (!inp || !box) return;
  const html = dashSearchHTML(inp.value, DB.children, getRecentIds());
  box.style.display = html ? "" : "none";
  box.innerHTML = html;
}
function dashSearchKey(e) {
  if (!e || !e.key) return;
  const inp = $("dashSearch");
  if (!inp) return;
  if (e.key === "Enter") {
    const hits = matchChildren((inp.value || "").trim(), DB.children, getRecentIds());
    if (hits.length) { e.preventDefault(); dashPick(hits[0].c.id); }
  } else if (e.key === "Escape") { inp.value = ""; dashSearch(); }
}
function dashPick(id) {
  setActive(id);
  const s = $("dashSearch"); if (s) s.value = "";
  const r = $("dashSearchRes"); if (r) { r.innerHTML = ""; r.style.display = "none"; }
  const c = child();
  if (c) toast(`Active patient: ${c.name}`);
}
function renderDashHome() {
  const t = todayISO(), c = child();
  const hz = $("dashHero");
  if (hz) {
    const _S = DB.settings || {}, logoHtml = _S.logo ? `<img src="${_S.logo}" alt="clinic logo">` : `<span class="ph">👶</span>`;
    const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
    let sub = "Search for a patient or pick from today's queue below.";
    if (c) {
      let vs = { done: 0, total: 0, overdue: 0 };
      try { vs = vaccineSummary(c); } catch (e) {}
      sub = `Active child: <b>${esc(c.name)}</b> · ${esc(ageStr(ageBetween(c.dob)))}${c.mrn ? ` · MRN ${esc(c.mrn)}` : ""} · 💉 ${vs.done}/${vs.total} vaccines${vs.overdue ? ` · <b>${vs.overdue} overdue</b>` : ""}`;
    }
    hz.innerHTML = `<div class="hero-top"><div class="hero-logo">${logoHtml}</div><div><div class="hero-eyebrow">${esc(fmtDate(t))} · ${esc((DB.settings || {}).clinic || "NeoKid Care")} · what needs you today</div>
      <h2>${greet}, ${esc(greetName())} 👋</h2><div class="hero-sub">${sub}</div></div></div>
      <div class="hero-search search-wrap"><input id="dashSearch" placeholder="🔍 Search name, parent, phone, MRN…" autocomplete="off" oninput="dashSearch()" onkeydown="dashSearchKey(event)"><div id="dashSearchRes" class="search-res" style="display:none"></div></div>
      <div class="hero-actions"><button class="btn btn-p btn-sm" onclick="startVisit()">+ Start visit</button>
      <button class="btn btn-o btn-sm" onclick="openChildModal()">+ Register child</button></div>
      <div class="hero-actions" style="margin-top:8px"><button class="btn btn-o btn-sm" onclick="openGrowthModal()">+ Record growth</button>
      <button class="btn btn-o btn-sm" onclick="openVisitModal()">+ Visit note</button>
      <button class="btn btn-o btn-sm" onclick="openApptModal()">+ Book visit</button>
      <button class="btn btn-o btn-sm" onclick="go('front')">🎟️ Frontdesk</button></div>`;
  }
  const hs = homeStatsData(DB.children, DB.tokens, DB.appts, t);
  $("dashHome").innerHTML = homeStatsHTML(hs);
  $("dashQueue").innerHTML = homeQueueHTML(homeQueueRows(DB.tokens, DB.appts, DB.children, t));
  let stockN = 0, stockDetail = "";
  try {
    const sa = (typeof stockAlerts === "function") ? stockAlerts(t) : null;
    if (sa) {
      stockN = sa.expired.length + sa.out.length + sa.low.length;
      const bits = [];
      if (sa.expired.length) bits.push(`${sa.expired.length} expired`);
      if (sa.out.length + sa.low.length) bits.push(`${sa.out.length + sa.low.length} under reorder`);
      if (sa.expiring.length) bits.push(`${sa.expiring.length} expiring soon`);
      stockDetail = bits.join(" · ");
    }
  } catch (e) {}
  let labsN = 0;
  try { labsN = (typeof labsPending === "function") ? labsPending(DB.children, t) : 0; } catch (e) {}
  $("dashAlerts").innerHTML = homeAlertsHTML(homeAlertsData({ overdueKids: hs.overdueKids, flags: hs.flags, stockN, stockDetail, labsN }));
  $("dashChildTag").textContent = c ? `${c.name} · ${ageStr(ageBetween(c.dob))}` : "No patient selected";
}
function renderDashboard() {
  renderDashHome();
  const _role = myAppRole();
  const _clinicExtra = CLINICAL_ROLES.includes(_role)
    ? (clinicPulseHTML() + (typeof nicuCensusHTML === "function" ? nicuCensusHTML() : "") + (typeof marDueHTML === "function" ? marDueHTML() : "") + (typeof growthAlertsHTML === "function" ? growthAlertsHTML() : ""))
    : "";
  $("dashClinic").innerHTML = roleDashHTML(_role) + _clinicExtra;
  const c = child();
  if (!c) {
    $("dashStats").innerHTML = "";
    ["dashVac", "dashGrowth", "dashMs", "dashVisits"].forEach((id) => { $(id).innerHTML = `<div class="empty">Select a patient above to see details.</div>`; });
    return;
  }
  const a = ageBetween(c.dob), vs = vaccineSummary(c), lm = latestMeasure(c);
  const bi = bandForAge(a.months), b = MILESTONES[bi];
  let ach = 0; b.items.forEach((_, ii) => { if (c.milestones[bi + "_" + ii] === "A") ach++; });
  $("dashStats").innerHTML = `
    <div class="stat" style="--ac:var(--blue);cursor:pointer" tabindex="0" role="button" aria-label="Open Children" onclick="go('children')" onkeydown="if(event.key==='Enter')go('children')"><div><div class="n">${ageStr(a)}</div><div class="l">Age · ${c.sex === "boy" ? "Boy" : "Girl"}</div></div><div class="e">🎂</div></div>
    <div class="stat" style="--ac:var(--teal);cursor:pointer" tabindex="0" role="button" aria-label="Open vaccination record" onclick="go('vaccines')" onkeydown="if(event.key==='Enter')go('vaccines')"><div><div class="n">${vs.done}/${vs.total}</div><div class="l">Vaccines · ${vs.pct}%</div></div><div class="e">💉</div></div>
    <div class="stat" style="--ac:var(--amber);cursor:pointer" tabindex="0" role="button" aria-label="Open milestones" onclick="go('milestones')" onkeydown="if(event.key==='Enter')go('milestones')"><div><div class="n">${ach}/${b.items.length}</div><div class="l">Milestones · ${esc(b.band)}</div></div><div class="e">🌟</div></div>
    <div class="stat" style="--ac:var(--green);cursor:pointer" tabindex="0" role="button" aria-label="Open growth" onclick="go('growth')" onkeydown="if(event.key==='Enter')go('growth')"><div><div class="n">${lm ? lm.wt + " kg" : "—"}</div><div class="l">${lm ? "Wt · " + fmtDate(lm.date) : "No growth data"}</div></div><div class="e">⚖️</div></div>`;
  $("dashVac").innerHTML = vs.next
    ? `<div class="alert ${vs.overdue ? "a-red" : "a-amber"}" style="margin:0">💉 <div><b>${esc(vs.next.v.label)}</b> due <b>${fmtDate(vs.next.due)}</b><br><span style="font-size:12.5px">${esc(vs.next.v.vaccines.filter((x) => !c.vaccines[x.code]).map((x) => x.name + " " + x.dose).join(" · "))}</span>${vs.overdue ? `<br><b>${vs.overdue} overdue</b> — book catch-up.` : ""}</div></div>
       <div style="margin-top:10px"><button class="btn btn-p btn-sm" onclick="go('vaccines')">Open vaccination record →</button></div>`
    : `<div class="alert a-green" style="margin:0">✅ <div>Schedule complete. <button class="btn btn-d btn-xs" onclick="printCertificate()">Print certificate</button></div></div>`;
  if (lm) {
    const cl = classifyGrowth(c, lm);
    $("dashGrowth").innerHTML = `<dl class="kv">
      <dt>Measured</dt><dd>${fmtDate(lm.date)} (${ageStr(ageBetween(c.dob, lm.date))})</dd>
      <dt>Wt / Ht / BMI</dt><dd>${lm.wt} kg · ${lm.ht} cm · ${lm.bmi}</dd>
      ${cl.wt ? `<dt>Weight</dt><dd>${fmtPct(cl.wt.pct)} · ${esc(cl.wt.label)}</dd>` : ""}
      ${cl.ht ? `<dt>Height</dt><dd>${fmtPct(cl.ht.pct)} · ${esc(cl.ht.label)}</dd>` : ""}
      ${cl.bmi ? `<dt>BMI</dt><dd>${fmtPct(cl.bmi.pct)} · ${esc(cl.bmi.label)}</dd>` : ""}</dl>
      <div style="margin-top:10px"><button class="btn btn-p btn-sm" onclick="go('growth')">Open growth charts →</button></div>`;
  } else $("dashGrowth").innerHTML = `<div class="empty"><div class="big">📈</div>No measurements.<br><button class="btn btn-p btn-sm" onclick="openGrowthModal()">Record now</button></div>`;
  $("dashMs").innerHTML = `<div style="font-size:13.5px;margin-bottom:8px"><b>${esc(b.band)}</b> band — ${ach}/${b.items.length} achieved</div>
    <div class="progress"><div style="width:${Math.round((ach / b.items.length) * 100)}%"></div></div>
    <div style="margin-top:10px"><button class="btn btn-p btn-sm" onclick="go('milestones')">Continue assessment →</button></div>`;
  const vv = [...c.visits].sort((x, y) => y.date.localeCompare(x.date)).slice(0, 3);
  $("dashVisits").innerHTML = vv.length ? vv.map((v) => `<div style="font-size:13.5px;padding:8px 0;border-bottom:1px solid var(--line)"><b>${fmtDate(v.date)}</b> <span class="badge b-gray">${esc(v.type)}</span><br><span style="color:var(--muted)">${esc((v.subj || v.plan || "").slice(0, 90))}</span></div>`).join("") : `<span style="color:var(--muted);font-size:13px">No visits recorded.</span>`;
}

/* ---- v10.28.1: professional letterhead contact lines ----
   Doctor details ride on their OWN line; address + phone on a separate
   line. Also heals legacy settings where the phone was typed into the
   address field ("addr \u00b7 \u260e phone"). Pure - safe in every builder. */
function splitClinicContact(s) {
  s = s || {};
  let addr = String(s.addr || "").trim(), phone = String(s.phone || "").trim();
  if (!phone) {
    const m = addr.match(/^(.*?)\s*[\u00b7\u2022|\-]\s*\u260e\s*([\d\s()+\/-]+)\s*$/) || addr.match(/^(.+?)\s*\u260e\s*([\d\s()+\/-]+)\s*$/);
    if (m) { addr = (m[1] || "").trim().replace(/\s*[\u00b7\u2022|\-]\s*$/, ""); phone = (m[2] || "").trim(); }
  }
  const doc = [String(s.doctor || "").trim(), String(s.reg || "").trim() ? "Reg: " + String(s.reg).trim() : ""].filter(Boolean).join(" \u00b7 ");
  return { doc, addr: [addr, phone ? "\u260e " + phone : ""].filter(Boolean).join(" \u00b7 "), phone };
}

/* ================= REPORTS ================= */
function clinicHeader() {
  const s = DB.settings || {};
  const ld = (typeof letterDoc === "function") ? letterDoc() : { name: s.doctor || "", qual: "", reg: s.reg || "" };
  const logo = s.logo ? `<img src="${s.logo}" alt="logo" class="report-logo" onerror="this.style.display='none'">` : `<div style="font-size:40px">👶</div>`;
  const cc = splitClinicContact(s);
  return `<div class="report-head">${logo}<div><div class="clinic">${esc(s.clinic || "NeoKid Care Clinic")}</div>
  <div style="font-size:13px;color:var(--muted)">${esc(ld.name)}${ld.qual ? ", " + esc(ld.qual) : ""} ${ld.reg ? "· Reg: " + esc(ld.reg) : ""}<br>${esc(cc.addr)}</div></div>
  <div style="margin-left:auto;font-size:12px;color:var(--muted)">Generated ${fmtDate(todayISO())}</div></div>`;
}
function childHeader(c) {
  const a = ageBetween(c.dob);
  return `<dl class="kv" style="margin-bottom:14px">
    <dt>Child</dt><dd>${esc(c.name)} · ${c.sex === "boy" ? "Boy" : "Girl"} · ${ageStr(a)} (DOB ${fmtDate(c.dob)})</dd>
    <dt>Parents</dt><dd>${esc(c.father || "—")} · ${esc(c.mother || "—")} ${c.phone ? "· ☎ " + esc(c.phone) : ""}</dd>
    ${c.abha ? "<dt>ABHA</dt><dd>" + esc(c.abha) + "</dd>" : ""}
    <dt>Birth</dt><dd>${c.birthWt ? c.birthWt + " kg" : "—"} ${c.gest ? "· " + c.gest + " wk" : ""} ${c.blood ? "· Blood " + esc(c.blood) : ""}</dd>
    ${c.allergy ? `<dt>Alerts</dt><dd style="color:var(--red)">⚠ ${esc(c.allergy)}</dd>` : ""}${(() => { try { return (typeof Hx !== "undefined" && Hx.headerProblems) ? Hx.headerProblems(c) : ""; } catch (eHx) { return ""; } })()}</dl>`;
}
function buildSummary() {
  const c = child(); if (!c) return;
  const vs = vaccineSummary(c), lm = latestMeasure(c), a = ageBetween(c.dob);
  const bi = bandForAge(a.months), b = MILESTONES[bi];
  let msRows = b.items.map((it, ii) => {
    const v = c.milestones[bi + "_" + ii];
    return `<tr><td>${DOMAIN_META[it.d].icon} ${DOMAIN_META[it.d].label}</td><td>${esc(it.t)}</td><td>${v === "A" ? "✓ Achieved" : v === "E" ? "◐ Emerging" : v === "N" ? "✗ Not yet" : "—"}</td></tr>`;
  }).join("");
  let cl = lm ? classifyGrowth(c, lm) : null;
  const html = `${clinicHeader()}<h3 style="color:var(--navy);margin-bottom:8px">Comprehensive Child Health Summary</h3>${childHeader(c)}
  <h4 style="margin:12px 0 6px;color:var(--navy)">📈 Growth (latest ${lm ? fmtDate(lm.date) : "—"})</h4>
  ${lm ? `<table class="tbl"><tr><th>Parameter</th><th>Value</th><th>Percentile</th><th>Z-score</th><th>Interpretation</th></tr>
    ${cl.wt ? `<tr><td>Weight</td><td>${lm.wt} kg</td><td>${fmtPct(cl.wt.pct)}</td><td>${zStr(cl.wt.z)}</td><td>${esc(cl.wt.label)}</td></tr>` : ""}
    ${cl.ht ? `<tr><td>Height/Length</td><td>${lm.ht} cm</td><td>${fmtPct(cl.ht.pct)}</td><td>${zStr(cl.ht.z)}</td><td>${esc(cl.ht.label)}</td></tr>` : ""}
    ${cl.bmi ? `<tr><td>BMI</td><td>${lm.bmi}</td><td>${fmtPct(cl.bmi.pct)}</td><td>${zStr(cl.bmi.z)}</td><td>${esc(cl.bmi.label)}</td></tr>` : ""}
    ${cl.hc ? `<tr><td>Head circ.</td><td>${lm.hc} cm</td><td>${fmtPct(cl.hc.pct)}</td><td>${zStr(cl.hc.z)}</td><td>${esc(cl.hc.label)}</td></tr>` : ""}</table>
    <div style="font-size:11.5px;color:var(--muted)">Reference: WHO MGRS 2006 (0–5 y) · IAP 2015 (5–18 y) · IAP BMI overweight = adult-equiv 23, obesity = 27.</div>` : "<p>No growth data.</p>"}
  <h4 style="margin:12px 0 6px;color:var(--navy)">💉 Immunization (${vs.done}/${vs.total})</h4>
  <table class="tbl"><tr><th>Visit</th><th>Vaccine</th><th>Brand</th><th>Due</th><th>Given</th><th>Batch</th></tr>
  ${VACCINE_SCHEDULE.map((v) => v.vaccines.map((vx) => { const r = c.vaccines[vx.code]; return `<tr><td>${esc(v.label)}</td><td>${esc(vx.name)} (${esc(vx.dose)})</td><td>${r?.brand ? esc(r.brand) + (r.mfr ? ` (${esc(r.mfr)})` : "") : "—"}</td><td>${fmtDate(dueDateFor(c, v))}</td><td>${r ? fmtDate(r.date) : "<b style='color:var(--red)'>Pending</b>"}</td><td>${r?.batch || "—"}</td></tr>`; }).join("")).join("")}${(c.extraVac || []).map((x) => `<tr><td>Additional</td><td>${esc(x.name)}</td><td>${x.brand ? esc(x.brand) + (x.mfr ? ` (${esc(x.mfr)})` : "") : "—"}</td><td>—</td><td>${x.date ? fmtDate(x.date) : "—"}</td><td>${esc(x.batch || "—")}</td></tr>`).join("")}</table>
  <h4 style="margin:12px 0 6px;color:var(--navy)">🌟 Milestones — ${esc(b.band)} band</h4>
  <table class="tbl"><tr><th>Domain</th><th>Milestone</th><th>Status</th></tr>${msRows}</table>
  <div class="footer-note">Screening summary generated by NeoKid Care · ${VAX_SCHEDULE_VERSION} / WHO–IAP growth references. Confirm borderline findings on official charts. &nbsp;&nbsp; Doctor signature & seal: ______________________</div>`;
  $("summaryBody").innerHTML = html; $("summaryPrint").innerHTML = html;
  $("summaryCard").style.display = "";
  $("summaryCard").scrollIntoView({ behavior: "smooth" });
}
function printCertificate() {
  const c = child(); if (!c) return;
  const rows = VACCINE_SCHEDULE.map((v) => v.vaccines.map((vx) => {
    const r = c.vaccines[vx.code];
    return `<tr><td>${esc(v.label)}</td><td><b>${esc(vx.name)}</b><br><span style="font-size:11.5px;color:var(--muted)">${esc(vx.dose)} · ${esc(vx.protects)}</span></td><td>${r?.brand ? `<b>${esc(r.brand)}</b>${r.mfr ? `<br><span style="font-size:11px;color:var(--muted)">${esc(r.mfr)}</span>` : ""}` : "—"}</td><td>${r ? fmtDate(r.date) : "—"}</td><td>${r?.batch || "—"}</td><td>${r ? "✓" : "○"}</td></tr>`;
  }).join("")).join("");
  const exRows = (c.extraVac || []).map((x) => `<tr><td>Additional</td><td><b>${esc(x.name)}</b></td><td>${x.brand ? `<b>${esc(x.brand)}</b>${x.mfr ? `<br><span style="font-size:11px;color:var(--muted)">${esc(x.mfr)}</span>` : ""}` : "—"}</td><td>${x.date ? fmtDate(x.date) : "—"}</td><td>${esc(x.batch || "—")}</td><td>✓</td></tr>`).join("");
  $("certPrint").innerHTML = `${clinicHeader()}
  <div style="text-align:center;margin:6px 0 12px"><div style="font-size:22px;font-weight:800;color:var(--navy)">🏅 IMMUNIZATION RECORD CERTIFICATE</div>
  <div style="font-size:12.5px;color:var(--muted)">As per ${VAX_SCHEDULE_VERSION} Immunization Timetable (routine use) · India</div></div>
  ${childHeader(c)}
  <table class="tbl">${`<tr><th>Due visit</th><th>Vaccine</th><th>Brand</th><th>Date given</th><th>Batch</th><th>✓</th></tr>`}${rows}${exRows}</table>
  <div style="display:flex;gap:30px;margin-top:26px;font-size:13px"><div>Parent signature: ______________</div><div style="margin-left:auto;text-align:center">Doctor signature & seal<br><br>______________<br><span style="font-size:11px;color:var(--muted)">${esc(DB.settings.doctor || "")}</span></div></div>
  <div class="footer-note">Keep this record safe — required for school admission & travel. In case of missed doses, consult your paediatrician for catch-up (no need to restart series).</div>`;
  printPage("pg-cert");
}

/* ================= SETTINGS / DATA ================= */
function saveSettings() {
  const lm = document.getElementById("sLockMins"), scp0 = document.getElementById("sColorPrint");
  DB.settings = Object.assign({}, DB.settings, { clinic: $("sClinic").value.trim(), doctor: $("sDoctor").value.trim(), reg: $("sReg").value.trim(), addr: $("sAddr").value.trim(), phone: $("sPhone").value.trim(), lockMins: lm ? lm.value.trim() : ((DB.settings || {}).lockMins || "15"), colorPrint: scp0 ? scp0.checked : ((DB.settings || {}).colorPrint !== false) });
  save(); syncChildPicker(); renderBrand(); applyPrintMode(); alert("Clinic profile saved.");
}
function savePrintPref() { const scp = $("sColorPrint"); if (!scp) return; DB.settings = Object.assign({}, DB.settings, { colorPrint: scp.checked }); save(); applyPrintMode(); toast(scp.checked ? "Color printing on 🎨" : "Ink-saver B&W printing on"); }
function applyPrintMode() {
  const color = (DB.settings || {}).colorPrint !== false;
  try { document.body.classList.toggle("bw-print", !color); document.body.dataset.printMode = color ? "color" : "bw"; } catch (e) {}
  return color;
}
function loadSettings() { const s = DB.settings || {}; $("sClinic").value = s.clinic || ""; $("sDoctor").value = s.doctor || ""; $("sReg").value = s.reg || ""; $("sAddr").value = s.addr || ""; $("sPhone").value = s.phone || ""; const slm = $("sLockMins"); if (slm) slm.value = s.lockMins || "15"; const pv = $("logoPrev"); if (pv) { pv.style.display = s.logo ? "" : "none"; if (s.logo) pv.src = s.logo; } const li = $("sLogo"); if (li) li.value = ""; const scp = document.getElementById("sColorPrint"); if (scp) scp.checked = s.colorPrint !== false; }
function exportData() {
  DB.lastBackup = todayISO(); save();
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `kidgrow-backup-${todayISO()}.json`; a.click();
}
/* ---------------- Backup validation + atomic restore (pure core) ---------------- */
function validateBackup(d) {
  const errors = [];
  if (!d || typeof d !== "object" || Array.isArray(d)) errors.push("file is not a NeoKid Care backup object");
  else if (!Array.isArray(d.children)) errors.push("backup is missing the children array");
  else d.children.forEach((c, i) => { if (!c || !c.id || !c.name || !c.dob) errors.push(`child #${i + 1} is missing id/name/dob`); });
  const kids = (d && Array.isArray(d.children)) ? d.children : [];
  const stats = {
    children: kids.length,
    visits: kids.reduce((s, c) => s + ((c.visits || []).length), 0),
    measures: kids.reduce((s, c) => s + ((c.measures || []).length), 0),
    vaccines: kids.reduce((s, c) => s + Object.keys(c.vaccines || {}).length, 0),
    asOf: (d && d.lastBackup) || "",
  };
  return { ok: errors.length === 0, errors: errors.slice(0, 5), stats };
}
function backupPreviewLine(st) {
  return `${st.children} children · ${st.visits} visits · ${st.measures} measurements · ${st.vaccines} vaccine entries${st.asOf ? ` · backup from ${st.asOf}` : ""}`;
}
function freshDb() {
  return {
    _sv: (typeof SCHEMA_V === "number" ? SCHEMA_V : 1), // record schema (see js/migrate.js)
    children: [], activeId: null, settings: { clinic: "", doctor: "", reg: "", addr: "" },
    msBand: null, gTab: "wt", appts: [], tokens: [], bills: [], users: [], audit: [], session: {},
  };
}
function buildDbFromBackup(d) {
  const out = Object.assign(freshDb(), d);
  out.children = (Array.isArray(d.children) ? d.children : []).map((c) => normalizeChild(Object.assign({}, c)));
  ["appts", "tokens", "bills", "users", "audit"].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!out.settings || typeof out.settings !== "object") out.settings = freshDb().settings;
  if (!out.session || typeof out.session !== "object") out.session = {};
  ensureMrns(out.children);
  try { if (typeof migrateDB === "function") migrateDB(out); } catch (e) {}
  return out;
}
// Single funnel for every restore path (JSON + encrypted): validate → confirm →
// stash fallback → clean-slate replace. Returns true only when data changed.
function applyBackupObject(d, label) {
  const v = validateBackup(d);
  if (!v.ok) { alert("Invalid backup — nothing was changed:\n" + v.errors.join("\n")); return false; }
  if (!confirm(`Replace ALL current data with this backup?\n${backupPreviewLine(v.stats)}\n\nYour current data is kept — Data → Undo last import rolls back.`)) return false;
  try { localStorage.setItem(LS_KEY + "_prev", JSON.stringify(DB)); } catch (_) {}
  DB = buildDbFromBackup(d);
  if (!DB.children.some((c) => c.id === DB.activeId)) DB.activeId = (DB.children[0] || {}).id || null;
  save(); syncChildPicker(); renderAll(); loadSettings();
  auditSafe("Import", `${label || "Backup"} restored (${DB.children.length} children)`);
  alert(`Backup restored — ${DB.children.length} children.`);
  return true;
}
function undoImportLine() {
  try {
    const p = JSON.parse(localStorage.getItem(LS_KEY + "_prev") || "null");
    if (p && Array.isArray(p.children)) return `Pre-import fallback available (${p.children.length} children) — one mistaken restore can be rolled back.`;
  } catch (e) {}
  return "";
}
function undoLastImport() {
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(LS_KEY + "_prev") || "null"); } catch (e) {}
  if (!prev || !Array.isArray(prev.children)) return alert("No pre-import fallback found — nothing to undo.");
  if (!confirm(`Roll back to the data from just before the last import (${prev.children.length} children)? Current data will be replaced.`)) return;
  DB = buildDbFromBackup(prev);
  if (!DB.children.some((c) => c.id === DB.activeId)) DB.activeId = (DB.children[0] || {}).id || null;
  save(); syncChildPicker(); renderAll(); loadSettings();
  auditSafe("Import", "Undo last import");
  alert("Rolled back to pre-import data.");
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      applyBackupObject(JSON.parse(r.result), "JSON backup");
    } catch { alert("Invalid backup file — nothing was changed."); }
  };
  r.readAsText(f); e.target.value = "";
}
function factoryReset() {
  if (!confirm("Delete ALL children, vaccines, growth & notes? Export a backup first!")) return;
  if (!confirm("Really wipe everything?")) return;
  try { localStorage.removeItem(LS_KEY); } catch (e) { MEM_FALLBACK = null; }
  location.reload();
}

/* ---------------- Modals / print / render ---------------- */
function openModal(id) { $(id).classList.add("open"); }
function closeModal(id) { $(id).classList.remove("open"); }
document.querySelectorAll(".modal-bg").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("open"); }));
/* Direct browser-print support (Ctrl+P / phone Print menu): mark the visible
   page for printing when the dialog opens, and always clear the mark after —
   so a print never comes out blank and never repeats a stale page. */
let _autoPrint = false;
function autoPrintPrep() {
  try { document.querySelectorAll(".card[data-fold].folded").forEach((el) => el.classList.remove("folded")); } catch (e) {}
  try {
    if (document.querySelector(".page.printing")) return "kept";
    const act = document.querySelector(".page.active") || document.querySelector(".page");
    if (act && act.classList) { act.classList.add("printing"); _autoPrint = true; return "auto"; }
  } catch (e) {}
  return "none";
}
function autoPrintCleanup() {
  try { document.querySelectorAll(".page.printing").forEach((p) => { if (p && p.classList) p.classList.remove("printing"); }); } catch (e) {}
  try { if (typeof applyFolds === "function") applyFolds(); } catch (e) {}
  _autoPrint = false;
}
try { if (typeof window !== "undefined" && window.addEventListener) { window.addEventListener("beforeprint", autoPrintPrep); window.addEventListener("afterprint", autoPrintCleanup); } } catch (e) {}
function printPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("printing"));
  $(id).classList.add("printing");
  const go = () => { if (id === "pg-growth") setTimeout(() => window.print(), 150); else window.print(); };
  try {
    if (typeof Promise === "undefined") { go(); return; }
    // Wait for embedded images (e.g. the six growth charts) to decode before
    // opening the print dialog, so print preview never captures blank charts.
    const imgs = [...($(id).querySelectorAll("img") || [])].filter((im) => !im.complete);
    if (!imgs.length) { go(); return Promise.resolve(); }
    return Promise.race([
      Promise.all(imgs.map((im) => (typeof im.decode === "function" ? im.decode().catch(() => {}) : Promise.resolve()))),
      new Promise((res) => setTimeout(res, 1500)),
    ]).then(go, go);
  } catch (e) { go(); return Promise.resolve(); }
}
/* ---- v10.30.0: one canonical print + universal share bar ---- */
function shareBarHTML(pageId, contentId, label, srcPage) {
  const L = String(label || "document").replace(/["']/g, "");
  const S = String(srcPage || "").replace(/[^a-z-]/g, "");
  const b = (act, icon, txt, cls) => `<button class="btn ${cls} btn-xs" onclick="doShare('${act}','${pageId}','${contentId}','${L}','${S}')">${icon} ${txt}</button>`;
  return `<div class="sharebar no-print">` + (S ? b("back", "\u2039", "Back", "btn-o") : "") + `<span class="sharebar-t">Share:</span>`
    + b("print", "🖨️", "Print", "btn-p") + b("pdf", "📄", "PDF", "btn-o")
    + b("send", "📤", "Send", "btn-o") + b("wa", "🟢", "WhatsApp", "btn-o")
    + b("mail", "\u2709\uFE0F", "Email", "btn-o") + b("file", "\u2B07\uFE0F", "File", "btn-o") + `</div>`;
}
function shareTextFor(contentId, maxLen) {
  let t = "";
  try {
    const el = document.getElementById(contentId);
    t = el ? (el.innerText || el.textContent || "") : "";
  } catch (e) {}
  t = String(t).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  try {
    const s = (typeof DB !== "undefined" && DB.settings) || {};
    const c = (typeof child === "function" && child()) || {};
    const head = `${s.clinic || "NeoKid Care"}${c.name ? " \u00B7 " + c.name : ""}`;
    if (t.indexOf(head) !== 0) t = head + "\n" + t;
  } catch (e) {}
  const m = maxLen || 6000;
  return t.length > m ? t.slice(0, m - 1) + "\u2026" : t;
}
function downloadDocHTML(contentId, label) {
  try {
    const el = document.getElementById(contentId);
    if (!el) return false;
    const title = String(label || "document").replace(/["'<>]/g, "");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title} \u2014 NeoKid Care</title><style>body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;max-width:720px;margin:16px auto;padding:0 12px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:4px 6px;font-size:13px}img{max-width:100%}.sharebar,.no-print{display:none!important}</style></head><body>${el.innerHTML}</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url; a.download = title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() + ".html";
    document.body.appendChild(a); a.click();
    setTimeout(() => { try { URL.revokeObjectURL(url); a.remove(); } catch (e) {} }, 800);
    return true;
  } catch (e) { return false; }
}
function doShare(action, pageId, contentId, label, srcPage) {
  const L = label || "document";
  if (action !== "back") try { if (typeof auditSafe === "function") auditSafe("Export", `${L} \u2014 shared (${action})`); } catch (e) {}
  try {
    if (action === "back") { try { go(srcPage || "dashboard"); } catch (e) {} return true; }
    if (action === "print" || action === "pdf") {
      if (action === "pdf" && typeof toast === "function") toast("In the dialog, choose \u201CSave as PDF\u201D as the printer.");
      printPage(pageId);
      return true;
    }
    if (action === "send" && typeof navigator !== "undefined" && navigator.share) {
      navigator.share({ title: `${L} \u2014 NeoKid Care`, text: shareTextFor(contentId) }).catch(() => {});
      return true;
    }
    if (action === "send") { if (typeof toast === "function") toast("System share is not available here \u2014 try WhatsApp or File."); return false; }
    if (action === "wa") {
      window.open("https://wa.me/?text=" + encodeURIComponent(shareTextFor(contentId)), "_blank");
      return true;
    }
    if (action === "mail") {
      window.location.href = `mailto:?subject=${encodeURIComponent(`${L} \u2014 NeoKid Care`)}&body=${encodeURIComponent(shareTextFor(contentId, 1800))}`;
      return true;
    }
    if (action === "file") {
      if (downloadDocHTML(contentId, L)) { if (typeof toast === "function") toast("File saved \u2014 open it in any browser."); return true; }
      if (typeof toast === "function") toast("Could not save the file on this device.");
      return false;
    }
  } catch (e) { if (typeof toast === "function") toast("Share did not go through \u2014 please retry."); }
  return false;
}
function renderShareBars() {
  try {
    const vx = document.getElementById("vxShare");
    if (vx) vx.innerHTML = shareBarHTML("pg-vaccines", "vacPrint", "Vaccination record");
    const vs = document.getElementById("vsShare");
    if (vs) vs.innerHTML = shareBarHTML("pg-visits", "visitList", "Visit notes");
  } catch (e) {}
}
function previewPage(id) {
  // Screen-first preview: show the print page in the app WITHOUT opening the
  // print dialog. The share bar on the preview offers Print/PDF + Back.
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("printing"));
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $(id).classList.add("printing");
  $(id).classList.add("active");
  try { window.scrollTo({ top: 0 }); } catch (e) {}
  try { if (typeof renderShareBars === "function") renderShareBars(); } catch (e) {}
}
function callRender(name) {
  try {
    const f = (typeof window !== "undefined" && window[name]) || null;
    if (typeof f === "function") f();
  } catch (e) { if (typeof console !== "undefined" && console.error) console.error("NeoKid Care render failed: " + name, e); } /* LOGGING POLICY: console.error for render faults only (page name + exception). Never log patient data — see docs/OPERATIONS.md. */
}
function renderAll() {
  try { if (typeof ensureDoctors === "function") ensureDoctors(); } catch (e) {}
  if (!child() && DB.children.length) DB.activeId = DB.children[0].id;
  DB.appts = DB.appts || []; DB.tokens = DB.tokens || []; DB.bills = DB.bills || []; DB.users = DB.users || []; DB.audit = DB.audit || []; DB.session = DB.session || {};
  try { syncChildPicker(); } catch (e) {}
  ["renderDashboard", "renderChildren", "renderMilestones", "renderVaccines", "renderGrowth", "renderVisits", "renderTimeline", "renderSchedule", "renderAnalytics", "renderCard", "renderEmergency", "renderRx", "renderFront", "renderUsers", "renderNB", "renderNicu", "renderLabs", "renderAefi", "renderScreen", "renderDiet", "renderConsent", "renderHand", "renderStock", "renderDisplay", "renderDoctors", "renderExport", "applyRole", "enforceLock", "renderPatientHeaders"].forEach(callRender);
  try { applyFolds(); } catch (e) {}
}
window.addEventListener("resize", () => drawGrowthChart());

/* ---------------- Init ---------------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; const b = document.getElementById("installAppBtn"); if (b) b.style.display = ""; });
function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.then(() => { deferredInstall = null; const b = document.getElementById("installAppBtn"); if (b) b.style.display = "none"; }); }
  else alert("To install: browser menu → Install app / Add to Home Screen.");
}
function applyRefVersions() {
  let n = 0;
  try { document.querySelectorAll("[data-vaxver]").forEach((el) => { el.textContent = VAX_SCHEDULE_VERSION; n++; }); } catch (e) {}
  return n;
}
load(); loadSettings(); syncChildPicker(); applyTheme(); applyGlass(); applyMotion(); applyPrintMode(); applyNavMini(); renderBrand(); applyRefVersions(); renderAll();

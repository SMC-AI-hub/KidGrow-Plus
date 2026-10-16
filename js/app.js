/* ================= KidGrow Pro — App logic ================= */
const LS_KEY = "kidgrow_pro_v1";
const $ = (id) => document.getElementById(id);
const uid = () => "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => { if (!iso) return "—"; const d = new Date(iso + "T00:00:00"); return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); };
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

function ageBetween(dobISO, onISO) {
  const b = new Date(dobISO + "T00:00:00"), o = new Date((onISO || todayISO()) + "T00:00:00");
  let y = o.getFullYear() - b.getFullYear(), m = o.getMonth() - b.getMonth(), d = o.getDate() - b.getDate();
  if (d < 0) { m--; d += new Date(o.getFullYear(), o.getMonth(), 0).getDate(); }
  if (m < 0) { y--; m += 12; }
  const days = Math.max(0, Math.round((o - b) / 86400000));
  return { y, m, d, days, months: days / 30.4375 };
}
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
  if (!c.nicu || typeof c.nicu !== "object") c.nicu = { admissions: [] };
  if (!Array.isArray(c.nicu.admissions)) c.nicu.admissions = [];
  if (!Array.isArray(c.mar)) c.mar = [];
  if (!c.dental || typeof c.dental !== "object") c.dental = {};
  if (!c.diet || typeof c.diet !== "object") c.diet = { type: "veg" };
  if (!c.asthma || typeof c.asthma !== "object") c.asthma = { pef: [], triggers: [] };
  if (!Array.isArray(c.asthma.pef)) c.asthma.pef = [];
  if (!Array.isArray(c.asthma.triggers)) c.asthma.triggers = [];
  return c;
}
function child() { return normalizeChild(DB.children.find((c) => c.id === DB.activeId) || DB.children[0] || null); }

/* ================= PATIENT HEADER (unified, every clinical screen) ================= */
const PH_SLOTS = ["visits", "timeline", "rx", "vaccines", "growth", "labs", "aefi", "nicu", "mar", "nb", "screen", "diet", "consent"];
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
function setActive(id) { DB.activeId = id; DB.msBand = null; save(); syncChildPicker(); renderAll(); }

/* ---------------- Demo seed ---------------- */
function seedDemo() {
  const dob = "2025-01-15";
  const c = {
    id: uid(), name: "Aarav Sharma", sex: "boy", dob, blood: "B+", birthWt: 2.9, gest: 39,
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
  ["DTP2", "IPV2", "HIB2", "ROTA2", "PCV2"].forEach((k) => (c.vaccines[k] = V("2025-03-26")));
  ["DTP3", "IPV3", "HIB3", "ROTA3", "PCV3"].forEach((k) => (c.vaccines[k] = V("2025-04-23")));
  c.vaccines["HEPB3"] = V("2025-07-15"); c.vaccines["FLU1"] = V("2025-07-15"); c.vaccines["FLU2"] = V("2025-08-14");
  c.vaccines["MMR1"] = V("2025-10-15"); c.vaccines["TCV1"] = V("2025-10-15"); c.vaccines["VITA1"] = { date: "2025-10-15", batch: "", site: "Oral", by: "Nurse", aer: "", note: "" };
  c.vaccines["HEPA1"] = V("2026-01-15");
  c.vaccines["MMR2"] = V("2026-04-15"); c.vaccines["VAR1"] = V("2026-04-15"); c.vaccines["PCVB"] = V("2026-04-15");
  const BR = (codes, brand, mfr) => codes.forEach((k) => { if (c.vaccines[k]) { c.vaccines[k].brand = brand; c.vaccines[k].mfr = mfr; } });
  BR(["BCG", "OPV0"], "Govt. UIP supply", "Govt. of India");
  BR(["HEPB-B"], "Genevac-B", "Serum Institute");
  BR(["DTP1", "IPV1", "HIB1", "HEPB2", "DTP2", "IPV2", "HIB2", "DTP3", "IPV3", "HIB3"], "Hexaxim", "Sanofi");
  BR(["ROTA1", "ROTA2", "ROTA3"], "Rotavac", "Bharat Biotech");
  BR(["PCV1", "PCV2", "PCV3", "PCVB"], "Prevenar 13", "Pfizer");
  BR(["HEPB3"], "Engerix-B", "GSK");
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
  ["DTP2", "IPV2", "HIB2", "ROTA2", "PCV2"].forEach((k) => (c2.vaccines[k] = V2("2026-03-31")));
  ["DTP3", "IPV3", "HIB3", "ROTA3", "PCV3"].forEach((k) => (c2.vaccines[k] = V2("2026-04-28")));
  c2.vaccines["HEPB3"] = V2("2026-07-21");
  const BR2 = (codes, brand, mfr) => codes.forEach((k) => { if (c2.vaccines[k]) { c2.vaccines[k].brand = brand; c2.vaccines[k].mfr = mfr; } });
  BR2(["BCG", "OPV0", "HEPB-B"], "Govt. UIP supply", "Govt. of India");
  BR2(["DTP1", "IPV1", "HIB1", "HEPB2", "DTP2", "IPV2", "HIB2", "DTP3", "IPV3", "HIB3"], "EasySix", "Panacea Biotec");
  BR2(["ROTA1", "ROTA2", "ROTA3"], "Rotavac", "Bharat Biotech");
  BR2(["PCV1", "PCV2"], "Pneumosil", "Serum Institute");
  BR2(["HEPB3"], "Genevac-B", "Serum Institute");
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
  DB.settings = { clinic: "Smile Child Care Clinic", doctor: "Dr. A. Sharma, MD (Paediatrics)", reg: "TNMC 12345", addr: "12 Anna Nagar, Coimbatore · ☎ 0422-4001234" };
}

/* ---------------- Navigation ---------------- */
const TITLES = { dashboard: "Dashboard", children: "Children", nb: "Newborn Care", schedule: "Schedule & Reminders", milestones: "Milestone Assessment", vaccines: "Vaccination Digital Record", card: "Digital Vaccine Card", aefi: "AEFI Register", growth: "Growth Assessment (IAP / WHO)", labs: "Labs & Anaemia", screen: "Screening Suite", diet: "Diet Planner", hand: "Parent Handouts", visits: "Visits & Clinical Notes", timeline: "Patient Timeline", rx: "Prescription", consent: "E-Consent", nicu: "NICU", mar: "eMAR", calc: "Calculators", mrd: "MRD Registers", formulary: "Formulary Review", front: "Frontdesk — Tokens & Billing", analytics: "Clinic Analytics", emg: "Emergency Ready-Reckoner", reports: "Reports & Certificates", export: "Data & Exports", users: "Users & Audit", settings: "Settings", stock: "Vaccine Stock & Ledger", display: "Token Display" };
const RENDER_FOR = { dashboard: "renderDashboard", children: "renderChildren", nb: "renderNB", schedule: "renderSchedule", milestones: "renderMilestones", vaccines: "renderVaccines", card: "renderCard", aefi: "renderAefi", growth: "renderGrowth", labs: "renderLabs", screen: "renderScreen", diet: "renderDiet", hand: "renderHand", visits: "renderVisits", timeline: "renderTimeline", rx: "renderRx", consent: "renderConsent", nicu: "renderNicu", mar: "renderMar", calc: "renderCalc", mrd: "renderMrd", formulary: "renderFormulary", front: "renderFront", analytics: "renderAnalytics", emg: "renderEmergency", export: "renderExport", users: "renderUsers", stock: "renderStock", display: "renderDisplay" };
function go(page) {
  if (typeof roleBlock === "function" && roleBlock(page)) { alert("🔒 Your role cannot open this page."); return; }
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  $("pg-" + page).classList.add("active");
  document.querySelectorAll("#sideNav button, #mobNav button").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("pageTitle").textContent = TITLES[page] || page;
  try { history.replaceState(null, "", "#" + page); } catch (e) {}
  if (typeof callRender === "function" && RENDER_FOR[page]) callRender(RENDER_FOR[page]);
  if (page === "growth") setTimeout(drawGrowthChart, 60);
  window.scrollTo({ top: 0 });
}
document.querySelectorAll("#sideNav button, #mobNav button").forEach((b) => b.addEventListener("click", () => go(b.dataset.page)));

/* ---------------- Theme + sidebar ---------------- */
function applyTheme() {
  let t = (DB.settings || {}).theme;
  if (!t) { try { t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; } catch (e) { t = "light"; } }
  document.documentElement.dataset.theme = t;
  const b = document.getElementById("themeToggle"); if (b) b.textContent = t === "dark" ? "☀️" : "🌙";
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === "dark" ? "#0a1424" : "#0e7c7b";
}
function toggleTheme() {
  DB.settings.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  save(); applyTheme();
}
function renderBrand() {
  const s = DB.settings || {};
  const nm = $("brandName"), sb = $("brandSub"), lg = $("brandLogo");
  if (nm) nm.textContent = s.clinic || "KidGrow Pro";
  if (sb) { const ld = (typeof letterDoc === "function") ? letterDoc() : { name: s.doctor || "" }; sb.textContent = ld.name || s.addr || "Pediatric Suite · IAP"; }
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
  DB.settings.navMini = !document.body.classList.contains("nav-mini");
  save(); applyNavMini();
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
    $("clinicLine").textContent = (DB.settings.clinic || "KidGrow Pro Clinic") + (DB.settings.doctor ? " · " + DB.settings.doctor : "");
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
  openModal("mChild");
}
function saveChild() {
  if (typeof guardSubmit === "function" && !guardSubmit("child")) return; // M4: no duplicate registrations
  const name = $("cName").value.trim(), dob = $("cDob").value;
  if (!name || !dob) return alert("Name and date of birth are required.");
  if (dob > todayISO()) return alert("Date of birth cannot be in the future.");
  const id = $("cId").value;
  const data = { name, sex: $("cSex").value, dob, blood: $("cBlood").value, birthWt: parseFloat($("cBirthWt").value) || "", gest: $("cGest").value, birthLen: parseFloat($("cBirthLen").value) || "", birthHC: parseFloat($("cBirthHC").value) || "", father: $("cFather").value.trim(), mother: $("cMother").value.trim(), fHt: parseFloat($("cFHt").value) || "", mHt: parseFloat($("cMHt").value) || "", phone: $("cPhone").value.trim(), abha: $("cAbha").value.trim(), ped: $("cPed").value.trim(), allergy: $("cAllergy").value.trim() };
  if (id) { const ex = DB.children.find((x) => x.id === id); if (ex) normalizeChild(Object.assign(ex, data)); }
  else DB.children.push(normalizeChild(Object.assign({ id: uid(), created: todayISO() }, data)));
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
function renderChildren() {
  const q = ($("childSearch").value || "").toLowerCase();
  const box = $("childCards"); box.innerHTML = "";
  const list = DB.children.filter((c) => c.name.toLowerCase().includes(q));
  if (!list.length) { box.innerHTML = `<div class="card" style="grid-column:1/-1"><div class="empty"><div class="big">🧒</div>No children found. Register your first child to begin.</div></div>`; return; }
  list.forEach((c) => {
    const a = ageBetween(c.dob);
    const vac = vaccineSummary(c);
    const div = document.createElement("div"); div.className = "card";
    div.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">
        <div class="avatar" style="width:48px;height:48px;font-size:18px">${esc(c.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase())}</div>
        <div><b style="font-size:16px;color:var(--navy)">${esc(c.name)}</b><br>
        <span style="font-size:12.5px;color:var(--muted)">${c.sex === "boy" ? "♂ Boy" : "♀ Girl"} · ${ageStr(a)} · DOB ${fmtDate(c.dob)}</span></div>
      </div>
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
function renderVaccines() {
  const c = child(); if (!c) return;
  const s = vaccineSummary(c);
  $("vacBar").style.width = s.pct + "%"; $("vacPct").textContent = `${s.done}/${s.total} (${s.pct}%)`;
  let al = "";
  if (s.overdue) al += `<div class="alert a-red">⚠️ <div><b>${s.overdue} vaccine(s) overdue.</b> Please schedule catch-up at the earliest. IAP: no need to restart a series — continue from where it stopped, keeping minimum intervals.</div></div>`;
  if (s.next) al += `<div class="alert a-blue">📅 <div><b>Next:</b> ${esc(s.next.v.label)} visit — due <b>${fmtDate(s.next.due)}</b> (${esc(s.next.v.vaccines.filter((x) => !c.vaccines[x.code]).map((x) => x.code).join(", "))}).</div></div>`;
  else al += `<div class="alert a-green">✅ <div><b>Schedule complete</b> till 10–12 y. Continue annual influenza & adolescent boosters as advised.</div></div>`;
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
  const rec = (aer) => ({ date: $("vDate").value, brand: bm.brand, mfr: bm.mfr, batch: $("vBatch").value.trim(), site: $("vSite").value.trim(), by: $("vBy").value.trim(), aer, note: $("vNote").value.trim() });
  const _newVx = [];
  if (!c.vaccines[code]) _newVx.push(code);
  c.vaccines[code] = rec($("vAer").value.trim());
  document.querySelectorAll(".vSib:checked").forEach((cb) => { if (!c.vaccines[cb.value]) _newVx.push(cb.value); c.vaccines[cb.value] = rec(""); });
  if (typeof stockDeduct === "function") _newVx.forEach((cd) => stockDeduct(cd, bm.brand, $("vBatch").value.trim(), c.name));
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
  $("xDelBtn").style.display = x ? "" : "none";
  openModal("mExtra");
}
function saveExtra() {
  const c = child(); c.extraVac = c.extraVac || [];
  if (!$("xName").value.trim() || !$("xDate").value) return alert("Vaccine name and date are required.");
  const bm = matchBrand(null, $("xBrand").value, $("xMfr").value);
  const x = { id: $("xId").value || uid(), name: $("xName").value.trim(), brand: bm.brand, mfr: bm.mfr, date: $("xDate").value, batch: $("xBatch").value.trim(), by: $("xBy").value.trim(), note: $("xNote").value.trim() };
  const i = c.extraVac.findIndex((v) => v.id === x.id);
  if (i >= 0) c.extraVac[i] = x; else c.extraVac.push(x);
  if (i < 0 && typeof stockDeduct === "function") stockDeduct(null, x.brand, x.batch, c.name + " · " + x.name);
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
  let verdict, cls;
  if (!scored) { verdict = "Not yet assessed — complete this band during the visit."; cls = "a-blue"; }
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
  openModal("mVisit");
}
function saveVisit() {
  const c = child();
  if (!$("vsDate").value) return alert("Date required.");
  const v = { id: $("vsId").value || uid(), date: $("vsDate").value, type: $("vsType").value, subj: $("vsSubj").value.trim(), obj: $("vsObj").value.trim(), plan: $("vsPlan").value.trim() };
  if (typeof voiceData === "function" && voiceData()) v.voice = voiceData();
  const i = c.visits.findIndex((x) => x.id === v.id);
  if (i >= 0) c.visits[i] = v; else c.visits.push(v);
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
function renderDashboard() {
  const c = child();
  if (!c) { $("dashStats").innerHTML = ""; const hz = $("dashHero"); if (hz) hz.innerHTML = ""; return; }
  const a = ageBetween(c.dob), vs = vaccineSummary(c), lm = latestMeasure(c);
  const bi = bandForAge(a.months), b = MILESTONES[bi];
  let ach = 0; b.items.forEach((_, ii) => { if (c.milestones[bi + "_" + ii] === "A") ach++; });
  $("dashChildTag").textContent = `${c.name} · ${ageStr(a)}`;
  { const hz = $("dashHero");
    if (hz) { const _S = DB.settings || {}, logoHtml = _S.logo ? `<img src="${_S.logo}" alt="clinic logo">` : `<span class="ph">👶</span>`; const hr = new Date().getHours(), greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
      hz.innerHTML = `<div class="hero-top"><div class="hero-logo">${logoHtml}</div><div><div class="hero-eyebrow">${esc(fmtDate(todayISO()))} · ${esc((DB.settings || {}).clinic || "KidGrow Pro")}</div>
        <h2>${greet}, ${esc(greetName())} 👋</h2>
        <div class="hero-sub">Active child: <b>${esc(c.name)}</b> · ${esc(ageStr(a))} · 💉 ${vs.done}/${vs.total} vaccines${vs.overdue ? ` · <b>${vs.overdue} overdue</b>` : ""}</div></div></div>
        <div class="hero-actions"><button class="btn btn-p btn-sm" onclick="openGrowthModal()">+ Record growth</button>
        <button class="btn btn-o btn-sm" onclick="openVisitModal()">+ Visit note</button>
        <button class="btn btn-o btn-sm" onclick="openApptModal()">+ Book visit</button>
        <button class="btn btn-o btn-sm" onclick="go('front')">🎟️ Frontdesk</button></div>`; } }
  const _role = myAppRole();
  const _clinicExtra = CLINICAL_ROLES.includes(_role)
    ? (clinicPulseHTML() + (typeof nicuCensusHTML === "function" ? nicuCensusHTML() : "") + (typeof marDueHTML === "function" ? marDueHTML() : "") + (typeof growthAlertsHTML === "function" ? growthAlertsHTML() : ""))
    : "";
  $("dashClinic").innerHTML = roleDashHTML(_role) + _clinicExtra;
  $("dashStats").innerHTML = `
    <div class="stat" style="--ac:var(--blue)"><div><div class="n">${ageStr(a)}</div><div class="l">Age · ${c.sex === "boy" ? "Boy" : "Girl"}</div></div><div class="e">🎂</div></div>
    <div class="stat" style="--ac:var(--teal)"><div><div class="n">${vs.done}/${vs.total}</div><div class="l">Vaccines · ${vs.pct}%</div></div><div class="e">💉</div></div>
    <div class="stat" style="--ac:var(--amber)"><div><div class="n">${ach}/${b.items.length}</div><div class="l">Milestones · ${esc(b.band)}</div></div><div class="e">🌟</div></div>
    <div class="stat" style="--ac:var(--green)"><div><div class="n">${lm ? lm.wt + " kg" : "—"}</div><div class="l">${lm ? "Wt · " + fmtDate(lm.date) : "No growth data"}</div></div><div class="e">⚖️</div></div>`;
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

/* ================= REPORTS ================= */
function clinicHeader() {
  const s = DB.settings || {};
  const ld = (typeof letterDoc === "function") ? letterDoc() : { name: s.doctor || "", qual: "", reg: s.reg || "" };
  const logo = s.logo ? `<img src="${s.logo}" alt="logo" class="report-logo" onerror="this.style.display='none'">` : `<div style="font-size:40px">👶</div>`;
  return `<div class="report-head">${logo}<div><div class="clinic">${esc(s.clinic || "KidGrow Pro Clinic")}</div>
  <div style="font-size:13px;color:var(--muted)">${esc(ld.name)}${ld.qual ? ", " + esc(ld.qual) : ""} ${ld.reg ? "· Reg: " + esc(ld.reg) : ""}<br>${esc(s.addr || "")}</div></div>
  <div style="margin-left:auto;font-size:12px;color:var(--muted)">Generated ${fmtDate(todayISO())}</div></div>`;
}
function childHeader(c) {
  const a = ageBetween(c.dob);
  return `<dl class="kv" style="margin-bottom:14px">
    <dt>Child</dt><dd>${esc(c.name)} · ${c.sex === "boy" ? "Boy" : "Girl"} · ${ageStr(a)} (DOB ${fmtDate(c.dob)})</dd>
    <dt>Parents</dt><dd>${esc(c.father || "—")} · ${esc(c.mother || "—")} ${c.phone ? "· ☎ " + esc(c.phone) : ""}</dd>
    ${c.abha ? "<dt>ABHA</dt><dd>" + esc(c.abha) + "</dd>" : ""}
    <dt>Birth</dt><dd>${c.birthWt ? c.birthWt + " kg" : "—"} ${c.gest ? "· " + c.gest + " wk" : ""} ${c.blood ? "· Blood " + esc(c.blood) : ""}</dd>
    ${c.allergy ? `<dt>Alerts</dt><dd style="color:var(--red)">⚠ ${esc(c.allergy)}</dd>` : ""}</dl>`;
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
  <div class="footer-note">Screening summary generated by KidGrow Pro · IAP ACVIP 2023-24 / WHO–IAP growth references. Confirm borderline findings on official charts. &nbsp;&nbsp; Doctor signature & seal: ______________________</div>`;
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
  <div style="font-size:12.5px;color:var(--muted)">As per IAP ACVIP Immunization Timetable (routine use) · India</div></div>
  ${childHeader(c)}
  <table class="tbl">${`<tr><th>Due visit</th><th>Vaccine</th><th>Brand</th><th>Date given</th><th>Batch</th><th>✓</th></tr>`}${rows}${exRows}</table>
  <div style="display:flex;gap:30px;margin-top:26px;font-size:13px"><div>Parent signature: ______________</div><div style="margin-left:auto;text-align:center">Doctor signature & seal<br><br>______________<br><span style="font-size:11px;color:var(--muted)">${esc(DB.settings.doctor || "")}</span></div></div>
  <div class="footer-note">Keep this record safe — required for school admission & travel. In case of missed doses, consult your paediatrician for catch-up (no need to restart series).</div>`;
  printPage("pg-cert");
}

/* ================= SETTINGS / DATA ================= */
function saveSettings() {
  const lm = document.getElementById("sLockMins");
  DB.settings = Object.assign({}, DB.settings, { clinic: $("sClinic").value.trim(), doctor: $("sDoctor").value.trim(), reg: $("sReg").value.trim(), addr: $("sAddr").value.trim(), lockMins: lm ? lm.value.trim() : ((DB.settings || {}).lockMins || "15") });
  save(); syncChildPicker(); renderBrand(); alert("Clinic profile saved.");
}
function loadSettings() { const s = DB.settings || {}; $("sClinic").value = s.clinic || ""; $("sDoctor").value = s.doctor || ""; $("sReg").value = s.reg || ""; $("sAddr").value = s.addr || ""; const slm = $("sLockMins"); if (slm) slm.value = s.lockMins || "15"; const pv = $("logoPrev"); if (pv) { pv.style.display = s.logo ? "" : "none"; if (s.logo) pv.src = s.logo; } const li = $("sLogo"); if (li) li.value = ""; }
function exportData() {
  DB.lastBackup = todayISO(); save();
  const blob = new Blob([JSON.stringify(DB, null, 2)], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `kidgrow-backup-${todayISO()}.json`; a.click();
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.children)) throw 0;
      d.children.forEach(normalizeChild);
      if (!confirm(`Replace ALL current data with this backup (${d.children.length} children)? Your current data is kept as an emergency fallback.`)) return;
      try { localStorage.setItem(LS_KEY + "_prev", JSON.stringify(DB)); } catch (_) {}
      DB = Object.assign(DB, d);
      if (!DB.children.some((c) => c.id === DB.activeId)) DB.activeId = (DB.children[0] || {}).id || null;
      save(); syncChildPicker(); renderAll(); loadSettings();
      alert(`Backup restored — ${DB.children.length} children.`);
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
function printPage(id) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("printing"));
  $(id).classList.add("printing");
  if (id === "pg-growth") setTimeout(() => window.print(), 150); else window.print();
}
function callRender(name) {
  try {
    const f = (typeof window !== "undefined" && window[name]) || null;
    if (typeof f === "function") f();
  } catch (e) { if (typeof console !== "undefined" && console.error) console.error("KidGrow render failed: " + name, e); } /* LOGGING POLICY: console.error for render faults only (page name + exception). Never log patient data — see docs/OPERATIONS.md. */
}
function renderAll() {
  try { if (typeof ensureDoctors === "function") ensureDoctors(); } catch (e) {}
  if (!child() && DB.children.length) DB.activeId = DB.children[0].id;
  DB.appts = DB.appts || []; DB.tokens = DB.tokens || []; DB.bills = DB.bills || []; DB.users = DB.users || []; DB.audit = DB.audit || []; DB.session = DB.session || {};
  try { syncChildPicker(); } catch (e) {}
  ["renderDashboard", "renderChildren", "renderMilestones", "renderVaccines", "renderGrowth", "renderVisits", "renderTimeline", "renderSchedule", "renderAnalytics", "renderCard", "renderEmergency", "renderRx", "renderFront", "renderUsers", "renderNB", "renderLabs", "renderAefi", "renderScreen", "renderDiet", "renderConsent", "renderHand", "renderStock", "renderDisplay", "renderDoctors", "renderExport", "applyRole", "enforceLock", "renderPatientHeaders"].forEach(callRender);
}
window.addEventListener("resize", () => drawGrowthChart());

/* ---------------- Init ---------------- */
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; const b = document.getElementById("installAppBtn"); if (b) b.style.display = ""; });
function installApp() {
  if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.then(() => { deferredInstall = null; const b = document.getElementById("installAppBtn"); if (b) b.style.display = "none"; }); }
  else alert("To install: browser menu → Install app / Add to Home Screen.");
}
load(); loadSettings(); syncChildPicker(); applyTheme(); applyNavMini(); renderBrand(); renderAll();

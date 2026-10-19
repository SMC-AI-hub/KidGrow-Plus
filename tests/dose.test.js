// NeoKid Care — Phase 3 decision-support suite. Same full-boot harness as
// exam.test.js (ALL scripts in index.html order), then asserts: formulary +
// labs packs, weight bands, allergy/contra/interaction/duplicate checks,
// labs flags, growth red-flags, EMG allergy cross-check, MAR five-rights,
// and the ageMonths() repair. Use: node tests/dose.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }

const html = fs.readFileSync(path.join(R, "index.html"), "utf8");
const IDS = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
function ctxStub() {
  return new Proxy({ canvas: null, measureText: () => ({ width: 10 }) }, {
    get(t, p) { if (p in t) return t[p]; if (typeof p === "string") return (...a) => undefined; return undefined; },
    set() { return true; },
  });
}
function makeEl(tag, id) {
  const el = {
    tagName: String(tag || "div").toUpperCase(), children: [], style: {}, dataset: {},
    value: "", id: id || "", className: "", width: 300, height: 150, _html: "", _text: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { el.children.push(c); return c; }, append() {}, prepend() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementsByTagName() { return []; }, getElementsByClassName() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
    closest() { return null; }, matches() { return false; }, contains() { return false; },
    click() {}, focus() {}, blur() {}, select() {}, scrollIntoView() {},
    getContext() { return ctxStub(); },
    toDataURL() { return "data:image/png,KGTEST"; },
  };
  Object.defineProperty(el, "innerHTML", { get: () => el._html, set: (v) => { el._html = String(v); } });
  Object.defineProperty(el, "textContent", { get: () => el._text, set: (v) => { el._text = String(v); } });
  return new Proxy(el, { get(t, p) { return p in t ? t[p] : undefined; }, set(t, p, v) { t[p] = v; return true; } });
}
const elCache = {};
const store = {};
const sb = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  TextEncoder, TextDecoder,
  alert: () => {}, confirm: () => false, prompt: () => null,
  requestAnimationFrame: (f) => setTimeout(f, 0),
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
  },
  location: { hash: "", href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "" },
  navigator: { onLine: true, userAgent: "node-dosetest" },
  history: { replaceState() {}, pushState() {} },
  screen: { width: 1280, height: 800 },
  devicePixelRatio: 1,
  Blob: function () {}, FileReader: function () {},
  URL: { createObjectURL: () => "", revokeObjectURL() {} },
  ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  IntersectionObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  addEventListener() {}, removeEventListener() {},
  crypto: require("crypto").webcrypto,
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
};
sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.top = sb;
sb.document = {
  getElementById: (id) => (IDS.has(id) ? (elCache[id] || (elCache[id] = makeEl("div", id))) : null),
  createElement: (t) => makeEl(t),
  querySelector: (s) => {
    const m = /^#([\w-]+)$/.exec(s);
    if (m) return sb.document.getElementById(m[1]);
    if (s === ".content") return makeEl("div");
    return null;
  },
  querySelectorAll: () => [], body: makeEl("body"), head: makeEl("head"),
  addEventListener() {}, removeEventListener() {},
  documentElement: makeEl("html"), title: "",
};
vm.createContext(sb);
const RX = (expr) => vm.runInContext(expr, sb);

async function main() {
  const order = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
  let loadErr = "";
  for (const f of order) {
    try { vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f }); }
    catch (e) { loadErr += f + ": " + e.message + "\n"; }
  }
  ok(!loadErr, "all " + order.length + " scripts parse+boot" + (loadErr ? "\n" + loadErr : ""));
  const idx = (n) => order.indexOf(n);
  ok(idx("js/dose.js") > idx("js/drugs.js") && idx("js/dose.js") > idx("js/cdata.gen.js"), "dose.js loads after drugs + content");
  ok(idx("js/dose.js") > idx("js/hx.js"), "dose.js loads after hx.js");
  ok(fs.readFileSync(path.join(R, "sw.js"), "utf8").includes("./js/dose.js"), "SW shell caches js/dose.js");

  // ---- packs ----
  const K = sb.KGCONTENT || {};
  ok(K.formulary && K.formulary.version === "2026.1-p3" && /PENDING/.test(K.formulary.verification || ""), "formulary pack versioned + PENDING");
  ok(K.formulary.wtBands.length === 6, "formulary: 6 weight bands");
  ok(K.labs && K.labs.version === "2026.1-p3" && /PENDING/.test(K.labs.verification || ""), "labs pack versioned + PENDING");
  ok(K.labs.fields.crp.high === 100, "labs pack: CRP high threshold present");

  const D = sb.Dose;
  ok(D && typeof D.checkRx === "function", "Dose module present");

  // ---- self-consistency: every calculated dose inside its envelope ----
  const self = D.formularySelfCheck();
  ok(self.length > 10 && self.every((x) => x.ok), `formulary self-check all ok (${self.length} drugs)` + (self.filter((x) => !x.ok).map((x) => x.id + ":" + x.why).join(", ") || ""));

  // ---- weight bands ----
  ok(D.wtCheck(14, 24).length === 0, "toddler 14kg -> no flag");
  ok(D.wtCheck(30, 24).some((f) => f.tier === "warn"), "toddler 30kg -> warn");
  ok(D.wtCheck(90, 24).some((f) => f.tier === "hard"), "toddler 90kg -> HARD stop");
  ok(D.wtCheck(250, 24).some((f) => f.code === "WT-ABSURD"), "250kg -> absurd hard stop");
  ok(D.wtCheck(null, 24).length === 0 && D.wtCheck(0, 24).length === 0, "missing weight -> no flag (calcDose reports it)");

  // ---- mg/kg math follows the formulary (runtime-derived) ----
  const amox = RX(`drugById("amox")`);
  const mA = D.mgKg("amox", 15, "BD");
  const expDose = amox.perDay ? amox.mgkg / 2 : amox.mgkg;
  ok(mA && Math.abs(mA.perDose - expDose) < 1e-9 && Math.abs(mA.absMg - expDose * 15) < 1e-9, "mgKg tracks formulary amox entry");
  ok(D.mgKg("ors", 15, "OD") === null, "infoOnly drug -> null calc");

  // ---- hard-stop 1: anaphylaxis allergy match ----
  const anaChild = { name: "T", allergies: [{ agent: "Amoxicillin", severity: "Anaphylaxis" }] };
  const anaR = D.checkRx({ drugId: "amox", wtKg: 15, ageM: 24, freq: "BD", child: anaChild, draftItems: [] });
  ok(anaR.hard && anaR.flags.some((f) => f.tier === "hard" && f.code === "ALLERGY"), "anaphylaxis-history amox -> HARD allergy stop");
  const mildChild = { name: "T", allergies: [{ agent: "Amoxicillin", severity: "Mild" }] };
  const mildR = D.checkRx({ drugId: "amox", wtKg: 15, ageM: 24, freq: "BD", child: mildChild, draftItems: [] });
  ok(!mildR.hard && mildR.flags.some((f) => f.tier === "warn" && f.code === "ALLERGY"), "mild amox rash -> warn only");
  const penChild = { name: "T", allergies: [{ agent: "Penicillin", severity: "Severe" }] };
  ok(D.checkRx({ drugId: "aug", wtKg: 15, ageM: 24, freq: "BD", child: penChild, draftItems: [] }).flags.some((f) => f.code === "ALLERGY"), "penicillin allergy catches augmentin");
  ok(D.checkRx({ drugId: "para", wtKg: 15, ageM: 24, freq: "TDS", child: mildChild, draftItems: [] }).flags.filter((f) => f.code === "ALLERGY").length === 0, "amox allergy does not hit paracetamol");

  // ---- hard-stop 2: NSAID in dengue; asthma/G6PD warns ----
  const dengChild = { name: "T", visits: [{ date: RX("todayISO()"), icd: ["A90"] }] };
  const dengR = D.checkRx({ drugId: "ibu", wtKg: 15, ageM: 24, freq: "TDS", child: dengChild, draftItems: [] });
  ok(dengR.hard && dengR.flags.some((f) => f.code === "CONTRA-nsaid-dengue" && f.tier === "hard"), "ibuprofen + dengue A90 -> HARD stop");
  ok(D.checkRx({ drugId: "para", wtKg: 15, ageM: 24, freq: "TDS", child: dengChild, draftItems: [] }).hard === false, "paracetamol + dengue -> no hard stop");
  const astChild = { name: "T", visits: [{ date: RX("todayISO()"), icd: ["J45.9"] }] };
  ok(D.checkRx({ drugId: "ibu", wtKg: 15, ageM: 24, freq: "TDS", child: astChild, draftItems: [] }).flags.some((f) => f.code === "CONTRA-nsaid-asthma"), "ibuprofen + asthma -> warn");
  const g6Child = { name: "T", problems: [{ label: "G6PD deficiency", code: "D55.0", status: "active" }] };
  ok(D.checkRx({ drugId: "cotri", wtKg: 15, ageM: 24, freq: "BD", child: g6Child, draftItems: [] }).flags.some((f) => f.code === "CONTRA-cotri-g6pd"), "cotrimoxazole + G6PD -> warn");
  ok(D.checkRx({ drugId: "cotri", wtKg: 4, ageM: 1, freq: "BD", child: { name: "T" }, draftItems: [] }).flags.some((f) => f.code === "CONTRA-cotri-young"), "cotrimoxazole <2mo -> warn");

  // ---- QT interactions (draft-aware) ----
  const aziName = RX(`drugById("azi").name`);
  const ondaName = RX(`drugById("onda").name`);
  ok(D.checkRx({ drugId: "onda", wtKg: 15, ageM: 60, freq: "OD", child: { name: "T" }, draftItems: [{ drug: aziName }] }).flags.some((f) => f.code === "IX-qt-onda-azi"), "ondansetron + azithromycin draft -> QT warn");
  ok(D.checkRx({ drugId: "onda", wtKg: 15, ageM: 60, freq: "OD", child: { name: "T" }, draftItems: [] }).flags.filter((f) => /^IX-/.test(f.code)).length === 0, "ondansetron alone -> no interaction");

  // ---- duplicates: draft + recent Rx ----
  const paraName = RX(`drugById("para").name`);
  ok(D.checkRx({ drugId: "para", wtKg: 15, ageM: 24, freq: "TDS", child: { name: "T" }, draftItems: [{ drug: paraName }] }).flags.some((f) => f.code === "DUP-DRAFT"), "paracetamol already in draft -> warn");
  const rxChild = { name: "T", rx: [{ date: RX("todayISO()"), items: [{ drug: paraName }] }] };
  ok(D.checkRx({ drugId: "para", wtKg: 15, ageM: 24, freq: "TDS", child: rxChild, draftItems: [] }).flags.some((f) => f.code === "DUP-RECENT"), "paracetamol prescribed today -> recent-repeat warn");
  const oldChild = { name: "T", rx: [{ date: "2020-01-01", items: [{ drug: paraName }] }] };
  ok(D.checkRx({ drugId: "para", wtKg: 15, ageM: 24, freq: "TDS", child: oldChild, draftItems: [] }).flags.filter((f) => f.code === "DUP-RECENT").length === 0, "2020 paracetamol -> no recent warn");

  // ---- minimum age ----
  const ibu = RX(`drugById("ibu")`);
  if (ibu.ageMinM) {
    ok(D.checkRx({ drugId: "ibu", wtKg: 5, ageM: ibu.ageMinM - 1, freq: "TDS", child: { name: "T" }, draftItems: [] }).flags.some((f) => f.code === "AGE-MIN"), "ibuprofen below min age -> warn");
  } else { ok(true, "ibuprofen has no min age (skip)"); }

  // ---- clean prescription: zero flags ----
  ok(D.checkRx({ drugId: "para", wtKg: 15, ageM: 24, freq: "TDS", child: { name: "T" }, draftItems: [] }).flags.length === 0, "clean paracetamol -> zero flags");
  ok(D.checksHTML({ flags: [] }) === "", "empty checks -> empty HTML");
  ok(D.checksHTML({ flags: [{ tier: "hard", code: "X", text: "stop <b>now</b>" }] }).includes("⛔") && !D.checksHTML({ flags: [{ tier: "hard", code: "X", text: "stop <b>now</b>" }] }).includes("<b>now</b>"), "hard flag renders ⛔ + escapes text");

  // ---- labs ----
  ok(D.labFlags({ hb: 6 }).some((f) => f.code === "LAB-HB-CRIT"), "Hb 6 -> critical warn");
  ok(D.labFlags({ hb: 12 }).filter((f) => f.code === "LAB-HB-CRIT").length === 0, "Hb 12 -> no critical");
  ok(D.labFlags({ crp: 150 }).some((f) => f.code === "LAB-CRP-HIGH" && f.tier === "warn"), "CRP 150 -> high warn");
  ok(D.labFlags({ crp: 50 }).some((f) => f.code === "LAB-CRP-RAISED" && f.tier === "info"), "CRP 50 -> raised info");
  ok(D.crpLabel(150).indexOf("Markedly") === 0 && D.crpLabel(50).indexOf("Raised") === 0 && D.crpLabel(5) === "Normal" && D.crpLabel("") === "", "CRP labels");
  ok(D.labFlags({ b12: 150 }).some((f) => f.code === "LAB-B12-LOW"), "B12 150 -> warn");
  ok(D.labFlags({ vitD: 8 }).some((f) => f.code === "LAB-VITD-DEF"), "Vit D 8 -> deficient warn");
  ok(D.labFlags({ vitD: 15 }).some((f) => f.code === "LAB-VITD-INS"), "Vit D 15 -> insufficient info");
  ok(D.labFlags({ ferritin: 8 }).some((f) => f.code === "LAB-FER-LOW"), "ferritin 8 -> info");
  ok(D.labFlags({ mcv: 60 }).some((f) => /microcytic/.test(f.text)), "MCV 60 -> microcytic info");

  // ---- growth red-flags ----
  const gChild = (wt, ht) => ({ name: "T", dob: "2023-01-01", sex: "boy", measures: [{ id: "m1", date: "2026-01-01", wt: 12, ht: 85 }, { id: "m2", date: RX("todayISO()"), wt, ht }] });
  ok(D.growthFlags(gChild(12, 86)[0] ? gChild(12, 86) : null, { id: "m2", date: RX("todayISO()"), wt: 12, ht: 86 }).length === 0, "stable weight -> no flags");
  ok(D.growthFlags(gChild(11.5, 86), { id: "m2", date: RX("todayISO()"), wt: 11.5, ht: 86 }).some((f) => f.code === "GROW-LOSS" && !/Marked/.test(f.text)), "4% loss -> loss warn");
  ok(D.growthFlags(gChild(11, 86), { id: "m2", date: RX("todayISO()"), wt: 11, ht: 86 }).some((f) => /Marked weight loss/.test(f.text)), "8% loss -> marked warn");
  ok(D.growthFlags(gChild(12, 83), { id: "m2", date: RX("todayISO()"), wt: 12, ht: 83 }).some((f) => f.code === "GROW-HT"), "height drop -> recheck warn");

  // ---- EMG allergy cross-check ----
  ok(D.emgAllergyRows({ allergy: "penicillin rash" }).some((r) => /Amoxicillin/.test(r)), "penicillin text matches amox EMG row");
  ok(D.emgAllergyRows({ allergy: "" }).length === 0 && D.emgAllergyRows({}).length === 0, "no allergy text -> no EMG rows");
  ok(D.emgAllergyHTML({ allergy: "ibuprofen wheeze" }).includes("Emergency allergy"), "EMG banner renders");

  // ---- MAR five-rights ----
  const MP = sb.MarPure;
  ok(MP && typeof MP.fiveRights === "function", "MarPure.fiveRights present");
  const rxItem = [{ drug: RX(`drugById("amox").name`), take: "5 ml", strength: "250mg/5ml" }];
  const frOK = MP.fiveRights({ drug: rxItem[0].drug, dose: "5 ml", scheduledAt: "2026-10-19T08:00", status: "scheduled" }, rxItem, "2026-10-19T08:30");
  ok(frOK.filter((f) => f.tier === "warn").length === 0, "five-rights: on-time matching dose -> no warns");
  const frDose = MP.fiveRights({ drug: rxItem[0].drug, dose: "10 ml", scheduledAt: "2026-10-19T08:00", status: "scheduled" }, rxItem, "2026-10-19T08:30");
  ok(frDose.some((f) => f.code === "MAR-DOSE-DIFF"), "five-rights: dose mismatch -> warn");
  const frLate = MP.fiveRights({ drug: rxItem[0].drug, dose: "5 ml", scheduledAt: "2026-10-19T08:00", status: "scheduled" }, rxItem, "2026-10-19T11:30");
  ok(frLate.some((f) => f.code === "MAR-LATE"), "five-rights: 3.5h late -> warn");
  const frEarly = MP.fiveRights({ drug: rxItem[0].drug, dose: "5 ml", scheduledAt: "2026-10-19T08:00", status: "scheduled" }, rxItem, "2026-10-19T06:30");
  ok(frEarly.some((f) => f.code === "MAR-EARLY"), "five-rights: 1.5h early -> warn");
  const frStale = MP.fiveRights({ drug: rxItem[0].drug, dose: "5 ml", scheduledAt: "2026-10-17T08:00", status: "scheduled" }, rxItem, "2026-10-19T08:30");
  ok(frStale.some((f) => f.code === "MAR-STALE"), "five-rights: stale order -> warn");
  const frNoRx = MP.fiveRights({ drug: "Mystery med", dose: "1", scheduledAt: "2026-10-19T08:00", status: "scheduled" }, rxItem, "2026-10-19T08:30");
  ok(frNoRx.some((f) => f.code === "MAR-NO-RX" && f.tier === "info"), "five-rights: no Rx match -> info");

  // ---- ageMonths repair ----
  ok(Math.abs(sb.ageMonths("2024-01-01", "2026-01-01") - 24) < 0.05, "ageMonths 2y -> ~24");
  ok(Number.isFinite(sb.ageMonths("2026-01-01", "2026-10-19")), "ageMonths finite (was NaN via .years/.months)");

  console.log(`dose: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("FATAL:", e); process.exit(1); });

// NeoKid Care — Phase 7 labs/comms/safety suite. Full-boot harness (all scripts
// in index.html order), then asserts: labpanels pack, WBC/platelet/TSH flags,
// urine interpretation, Hb-recheck tracker, letter builders, consent types,
// Tanner verification, analytics additions, page wiring. Use: node tests/panels.test.js
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
  navigator: { onLine: true, userAgent: "node-panelstest" },
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

async function main() {
  const order = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
  let loadErr = "";
  for (const f of order) {
    try { vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f }); }
    catch (e) { loadErr += f + ": " + e.message + "\n"; }
  }
  ok(!loadErr, "all " + order.length + " scripts parse+boot" + (loadErr ? "\n" + loadErr : ""));

  // ---- pack ----
  const K = sb.KGCONTENT || {};
  ok(K.labpanels && K.labpanels.version === "2026.1-p7" && /PENDING/.test(K.labpanels.verification || ""), "labpanels pack versioned + PENDING");
  ok(K.labpanels.wbc.bands.length === 4 && K.labpanels.tsh.bands.length === 4, "WBC + TSH age bands present");
  ok(K.labpanels.platelet.lo === 150 && K.labpanels.platelet.hi === 450, "platelet range 150-450");

  const L = sb.LabX;
  ok(L && typeof L.wbc === "function", "LabX module present");

  // ---- WBC ----
  ok(L.wbc(5, 0, 20).sev === "green", "neonate WBC 20 in range");
  ok(L.wbc(5, 0, 35).sev === "amber" && /High/.test(L.wbc(5, 0, 35).label), "neonate WBC 35 high");
  ok(L.wbc(1100, 36, 8).sev === "green", "3y WBC 8 in range");
  ok(L.wbc(1100, 36, 25).sev === "amber", "3y WBC 25 high");
  ok(L.wbc(1100, 36, "") === null, "WBC empty -> null");

  // ---- platelets ----
  ok(L.plt(30).sev === "red" && /Critical/.test(L.plt(30).label), "plt 30 critical red");
  ok(L.plt(120).sev === "amber", "plt 120 low amber");
  ok(L.plt(200).sev === "green", "plt 200 green");
  ok(L.plt(600).sev === "amber", "plt 600 high amber");
  ok(L.plt(1200).sev === "red", "plt 1200 critical red");

  // ---- TSH ----
  ok(L.tsh(36, 3).sev === "green", "3y TSH 3 green");
  ok(L.tsh(36, 8).sev === "amber" && /High/.test(L.tsh(36, 8).label), "3y TSH 8 high");
  ok(L.tsh(36, 0.3).sev === "amber" && /Low/.test(L.tsh(36, 0.3).label), "3y TSH 0.3 low");
  ok(L.tsh(150, 5).sev === "amber", "teen TSH 5 above 4.3 band");

  // ---- urine ----
  const u = L.urine({ uProt: "2+", uLeu: "1+", uNit: "1+", uBld: "Negative", uGlu: "Negative", uKet: "Trace" });
  ok(u.some((x) => x.test === "protein") && u.some((x) => x.test === "uti" && x.sev === "red"), "urine: protein flagged + UTI combo red");
  ok(L.urine({ uProt: "Negative", uLeu: "Negative", uNit: "Negative", uBld: "Negative", uGlu: "Negative", uKet: "Negative" }).length === 0, "urine all negative -> silent");

  // ---- recheck tracker ----
  const rc = L.recheck([{ date: "2026-08-01", hb: "9.5" }], (am, h) => sb.hbClass(80, h), "2026-10-19");
  ok(rc.length === 1 && rc[0].band === "moderate" && rc[0].dueBy === "2026-08-29", "moderate anaemia Aug -> recheck due");
  ok(L.recheck([{ date: "2026-10-01", hb: "12.5" }], (am, h) => sb.hbClass(80, h), "2026-10-19").length === 0, "normal Hb -> no recheck");
  ok(L.recheck([], (am, h) => sb.hbClass(80, h), "2026-10-19").length === 0, "no labs -> no recheck");

  // ---- letters ----
  const kid = {
    name: "Letter Proof", sex: "girl", dob: "2020-01-01", allergy: "Penicillin rash",
    problems: [{ label: "Asthma", code: "J45.9", status: "active" }],
    measures: [{ date: "2026-10-01", wt: 18, ht: 110 }],
    labs: [{ date: "2026-10-01", hb: "11.5" }],
  };
  ok(/Active problems/.test(sb.Letters.summary(kid)) && /Latest Hb/.test(sb.Letters.summary(kid)), "auto summary covers problems + growth + Hb");
  const ref = sb.Letters.referral(kid, { to: "Pediatric Neurology, GH", urgency: "Urgent", reason: "Seizures", summary: "Two febrile seizures." });
  ok(ref.includes("Referral Letter") && ref.includes("Letter Proof") && ref.includes("URGENT") && ref.includes("Pediatric Neurology"), "referral builder");
  const fit = sb.Letters.cert(kid, { certType: "fitness", date: "2026-10-19" });
  ok(fit.includes("Fitness Certificate") && fit.includes("Letter Proof"), "fitness cert builder");
  const ill = sb.Letters.cert(kid, { certType: "illness", from: "2026-10-19", to: "2026-10-21", days: "3" });
  ok(ill.includes("advised rest") && ill.includes("3 days"), "illness cert builder");

  // ---- consent types ----
  const ctKeys = vm.runInContext("Object.keys(CONSENT_TYPES)", sb);
  ok(ctKeys.length === 8 && ctKeys.includes("sedation") && ctKeys.includes("transfusion") && ctKeys.includes("nicuproc"), "consent: 8 types incl sedation/transfusion/NICU");

  // ---- Tanner verification (pre-built, grounded: <8/<9, 13/14, menarche 15) ----
  const ti = sb.tannerInterpret;
  ok(typeof ti === "function", "tannerInterpret present");
  ok(ti({ dob: "2018-01-01", sex: "girl" }, { date: "2025-06-01", b: 2, ph: 2 }).t.includes("Precocious"), "7.4y girl B2 -> precocious");
  const del = ti({ dob: "2010-01-01", sex: "boy" }, { date: "2024-08-01", g: 1, ph: 1 });
  ok(del.t.includes("Delayed") && del.sev === "red", "14.6y boy G1 -> delayed red");
  ok(ti({ dob: "2014-01-01", sex: "girl" }, { date: "2025-06-01", b: 3, ph: 3 }).t.includes("normally"), "11.4y girl B3 -> normal");

  // ---- analytics additions ----
  const clinSrc = fs.readFileSync(path.join(R, "js/clinic.js"), "utf8");
  ok(clinSrc.includes("HRI defaulters") && clinSrc.includes("chronic flowsheets"), "analytics stats added");
  let anOK = false;
  try { sb.renderAnalytics(); anOK = (elCache.anStats._html || "").includes("HRI defaulters"); } catch (e) { anOK = "THREW: " + e.message; }
  ok(anOK === true, "renderAnalytics runs + shows HRI stat" + (anOK === true ? "" : " (" + anOK + ")"));

  // ---- page wiring ----
  ok(html.includes('data-page="letters"') && html.includes('id="pg-letters"') && html.includes('id="lettersBox"'), "letters nav + section + box");
  ok(fs.readFileSync(path.join(R, "sw.js"), "utf8").includes("./js/letters.js"), "SW shell caches letters.js");
  ok(fs.readFileSync(path.join(R, "js/app.js"), "utf8").includes('letters: "renderLetters"'), "RENDER_FOR has letters");
  ok(typeof sb.renderLetters === "function", "renderLetters global present");
  const syLetters = fs.readFileSync(path.join(R, "js", "letters.js"), "utf8");
  ok(syLetters.includes('<div class="grid g2 no-print">'), "letters form + saved list hidden on paper (no-print)");
  ok(html.includes('<div id="ph-letters" class="no-print">'), "letters page title hidden on paper");
  ok(syLetters.includes('<div class="card" style="margin-top:12px">${shareBarHTML'), "certificate card itself still prints");

  console.log(`panels: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("FATAL:", e); process.exit(1); });

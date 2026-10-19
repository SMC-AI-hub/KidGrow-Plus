// NeoKid Care — Phase 4a NICU-depth suite. Same full-boot harness as
// dose.test.js (ALL scripts in index.html order), then asserts: nicu pack,
// bilirubin lines (NICE CG98), rise-rate, fluid guide, sepsis days, bundle
// scoring, bed-board sort, resp/bili chips. Use: node tests/nicu.test.js
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
  navigator: { onLine: true, userAgent: "node-nicutest" },
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
  ok(K.nicu && K.nicu.version === "2026.1-p4a" && /PENDING/.test(K.nicu.verification || ""), "nicu pack versioned + PENDING");
  ok(K.nicu.biliTerm.length === 17 && K.nicu.mgdlToUmol === 17.1, "nicu: 17 bili rows + mg/dL factor");
  ok(K.nicu.fluids.term.length === 5 && K.nicu.fluids.preterm32_36.length === 4, "nicu: fluid tables present");
  ok(K.nicu.bundles.clabsi.items.length === 5 && K.nicu.bundles.uvc.items.length === 3, "nicu: CLABSI 5 + UVC 3 bundle items");
  ok(K.nicu.respModes.length === 6 && K.nicu.procedures.length > 5, "nicu: resp modes + procedure list");

  const NP = sb.NicuPure;
  ok(NP && typeof NP.biliFlag === "function" && typeof NP.fluidGuide === "function", "NicuPure depth fns present");

  // ---- DOL ----
  ok(NP.dolOf("2026-10-01", "2026-10-01") === 1, "DOL: birth day = 1");
  ok(NP.dolOf("2026-10-01", "2026-10-03") === 3, "DOL: +2 days = 3");
  ok(NP.dolOf("", "2026-10-03") === null, "DOL: missing dob -> null");

  // ---- bilirubin lines (NICE CG98 term table) ----
  const t48 = NP.biliThreshold(40, 48);
  ok(t48.photo === 250 && t48.exchange === 450 && t48.consider === 200, "term 48h: 200/250/450");
  const t24 = NP.biliThreshold(39, 24);
  ok(t24.photo === 200 && t24.exchange === 300, "term 24h: 200/300");
  const t100 = NP.biliThreshold(40, 100);
  ok(t100.photo === 350 && t100.exchange === 450, "term 100h: capped at 96+ row");
  const t0 = NP.biliThreshold(40, 0);
  ok(t0.photo === 100 && t0.exchange === 100, "term 0h: 100/100");
  const tp = NP.biliThreshold(35, 80);
  ok(tp.preterm === true && tp.photo === 250, "preterm 35wk 80h: GAx10-100 = 250");
  const tpEarly = NP.biliThreshold(35, 48);
  ok(tpEarly && /nomogram/.test(tpEarly.note || ""), "preterm <72h: unit-nomogram note, no line");
  ok(/gestation/i.test((NP.biliThreshold(null, 48) || {}).note || ""), "missing GA: record-gestation note");

  // ---- bilirubin flags (NICE uses strictly-greater-than) ----
  ok(NP.biliFlag(260, 40, 48).band === "photo" && NP.biliFlag(260, 40, 48).tier === "warn", "260 @48h: phototherapy warn");
  ok(NP.biliFlag(460, 40, 48).band === "exchange", "460 @48h: exchange band");
  ok(NP.biliFlag(250, 40, 48).band === "consider", "exactly 250 @48h: still consider (strict >)");
  ok(NP.biliFlag(160, 40, 48).band === "repeat", "160 @48h: repeat band");
  ok(NP.biliFlag(100, 40, 48) === null, "100 @48h: below all lines");
  ok(NP.biliFlag(300, 35, 48).tier === "info", "preterm <72h value: info note, no warn");

  // ---- rise rate ----
  const rr1 = NP.biliRise(200, 48, 260, 54);
  ok(rr1.rate === 10 && rr1.rapid === true, "rise 10/hr: rapid");
  const rr2 = NP.biliRise(200, 48, 220, 54);
  ok(Math.abs(rr2.rate - 3.3) < 0.01 && rr2.rapid === false, "rise 3.3/hr: not rapid");

  // ---- fluids ----
  const f1 = NP.fluidGuide(1, 40, 3);
  ok(f1.band === "term" && f1.lo === 50 && f1.hi === 60 && f1.totalLo === 150 && f1.totalHi === 180, "term D1 3kg: 50-60 -> 150-180 mL");
  const f3 = NP.fluidGuide(3, 40, 3);
  ok(f3.lo === 80 && f3.hi === 100, "term D3: 80-100");
  const fp = NP.fluidGuide(2, 34, 2);
  ok(fp.band === "preterm32_36" && fp.lo === 80 && fp.totalHi === 160, "preterm34 D2 2kg: 80 -> 160 mL");
  ok(/individualise/.test((NP.fluidGuide(1, 28, 1) || {}).note || ""), "<32wk: individualise note");

  // ---- sepsis days + bundles ----
  ok(NP.sepsisAbxDays("2026-10-01", "2026-10-03") === 3, "abx day count");
  const bs5 = NP.bundleScore("clabsi", { 0: true, 1: true, 2: true, 3: true, 4: true });
  ok(bs5.pct === 100 && bs5.misses.length === 0, "bundle 5/5: 100%");
  const bs3 = NP.bundleScore("clabsi", { 0: true, 2: true, 4: true });
  ok(bs3.pct === 60 && bs3.misses.length === 2, "bundle 3/5: 60% + misses");

  // ---- board + chips ----
  const sorted = NP.boardSort([
    { child: { name: "b" }, adm: { bed: "B2" } },
    { child: { name: "a" }, adm: {} },
    { child: { name: "c" }, adm: { bed: "A1" } },
  ]);
  ok(sorted.map((e) => e.child.name).join("") === "cba", "board sorts by bed, unbedded last");
  ok(NP.respLabel("cpap") === "CPAP" && NP.respRank("vent") === 5, "resp labels/ranks");
  ok(NP.roundRespChip({ resp: { mode: "cpap", fio2: "30" } }) === "CPAP 30%", "resp chip");
  ok(NP.roundRespChip({}) === "", "empty resp chip");
  ok(NP.roundBiliChip({ bili: { tsb: 15, unit: "mgdl", ageHrs: 49 } }, 40).includes("Bili 15@49h"), "bili chip mg/dL");
  ok(NP.roundBiliChip({ bili: { tsb: 15, unit: "mgdl", ageHrs: 49 } }, 40).includes("⚠️"), "bili chip warns over line (15mg/dL≈257>250)");

  // ---- old pures intact ----
  ok(NP.feedGuide(1, 3).mlPerKg === 20, "feedGuide unchanged");
  ok(NP.roundValid({ date: "2031-01-01" }, "2026-10-13").some((e) => /future/.test(e)), "roundValid unchanged");

  console.log(`nicu: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("FATAL:", e); process.exit(1); });

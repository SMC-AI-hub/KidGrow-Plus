// NeoKid Care — F25 automated validation cases (10 slots).
// Same full-boot harness as nicu.test.js (ALL scripts in index.html order).
// WHAT THIS PROVES: the bili builder implements its OWN coded table/formula
// correctly at boundaries (implementation-conformance). WHAT IT DOES NOT PROVE:
// clinical truth — the NICE CG98 values, the preterm formula, and mg/dL factor
// still need the F25 CLINICIAN sign-off on >=10 real cases. Use: node tests/f25-validation.test.js
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
  navigator: { onLine: true, userAgent: "node-f25test" },
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

  const K = sb.KGCONTENT || {};
  const NP = sb.NicuPure;
  ok(NP && typeof NP.biliFlag === "function" && typeof NP.biliThreshold === "function", "NicuPure bili fns present");
  ok(K.nicu && K.nicu.mgdlToUmol === 17.1 && K.nicu.biliStopBelow === 50, "pack: x17.1 + stop-below 50 constants");

  // Slot 1 DOCUMENTS a suspected bug: the >=72h preterm branch returns BOTH a photo
  // number AND a note, and biliFlag short-circuits on note -> info, so the formula line
  // NEVER raises photo/exchange flags (a 29wk baby at 400 gets no warning). Threshold
  // computes 190 (locked below); flags stay info until a clinician rules + code is fixed.
  const t1 = NP.biliThreshold(29, 80);
  ok(t1.preterm === true && t1.photo === 190 && t1.exchange === null, "slot1: 29wk/80h formula photo=190, exchange null");
  ok((NP.biliFlag(195, 29, 80) || {}).band === "info", "slot1-documents-suspected-bug: 195 -> info, photo flag never fires");
  ok((NP.biliFlag(400, 29, 80) || {}).band === "info", "slot1-documents-suspected-bug: 400 -> info, no warning at all");

  // Slot 2: preterm 33wk, 60h (<72h) -> unit nomogram, NO line drawn.
  const t2 = NP.biliThreshold(33, 60);
  ok(/nomogram/.test(t2.note || ""), "slot2: 33wk/60h -> nomogram note, no thresholds");
  ok((NP.biliFlag(300, 33, 60) || {}).band === "info", "slot2: any value -> info band (no line drawn)");

  // Slot 3: exchange-range. Term 39wk/48h row = repeat 150 / consider 200 / photo 250 / exchange 450.
  const t3 = NP.biliThreshold(39, 48);
  ok(t3.photo === 250 && t3.exchange === 450, "slot3: 39wk/48h row 250/450");
  ok((NP.biliFlag(460, 39, 48) || {}).band === "exchange", "slot3: 460 > 450 -> exchange");

  // Slot 4 DOCUMENTS a gap: stop-below 50 exists in the pack but NO stop-phototherapy
  // logic consumes it — the app stays silent (null) below all lines. Clinician decides (F25 sheet).
  ok(NP.biliFlag(49, 39, 48) === null, "slot4-documents: 49 (near stop-50) -> null, no stop guidance wired");

  // Slots 5+6: mg/dL conversion straddling the 250 photo line, through the real chip path.
  // 14.6*17.1=249.66->250 (consider, no warn) vs 14.7*17.1=251.37->251 (photo, warn).
  const chip5 = NP.roundBiliChip({ bili: { tsb: 14.6, unit: "mgdl", ageHrs: 48 } }, 39);
  ok(chip5.indexOf("Bili 14.6@48h") >= 0 && chip5.indexOf("⚠️") < 0, "slot5: 14.6mg/dL -> 250 consider, no warn [" + chip5 + "]");
  const chip6 = NP.roundBiliChip({ bili: { tsb: 14.7, unit: "mgdl", ageHrs: 48 } }, 39);
  ok(chip6.indexOf("⚠️") >= 0, "slot6: 14.7mg/dL -> 251 photo, warns [" + chip6 + "]");

  // Slot 7: term <24h rows move fast — h18 photo 175 vs h24 photo 200; same 180 flips bands.
  ok(NP.biliThreshold(39, 18).photo === 175 && NP.biliThreshold(39, 24).photo === 200, "slot7: h18 photo 175, h24 photo 200");
  ok((NP.biliFlag(180, 39, 18) || {}).band === "photo", "slot7: 180@18h -> photo");
  ok((NP.biliFlag(180, 39, 24) || {}).band === "consider", "slot7: 180@24h -> consider");

  // Slots 8+9: strict-> comparisons — exactly ON the 250 line stays below it.
  ok((NP.biliFlag(250, 39, 48) || {}).band === "consider", "slot8: 250 (on line) -> consider, not photo");
  ok((NP.biliFlag(251, 39, 48) || {}).band === "photo", "slot9: 251 (just above) -> photo");

  // Slot 10 DOCUMENTS a gap: biliFlag takes (tsb, ga, hrs) only — risk factors do NOT
  // shift tiers. Identical inputs -> identical tier. Clinician reviews in F25.
  ok(NP.biliFlag.length === 3, "slot10-documents: biliFlag has no risk-factor parameter");
  const r10a = NP.biliFlag(210, 39, 48) || {}, r10b = NP.biliFlag(210, 39, 48) || {};
  ok(r10a.band === "consider" && r10b.band === r10a.band, "slot10-documents: same inputs -> same tier (consider)");

  console.log(`f25-validation: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("FATAL:", e); process.exit(1); });

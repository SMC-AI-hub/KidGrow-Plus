// NeoKid Care — Phase 6 chronic-flowsheet suite. Same full-boot harness as
// hri.test.js (ALL scripts in index.html order), then asserts: chronic pack,
// condition detection, GINA + HbA1c bands, timeline/cells, growthInterp,
// dietWeightNote, page wiring. Use: node tests/chronic.test.js
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
  navigator: { onLine: true, userAgent: "node-chronictest" },
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
  const idx = (n) => order.indexOf(n);
  ok(idx("js/chronic.js") > idx("js/cdata.gen.js"), "chronic.js loads after content");

  // ---- pack ----
  const K = sb.KGCONTENT || {};
  ok(K.chronic && K.chronic.version === "2026.1-p6" && /PENDING/.test(K.chronic.verification || ""), "chronic pack versioned + PENDING");
  ok(K.chronic.profiles.length === 3, "chronic: 3 exemplar profiles");
  ok(K.chronic.profiles.find((p) => p.id === "asthma").gina.length === 4, "asthma: 4 GINA questions");
  ok(K.chronic.hba1c.standard === 7.0 && K.chronic.hba1c.tech === 6.5, "hba1c bands 7.0/6.5");
  ok(K.chronic.seizureTypes.length >= 5, "seizure types present");

  const C = sb.Chronic;
  ok(C && typeof C.cell === "function", "Chronic module present");

  // ---- condition detection ----
  ok(C.conds({ problems: [{ label: "Asthma", code: "J45.9", status: "active" }] }).some((x) => x.id === "asthma"), "J45.9 problem -> asthma");
  ok(C.conds({ visits: [{ icd: ["G40.90"] }] }).some((x) => x.id === "epilepsy"), "G40.90 visit -> epilepsy");
  ok(C.conds({ problems: [{ label: "T1DM", code: "E10", status: "active" }] }).some((x) => x.id === "t1dm"), "E10 prefix -> t1dm");
  ok(C.conds({ problems: [{ label: "Asthma", code: "J45.9", status: "resolved" }] }).length === 0, "resolved problem ignored");
  ok(C.conds({ asthma: { pef: [{ date: "2026-10-01", am: 200 }] } }).some((x) => x.id === "asthma"), "PEF diary -> asthma fallback");
  ok(C.conds({}).length === 0, "no data -> no conditions");

  // ---- GINA + HbA1c ----
  ok(C.gina(0).short === "Well" && C.gina(0).sev === "green", "GINA 0 -> well");
  ok(C.gina(2).short === "Partly", "GINA 2 -> partly");
  ok(C.gina(3).short === "Uncontrolled" && C.gina(4).sev === "red", "GINA 3-4 -> uncontrolled");
  ok(C.a1c(6.4).band === "tech", "A1c 6.4 -> tech target");
  ok(C.a1c(6.8).band === "standard", "A1c 6.8 -> standard only");
  ok(C.a1c(8.2).band === "above" && C.a1c(8.2).sev === "warn", "A1c 8.2 -> above warn");
  ok(C.a1c("") === null, "A1c empty -> null");

  // ---- timeline + cells ----
  const kid = {
    dob: "2020-01-01", sex: "boy",
    problems: [{ label: "Asthma", code: "J45.9", status: "active" }],
    measures: [{ date: "2026-10-01", wt: 18, ht: 110 }],
    labs: [{ date: "2026-10-01", hb: "11.5" }],
    visits: [{ date: "2026-09-01", icd: ["J45.9"] }],
    asthma: { pef: [{ date: "2026-10-01", am: 210, pm: 230 }] },
    chronic: {
      asthma: { checks: [{ date: "2026-10-01", yes: 1 }], exac: [{ date: "2026-09-01", steroids: true, admission: false }] },
      epilepsy: { seizures: [{ date: "2026-10-01", type: "Absence", rescue: false }], aeds: [] },
      t1dm: { readings: [{ date: "2026-10-01", kind: "hba1c", value: "8.2" }, { date: "2026-10-01", kind: "fbs", value: "140" }, { date: "2026-10-01", kind: "hypo", value: "mild" }], insulin: "" },
    },
  };
  const ds = C.dates(kid, "asthma", 6);
  ok(ds.length === 2 && ds[0] === "2026-10-01" && ds[1] === "2026-09-01", "dates union desc");
  ok(C.cell(kid, "asthma", "gina", "2026-10-01") === "Partly (1/4)", "gina cell");
  ok(C.cell(kid, "asthma", "pef", "2026-10-01") === "210/230", "pef cell");
  ok(C.cell(kid, "asthma", "exac", "2026-09-01") === "⚠️S", "exac cell steroids flag");
  ok(C.cell(kid, "epilepsy", "seiz", "2026-10-01") === "1× Absence", "seizure cell");
  ok(C.cell(kid, "epilepsy", "rescue", "2026-10-01") === "", "no rescue -> empty");
  ok(C.cell(kid, "t1dm", "hba1c", "2026-10-01") === "8.2 ⚠️", "hba1c cell warns");
  ok(C.cell(kid, "t1dm", "glu", "2026-10-01") === "FBS140", "glucose cell");
  ok(C.cell(kid, "t1dm", "hypo", "2026-10-01") === "×1", "hypo cell");
  ok(C.cell(kid, "asthma", "wt", "2026-10-01") === "18", "weight cell");
  ok(C.cell(kid, "asthma", "hb", "2026-10-01") === "11.5", "hb cell");
  ok(C.cell(kid, "asthma", "gina", "2026-09-01") === "", "no carry-forward across dates");
  const lat = C.latestVal(kid, "asthma", "gina");
  ok(lat && lat.text === "Partly (1/4)" && lat.date === "2026-10-01", "latest value");
  ok(C.latestVal(kid, "asthma", "rescue") === null, "latest missing -> null");

  // ---- growth interpretation (real WHO/IAP tables) ----
  const gi = sb.growthInterp;
  ok(typeof gi === "function", "growthInterp present");
  ok(/normal range/.test(gi({ dob: "2020-10-01", sex: "boy" }, { date: "2026-10-01", wt: 20, ht: 115, bmi: 15.1 }).pattern), "normal 6yo -> normal pattern");
  const uw = gi({ dob: "2020-10-01", sex: "boy" }, { date: "2026-10-01", wt: 13, ht: 115, bmi: 9.8 });
  ok(/Underweight/.test(uw.pattern) && uw.diet === true, "underweight 6yo -> catch-up pattern + diet link");
  ok(/Stunted/.test(gi({ dob: "2020-10-01", sex: "boy" }, { date: "2026-10-01", wt: 20, ht: 95, bmi: 22.2 }).pattern), "short 6yo -> stunted pattern");
  const wst = gi({ dob: "2024-10-01", sex: "girl" }, { date: "2026-10-01", wt: 7, ht: 85, bmi: 9.7 });
  ok(/wast/i.test(wst.pattern) && wst.sev === "red", "wasted 2yo -> red wasting pattern");
  const ov = gi({ dob: "2018-10-01", sex: "girl" }, { date: "2026-10-01", wt: 45, ht: 125, bmi: 28.8 });
  ok(/BMI says/.test(ov.pattern) && ov.diet === true, "obese 8yo -> BMI pattern + diet link");

  // ---- diet note ----
  const dw = sb.dietWeightNote;
  ok(dw({ bmi: { label: "Obese (IAP ≥27 line)" } }) === "over", "diet note: obese -> over");
  ok(dw({ wt: { sev: "amber" }, bmi: { sev: "green", label: "Normal (IAP)" } }) === "catchup", "diet note: thin -> catchup");
  ok(dw({ wt: { sev: "green" }, bmi: { label: "Normal", sev: "green" } }) === null, "diet note: normal -> null");

  // ---- page wiring ----
  ok(html.includes('data-page="chronic"') && html.includes('id="pg-chronic"') && html.includes('id="chronicBox"'), "chronic nav + section + box");
  ok(fs.readFileSync(path.join(R, "sw.js"), "utf8").includes("./js/chronic.js"), "SW shell caches js/chronic.js");
  ok(fs.readFileSync(path.join(R, "js/app.js"), "utf8").includes('chronic: "renderChronic"'), "RENDER_FOR has chronic");
  ok(typeof sb.renderChronic === "function", "renderChronic global present");

  console.log(`chronic: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("FATAL:", e); process.exit(1); });

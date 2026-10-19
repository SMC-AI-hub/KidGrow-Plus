// NeoKid Care — Phase 5 HRI + screening-tools suite. Same full-boot harness
// as nicu.test.js (ALL scripts in index.html order), then asserts: hri pack,
// EDD/corrected-age math, schedule engine, ROP timing (AAP 2018), CCHD
// interpretation (AAP 2025), Scores registration, defaulters, page wiring.
// Use: node tests/hri.test.js
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
  navigator: { onLine: true, userAgent: "node-hritest" },
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
  ok(idx("js/hri.js") > idx("js/scores.js") && idx("js/hri.js") > idx("js/cdata.gen.js"), "hri.js loads after scores + content");

  // ---- pack ----
  const K = sb.KGCONTENT || {};
  ok(K.hri && K.hri.version === "2026.1-p5" && /PENDING/.test(K.hri.verification || ""), "hri pack versioned + PENDING");
  ok(K.hri.schedule.length === 9 && K.hri.riskFactors.length === 10, "hri: 9 visits + 10 risk factors");
  ok(K.hri.rop.eligBWkg === 1.5 && K.hri.rop.eligGAwk === 30 && K.hri.rop.pmaFirstWk === 31, "hri: ROP params");
  ok(K.hri.cchd.passBoth === 95 && K.hri.cchd.maxDiff === 3 && K.hri.cchd.failAny === 90, "hri: CCHD params");

  const H = sb.Hri;
  ok(H && typeof H.schedule === "function", "Hri module present");
  ok(sb.Scores.list().includes("rop-first") && sb.Scores.list().includes("cchd"), "Scores registry has rop-first + cchd");

  // ---- date math ----
  ok(H.addDays("2026-08-01", 56) === "2026-09-26", "addDays +56");
  ok(H.addMo("2026-09-26", 3) === "2026-12-26", "addMo +3");
  ok(H.addMo("2026-01-31", 1) === "2026-02-28", "addMo clamps short month");
  ok(H.diffD("2026-08-01", "2026-09-26") === 56, "diffD");

  // ---- EDD + corrected age ----
  ok(H.edd("2026-08-01", 32) === "2026-09-26", "EDD GA32 = dob+56d");
  ok(H.edd("2026-08-01", null) === "2026-08-01", "EDD unknown GA = dob");
  const cc = H.corr("2026-08-01", 32, "2026-10-19");
  ok(cc.chronoD === 79 && cc.corrD === 23 && cc.useCorr === true, "GA32 corr age on 10-19: 79 chrono, 23 corr");
  ok(H.corr("2026-08-01", 39, "2026-10-19").useCorr === false, "term: no correction");
  ok(H.corr("2020-01-01", 28, "2026-10-19").useCorr === false, "preterm past 24mo: no correction");

  // ---- schedule ----
  const sch = H.schedule("2026-08-01", 32, "2026-08-20");
  ok(sch.length === 9, "schedule with discharge: 9 rows");
  ok(sch.find((v) => v.id === "discharge2wk").date === "2026-09-03", "2wk post-discharge date");
  ok(sch.find((v) => v.id === "term").date === "2026-09-26", "term-equivalent = EDD");
  ok(sch.find((v) => v.id === "c3mo").date === "2026-12-26", "3mo corrected = EDD+3mo");
  ok(H.schedule("2026-08-01", 32, null).length === 8, "no discharge: 8 rows");

  // ---- status bands ----
  ok(H.status("2026-01-01", [], "x", "2026-10-19") === "overdue", "past + not done -> overdue");
  ok(H.status("2026-01-01", [{ visitId: "x" }], "x", "2026-10-19") === "done", "done wins");
  ok(H.status("2026-10-25", [], "y", "2026-10-19") === "due", "+6d -> due");
  ok(H.status("2026-12-26", [], "z", "2026-10-19") === "upcoming", "+68d -> upcoming");

  // ---- ROP ----
  const r24 = H.ropFirst(24, "2026-08-01");
  ok(r24.date === "2026-09-19" && /31 wk/.test(r24.basis), "GA24 first exam +49d (31wk PMA)");
  const r30 = H.ropFirst(30, "2026-08-01");
  ok(r30.date === "2026-08-29" && /chronological/.test(r30.basis), "GA30 first exam +28d (4wk chrono)");
  ok(H.ropFirst(null, "2026-08-01") === null, "ROP needs GA");
  ok(H.ropEligible(29, null, false) === true, "GA29 eligible");
  ok(H.ropEligible(null, 1.4, false) === true, "1.4kg eligible");
  ok(H.ropEligible(39, 3.2, false) === false, "term well baby not eligible");
  ok(H.ropEligible(39, 3.2, true) === true, "unstable term eligible");

  // ---- CCHD ----
  ok(H.cchd(97, 96, 1).result === "pass", "97/96 -> pass");
  ok(H.cchd(93, 96, 1).result === "retest", "93/96 first -> retest");
  ok(H.cchd(93, 96, 2).result === "fail", "93/96 repeat -> fail");
  ok(H.cchd(88, 95, 1).result === "fail", "88 anywhere -> immediate fail");
  ok(H.cchd(99, 95, 1).result === "retest", "diff 4 despite both >=95 -> retest");
  ok(H.cchd("", "", 1).result === "invalid", "missing sats -> invalid");

  // ---- via Scores registry ----
  const sr = sb.Scores.run("rop-first", { ga: 24, dob: "2026-08-01" });
  ok(sr.ok && sr.date === "2026-09-19" && /2018/.test(sr.source) && /judgement/.test(sr.notice), "Scores rop-first carries result + source + notice");
  const sc = sb.Scores.run("cchd", { hand: 97, foot: 96, attempt: 1 });
  ok(sc.ok && sc.result === "pass", "Scores cchd pass");
  ok(sb.Scores.run("rop-first", {}).ok === false, "Scores rop-first needs inputs");

  // ---- enrollment + defaulters ----
  ok(H.enrollValid([]).length > 0 && H.enrollValid(["x"]).length === 0, "enroll needs a risk");
  const kid = { dob: "2026-08-01", gest: "32", hri: { enrolled: true, date: "2026-10-01", risks: ["Preterm <37 wk"], done: [] } };
  const dd = H.dueFor(kid, "2026-10-19");
  ok(dd.enrolled && dd.overdue.length === 1 && dd.overdue[0].id === "term", "GA32 baby: term visit overdue on 10-19");
  ok(H.dueFor({ dob: "2026-08-01", hri: { enrolled: false } }, "2026-10-19").enrolled === false, "not enrolled -> skip");
  ok(H.dueFor({ dob: "2026-08-01", gest: "32", hri: { enrolled: true, risks: ["x"], done: [], discharged: "2026-10-01" } }, "2026-10-19").enrolled === false, "discharged -> skip");
  const defs = H.defaulters([kid, { dob: "2026-01-01", hri: { enrolled: false } }], "2026-10-19");
  ok(defs.length === 1 && defs[0].overdue[0].id === "term", "defaulters lists enrolled-overdue only");

  // ---- ROP line vs recorded screen ----
  ok(H.ropLine({ dob: "2026-08-01", gest: "28" }).recorded === false, "ROP line: unrecorded");
  ok(H.ropLine({ dob: "2026-08-01", gest: "28", nb: { screen: { rop: { date: "2026-09-01", res: "Normal" } } } }).recorded === true, "ROP line: recorded");
  ok(H.ropLine({ dob: "2026-08-01", gest: "39", birthWt: "3.2" }) === null, "ROP line: term baby null");

  // ---- page wiring ----
  ok(html.includes('data-page="hri"') && html.includes('id="pg-hri"') && html.includes('id="hriBox"'), "HRI nav + section + box");
  ok(fs.readFileSync(path.join(R, "sw.js"), "utf8").includes("./js/hri.js"), "SW shell caches js/hri.js");
  ok(fs.readFileSync(path.join(R, "js/app.js"), "utf8").includes('hri: "renderHri"'), "RENDER_FOR has hri");
  ok(typeof sb.renderHri === "function", "renderHri global present");

  console.log(`hri: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("FATAL:", e); process.exit(1); });

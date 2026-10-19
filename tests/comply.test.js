// NeoKid Care — Phase 8 compliance suite. Full-boot harness, then asserts:
// FHIR R4 Bundle builder, soft-delete erasure + grace purge, per-patient audit
// stamp + strip, encrypted-sync round-trip, cloud wiring. Use: node tests/comply.test.js
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
  navigator: { onLine: true, userAgent: "node-complytest" },
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
  ok(typeof sb.FhirX === "object" && typeof sb.Comply === "object", "FhirX + Comply globals present");

  // ---- FHIR Bundle ----
  const code1 = vm.runInContext("VACCINE_SCHEDULE[0].vaccines[0].code", sb);
  const kid = {
    id: "kid1", name: "Fhir Proof", sex: "girl", dob: "2020-01-01", mrn: "M1",
    phone: "999", father: "F", mother: "M", birthWt: "3.1", gest: "38", allergy: "Penicillin rash",
    vaccines: { [code1]: { date: "2020-01-02", batch: "B1", mfr: "MFR" } },
    measures: [{ date: "2026-10-01", wt: 18, ht: 110, hc: 51 }],
    labs: [{ date: "2026-10-01", hb: "11.5" }],
    visits: [{ id: "v1", date: "2026-10-01", type: "Review", icd: [{ code: "J45.9" }] }],
    consents: [{ id: "c1", type: "vaccination", date: "2026-10-01", guardian: "M", relation: "Mother" }],
  };
  const b = sb.FhirX.bundle(kid);
  ok(b.resourceType === "Bundle" && b.type === "collection" && b.entry.length > 5, "bundle shape + entries");
  const types = b.entry.map((e) => e.resource.resourceType);
  ok(types.includes("Patient") && types.includes("Immunization") && types.includes("Observation")
    && types.includes("Encounter") && types.includes("AllergyIntolerance") && types.includes("Consent"), "all 6 resource kinds");
  ok(b.entry[0].resource.gender === "female" && b.entry[0].resource.birthDate === "2020-01-01", "patient gender + dob");
  ok(types.filter((t) => t === "Immunization").length === 1, "only given doses become Immunizations");
  ok(JSON.stringify(b).includes("29463-7") && JSON.stringify(b).includes("718-7"), "LOINC weight + Hb codes");

  // ---- erasure ----
  const kidJSON = JSON.stringify(kid);
  const js = (x) => vm.runInContext(x, sb);
  js(`DB.children = [${kidJSON}]; DB.activeId = "kid1"; DB._deleted = []; DB.audit = [];`);
  ok(sb.Comply.erase("kid1", { reason: "test", by: "tester" }) === true, "erase returns true");
  ok(js(`DB.children.length === 0 && DB._deleted.length === 1`), "child moved to _deleted");
  ok(js(`DB._deleted[0].purgeAfter`) === js(`addDays(todayISO(), 30)`), "purgeAfter = 30-day grace");
  ok(js(`(DB.audit[0] || {}).action`) === "Record erased", "erasure audited");
  ok(sb.Comply.restore("kid1") === true && js(`DB.children.length === 1 && DB._deleted.length === 0`), "restore reverses erasure");
  sb.Comply.erase("kid1", { reason: "test2", by: "tester" });
  ok(sb.Comply.purgeOne("kid1") === true && js(`DB._deleted.length === 0`), "purgeOne destroys immediately");
  js(`DB.children = [${kidJSON}];`);
  sb.Comply.erase("kid1", { reason: "test3", by: "tester" });
  js(`DB._deleted[0].purgeAfter = "2026-01-01";`);
  ok(sb.Comply.purge("2026-10-19") === 1 && js(`DB._deleted.length === 0`), "auto-purge clears expired grace");
  ok(sb.Comply.erase("nope", {}) === false, "erase unknown id -> false");

  // ---- per-patient audit ----
  js(`DB.activeId = "kid1";`);
  sb.log("Test act", "some detail");
  ok(js(`(DB.audit[0] || {}).cid`) === "kid1", "log() stamps active child");
  ok(sb.Comply.auditStrip({ id: "kid1" }).includes("Test act"), "audit strip shows child entries");
  ok(sb.Comply.auditStrip({ id: "other" }) === "", "audit strip silent for others");

  // ---- encrypted-sync round-trip (real WebCrypto) ----
  const env = await sb.Comply.encrypt({ hello: "world" }, "passphrase-123");
  ok(env && env.enc === "AES-GCM-256-PBKDF2-100k" && env.app === "KidGrowPro", "encrypt envelope shape");
  ok((await sb.Comply.decrypt(env, "passphrase-123")).hello === "world", "decrypt round-trips");
  let wrongPW = false;
  try { await sb.Comply.decrypt(env, "wrong-passphrase"); } catch (e) { wrongPW = true; }
  ok(wrongPW, "wrong passphrase fails closed");

  // ---- cloud wiring ----
  const clSrc = fs.readFileSync(path.join(R, "js/cloud.js"), "utf8");
  ok(clSrc.includes("Comply.encrypt") && clSrc.includes("Comply.decrypt"), "push/pull call Comply crypto");
  ok(clSrc.includes("Encrypt cloud snapshots") && typeof sb.Cloud.setEnc === "function" && typeof sb.Cloud.forgetPw === "function", "encSync toggle + setters");
  ok(fs.readFileSync(path.join(R, "js/exports.js"), "utf8").includes("dlFhir()") && fs.readFileSync(path.join(R, "js/exports.js"), "utf8").includes("Erased records"), "export page: FHIR + erasure cards");
  ok(fs.readFileSync(path.join(R, "js/app.js"), "utf8").includes("eraseRequest('${c.id}')"), "children page delete -> eraseRequest");
  const sw = fs.readFileSync(path.join(R, "sw.js"), "utf8");
  ok(sw.includes("./js/fhirx.js") && sw.includes("./js/comply.js"), "SW shell caches fhirx + comply");

  console.log(`comply: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("FATAL:", e); process.exit(1); });

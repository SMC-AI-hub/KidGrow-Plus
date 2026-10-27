// NeoKid Care - machine restore drill (M7 Gate 3 dry-run, no witness).
// Boots the full app in a stub DOM, seeds 50 synthetic children, exports an
// encrypted backup, wipes state, restores, compares manifests exactly, and
// verifies wrong-password rejection leaves state unchanged.
// Use: node scripts/restore-drill.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.log("FAIL:", n); } };
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
const prompts = ["drill-password-1", "drill-password-1", "drill-password-1", "wrong-password-zz"];
const alerts = [];
const sb = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  TextEncoder, TextDecoder,
  alert: (m) => { alerts.push(String(m)); }, confirm: (m) => { alerts.push("CONFIRM: " + String(m).slice(0, 60)); return true; },
  prompt: () => (prompts.length ? prompts.shift() : null),
  requestAnimationFrame: (f) => setTimeout(f, 0),
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
  },
  location: { hash: "", href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "" },
  navigator: { onLine: true, userAgent: "node-drill" },
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
  for (const f of order) vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f });
  ok(true, "booted " + order.length + " scripts");
  vm.runInContext("downloadFile = function (n, c, t) { globalThis.__cap = { name: n, content: String(c), type: t }; };", sb);
  vm.runInContext(`
    DB.children = []; DB.activeId = null;
    seedDemo();
    DB.children.forEach((c) => { if (!c.mrn) c.mrn = "DRILL-SEED"; }); // seed Diya has no mrn; real data always has one (ensureMrns)
    for (let i = DB.children.length; i < 50; i++) {
      DB.children.push(normalizeChild({ id: "drill-" + i, name: "Drill Child " + i, sex: i % 2 ? "girl" : "boy",
        dob: "202" + (i % 10) + "-0" + ((i % 9) + 1) + "-1" + (i % 10),
        father: "F" + i, mother: "M" + i, created: "2026-10-01", mrn: "DRILL-" + i,
        vaccines: {}, measures: [{ date: "2026-10-01", wt: 10 + (i % 5), ht: 80 + (i % 10) }] }));
    }
  `, sb);
  const manifest = () => vm.runInContext(`JSON.stringify({ n: DB.children.length,
    names: DB.children.map((c) => c.name).sort().join("|"),
    dobs: DB.children.map((c) => c.dob).sort().join("|"),
    mrns: DB.children.map((c) => c.mrn).sort().join("|") })`, sb);
  const pre = manifest();
  ok(JSON.parse(pre).n === 50, "seeded 50 drill children");
  await vm.runInContext("exportEncrypted()", sb);
  const cap = vm.runInContext("globalThis.__cap", sb);
  ok(!!(cap && cap.content) && cap.name.endsWith(".kgenc"), "encrypted backup captured");
  console.log("  (backup " + (cap.content.length / 1024).toFixed(1) + " KB, pw prompts used: " + (4 - prompts.length) + "/4 so far)");
  vm.runInContext("DB.children = []; DB.activeId = null;", sb);
  for (const k of Object.keys(store)) delete store[k];
  ok(vm.runInContext("DB.children.length", sb) === 0, "wipe leaves clean state");
  sb.__file = { text: async () => vm.runInContext("globalThis.__cap.content", sb) };
  const t1 = Date.now();
  await vm.runInContext("importEncrypted(globalThis.__file)", sb);
  console.log("  (decrypt+import " + (Date.now() - t1) + " ms for 50 records)");
  const post = manifest();

  if (post !== pre) { const a = JSON.parse(pre), b = JSON.parse(post);
    ["n", "names", "dobs", "mrns"].forEach((k) => { if (String(a[k]) !== String(b[k])) console.log("  DIFF in " + k + ": pre=" + String(a[k]).slice(0, 120) + " post=" + String(b[k]).slice(0, 120)); }); }
  ok(post === pre, "post-restore manifest matches pre-wipe exactly");
  const beforeWrong = manifest();
  sb.__file2 = { text: async () => vm.runInContext("globalThis.__cap.content", sb) };
  await vm.runInContext("importEncrypted(globalThis.__file2)", sb);
  ok(manifest() === beforeWrong, "wrong password leaves state unchanged");
  ok(alerts.some((a) => /Could not restore/i.test(a)), "wrong password shows clean rejection");
  console.log("\nrestore-drill: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("DRILL ERROR:", (e && e.message) || e); process.exit(1); });

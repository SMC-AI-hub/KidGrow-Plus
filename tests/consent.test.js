// NeoKid Care - E-consent grant/withdraw path (DPDP withdrawal). Boots the
// full app in the stub DOM, saves a consent, withdraws it, asserts status
// flip + withdrawn stamp in list + printout, and idempotent re-withdraw.
// Use: node tests/consent.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.log("FAIL:", n); } };
const html = fs.readFileSync(path.join(R, "index.html"), "utf8");
const IDS = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
["conDate", "conText", "conGuard", "conRel", "conWit", "conBy", "sigPad"].forEach((i) => IDS.add(i));
function ctxStub() {
  return new Proxy({ canvas: null, measureText: () => ({ width: 10 }) }, {
    get(t, p) { if (p in t) return t[p]; if (typeof p === "string") return (...a) => undefined; return undefined; },
    set() { return true; },
  });
}
function makeEl(tag, id) {
  const el = {
    tagName: String(tag || "div").toUpperCase(), children: [], style: {}, dataset: {},
    value: "", id: id || "", className: "", width: 600, height: 170, _html: "", _text: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { el.children.push(c); return c; }, append() {}, prepend() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementsByTagName() { return []; }, getElementsByClassName() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 170 }; },
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
  alert: () => {}, confirm: () => true, print: () => {},
  prompt: () => null,
  requestAnimationFrame: (f) => setTimeout(f, 0),
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
  },
  location: { hash: "", href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "" },
  navigator: { onLine: true, userAgent: "node-conttest" },
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
  ok(!loadErr, "boot clean" + (loadErr ? "\n" + loadErr : ""));
  const run = (s) => vm.runInContext(s, sb);
  ok(run("typeof withdrawConsent") === "function", "withdrawConsent registered");
  run("DB.children = []; DB.activeId = null; seedDemo(); DB.activeId = DB.children[0].id; child().consents = [];");
  run(`document.getElementById("conGuard").value = "Test Guardian"; document.getElementById("conWit").value = "Nurse";`);
  run("saveConsent();");
  ok(run("child().consents.length") === 1, "consent saved");
  ok(run("child().consents[0].status") === "granted", "new consent status=granted");
  const cid = run("child().consents[0].id");
  run(`withdrawConsent("${cid}");`);
  ok(run("child().consents[0].status") === "withdrawn", "withdraw flips status");
  ok(run("child().consents[0].withdrawnAt") === run("todayISO()"), "withdrawnAt stamped today");
  run("renderConsent();");
  ok(String(elCache["conBox"].innerHTML).includes("Withdrawn"), "list shows Withdrawn badge");
  run(`printConsent("${cid}");`);
  ok(String(elCache["conPrint"].innerHTML).includes("WITHDRAWN"), "printout stamped WITHDRAWN");
  run(`withdrawConsent("${cid}");`);
  ok(run("child().consents[0].status") === "withdrawn", "re-withdraw is a safe no-op");
  // --- privacy notice acceptance (DPDP: shown before/at collection) ---
  ok(run("typeof noticeMaybeShow") === "function", "notice fns registered");
  run("DB.settings.notice = null;");
  run("noticeMaybeShow();");
  ok(run("noticeStatusLine()").includes("Not yet accepted"), "unstamped status line");
  run("noticeAccept();");
  const stamp = JSON.parse(run("JSON.stringify(DB.settings.notice)"));
  ok(stamp.v === run("NOTICE_VERSION") && stamp.ts === run("todayISO()"), "accept stamps version+date");
  ok(run("noticeStatusLine()").includes("Accepted"), "stamped status line");
  run("loadSettings();");
  ok(String(elCache["noticeStatus"].textContent).includes("Accepted"), "settings shows acceptance");
  run("DB.settings.notice = { v: 'old', ts: '2026-01-01' };");
  run("noticeMaybeShow();");
  ok(String(elCache["noticePrevAccept"].textContent).includes("updated since"), "version bump prompts re-review");
  console.log(`\nconsent: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.log("CONSENT TEST ERROR:", (e && e.message) || e); process.exit(1); });

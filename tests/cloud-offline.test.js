// KidGrow Pro — offline/local-mode suite (M1). Boots ALL scripts in index.html
// order, asserts local-mode parity, subscription-access logic, file resolution,
// and the PIN-hash migration + lockout. Use: node tests/cloud-offline.test.js
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
  navigator: { onLine: true, userAgent: "node-cloudtest" },
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
  crypto: require("crypto").webcrypto, // real subtle (SHA-256 path) + getRandomValues
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
  ok(!loadErr, "all " + order.length + " scripts parse+boot with no exception" + (loadErr ? "\n" + loadErr : ""));
  const idx = (n) => order.indexOf(n);
  ok(order.length >= 26, "script count " + order.length + " >= 26");
  ok(idx("js/config.js") > -1 && idx("js/config.js") < idx("js/vendor/supabase.js"), "config before vendor");
  ok(idx("js/vendor/supabase.js") < idx("js/cloud.js"), "vendor before cloud");
  ok(idx("js/cloud.js") < idx("js/ops.js"), "cloud before ops");

  let missing = [];
  for (const f of order) if (!fs.existsSync(path.join(R, f))) missing.push(f);
  const sw = fs.readFileSync(path.join(R, "sw.js"), "utf8");
  for (const m of sw.matchAll(/"\.\/([^"]+)"/g)) {
    if (m[1] === "" || m[1] === "/") continue;
    if (!fs.existsSync(path.join(R, m[1]))) missing.push("SHELL:" + m[1]);
  }
  ok(!missing.length, "all script/SHELL files resolve" + (missing.length ? ": " + missing.join(",") : ""));
  ok(/kidgrow-v10/.test(sw), "SW cache bumped to v10");

  const C = sb.Cloud;
  ok(C && C.enabled === false, "Cloud present but disabled with empty config");
  ok(sb.KIDGROW_CONFIG && sb.KIDGROW_CONFIG.SUPABASE_URL === "", "committed config is local-mode (keys empty)");
  ok(typeof sb.CloudSchedulePush === "function", "CloudSchedulePush hook defined");
  vm.runInContext("globalThis.__probe={dbChildren:(typeof DB!=='undefined'&&DB&&DB.children)?DB.children.length:-1,renderAll:typeof renderAll}", sb);
  ok(sb.__probe.dbChildren >= 0, "DB booted with children array (fresh device)");
  ok(sb.__probe.renderAll === "function", "renderAll wired after full boot");
  try { sb.save(); ok(true, "save() runs clean with cloud disabled"); }
  catch (e) { ok(false, "save() runs clean with cloud disabled (" + e.message + ")"); }
  try { sb.CloudSchedulePush(); ok(true, "schedulePush no-ops when disabled"); }
  catch (e) { ok(false, "schedulePush no-ops when disabled (" + e.message + ")"); }
  ok(typeof sb.supabase === "object" && typeof sb.supabase.createClient === "function", "supabase UMD exposes createClient");

  const DAY = 864e5, NOW = Date.now();
  const acc = C._access;
  ok(JSON.stringify(acc({ sub_status: "active" }, null, NOW)) === JSON.stringify({ ok: true, reason: "active" }), "access: active, no period end");
  ok(acc({ sub_status: "active", current_period_end: new Date(NOW - 10 * DAY).toISOString() }, null, NOW).ok === false, "access: active but period long past -> locked");
  const a7 = acc({ sub_status: "trialing", trial_ends_at: new Date(NOW + 7 * DAY).toISOString() }, null, NOW);
  ok(a7.ok && a7.reason === "trial" && a7.daysLeft === 7, "access: trialing 7d left");
  ok(acc({ sub_status: "trialing", trial_ends_at: new Date(NOW - DAY).toISOString() }, null, NOW).reason === "expired", "access: trial over -> expired");
  ok(acc({ sub_status: "created", trial_ends_at: new Date(NOW + 3 * DAY).toISOString() }, null, NOW).reason === "trial", "access: created + trial left -> trial");
  ok(acc({ sub_status: "created", trial_ends_at: new Date(NOW - DAY).toISOString() }, null, NOW).reason === "pending", "access: created + trial over -> pending");
  ok(acc({ sub_status: "past_due" }, null, NOW).ok === true, "access: past_due keeps access");
  ok(acc({ sub_status: "cancelled" }, null, NOW).reason === "expired", "access: cancelled -> expired");
  ok(acc(null, { ok: true, verifiedAt: NOW - 2 * DAY }, NOW).reason === "grace", "access: offline fresh cache -> grace");
  ok(acc(null, { ok: true, verifiedAt: NOW - 8 * DAY }, NOW).ok === false, "access: stale cache (8d) -> locked");
  ok(acc(null, { ok: false, reason: "expired", verifiedAt: NOW }, NOW).reason === "expired", "access: negative cache sticks");
  ok(acc(null, null, NOW).reason === "login", "access: no profile/cache -> login");
  ok(C._trialLeft({ trial_ends_at: new Date(NOW + 36e5).toISOString() }, NOW) === 1, "trialLeft: ceil partial day");
  ok(C._trialLeft({}, NOW) === 0 && C._trialLeft(null, NOW) === 0, "trialLeft: missing -> 0");
  ok(C._hash("abc") === C._hash("abc") && C._hash("abc") !== C._hash("abd"), "hash: stable + sensitive");

  // ---- PIN hashing + migration + lockout ----
  const h1 = await sb.pinHash("4242", "salt-A"), h1b = await sb.pinHash("4242", "salt-A"), h2 = await sb.pinHash("4242", "salt-B");
  ok(/^[0-9a-f]{64}$/.test(h1), "pinHash uses SHA-256 hex (strong path, not weak fallback)");
  ok(h1 === h1b && h1 !== h2, "pinHash deterministic per salt, salt-sensitive");
  vm.runInContext("DB.users=[{id:'u9',name:'PIN Test',role:'Doctor',pin:'4242'}]; DB.session={};", sb);
  sb.document.getElementById("lockUser").value = "u9";
  sb.document.getElementById("lockPin").value = "4242";
  await sb.doLogin();
  vm.runInContext("globalThis.__pin={migrated:!!(DB.users[0].pinHash&&!('pin' in DB.users[0])),sess:(DB.session||{}).userId}", sb);
  ok(sb.__pin.migrated && sb.__pin.sess === "u9", "legacy plaintext PIN migrates to hash on login + session set");
  sb.document.getElementById("lockPin").value = "4242";
  await sb.doLogin();
  vm.runInContext("globalThis.__pin2={sess:(DB.session||{}).userId}", sb);
  ok(sb.__pin2.sess === "u9", "hashed PIN login succeeds");
  vm.runInContext("DB.session={};", sb);
  sb.document.getElementById("lockPin").value = "0000";
  for (let i = 0; i < 5; i++) await sb.doLogin();
  const lm = sb.document.getElementById("lockMsg").textContent || "";
  ok(/locked 60s/.test(lm), "5 wrong PINs triggers 60s lockout");
  sb.document.getElementById("lockPin").value = "4242";
  await sb.doLogin();
  vm.runInContext("globalThis.__pin3={sess:(DB.session||{}).userId}", sb);
  ok(!sb.__pin3.sess && /try again/.test(sb.document.getElementById("lockMsg").textContent || ""), "lockout blocks even the correct PIN");

  console.log(`\ncloud-offline: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("cloud-offline harness error:", e && e.message || e); process.exit(1); });

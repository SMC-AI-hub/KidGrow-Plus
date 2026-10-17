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
  const cfgKey = (sb.KIDGROW_CONFIG && sb.KIDGROW_CONFIG.SUPABASE_ANON_KEY) || "";
  let cfgRole = "";
  try { cfgRole = cfgKey ? JSON.parse(Buffer.from(cfgKey.split(".")[1], "base64").toString()).role : ""; } catch (e) { cfgRole = "unparseable"; }
  ok(cfgRole === "" || cfgRole === "anon", "committed config carries no service-role key (empty or anon only)");
  ok(!sb.KIDGROW_CONFIG.SUPABASE_URL || /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(sb.KIDGROW_CONFIG.SUPABASE_URL), "committed URL is a Supabase project or empty");
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

  // ---- inactivity auto-lock ----
  vm.runInContext("DB.users=[{id:'u9',name:'Idle Test',role:'Doctor',pinSalt:'s',pinHash:'h'}]; DB.session={userId:'u9',at:'x'}; DB.settings={lockMins:'15'}; IdleLast = Date.now() - 20*60e3;", sb);
  ok(sb.checkIdle() === true, "idle past limit locks the session");
  vm.runInContext("globalThis.__idleLocked = !!((DB.session || {}).userId);", sb);
  ok(sb.__idleLocked === false, "session cleared after auto-lock");
  ok(/inactivity/.test(sb.document.getElementById("lockMsg").textContent || ""), "lock screen explains inactivity");
  vm.runInContext("DB.session={userId:'u9'}; IdleLast = Date.now();", sb);
  ok(sb.checkIdle() === false, "recent activity prevents lock");
  vm.runInContext("globalThis.__idleKept = !!((DB.session || {}).userId);", sb);
  ok(sb.__idleKept === true, "session kept when active");
  vm.runInContext("DB.users=[]; DB.session={}; IdleLast = 0;", sb);
  ok(sb.checkIdle() === false, "open mode never locks");
  vm.runInContext("DB.settings={lockMins:'1'};", sb);
  ok(sb.idleTimeoutMs() === 60000, "lockMins setting honored");
  vm.runInContext("DB.settings={lockMins:'9999'};", sb);
  ok(sb.idleTimeoutMs() === 480 * 60e3, "lockMins clamped to 480 max");

  // ---- encrypted-backup crypto round-trip (client restore path) ----
  const t0 = Date.now();
  vm.runInContext(`globalThis.__bkP = (async () => {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const pw = "correct-horse-99";
      const enc = await encKey(pw, salt, "encrypt");
      const pt = JSON.stringify({ children: [{ id: "c1", name: "Synthetic" }], marker: "M2-RESTORE-DRILL" });
      const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, enc, new TextEncoder().encode(pt));
      const env = { app: "KidGrowPro", enc: "AES-GCM-256-PBKDF2-100k", salt: b64enc(salt), iv: b64enc(iv), data: b64enc(ct) };
      const dec = await encKey(pw, b64dec(env.salt), "decrypt");
      const rt = new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64dec(env.iv) }, dec, b64dec(env.data)));
      let wrongRejected = false;
      try { const bad = await encKey("wrong-password", b64dec(env.salt), "decrypt"); await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64dec(env.iv) }, bad, b64dec(env.data)); }
      catch (e) { wrongRejected = true; }
      return { ok: rt === pt, wrongRejected, bytes: env.data.length };
    } catch (e) { return { ok: false, err: String((e && e.message) || e) }; }
  })();`, sb);
  const bk = await sb.__bkP;
  ok(bk.ok && bk.wrongRejected, "AES-GCM backup round-trips; wrong password rejected (GCM auth)" + (bk.err ? " [" + bk.err + "]" : ""));
  console.log("  (backup crypto drill: " + (Date.now() - t0) + "ms, " + (bk.bytes || 0) + " b64 chars)");

  // ---- M3 tenant platform: pure helpers + inert-when-offline ----
  ok(idx("js/cloud.js") < idx("js/tenant.js") && idx("js/tenant.js") < idx("js/ops.js"), "tenant.js loads between cloud and ops");
  ok(typeof sb.Tenant === "object" && typeof sb.Tenant.boot === "function", "Tenant namespace present");
  ok(typeof sb.BreakGlassActive === "function" && typeof sb.CloudServerUser === "function", "cross-module hooks present");
  const TP = sb.TenantPure;
  ok(TP.planQuota("trial", "users") === 3 && TP.planQuota("trial", "patients") === 200, "quota mirror: trial 3/200");
  ok(TP.planQuota("solo", "users") === 1 && TP.planQuota("solo", "patients") === 500, "quota mirror: solo 1/500");
  ok(TP.planQuota("clinic", "users") === 5 && TP.planQuota("clinic", "patients") === 5000, "quota mirror: clinic 5/5000");
  ok(TP.planQuota("nicu", "users") === 15 && TP.planQuota("nicu", "patients") === 20000, "quota mirror: nicu 15/20000");
  ok(TP.planQuota("hospital", "users") === 50 && TP.planQuota("hospital", "patients") === 100000, "quota mirror: hospital 50/100000");
  ok(TP.planQuota("enterprise", "users") === null && TP.planQuota("nope", "users") === null, "quota mirror: enterprise/unknown unlimited");
  ok(TP.quotaStatus(5, null).state === "ok" && /unlimited/.test(TP.quotaStatus(5, null).label), "quotaStatus: unlimited");
  ok(TP.quotaStatus(40, 100).state === "ok" && TP.quotaStatus(80, 100).state === "warn" && TP.quotaStatus(100, 100).state === "full", "quotaStatus: ok/warn/full boundaries");
  ok(TP.roleRank("owner") === "Doctor" && TP.roleRank("doctor") === "Doctor", "roleRank: clinical leads");
  ok(TP.roleRank("admin") === "Admin", "roleRank: admin maps to Admin");
  ok(TP.roleRank("nurse") === "Nurse" && TP.roleRank("lab") === "Nurse" && TP.roleRank("mrd") === "Nurse", "roleRank: care staff");
  ok(TP.roleRank("pharmacist") === "Pharmacist", "roleRank: pharmacist maps to Pharmacist");
  ok(TP.roleRank("billing") === "Frontdesk" && TP.roleRank("auditor") === "Frontdesk" && TP.roleRank("readonly") === "Frontdesk" && TP.roleRank("xyz") === "Frontdesk", "roleRank: least privilege default");
  ok(TP.mfaNext({ aal: "aal2", hasFactors: true, role: "owner", required: ["owner"] }) === "ok", "mfa: aal2 passes");
  ok(TP.mfaNext({ aal: "aal1", hasFactors: false, role: "nurse", required: ["owner"] }) === "ok", "mfa: non-required role passes");
  ok(TP.mfaNext({ aal: "aal1", hasFactors: false, role: "owner", required: ["owner", "admin"] }) === "enroll", "mfa: required without factors enrolls");
  ok(TP.mfaNext({ aal: "aal1", hasFactors: true, role: "admin", required: ["owner", "admin"] }) === "verify", "mfa: required with factors verifies");
  ok(TP.mfaNext(null) === "ok", "mfa: null-safe");
  const bgOK = { tenant_id: "t1", reason: "Night duty emergency case", at: NOW - 1000, until: NOW + 3600e3 };
  ok(TP.breakGlassValid(bgOK, NOW) === true, "breakglass: valid record passes");
  ok(TP.breakGlassValid({ ...bgOK, until: NOW - 1 }, NOW) === false, "breakglass: expired rejected");
  ok(TP.breakGlassValid({ ...bgOK, reason: "short" }, NOW) === false, "breakglass: short reason rejected");
  ok(TP.breakGlassValid({ ...bgOK, tenant_id: "" }, NOW) === false, "breakglass: missing tenant rejected");
  ok(TP.breakGlassValid(null, NOW) === false, "breakglass: null-safe");
  const ap = TP.auditPayload("t1", "u1", "patient.view", "patients", "p1", { x: 1 });
  ok(ap.tenant_id === "t1" && ap.actor_id === "u1" && ap.action === "patient.view" && ap.detail.x === 1, "auditPayload shape");
  ok(TP.auditPayload("t", "u", "a".repeat(200), "b".repeat(100), "c", null).action.length === 80, "auditPayload truncates long fields");
  ok(TP.validInviteEmail("doc@hospital.org") && !TP.validInviteEmail("not-an-email"), "invite email validation");
  ok(sb.BreakGlassActive() === false, "BreakGlassActive false with no record");
  sb.localStorage.setItem("kidgrow_breakglass", JSON.stringify(bgOK));
  ok(sb.BreakGlassActive() === true, "BreakGlassActive true with valid record");
  sb.localStorage.removeItem("kidgrow_breakglass");
  ok(sb.CloudServerUser() === null, "CloudServerUser null when cloud off");

  // ---- M4 relational sync: mapping, LWW, outbox, guards ----
  ok(idx("js/tenant.js") < idx("js/sync-rel.js") && idx("js/sync-rel.js") < idx("js/ops.js"), "sync-rel.js loads between tenant and ops");
  ok(typeof sb.SyncEngine === "object" && typeof sb.guardSubmit === "function", "SyncEngine + guardSubmit present");
  ok(sb.save._syncHooked === true, "save() wrapped for dual-write scan");
  const SP = sb.SyncPure;
  ok(SP.mrnFor({ id: "idabc123" }, "CC-") === "CC-IDABC123", "mrnFor: prefix + id-derived");
  ok(SP.mrnFor({ id: "x", mrn: "H-42" }, "CC-") === "CC-H42", "mrnFor: explicit mrn honored");
  ok(SP.sexMap("girl") === "female" && SP.sexMap("BOY") === "male" && SP.sexMap("?") === "unknown", "sexMap");
  ok(SP.sexBack("female") === "girl" && SP.sexBack("unknown") === "", "sexBack");
  ok(SP.gaParse("38+2") === 38 && SP.gaParse("abc") === null && SP.gaParse("") === null, "gaParse weeks");
  ok(SP.wtToG(3.1) === 3100 && SP.wtToG(3100) === 3100 && SP.wtToG("") === null && SP.wtToG(0) === null, "wtToG kg/g heuristic");
  const prow = SP.childToPatient({ id: "t1", name: "Sync Kid", dob: "2023-05-01", sex: "girl", gest: "39", birthWt: 2.9, father: "F", mother: "M", phone: "999", allergy: "sulfa" }, "CC-");
  ok(prow.local_id === "c_t1" && prow.sex === "female" && prow.birth_weight_g === 2900 && prow.ga_at_birth_weeks === 39, "childToPatient maps vitals");
  ok(prow.guardian.mother === "M" && prow.allergies[0] === "sulfa" && prow.dob === "2023-05-01", "childToPatient maps guardian/allergy");
  ok(SP.kindMap("NICU day 3") === "nicu" && SP.kindMap("Casualty") === "emergency" && SP.kindMap("Review visit") === "followup" && SP.kindMap("General") === "opd", "kindMap");
  const erow = SP.visitToEncounter("t1", { id: "v1", date: "2026-01-01", type: "OPD" }, "2026-10-13");
  ok(erow.local_id === "e_v1" && erow.patient_local_id === "c_t1" && erow.status === "closed" && erow.kind === "opd", "visitToEncounter past=closed");
  ok(SP.visitToEncounter("t1", { id: "v2", date: "2026-12-01", type: "x" }, "2026-10-13").status === "open", "visitToEncounter future=open");
  const krow = SP.consentToRow("t1", { purpose: "hack", status: "maybe" }, 0);
  ok(krow.purpose === "care" && krow.status === "granted" && krow.local_id === "k_t1_0", "consentToRow coerces + defaults");
  ok(SP.pickWinner("2026-10-02", "2026-10-01", "a", "b") === "local", "LWW: newer local wins");
  ok(SP.pickWinner("2026-10-01", "2026-10-02", "a", "b") === "remote", "LWW: newer remote wins");
  ok(SP.pickWinner("2026-10-01", "2026-10-01", "opB", "opA") === "local", "LWW: tie broken by opId");
  ok(SP.detectConflict("r2", "r1", "r3", "h1", "h2") === true, "conflict: both dirty + differ");
  ok(SP.detectConflict("r2", "r1", "r3", "h1", "h1") === false, "conflict: same content converges");
  ok(SP.detectConflict("r2", "r1", "r1", "h1", "h1") === false, "conflict: only local dirty");
  ok(SP.detectConflict("r1", null, "r1", "h1", "h2") === true, "conflict: never-pulled + differ");
  let ob = [];
  ob = SP.obEnqueue(ob, { opId: "a", ts: 1, table: "patients", localId: "c_1", row: {} }).q;
  ok(ob.length === 1, "outbox: enqueue adds");
  ok(SP.obEnqueue(ob, { opId: "a", ts: 2, table: "patients", localId: "c_1", row: {} }).added === false, "outbox: dup opId rejected");
  ob = SP.obEnqueue(ob, { opId: "b", ts: 1, table: "encounters", localId: "e_1", row: {} }).q;
  const due1 = SP.obDue(ob, 999);
  ok(due1.length === 2 && due1[0].opId === "a", "outbox: patients flush before encounters on tie");
  ob = SP.obFail(ob, "a", "boom", 10000);
  ok(ob[0].attempts === 1 && ob[0].nextRetry === 20000, "outbox: backoff 5s*2^attempts");
  ok(SP.obDue(ob, 15000).length === 1, "outbox: retry waits for backoff");
  ob = SP.obFail(ob, "a", "patient quota reached", 30000);
  ok(ob[0].attempts === 99, "outbox: fatal errors stop retrying");
  ob = SP.obAck(ob, "a"); ob = SP.obAck(ob, "b");
  ok(ob.length === 0, "outbox: ack drains");
  let cs = SP.canSubmitAt({}, "rx", 10000);
  ok(cs.ok === true, "submit guard: first submit passes");
  ok(SP.canSubmitAt(cs.store, "rx", 11000).ok === false, "submit guard: double-click blocked");
  ok(SP.canSubmitAt(cs.store, "rx", 13000).ok === true, "submit guard: passes after window");
  const ids = new Set(); for (let i = 0; i < 500; i++) ids.add(SP.opId());
  ok(ids.size === 500 && /^op[0-9a-z]+$/.test(SP.opId()), "opId unique + formatted");
  ok(SP.hashStr("abc") === SP.hashStr("abc") && SP.hashStr("abc") !== SP.hashStr("abd"), "hashStr stable");
  // auto-detect: seed -> scan -> edit -> delete
  sb.localStorage.removeItem("kidgrow_outbox"); sb.localStorage.removeItem("kidgrow_revs");
  vm.runInContext("DB.children=[{id:'t1',name:'Sync Kid',dob:'2023-05-01',sex:'girl',visits:[],consents:[]}];", sb);
  ok(sb.SyncEngine.scan() === 1, "scan detects a new child");
  let obx = JSON.parse(sb.localStorage.getItem("kidgrow_outbox"));
  ok(obx.length === 1 && obx[0].table === "patients" && obx[0].localId === "c_t1" && !!obx[0].row.client_rev, "patient op enqueued with rev");
  ok(sb.SyncEngine.scan() === 0, "rescan enqueues nothing (hash-tracked)");
  vm.runInContext("DB.children[0].name='Sync Kid Jr';", sb);
  ok(sb.SyncEngine.scan() === 1, "edit detected by hash change");
  vm.runInContext("DB.children[0].visits=[{id:'v9',date:'2026-09-01',type:'OPD',subj:'cold',obj:'',plan:''}];", sb);
  ok(sb.SyncEngine.scan() === 1, "new visit detected");
  obx = JSON.parse(sb.localStorage.getItem("kidgrow_outbox"));
  ok(obx.some((o) => o.table === "encounters" && o.localId === "e_v9"), "encounter op enqueued");
  vm.runInContext("DB.children=[];", sb);
  ok(sb.SyncEngine.scan() === 2, "deletions become tombstones (child + visit)");
  obx = JSON.parse(sb.localStorage.getItem("kidgrow_outbox"));
  ok(obx.filter((o) => o.row.deleted === "true").length === 2, "tombstone ops carry deleted flag");
  ok(sb.SyncEngine.scan() === 0, "tombstones enqueue once");
  const fl = await sb.SyncEngine.flush();
  ok(fl.ran === false, "flush no-ops when offline/cloud-off");
  ok(sb.guardSubmit("t-probe") === true && sb.guardSubmit("t-probe") === false, "guardSubmit live behavior");

  // ---- M5 clinical: NICU, eMAR, calculators, growth alerts ----
  ok(idx("js/sync-rel.js") < idx("js/nicu.js") && idx("js/calc.js") < idx("js/ops.js"), "clinical scripts load between sync and ops");
  ok(typeof sb.renderNicu === "function" && typeof sb.renderMar === "function" && typeof sb.renderCalc === "function", "clinical pages render");
  const NP = sb.NicuPure, MP = sb.MarPure, CP = sb.CalcPure;
  ok(NP.losDays("2026-10-01T08:00", null, "2026-10-03") === 3, "LOS counts admission day");
  ok(NP.losDays("2026-10-01T08:00", "2026-10-02T10:00", "2026-10-03") === 2, "LOS stops at discharge");
  ok(NP.activeAdmissions([{ status: "admitted" }, { status: "discharged" }]).length === 1, "active admissions filter");
  ok(NP.roundsDue([{ status: "admitted", rounds: [] }], "2026-10-07").length === 1, "round due when none today");
  ok(NP.roundsDue([{ status: "admitted", rounds: [{ date: "2026-10-07" }] }], "2026-10-07").length === 0, "no dup round same day");
  ok(NP.roundsDue([{ status: "discharged", rounds: [] }], "2026-10-07").length === 0, "discharged never due");
  ok(NP.admissionValid({}).length > 0 && NP.admissionValid({ admittedAt: "x", birthWtG: 99 }).some((e) => /300/.test(e)), "admission validation");
  ok(NP.admissionValid({ admittedAt: "2026-10-06T08:00", birthWtG: 2400, ga: 36 }).length === 0, "valid admission passes");
  ok(NP.dischargeValid({ status: "discharged" }).length > 0, "discharge requires active admission");
  ok(NP.dischargeValid({ status: "admitted", admittedAt: "2026-10-06", dischargedAt: "2026-10-05", outcome: "stable" }).some((e) => /precede/.test(e)), "discharge before admit rejected");
  ok(NP.dischargeValid({ status: "admitted", admittedAt: "2026-10-06", dischargedAt: "2026-10-09", outcome: "stable" }).length === 0, "valid discharge passes");
  ok(NP.roundValid({ date: "2031-01-01" }, "2026-10-13").some((e) => /future/.test(e)), "future round rejected");
  ok(NP.roundValid({ date: "2026-10-07", wtG: 2450 }, "2026-10-13").length === 0, "valid round passes");
  ok(NP.feedGuide(1, 3).mlPerKg === 20 && /trophic/.test(NP.feedGuide(1, 3).note), "day-1 trophic feeds");
  ok(NP.feedGuide(10, 3).mlPerKg === 160 && NP.feedGuide(10, 3).totalMl === 480 && NP.feedGuide(10, 3).perFeedQ3h === 60, "feed goal + q3h split");
  ok(NP.censusList([{ name: "a", nicu: { admissions: [{ status: "admitted" }] } }, { name: "b" }]).length === 1, "census lists active only");
  ok(MP.entryValid({}).some((e) => /drug/.test(e)), "MAR needs drug name");
  ok(MP.entryValid({ drug: "x", controlled: true, status: "given", witness: "" }).some((e) => /witness/.test(e)), "controlled needs witness");
  ok(MP.entryValid({ drug: "Paracetamol" }).length === 0, "valid MAR entry passes");
  ok(MP.logDose({ logs: [] }, { by: "", status: "given" }).ok === false, "log needs given-by");
  ok(MP.logDose({ logs: [] }, { by: "n", status: "vaporized" }).ok === false, "log rejects bad status");
  ok(MP.logDose({ controlled: true, logs: [] }, { by: "n", status: "given", witness: "" }).ok === false, "controlled log needs witness");
  const ml0 = { drug: "Caffeine", controlled: false, logs: [] };
  const mlr = MP.logDose(ml0, { at: "2026-10-07T10:00", by: "Nurse", status: "given" });
  ok(mlr.ok === true && mlr.entry.logs.length === 1 && mlr.entry.givenBy === "Nurse" && ml0.logs.length === 0, "logDose appends without mutating");
  ok(MP.dosesDue([{ mar: [{ status: "scheduled", scheduledAt: "2026-10-07T08:00" }] }], "2026-10-07T09:00").length === 1, "past scheduled dose due");
  ok(MP.dosesDue([{ mar: [{ status: "scheduled", scheduledAt: "2026-10-08T08:00" }] }], "2026-10-07T09:00").length === 0, "future dose not due");
  ok(MP.dosesDue([{ mar: [{ status: "given", scheduledAt: "2026-10-07T08:00" }] }], "2026-10-07T09:00").length === 0, "given dose not due");
  const adh = MP.marAdherence([{ logs: [{ at: "2026-10-07T08:00", status: "given" }, { at: "2026-10-07T14:00", status: "missed" }, { at: "2026-10-06T08:00", status: "given" }] }], "2026-10-07");
  ok(adh.given === 1 && adh.total === 2 && adh.pct === 50, "adherence counts the day only");
  const hs8 = CP.fluidsHS(8);
  ok(hs8.mlPerDay === 800 && hs8.mlPerHour === 33.3 && hs8.capped === false, "H-S under 10 kg");
  ok(CP.fluidsHS(15).mlPerDay === 1250 && CP.fluidsHS(25).mlPerDay === 1600, "H-S bands");
  const hsBig = CP.fluidsHS(150);
  ok(hsBig.mlPerDay === 2400 && hsBig.capped === true && hsBig.warnings.length > 0, "H-S capped at adult ceiling");
  ok(CP.fluidsHS(0).error && CP.fluidsHS("x").error, "H-S rejects bad weight");
  const neo1 = CP.fluidsNeonatal(3, 1);
  ok(neo1.mlPerKg === 70 && neo1.mlPerDay === 210, "neonatal day-1 fluids");
  ok(CP.fluidsNeonatal(3, 5).mlPerKg === 145, "neonatal day-5 fluids");
  ok(CP.fluidsNeonatal(1.2, 3).warnings.some((w) => /VLBW/.test(w)), "VLBW warning");
  ok(CP.fluidsNeonatal(3, 0).error && CP.fluidsNeonatal(10, 3).error, "neonatal rejects out-of-range");
  const fv = CP.feedVolume(3, 160);
  ok(fv.totalMl === 480 && fv.q3h === 60 && fv.q2h === 40, "feed splits");
  ok(CP.feedVolume(3, 200).warnings.length > 0 && CP.feedVolume(3, 0).error, "feed ceiling warns, zero errors");
  const ng = CP.nutritionGoal(2, true);
  ok(ng.kcalPerDay === 240 && ng.proteinGPerDay === 6.4, "preterm nutrition goal");
  ok(CP.nutritionGoal(0.1, false).error, "nutrition rejects bad weight");
  ok(sb.growthAlerts([], "2020-01-01", "2026-10-13").some((a) => /no measurement/.test(a.msg)), "growth overdue fires");
  ok(sb.growthAlerts([{ date: "2026-01-01", wt: 10 }, { date: "2026-02-01", wt: 8.4 }], "2024-01-01", "2026-10-13").some((a) => a.level === "red"), ">10% drop is red");
  ok(sb.growthAlerts([{ date: "2026-02-01", wt: 3 }, { date: "2026-06-01", wt: 3 }], "2026-01-15", "2026-10-13").some((a) => /no weight gain/.test(a.msg)), "stagnation under 1y fires");
  ok(sb.growthAlerts([{ date: "2026-10-01", wt: 2.4 }], "2026-09-01", "2026-10-13", () => ({ waz: -2.5, haz: 0 })).some((a) => /WAZ/.test(a.msg)), "low WAZ alerts");
  ok(sb.growthAlerts([{ date: "2026-10-01", wt: 3.2, ht: 50 }], "2026-09-01", "2026-10-13", () => ({ waz: 0, haz: 0.5 })).length === 0, "healthy growth is quiet");

  // ---- growth numeric validity + sex tolerance + stock expiry guard ----
  ok(sb.sxB("male") === "b" && sb.sxB("female") === "g" && sb.sxB("other") === "b" && sb.sxB("boy") === "b", "sxB tolerates server/import sex codes");
  ok(sb.sxW("male") === "boy" && sb.sxW("female") === "girl" && sb.sxW("g") === "girl", "sxW tolerates server/import sex codes");
  ok(sb.whoAgeZ("male", "wfa", 365, 9.5).z === sb.whoAgeZ("boy", "wfa", 365, 9.5).z, "sex male matches boy reference");
  ok(Math.abs(sb.whoAgeZ("boy", "wfa", 365, vm.runInContext("lmsAt(WHO_REF.wfa.b,365).M", sb)).z) < 1e-6, "WHO median -> z=0");
  ok((() => { const d = vm.runInContext("WHO_REF.lhfa.b.M[731]-WHO_REF.lhfa.b.M[730]", sb); return d > -0.70 && d < -0.64; })(), "WHO length-height step at 24mo");
  const ga1 = sb.growthAge({ dob: "2024-01-01", gest: "32" }, "2024-04-10");
  ok(ga1.useCorr === true && ga1.corrD === 44 && ga1.pmaD === 324, "corrected age GA32+100d");
  const ga2 = sb.growthAge({ dob: "2024-01-01", gest: "32" }, "2024-01-31");
  ok(ga2.useCorr === false && ga2.corrNeg === true && ga2.corrD === 30, "negative correction never used");
  vm.runInContext("DB.vaxstock=[{id:'e1',code:'BCG',batch:'B1',qty:5,expiry:'2020-01-01'},{id:'f1',code:'BCG',batch:'B2',qty:5,expiry:'2030-01-01'}];", sb);
  ok(sb.stockDeduct("BCG", "", "B1", "Kid") === null, "expired lot never auto-deducted");
  const sdd = sb.stockDeduct("BCG", "", "B2", "Kid");
  ok(sdd && sdd.id === "f1" && sdd.qty === 4, "fresh lot deducts");
  ok(vm.runInContext("DB.vaxstock.find(l=>l.id==='e1').qty", sb) === 5, "expired qty untouched");

  // ---- dup-dose guard ----
  const dck = { vaccines: { BCG: { date: "2026-01-10", batch: "B1" } }, extraVac: [{ id: "x1", name: "Flu", date: "2026-02-01" }] };
  ok(sb.vaxDupCheck(dck, "OPV0", "2026-01-10").dup === false, "new code passes dup check");
  const dd1 = sb.vaxDupCheck(dck, "BCG", "2026-01-10");
  ok(dd1.dup === true && dd1.sameDay === true, "same code+date flagged");
  const dd2 = sb.vaxDupCheck(dck, "BCG", "2026-03-01");
  ok(dd2.dup === true && dd2.sameDay === false, "same code new date flagged as overwrite");
  ok(sb.extraDupCheck(dck, "flu", "2026-02-01", "newid").dup === true, "extra same name+date (case-insensitive) flagged");
  ok(sb.extraDupCheck(dck, "Flu", "2026-02-01", "x1").dup === false, "extra self-edit exempt");
  ok(sb.extraDupCheck(dck, "Flu", "2027-02-01", "newid").dup === false, "extra different date passes");
  vm.runInContext("DB.children=[{id:'dx1',name:'Dup Kid',dob:'2025-01-01',sex:'boy',vaccines:{BCG:{date:'2026-01-10',batch:'B1'}},extraVac:[]}]; DB.activeId='dx1'; VAX_EDITING=null;", sb);
  vm.runInContext("document.getElementById('vCode').value='BCG'; document.getElementById('vDate').value='2026-01-10';", sb);
  sb.saveVaccine();
  ok(vm.runInContext("DB.children[0].vaccines.BCG.batch", sb) === "B1", "same-day overwrite blocked, record intact");
  vm.runInContext("document.getElementById('vDate').value='2026-05-01';", sb);
  sb.saveVaccine(); // confirm() stubbed false -> overwrite declined
  ok(vm.runInContext("DB.children[0].vaccines.BCG.date", sb) === "2026-01-10", "overwrite requires confirm, declined in test");

  // ---- unified patient header ----
  ok(sb.patientHeaderHTML(null) === "", "header empty with no child");
  const phc = { id: "ph1", name: "Header Kid", dob: "2024-01-15", sex: "girl", allergy: "Penicillin",
    measures: [{ date: "2026-01-01", wt: 10 }, { date: "2026-06-01", wt: 11.5 }], vaccines: {}, visits: [] };
  const phd = sb.patientHeaderData(phc);
  ok(phd.wt === 11.5 && phd.wtDate === "2026-06-01", "header picks latest weight");
  const phh = sb.patientHeaderHTML(phc);
  ok(phh.includes("Header Kid") && phh.includes("Penicillin") && phh.includes("11.5"), "header shows name+allergy+weight");
  ok(sb.patientHeaderHTML({ ...phc, allergy: "" }).includes("No known allergy"), "header shows no-allergy state");
  vm.runInContext("DB.children=[{id:'ph1',name:'Header Kid',dob:'2024-01-15',sex:'girl',allergy:'',vaccines:{},visits:[],measures:[]}]; DB.activeId='ph1'; DB.tokens=[{date:todayISO(),n:5,childId:'ph1',reason:'Fever',status:'in'}];", sb);
  ok(sb.patientHeaderHTML(vm.runInContext("DB.children[0]", sb)).includes("Token #5"), "header shows active token");
  sb.renderPatientHeaders();
  ok(sb.document.getElementById("ph-visits").innerHTML.includes("Header Kid"), "header slot filled on visits page");
  ok(sb.document.getElementById("ph-rx").innerHTML.includes("Header Kid"), "header slot filled on rx page");

  // ---- unified timeline ----
  const tlc = { id: "tl1", name: "Timeline Kid", dob: "2024-01-01", sex: "boy",
    visits: [{ id: "v1", date: "2026-03-01", type: "Follow-up", subj: "Fever<x>", obj: "", plan: "Review" }],
    rx: [{ id: "r1", date: "2026-05-01", dx: "Cold", items: [{ drug: "Paracetamol<script>" }], advice: "", review: "", by: "Dr" }],
    vaccines: { BCG: { date: "2024-01-02", brand: "Serum", batch: "B9", by: "Nurse" } },
    extraVac: [{ id: "x1", name: "Flu shot", date: "2026-01-10", brand: "Vax" }],
    measures: [{ date: "2026-04-01", wt: 12, ht: 85 }],
    labs: [{ id: "l1", date: "2026-02-01", hb: "11.2", note: "" }],
    aefi: [{ id: "a1", date: "2024-01-03", code: "BCG", vacLabel: "BCG", severity: "Mild", outcome: "Recovered", reported: "No" }] };
  const tev = sb.timelineEvents(tlc);
  ok(tev.length === 7, "timeline collects all 7 kinds, got " + tev.length);
  ok(tev[0].date === "2026-05-01" && tev[6].date === "2024-01-02", "timeline sorts newest-first");
  ok(tev.filter((e) => e.kind === "vax").length === 2, "scheduled + extra vaccines both included");
  ok(sb.timelineEvents(null).length === 0, "timeline empty with no child");
  const tlh = sb.timelineHTML(tlc, "all");
  ok(!tlh.includes("<script>") && !tlh.includes("<x>") && tlh.includes("Paracetamol"), "timeline escapes clinical text");
  ok(tlh.includes("BCG") && tlh.includes("Hb 11.2") && tlh.includes("Mild"), "timeline shows vax+lab+aefi detail");
  ok(sb.timelineHTML(tlc, "rx").includes("Paracetamol") && !sb.timelineHTML(tlc, "rx").includes("Hb 11.2"), "timeline filter isolates kinds");
  ok(sb.timelineHTML({ ...tlc, rx: [], visits: [], vaccines: {}, extraVac: [], measures: [], labs: [], aefi: [] }, "all").includes("No records yet"), "timeline empty state");
  ok(sb.vaxLabel("NOPE-99") === "NOPE-99", "unknown vax code falls back to code");
  vm.runInContext("DB.children=[{id:'tl1',name:'Timeline Kid',dob:'2024-01-01',sex:'boy',visits:[],rx:[],vaccines:{},extraVac:[],measures:[],labs:[],aefi:[]}]; DB.activeId='tl1';", sb);
  sb.renderTimeline();
  ok(sb.document.getElementById("timelineList").innerHTML.includes("No records yet"), "renderTimeline fills list");
  vm.runInContext("DB.users=[{id:'uF',name:'Front',role:'Frontdesk'}]; DB.session={userId:'uF'};", sb);
  ok(sb.roleBlock("timeline") === true, "frontdesk blocked from timeline");
  vm.runInContext("DB.users=[{id:'uD',name:'Doc',role:'Doctor'}]; DB.session={userId:'uD'};", sb);
  ok(sb.roleBlock("timeline") === false, "doctor opens timeline");
  vm.runInContext("DB.users=[]; DB.session={};", sb);

  // ---- role dashboards ----
  ok(sb.myAppRole() === "Doctor", "open mode defaults to Doctor");
  vm.runInContext("DB.users=[{id:'uP',name:'Pharma Pam',role:'Pharmacist'},{id:'uA',name:'Admin Al',role:'Admin'}]; DB.session={userId:'uP'};", sb);
  ok(sb.myAppRole() === "Pharmacist" && sb.greetName() === "Pharma", "role + first-name greeting");
  ok(sb.roleBlock("users") === true && sb.roleBlock("rx") === false, "pharmacist hides admin, sees rx");
  vm.runInContext("DB.session={userId:'uA'};", sb);
  ok(sb.roleBlock("users") === false && sb.roleBlock("visits") === false, "admin sees everything");
  vm.runInContext(`DB.children=[{id:'rd1',name:'Dash Kid',dob:'2024-01-01',sex:'boy',vaccines:{},visits:[],measures:[{date:'2026-01-01',wt:10},{date:'2026-02-01',wt:8.4}],rx:[{id:'rx1',date:todayISO(),dx:'Fever',items:[{drug:'Paracetamol'}],by:'Dr'}]}]; DB.tokens=[{date:todayISO(),n:1,childId:'rd1',reason:'Fever',status:'waiting'}]; DB.bills=[{id:'b1',date:todayISO(),total:500,paid:200}]; DB.appts=[{id:'a1',date:todayISO(),childId:'rd1',time:'10:00',type:'Review',done:false}];`, sb);
  ok(sb.queueToday().length === 1 && sb.queueToday()[0].child.name === "Dash Kid", "queue joins child names");
  const btd = sb.billsToday();
  ok(btd.n === 1 && btd.total === 500 && btd.paid === 200, "bills today totals");
  ok(sb.rxToday().length === 1 && sb.growthReds().length === 1, "rx-today + growth-red feeds");
  ok(sb.roleDashHTML("Doctor").includes("queue") && sb.roleDashHTML("Doctor").includes("#1"), "doctor panel shows queue");
  ok(sb.roleDashHTML("Frontdesk").includes("pending") && sb.roleDashHTML("Frontdesk").includes("300"), "frontdesk panel shows pending dues");
  ok(sb.roleDashHTML("Nurse").includes("care tasks"), "nurse panel renders");
  ok(sb.roleDashHTML("Pharmacist").includes("Dispense") && sb.roleDashHTML("Pharmacist").includes("Paracetamol"), "pharmacy queue lists items");
  sb.toggleDispense("rd1", "rx1", 0);
  ok(vm.runInContext("DB.children[0].rx[0].items[0].dispensed.by", sb) === "Admin Al", "dispense tick stamps user");
  ok(sb.roleDashHTML("Pharmacist").includes("0 of 1 items pending"), "pharmacy count updates");
  sb.toggleDispense("rd1", "rx1", 0);
  ok(vm.runInContext("DB.children[0].rx[0].items[0].dispensed", sb) === undefined, "dispense undo clears");
  ok(sb.roleDashHTML("Admin").includes("clinic overview") && sb.roleDashHTML("Admin").includes("Admin Al"), "admin panel shows staff");
  sb.renderDashboard();
  ok(sb.document.getElementById("dashClinic").innerHTML.includes("clinic overview"), "dashboard renders role panel");

  // ---- billing center ----
  ok(vm.runInContext("TITLES.billing", sb) === "Subscription & Billing" && vm.runInContext("TITLES.pricing", sb) === undefined, "merged page titled, old route gone");
  ok(vm.runInContext("RENDER_FOR.billing", sb) === "renderBilling" && vm.runInContext("RENDER_FOR.pricing", sb) === undefined, "merged page wired, old renderer unwired");
  ok(!html.includes('data-page="pricing"') && html.includes('data-page="billing"') && html.includes('id="billBody"') && !html.includes('pricingBody') && !html.includes('pg-pricing'), "one nav entry + one section after merge");
  vm.runInContext("DB.users=[{id:'uN',name:'Nurse Ned',role:'Nurse'},{id:'uP2',name:'Pharma',role:'Pharmacist'},{id:'uF2',name:'Front',role:'Frontdesk'}]; DB.session={userId:'uN'};", sb);
  ok(sb.roleBlock("billing") === true, "nurse blocked from billing");
  vm.runInContext("DB.session={userId:'uP2'};", sb);
  ok(sb.roleBlock("billing") === true, "pharmacist blocked from billing");
  vm.runInContext("DB.session={userId:'uF2'};", sb);
  ok(sb.roleBlock("billing") === true, "frontdesk blocked from merged subscription page");
  ok(vm.runInContext("ROUTE_ALIASES.pricing", sb) === "billing", "old pricing route aliases to billing");
  vm.runInContext("DB.users=[{id:'uD2',name:'Doc',role:'Doctor'},{id:'uA2',name:'Admin',role:'Admin'}]; DB.session={userId:'uD2'};", sb);
  ok(sb.roleBlock("billing") === false, "doctor opens billing");
  vm.runInContext("DB.session={userId:'uA2'};", sb);
  ok(sb.roleBlock("billing") === false, "admin opens billing");
  vm.runInContext("DB.users=[]; DB.session={};", sb);
  const bl = C._billStatusLabel;
  ok(bl({ ok: true, reason: "active" }, { current_period_end: "2026-11-16T00:00:00Z" }).startsWith("Active · renews"), "label: active + renews");
  ok(bl({ ok: true, reason: "past_due" }, {}) === "Past due — update payment", "label: past due");
  ok(bl({ ok: true, reason: "trial", daysLeft: 9 }, {}) === "Free trial · 9 day(s) left", "label: trial countdown");
  ok(bl({ ok: false, reason: "expired" }, {}) === "Expired" && bl({ ok: false, reason: "pending" }, {}) === "Completing payment…", "label: expired + pending");
  const binfo = { email: "evil@x.com<script>", profile: { sub_status: "active", current_period_end: "2026-11-16T00:00:00Z" }, subscription: { current_end: "2026-11-16T00:00:00Z", paid_count: 3, remaining_count: 9 }, invoices: [{ date: "2026-10-16T00:00:00Z", amount: 999, status: "paid", short_url: "https://rzp.io/x" }, { date: "2026-09-16T00:00:00Z", amount: 999, status: "failed", short_url: "" }] };
  const bh = C._billInfoHTML(binfo, { ok: true, reason: "active" });
  ok(!bh.includes("<script>") && bh.includes("evil@x.com"), "billing escapes account email");
  ok(bh.includes("3 paid") && bh.includes("9 to go") && bh.includes("Cloud.cancelSub()"), "billing shows sub counts + cancel");
  ok(bh.includes("b-green") && bh.includes("b-red") && bh.includes("https://rzp.io/x"), "invoices show paid/failed + link");
  ok(C._billInfoHTML({ profile: {} }, { ok: true, reason: "trial", daysLeft: 5 }).includes("Subscribe now"), "trial sees subscribe CTA");
  ok(C._billInfoHTML(null, { ok: false, reason: "expired" }).includes("Could not load live billing details"), "error state degrades gracefully");
  ok(typeof C.cancelSub === "function" && typeof C.refreshBilling === "function" && typeof sb.renderBilling === "function" && typeof sb.subscriptionPitchHTML === "function" && typeof sb.renderPricing === "undefined", "billing API exposed, old renderer gone");
  sb.renderBilling();
  ok(sb.document.getElementById("billBody").innerHTML.includes("not configured"), "billing explains cloud-off state");
  sb.Cloud.enabled = true;
  sb.renderBilling();
  const billPitch = sb.document.getElementById("billBody").innerHTML;
  ok(billPitch.includes("free trial") && billPitch.includes("per clinic, per month"), "logged-out billing shows the pitch");
  sb.Cloud.enabled = false;
  ok(sb.subscriptionPitchHTML(false).includes("Start") && sb.subscriptionPitchHTML(true).includes("Subscribe now"), "pitch CTA adapts to auth state");
  sb.scrollTo = sb.scrollTo || (() => {});
  sb.go("pricing");
  ok(sb.document.getElementById("pageTitle").textContent === "Subscription & Billing", "old pricing route lands on merged page");

  // ---- NICU discharge summary + handover ----
  const nkAdmDone = { id: "admDone", admittedAt: "2026-10-02T08:00", dischargedAt: "2026-10-05T10:00", status: "discharged", outcome: "stable", indication: "RDS <script>", birthWtG: 2400, ga: 36, fuNote: "review after 3 days", rounds: [{ id: "r1", date: "2026-10-02", wtG: 2400, feeds: { totalMl: 60 }, events: ["CPAP"], note: "settling" }, { id: "r2", date: "2026-10-04", wtG: 2480, feeds: { totalMl: 180 }, events: ["CPAP", "phototherapy"], note: "better <x>" }] };
  const nkAdmAct = { id: "admAct", admittedAt: "2026-10-08T08:00", status: "admitted", indication: "sepsis watch", birthWtG: 2500, ga: 37, rounds: [] };
  const nkKid = { id: "nk1", name: "NICU Nina", dob: "2026-10-01", sex: "girl", father: "F", mother: "M", nicu: { admissions: [nkAdmAct, nkAdmDone] } };
  ok(NP.dischargeSummaryData(nkKid, nkAdmAct, "2026-10-10") === null, "no summary while admitted");
  const nsd = NP.dischargeSummaryData(nkKid, nkAdmDone, "2026-10-10");
  ok(nsd.los === 4 && nsd.nRounds === 2, "summary aggregates LOS + rounds");
  ok(nsd.wt.first === 2400 && nsd.wt.last === 2480 && nsd.wt.delta === 80, "summary weight trend +80g");
  ok(nsd.events.length === 2 && nsd.events.includes("phototherapy"), "summary dedupes events");
  ok(NP.weightTrend([]) === null && NP.outcomeLabel("referred").includes("transferred") && NP.outcomeLabel("") === "—", "trend/label edge cases");
  const nsh = NP.dischargeSummaryHTML(nkKid, nkAdmDone, nsd);
  ok(nsh.includes("NICU discharge summary") && nsh.includes("Stable — discharged home") && nsh.includes("review after 3 days"), "summary shows outcome + follow-up");
  ok(!nsh.includes("<script>") && !nsh.includes("<x>") && nsh.includes("RDS"), "summary escapes clinical text");
  ok(nsh.includes("Computer-assisted record") && nsh.includes("2026-10-04"), "summary branded + lists rounds");
  ok(NP.dischargeSummaryHTML(nkKid, nkAdmAct, null) === "", "no summary HTML without data");
  const nhList = NP.censusList([nkKid]);
  ok(nhList.length === 1 && nhList[0].adm.id === "admAct", "handover census = active only");
  const nhh = NP.handoverHTML(nhList, "2026-10-10");
  ok(nhh.includes("shift handover") && nhh.includes("sepsis watch") && nhh.includes("DOL 10") && nhh.includes("round due"), "handover flags due round");
  ok(NP.handoverHTML([], "2026-10-10").includes("census is clear"), "handover empty state");
  ok(typeof sb.printNicuSummary === "function" && typeof sb.printNicuHandover === "function", "NICU print fns exposed");
  vm.runInContext(`DB.children=${JSON.stringify([nkKid])}; DB.activeId='nk1';`, sb);
  sb.printNicuSummary("admDone");
  ok(sb.document.getElementById("nicuPrint").innerHTML.includes("NICU discharge summary"), "print summary fills doc");
  sb.document.getElementById("nicuPrint").innerHTML = "";
  sb.printNicuSummary("admAct");
  ok(sb.document.getElementById("nicuPrint").innerHTML === "", "print summary refuses active admission");
  sb.printNicuHandover();
  ok(sb.document.getElementById("nicuPrint").innerHTML.includes("shift handover"), "print handover fills doc");
  sb.renderNicu();
  ok(sb.document.getElementById("nicuBox").innerHTML.includes("Shift handover") && sb.document.getElementById("nicuBox").innerHTML.includes("Discharge summary"), "NICU page offers both documents");

  // ---- catch-up planner + lot picker ----
  ok(sb.vaxSeries("DTPB1") === "DTP" && sb.vaxSeries("HEPB-B") === "HEPB" && sb.vaxSeries("FLU-Y2") === "FLU", "series keys group boosters");
  ok(sb.vaxSeries("BCG") === "BCG" && sb.vaxSeries("MMR2") === "MMR" && sb.vaxSeries("IPVB1") === "IPV", "series keys primaries");
  const cuKid = { id: "cu1", name: "Catchup Kid", dob: "2025-01-01", sex: "boy", vaccines: {} };
  const cup = sb.catchupPlan(cuKid, "2026-10-16");
  ok(cup.length >= 3 && cup[0].date === "2026-10-16" && cup[0].items.some((it) => it.code === "BCG"), "plan starts today with birth visit");
  ok(cup[1].date === "2026-11-13" && cup[2].date === "2026-12-11", "plan chains +28d visits");
  ok(cup.some((p) => p.rota && p.items.some((it) => it.code === "ROTA1")), "rota visit flagged");
  const allDue = vm.runInContext("VACCINE_SCHEDULE.filter((v)=>dueDateFor({dob:'2026-01-01'},v)<='2026-10-16').map((v)=>v.vaccines.map((x)=>x.code)).flat()", sb);
  const cuPushVx = {};
  allDue.forEach((cd) => { if (cd !== "DTP2") cuPushVx[cd] = { date: cd === "DTP1" ? "2026-10-10" : "2026-05-01" }; });
  const cup3 = sb.catchupPlan({ id: "cu4", dob: "2026-01-01", vaccines: cuPushVx }, "2026-10-16");
  ok(cup3.length === 1 && cup3[0].date === "2026-11-07" && cup3[0].items.some((it) => it.code === "DTP2"), "series push beats chaining (11-07 not today)");
  ok(sb.catchupPlan({ id: "cu3", dob: "2026-10-16", vaccines: { BCG: { date: "2026-10-16" }, OPV0: { date: "2026-10-16" }, "HEPB-B": { date: "2026-10-16" } } }, "2026-10-16").length === 0, "no plan when nothing missed");
  ok(sb.catchupHTML(cuKid, []).length === 0 && sb.catchupHTML(cuKid, cup).includes("clinical judgement prevails"), "plan HTML has verify disclaimer");
  vm.runInContext("DB.vaxstock=[{id:'lotA',code:'BCG',name:'BCG',brand:'Tubervax',batch:'B-1',expiry:'2027-06-01',qty:5,min:1},{id:'lotB',code:'BCG',name:'BCG',brand:'Tubervax',batch:'B-2',expiry:'2026-09-01',qty:3,min:1},{id:'lotC',code:'DTP1',name:'DTwP',brand:'EasySix',batch:'E-9',expiry:'2027-01-01',qty:0,min:1}]; DB.stocklog=[];", sb);
  const lotsBCG = sb.stockLotsFor("BCG");
  ok(lotsBCG.length === 2 && lotsBCG[0].id === "lotB" && sb.stockLotsFor("DTP1").length === 0, "picker lists FEFO, skips empty");
  ok(sb.lotStatus(lotsBCG[0]) === "expired" && sb.lotStatus(lotsBCG[1]) === "ok", "lot expiry statuses");
  const loh = sb.lotOptionsHTML("BCG", "");
  ok(loh.includes("lotA") && loh.includes("disabled") && loh.includes("No deduction"), "picker options: lots + disabled expired + opt-out");
  const dl1 = sb.stockDeductLot("lotA", "BCG", "Test Kid");
  ok(dl1.ok && vm.runInContext("DB.vaxstock.find((l)=>l.id==='lotA').qty", sb) === 4, "manual deduct decrements");
  ok(vm.runInContext("DB.stocklog[DB.stocklog.length-1].why", sb).includes("Manual"), "manual deduct logged");
  ok(sb.stockDeductLot("lotB", "BCG", "K").reason === "expired" && vm.runInContext("DB.vaxstock.find((l)=>l.id==='lotB').qty", sb) === 3, "expired lot blocked");
  ok(sb.stockDeductLot("lotC", "DTP1", "K").reason === "empty" && sb.stockDeductLot("nope", "X", "K").reason === "missing", "empty/missing reasons");
  ok(sb.vaxDeduct(["DTP1", "HIB1", "HEPB2"], "lotA", "EasySix", "B-1", "Combo Kid") === "lotA" && vm.runInContext("DB.vaxstock.find((l)=>l.id==='lotA').qty", sb) === 3, "combo shot deducts once");
  ok(sb.vaxDeduct(["BCG"], "none", "", "", "K") === null && sb.vaxDeduct([], "lotA", "", "", "K") === null, "opt-out + edits deduct nothing");
  ok(sb.vaxDeduct(["BCG"], "lotB", "", "", "K") === undefined, "invalid lot aborts save");
  vm.runInContext("DB.children=[{id:'vx1',name:'Vax Kid',dob:'2024-01-01',sex:'boy',vaccines:{}}]; DB.activeId='vx1'; DB.vaxstock.push({id:'lotD',code:'BCG',name:'BCG',brand:'Tubervax',batch:'B-9',expiry:'2027-03-01',qty:2,min:1});", sb);
  sb.document.getElementById("vCode").value = "BCG"; sb.document.getElementById("vDate").value = "2026-10-10";
  sb.document.getElementById("vBatch").value = ""; sb.document.getElementById("vBrand").value = ""; sb.document.getElementById("vMfr").value = "";
  sb.document.getElementById("vSite").value = "Left arm"; sb.document.getElementById("vBy").value = "Nurse";
  sb.document.getElementById("vAer").value = ""; sb.document.getElementById("vNote").value = ""; sb.document.getElementById("vLot").value = "lotD";
  sb.saveVaccine();
  ok(vm.runInContext("DB.children[0].vaccines.BCG.date", sb) === "2026-10-10" && vm.runInContext("DB.children[0].vaccines.BCG.lot", sb) === "lotD", "dose recorded with lot trace");
  ok(vm.runInContext("DB.vaxstock.find((l)=>l.id==='lotD').qty", sb) === 1, "picked lot deducted once");
  vm.runInContext("DB.children=[{id:'cu1',name:'Catchup Kid',dob:'2025-01-01',sex:'boy',vaccines:{}}]; DB.activeId='cu1';", sb);
  sb.renderVaccines();
  ok(sb.document.getElementById("vacAlerts").innerHTML.includes("Catch-up plan") && sb.document.getElementById("vacAlerts").innerHTML.includes("Record BCG"), "vaccines page shows plan + record shortcuts");
  sb.openVacModal("birth", "BCG");
  ok(sb.document.getElementById("vLot").innerHTML.includes("lotA"), "dose modal populates lot picker");
  sb.document.getElementById("vLot").value = "lotA"; sb.document.getElementById("vBatch").value = "";
  sb.syncLotFields("v");
  ok(sb.document.getElementById("vBatch").value === "B-1", "picker autofills batch");

  // ---- collapsible nav + filter + applyRole fix ----
  ok(html.includes('id="navFilter"') && (html.match(/data-sec="/g) || []).length === 8, "nav has filter + 8 sections");
  const sideNav = html.slice(html.indexOf('id="sideNav"'), html.indexOf('id="userChip"'));
  ok(sideNav.split("data-sec=")[0].indexOf("data-page=") === -1 && (sideNav.match(/data-page="/g) || []).length >= 30, "all nav buttons live inside sections");
  const navPages = [...sideNav.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]).sort().join(",");
  ok(navPages === vm.runInContext("Object.keys(TITLES).sort().join(',')", sb), "every route mapped in new IA, none dropped");
  ok(vm.runInContext("NAV_SECS.join(',')", sb) === "home,patients,ops,clinical,immun,specialty,reports,system", "JS section list matches markup");
  ok(sb.navMatch("Vaccination Record", "vacc") && sb.navMatch("NICU", "nicu") && !sb.navMatch("Growth", "xyz") && sb.navMatch("X", ""), "filter matcher");
  ok(typeof sb.toggleNavSec === "function" && typeof sb.filterNav === "function" && typeof sb.restoreNavSecs === "function" && typeof sb.refreshNavSecs === "function", "nav section fns exposed");
  sb.setNavSecCollapsed("clinical", true);
  ok(sb.navSecCollapsed().includes("clinical"), "collapse persists");
  sb.setNavSecCollapsed("clinical", false);
  ok(!sb.navSecCollapsed().includes("clinical") && sb.navSecCollapsed().includes("specialty") && sb.navSecCollapsed().includes("reports"), "uncollapse works, defaults kept");
  try { sb.restoreNavSecs(); sb.filterNav("vac"); sb.filterNav(""); ok(true, "nav fns no-throw headless"); } catch (e) { ok(false, "nav fns no-throw headless (" + e.message + ")"); }
  const roleDefs = order.filter((f) => /function applyRole\s*\(/.test(fs.readFileSync(path.join(R, f), "utf8")));
  ok(roleDefs.length === 1 && roleDefs[0] === "js/front.js", "exactly one applyRole (front.js)");
  ok(fs.readFileSync(path.join(R, "js/tenant.js"), "utf8").includes("function applyServerRole"), "server-role sync renamed");
  ok(fs.readFileSync(path.join(R, "js/front.js"), "utf8").includes("filterNav(f ? f.value"), "applyRole re-applies filter");

  // ---- display exit (kiosk trap fix) ----
  ok(sb.displayFootHTML().includes("exitDisplay()") && sb.displayFootHTML().includes("Esc to exit"), "display footer has exit + hint");
  ok(sb.displayFootHTML().includes("toggleDispMute()") && sb.displayFootHTML().includes("dispFullscreen()"), "display footer keeps mute + fullscreen");
  ok(typeof sb.exitDisplay === "function" && typeof sb.dispFullscreen === "function", "display exit fns exposed");
  sb.document.getElementById("pageTitle").textContent = "SENTINEL";
  sb.exitDisplay();
  ok(sb.document.getElementById("pageTitle").textContent === "SENTINEL", "exitDisplay no-ops when display inactive");
  try { sb.displayEscHandler({ key: "Enter" }); sb.displayEscHandler({ key: "Escape" }); sb.dispFullscreen(); ok(true, "display handlers no-throw headless"); } catch (e) { ok(false, "display handlers no-throw (" + e.message + ")"); }
  ok(fs.readFileSync(path.join(R, "js/ops.js"), "utf8").includes('addEventListener("keydown", displayEscHandler)'), "esc listener registered");
  vm.runInContext("DB.users=[]; DB.session={}; DB.tokens=[]; DB.bills=[]; DB.appts=[];", sb);
  const arow = SP.admToRow("m5", { id: "a1", admittedAt: "2026-10-06T08:00", birthWtG: 2400, ga: 36, status: "admitted", indication: "RDS" });
  ok(arow.local_id === "n_a1" && arow.patient_local_id === "c_m5" && arow.birth_weight_g === 2400, "admToRow maps");
  const rrow = SP.roundToRow("a1", { id: "r1", date: "2026-10-07", wtG: 2450, vitals: { spo2: 94 } });
  ok(rrow.local_id === "r_r1" && rrow.admission_local_id === "n_a1" && rrow.vitals.spo2 === 94, "roundToRow maps");
  const mrow = SP.marToRow("m5", { id: "e1", drug: "Morphine", controlled: true, status: "scheduled" });
  ok(mrow.local_id === "m_e1" && mrow.controlled === true, "marToRow maps");
  const grow = SP.measureToRow("m5", { id: "g1", date: "2026-10-01", wt: 2.4, ht: 45 });
  ok(grow.local_id === "g_g1" && grow.wt_kg === 2.4 && grow.len_cm === 45 && grow.measured_at === "2026-10-01T00:00:00Z", "measureToRow maps");
  ok(SP.flushParams("mar_entries", {}).p_table === "mar_entries" && SP.flushParams("patients", {}).p_table === undefined, "flush routes clinical via p_table");
  sb.localStorage.removeItem("kidgrow_outbox"); sb.localStorage.removeItem("kidgrow_revs");
  vm.runInContext(`DB.children=[{id:'m5',name:'M5 Kid',dob:'2026-09-01',sex:'girl',visits:[],consents:[],
    measures:[{date:'2026-10-01',wt:2.4,ht:45,hc:32}],
    nicu:{admissions:[{id:'a1',admittedAt:'2026-10-06T08:00',birthWtG:2400,ga:36,indication:'RDS',status:'admitted',rounds:[{id:'r1',date:'2026-10-07',wtG:2450}]}]},
    mar:[{id:'e1',drug:'Caffeine',dose:'5 mg',route:'PO',freq:'daily',controlled:false,scheduledAt:'2026-10-07T08:00',status:'scheduled',logs:[]}]}];`, sb);
  ok(sb.SyncEngine.scan() === 5, "scan detects patient + admission + round + MAR + growth");
  const obc = JSON.parse(sb.localStorage.getItem("kidgrow_outbox"));
  ok(["nicu_admissions", "nicu_rounds", "mar_entries", "growth_points"].every((t) => obc.some((o) => o.table === t)), "clinical ops enqueued");
  ok(obc.find((o) => o.table === "growth_points").localId.startsWith("g_"), "growth op keyed by measure id");
  ok(sb.SyncEngine.scan() === 0, "clinical rescan is quiet");
  ok(sb.nicuCensusHTML().includes("M5 Kid"), "census shows admitted baby");
  ok(sb.marDueHTML().includes("Caffeine"), "due list shows scheduled dose");
  vm.runInContext("DB.children[0].measures.push({date:'2026-10-10',wt:2.0});", sb);
  ok(sb.growthAlertsHTML().includes("M5 Kid"), "dashboard flags the weight drop");

  // ---- M6: MRD registers, denominator'd metrics, tenant brand ----
  ok(idx("js/calc.js") < idx("js/mrd.js") && idx("js/metrics.js") < idx("js/ops.js"), "mrd/metrics load between calc and ops");
  ok(typeof sb.renderMrd === "function" && typeof sb.metricsClinicalHTML === "function", "MRD page + clinical metrics render");
  const MR = sb.MrdPure, MT = sb.MetricsPure;
  vm.runInContext(`DB.children=[
    {id:'d1',name:'Reg A',dob:'2026-10-01',sex:'boy',birthWt:3,gest:39,measures:[{date:'2026-10-02',wt:3},{date:'2026-10-03',wt:3.1}],
     nicu:{admissions:[{id:'na1',admittedAt:'2026-10-02T08:00',status:'discharged',dischargedAt:'2026-10-05T10:00',outcome:'stable',indication:'TTN',birthWtG:3000}]},
     mar:[{logs:[{at:'2026-10-10T08:00',status:'given'}]}]},
    {id:'d2',name:'Reg B',dob:'2026-09-20',sex:'girl',measures:[{date:'2026-10-01',wt:2.5}],
     nicu:{admissions:[{id:'na2',admittedAt:'2026-10-08T08:00',status:'admitted',indication:'RDS'}]},mar:[]}];`, sb);
  const kids6 = vm.runInContext("DB.children", sb);
  const R6 = MR.buildRegisters(kids6, "2026-10-01", "2026-10-31");
  ok(R6.births.length === 1 && R6.admissions.length === 2 && R6.discharges.length === 1 && R6.deaths.length === 0, "registers count the month");
  ok(R6.births[0].name === "Reg A" && R6.discharges[0].ref === "discharged", "register rows carry detail");
  ok(R6.admissions[0].date === "2026-10-02" && R6.admissions[1].date === "2026-10-08", "registers sort by date");
  const R6b = MR.buildRegisters(kids6, "2026-10-06", "2026-10-31");
  ok(R6b.births.length === 0 && R6b.admissions.length === 1 && R6b.discharges.length === 0, "range filter excludes September + early October");
  ok(MR.regCsvRows("T", [{ date: "d", name: "n", sex: "s", ref: "r", detail: "x" }]).length === 3, "CSV rows: title + header + data");
  ok(MT.rate(1, 2).pct === 50 && MT.rate(0, 5).pct === 0, "rate percents");
  ok(MT.rate(1, 0).pct === null && MT.rate(1, 0).n === 1, "zero denominator yields null, keeps n");
  ok(MT.withMinMeasures(kids6, 2) === 1, "measures denominator counts");
  const ns = MT.nicuStats(kids6, "2026-10-10");
  ok(ns.admitted === 1 && ns.avgLos === 3 && ns.dis30 === 1 && /30 d/.test(ns.period), "NICU stats + period");
  const ms = MT.marStats(kids6, "2026-10-10");
  ok(ms.n === 1 && ms.d === 1 && ms.pct === 100 && ms.period === "2026-10-10", "MAR day stats");
  const g0 = MT.growthAlertCounts(kids6, "2026-10-13");
  ok(g0.screened === 2 && g0.red === 0 && g0.amber === 0, "steady growth is quiet");
  vm.runInContext("DB.children[1].measures.push({date:'2026-10-11',wt:2.0});", sb);
  ok(MT.growthAlertCounts(kids6, "2026-10-13").red === 1, "metrics flag the drop");
  const brand = sb.Tenant._brand();
  ok(brand && brand.name === "" && brand.prefix === "", "brand accessor safe offline");
  const foot = sb.docFooter("Discharge summary");
  ok(foot.includes("Discharge summary") && foot.includes("Generated") && foot.includes("confirm clinical labels"), "docFooter brands + dates");

  // ---- Formulary review workflow (C1 partial) ----
  ok(idx("js/metrics.js") < idx("js/formulary.js") && idx("js/formulary.js") < idx("js/ops.js"), "formulary loads between metrics and ops");
  ok(typeof sb.renderFormulary === "function" && typeof sb.formularyStatus === "function", "formulary page + status fn render");
  const DP = sb.DrugPure;
  ok(DP.validateDrug({ id: "t", name: "T", mgkg: 10, maxDose: 100, freqs: ["OD"], defFreq: "OD", allergy: [], strengths: [{ label: "x" }] }).length === 0, "sound drug passes structural check");
  ok(DP.validateDrug({ id: "t", name: "T" }).some((e) => /dosing basis/.test(e)), "dosing basis required");
  ok(DP.validateDrug({ id: "t", name: "T", mgkg: 10, maxDose: 5, freqs: ["OD"], defFreq: "BD", allergy: [], strengths: [{ label: "x" }] }).some((e) => /defFreq/.test(e)), "defFreq must be offered");
  ok(DP.validateDrug({ id: "t", name: "T", mgkg: 10, perDay: true, allergy: [], strengths: [{ label: "x" }] }).some((e) => /daily/.test(e)), "per-day drugs need maxDaily");
  ok(DP.validateDrug({ id: "o", name: "O", info: "directions", allergy: [] }).length === 0, "info-only drugs exempt from strengths");
  ok(DP.validateReview({}).length === 4, "review needs source + edition + by + verdict");
  ok(DP.validateReview({ source: "Nelson", edition: "22e", by: "Ph", verdict: "approved" }).length === 0, "complete review passes");
  ok(DP.reviewStatus("a", { a: { verdict: "approved" } }) === "reviewed", "approved = reviewed");
  ok(DP.reviewStatus("a", { a: { verdict: "flagged" } }) === "pending" && DP.reviewStatus("b", {}) === "pending", "flagged/missing = pending");
  ok(DP.pendingList([{ id: "a" }, { id: "b" }], { a: { verdict: "approved" } }).length === 1, "pending list filters");
  vm.runInContext('DB.formularyReviews={para:{source:"Nelson",edition:"22e",by:"Ph",verdict:"approved",at:"2026-10-14T00:00:00Z"}};', sb);
  ok(sb.formularyStatus("para") === "reviewed" && sb.formularyStatus("ibu") === "pending", "live status reads reviews");
  ok(vm.runInContext("DRUGS.length", sb) === 30, "formulary holds 30 drugs");
  const structIssues = vm.runInContext("DRUGS.map((d) => DrugPure.validateDrug(d).length)", sb);
  ok(structIssues.every((n) => n === 0), "all 30 drugs pass structural validation");

  // ---- Comprehensive growth report: all 6 charts + full detail sections ----
  sb.print = () => { sb.__printed = (sb.__printed || 0) + 1; };
  vm.runInContext(`DB.children=[{id:'gr1',name:'Growth Kid',dob:'2022-06-01',sex:'boy',fHt:'175',mHt:'160',
    measures:[{date:'2024-06-01',wt:12,ht:86,bmi:16.2,hc:48,muac:14},{date:'2025-01-01',wt:13,ht:90,bmi:16.0,hc:48.5,muac:14.2},{date:'2025-06-01',wt:14,ht:94,bmi:15.8,hc:49,muac:14.5}],
    tanner:[{id:'t1',date:'2025-06-01',b:0,g:1,ph:1,note:''}]}]; DB.activeId='gr1';`, sb);
  sb.printGrowthFull();
  const gFull = sb.document.getElementById("growthFullPrint").innerHTML;
  ok((gFull.match(/<img /g) || []).length === 6, "full report embeds all 6 charts");
  ok(gFull.includes("COMPREHENSIVE GROWTH REPORT"), "full report title present");
  ok(gFull.includes("Growth charts (6 of 6)"), "chart count line is honest");
  ok(gFull.includes("Measurement history (3)"), "history section covers all visits");
  ok(gFull.includes("Growth velocity between visits"), "velocity section present");
  ok(gFull.includes("Puberty & predicted height") && gFull.includes("Mid-parental"), "puberty + MPH present");
  ok(gFull.includes("References & methods"), "methods note present");
  ok(gFull.includes("Impression & plan"), "impression present");
  ok(gFull.includes("Latest 14 kg"), "per-chart caption shows latest value");
  ok(sb.__printed === 1, "print dialog fires once");
  const gVel = vm.runInContext("growthVelocityRows(child(), allMeasures(child()))", sb);
  ok(gVel.length === 2 && gVel[0].gpd > 0 && gVel[0].vw && gVel[0].vh, "velocity rows computed per interval");
  ok(vm.runInContext("assessRowFor(assessMeasure(child(), allMeasures(child()).slice(-1)[0]), 'wfa').key", sb) === "WAZ", "caption maps chart to assess row");
  // decode gate: print waits for pending images, then prints
  const gfp = sb.document.getElementById("pg-growthprint");
  const qsaOrig = gfp.querySelectorAll;
  let decoded = 0;
  gfp.querySelectorAll = () => [{ complete: false, decode: () => { decoded++; return Promise.resolve(); } }];
  sb.__printed = 0;
  await sb.printPage("pg-growthprint");
  ok(decoded === 1 && sb.__printed === 1, "printPage waits for image decode, then prints");
  gfp.querySelectorAll = qsaOrig;

  // ---- Build A: type-ahead patient search (G1) ----
  vm.runInContext(`DB.children=[
    {id:'s1',name:'Aarav Sharma',sex:'boy',dob:'2022-01-01',father:'Rohit Sharma',mother:'Priya',phone:'98765 43210',abha:'',vaccines:{},visits:[],measures:[]},
    {id:'s2',name:'Diya Sharma',sex:'girl',dob:'2023-03-03',father:'Karan',mother:'Anaya Sharma',phone:'91234 56789',abha:'',vaccines:{},visits:[],measures:[]},
    {id:'s3',name:'Arjun Mehta',sex:'boy',dob:'2021-06-06',father:'Vikram',mother:'Neha',phone:'90000 11111',abha:'',vaccines:{},visits:[],measures:[]}]; DB.activeId='s1';`, sb);
  const sKids = vm.runInContext("DB.children", sb);
  ok(sb.matchChildren("sharma", sKids).map((h) => h.c.id).join(",") === "s1,s2", "name hit outranks parent hit");
  ok(sb.matchChildren("98765", sKids).map((h) => h.c.id).join(",") === "s1", "phone digits match normalized number");
  ok(sb.matchChildren("91234-56789", sKids).map((h) => h.c.id).join(",") === "s2", "dashed phone query still matches");
  ok(sb.matchChildren("anaya", sKids)[0].why.includes("parent"), "parent match explains itself");
  ok(sb.matchChildren("sharma 2023", sKids).map((h) => h.c.id).join(",") === "s2", "multi-token AND narrows to one child");
  ok(sb.matchChildren("zzzqqq", sKids).length === 0, "no match returns empty");
  ok(sb.matchChildren("", sKids, ["s3", "s1"])[0].c.id === "s3", "empty query lists recents first");
  sb.pushRecentId("s9"); sb.pushRecentId("s3");
  ok(sb.getRecentIds()[0] === "s3" && sb.getRecentIds().length <= 8, "recents round-trip with cap");
  const dStrong = sb.findDupChildren({ name: "Aarav Sharma", dob: "2022-01-01", phone: "" }, sKids);
  ok(dStrong.length === 1 && dStrong[0].strong && dStrong[0].why.includes("name + DOB"), "exact name+DOB flagged strong");
  const dPhone = sb.findDupChildren({ name: "Nobody", dob: "2023-03-03", phone: "9123456789" }, sKids);
  ok(dPhone.length === 1 && dPhone[0].c.id === "s2", "same phone+DOB flagged despite different name");
  const dWeak = sb.findDupChildren({ name: "Aarav Sharma", dob: "2020-05-05", phone: "" }, sKids);
  ok(dWeak.length === 1 && !dWeak[0].strong, "same name different DOB is a weak verify-not-block");
  ok(sb.findDupChildren({ name: "Aarav Sharma", dob: "2022-01-01", phone: "" }, sKids, "s1").length === 0, "dup screen excludes self on edit");
  sb.document.getElementById("cId").value = "";
  sb.document.getElementById("cName").value = "Aarav Sharma";
  sb.document.getElementById("cDob").value = "2022-01-01";
  sb.document.getElementById("cPhone").value = "";
  sb.saveChild();
  ok(vm.runInContext("DB.children.length", sb) === 3, "duplicate registration refused when confirm declined");
  await new Promise((r) => setTimeout(r, 2600)); // outlast the 2.5 s double-submit guard
  sb.document.getElementById("cName").value = "Zara Khan";
  sb.document.getElementById("cDob").value = "2024-01-01";
  sb.saveChild();
  ok(vm.runInContext("DB.children.length", sb) === 4, "genuine registration still saves");
  sb.scrollTo = () => {};
  ok(sb.globalSlashKey({ key: "/", target: { tagName: "DIV" }, preventDefault() {} }) === true, "/ acts on body");
  ok(sb.document.getElementById("pageTitle").textContent === "Children", "/ navigates to Children");
  ok(sb.globalSlashKey({ key: "/", target: { tagName: "INPUT" }, preventDefault() {} }) === false, "/ ignored while typing");
  const dqOrig = sb.document.querySelector;
  sb.document.querySelector = () => ({});
  ok(sb.globalSlashKey({ key: "/", target: { tagName: "DIV" }, preventDefault() {} }) === false, "/ ignored with modal open");
  sb.document.querySelector = dqOrig;
  const ccBox = sb.document.getElementById("childCards");
  ccBox.children.length = 0;
  sb.document.getElementById("childSearch").value = "sharma";
  sb.renderChildren();
  ok(ccBox.children.length === 2 && ccBox.children[0].innerHTML.includes("Aarav Sharma") && ccBox.children[1].innerHTML.includes("Diya Sharma"), "rendered cards follow ranked order");
  ccBox.children.length = 0;
  sb.document.getElementById("childSearch").value = "anaya";
  sb.renderChildren();
  ok(ccBox.children.length === 1 && ccBox.children[0].innerHTML.includes("matched: parent"), "card shows why it matched");

  // ---- v10.10.6: atomic restore + undo + version stamp ----
  const bkValid = { children: [{ id: "b1", name: "Backup Kid", dob: "2021-01-01", visits: [{ id: "v1" }], measures: [{ date: "2026-01-01" }], vaccines: { BCG: {} } }], lastBackup: "2026-09-01" };
  const bv = sb.validateBackup(bkValid);
  ok(bv.ok && bv.stats.children === 1 && bv.stats.visits === 1 && bv.stats.measures === 1 && bv.stats.vaccines === 1 && bv.stats.asOf === "2026-09-01", "valid backup passes with full stats");
  ok(!sb.validateBackup(null).ok && !sb.validateBackup({}).ok && !sb.validateBackup({ children: [{ id: "x" }] }).ok, "garbage backups rejected");
  const built = sb.buildDbFromBackup({ children: [] });
  ok(Array.isArray(built.tokens) && built.settings.clinic === "" && Array.isArray(built.children), "restore fills defaults for keys missing from old backups");
  const builtKid = sb.buildDbFromBackup({ children: [{ id: "b9", name: "N", dob: "2020-01-01" }] }).children[0];
  ok(Array.isArray(builtKid.visits) && Array.isArray(builtKid.measures) && builtKid.vaccines && builtKid.milestones, "restored children normalized");
  vm.runInContext(`DB.children=[{id:'cur1',name:'Current Kid',dob:'2022-02-02',sex:'boy',vaccines:{},visits:[],measures:[],milestones:{}}]; DB.activeId='cur1'; DB.tokens=[{id:'t9'}];`, sb);
  ok(sb.applyBackupObject(bkValid, "test") === false, "restore cancelled when confirm declined");
  ok(vm.runInContext("DB.children.length", sb) === 1, "cancelled restore changes nothing");
  const cfOrig = sb.confirm;
  sb.confirm = () => true;
  ok(sb.applyBackupObject(bkValid, "test") === true, "restore applies when confirmed");
  ok(vm.runInContext("DB.children.length", sb) === 1 && vm.runInContext("DB.children[0].id", sb) === "b1", "clean-slate replace swaps children");
  ok(vm.runInContext("DB.tokens.length", sb) === 0, "stale keys do not survive a replace");
  ok(vm.runInContext("JSON.parse(localStorage.getItem('kidgrow_pro_v1_prev')).children[0].id", sb) === "cur1", "pre-import fallback stashed");
  sb.confirm = () => false;
  sb.undoLastImport();
  ok(vm.runInContext("DB.children[0].id", sb) === "b1", "undo cancelled when confirm declined");
  sb.confirm = () => true;
  sb.undoLastImport();
  ok(vm.runInContext("DB.children[0].id", sb) === "cur1", "undo restores pre-import data");
  vm.runInContext("localStorage.removeItem('kidgrow_pro_v1_prev');", sb);
  sb.undoLastImport();
  ok(vm.runInContext("DB.children[0].id", sb) === "cur1", "undo with no fallback changes nothing");
  sb.confirm = cfOrig;
  ok(vm.runInContext("VAX_SCHEDULE_VERSION", sb) === "IAP ACVIP 2023-24", "schedule version centralized");
  const strayVer = [];
  for (const f of fs.readdirSync(path.join(R, "js"))) {
    if (!f.endsWith(".js") || f === "data.js") continue;
    if (fs.readFileSync(path.join(R, "js", f), "utf8").includes("2023-24")) strayVer.push(f);
  }
  ok(!strayVer.length, "no hardcoded schedule year outside data.js" + (strayVer.length ? ": " + strayVer.join(",") : ""));
  const fakeSpans = [{ textContent: "" }, { textContent: "" }];
  const dqaOrig = sb.document.querySelectorAll;
  sb.document.querySelectorAll = () => fakeSpans;
  ok(sb.applyRefVersions() === 2 && fakeSpans[0].textContent === "IAP ACVIP 2023-24", "boot stamps version into placeholders");
  sb.document.querySelectorAll = dqaOrig;
  vm.runInContext(`DB.children=[normalizeChild({id:'d1',name:'Dash Kid',sex:'boy',dob:'2024-01-01'})]; DB.activeId='d1';`, sb);
  sb.renderDashboard();
  const dStats = sb.document.getElementById("dashStats").innerHTML;
  ok(dStats.includes("go('vaccines')") && dStats.includes("go('milestones')") && dStats.includes("go('growth')") && dStats.includes("go('children')"), "stat cards drill into their screens");

  // ---- v10.11.0: Sunrise home (stats + queue + alerts + search + MRN + lab review) ----
  vm.runInContext(`DB.children=[
    normalizeChild({id:'h1',name:'Hari Patel',sex:'boy',dob:'2024-06-01',phone:'98111 22222',mrn:'0007',vaccines:{}}),
    normalizeChild({id:'h2',name:'Ira Patel',sex:'girl',dob:'2022-01-15',phone:'98111 33333',mrn:'0008',vaccines:{}})];
  DB.activeId='h1';
  DB.tokens=[{id:'tk1',n:1,date:todayISO(),time:'09:00',childId:'h1',name:'Hari Patel',reason:'Fever',status:'waiting'},{id:'tk2',n:2,date:todayISO(),time:'09:20',childId:'h2',name:'Ira Patel',reason:'Review',status:'done'}];
  DB.appts=[{id:'ap1',date:todayISO(),time:'10:00',childId:'h2',type:'Newborn check',done:false}];`, sb);
  const hKids = vm.runInContext("DB.children", sb), hDay = vm.runInContext("todayISO()", sb);
  const hs = sb.homeStatsData(hKids, vm.runInContext("DB.tokens", sb), vm.runInContext("DB.appts", sb), hDay);
  ok(hs.patients === 3 && hs.seen === 1 && hs.waiting === 2, "home stats count queue + seen");
  ok(hs.overdueKids === 2 && hs.dueWeek >= 2 && hs.flags === 0, "home stats dues rich, flags zero without measures");
  const hq = sb.homeQueueRows(vm.runInContext("DB.tokens", sb), vm.runInContext("DB.appts", sb), hKids, hDay);
  ok(hq.map((r) => r.key).join(",") === "t:tk1,t:tk2,a:ap1", "queue merges tokens + appts in time order");
  ok(hq[0].name === "Hari Patel" && hq[0].status === "waiting" && hq[2].status === "booked", "queue rows carry child + status");
  const hqH = sb.homeQueueHTML(hq);
  ok((hqH.match(/queueStart/g) || []).length === 2 && hqH.includes("#1") && hqH.includes("Waiting"), "queue actions only on actionable rows");
  ok(sb.homeQueueHTML([]).includes("Open frontdesk"), "empty queue guides to frontdesk");
  const ha = sb.homeAlertsData({ overdueKids: 11, flags: 5, stockN: 2, stockDetail: "2 under reorder", labsN: 3 });
  ok(ha.length === 4 && ha[0].page === "schedule" && ha[1].page === "analytics", "all four alert kinds route to their lists");
  ok(sb.homeAlertsHTML([]).includes("All clear"), "no alerts shows all-clear");
  ok(sb.homeAlertsHTML(ha).includes("WhatsApp") && sb.homeAlertsHTML(ha).includes("11 children overdue"), "alerts render with honest counts");
  const hstH = sb.homeStatsHTML(hs);
  ok(hstH.includes("Patients today") && hstH.includes("go('front')") && hstH.includes("go('analytics')"), "stat cards drill down");
  // dashboard search (pure core; inputs live in JS-rendered hero)
  const dsH = sb.dashSearchHTML("hari", hKids, []);
  ok(dsH.includes("Hari Patel") && dsH.includes("MRN 0007") && !dsH.includes("Ira Patel"), "dash search ranks + shows MRN");
  ok(sb.dashSearchHTML("x", hKids, []) === "" && sb.dashSearchHTML("zzzqqq", hKids, []).includes("Register this child"), "short query blank, no-match offers register");
  sb.dashPick("h2");
  ok(vm.runInContext("DB.activeId", sb) === "h2", "dash pick activates child");
  // start visit: both branches (empty roster = no patient; child() falls back to [0] otherwise)
  vm.runInContext("DB.__keep=DB.children; DB.children=[]; DB.activeId=null;", sb);
  sb.startVisit();
  ok(sb.document.getElementById("pageTitle").textContent === "Children", "start visit without patient routes to Patients");
  vm.runInContext("DB.children=DB.__keep; delete DB.__keep; DB.activeId='h1';", sb);
  sb.startVisit();
  ok(sb.document.getElementById("vsDate").value === hDay, "start visit opens note for active child");
  // queue actions
  sb.queueOpen("t:tk1");
  ok(vm.runInContext("DB.activeId", sb) === "h1" && sb.document.getElementById("pageTitle").textContent === "Patient Timeline", "queue open jumps to profile");
  sb.queueStart("a:ap1");
  ok(vm.runInContext("DB.activeId", sb) === "h2" && sb.document.getElementById("vsDate").value === hDay, "queue start begins visit note");
  ok(sb.queueFind("x:zz") === null, "bogus queue key resolves to nothing");
  // MRN
  ok(sb.nextMrn([{ mrn: "0007" }, { mrn: "0009" }, {}]) === "0010" && sb.nextMrn([]) === "0001", "MRN sequencing skips gaps");
  const mrnKids = [{ mrn: "0003" }, {}];
  sb.ensureMrns(mrnKids);
  ok(mrnKids[0].mrn === "0003" && mrnKids[1].mrn === "0004", "backfill preserves + assigns");
  ok(sb.matchChildren("0007", hKids)[0].c.id === "h1" && sb.matchChildren("0007", hKids)[0].why.includes("MRN"), "type-ahead finds MRN");
  // labs reviewed
  vm.runInContext(`DB.children[0].labs=[{id:'l1',date:todayISO(),hb:'10',rev:''},{id:'l2',date:addDays(todayISO(),-100),hb:'9',rev:''},{id:'l3',date:todayISO(),hb:'11',rev:'2026-10-01'}]; DB.activeId='h1';`, sb);
  ok(sb.labsPending(hKids, hDay) === 1, "pending counts recent unreviewed only");
  sb.toggleLabRev("l1");
  ok(vm.runInContext("DB.children[0].labs[0].rev", sb) === hDay, "review stamps date");
  sb.toggleLabRev("l1");
  ok(vm.runInContext("DB.children[0].labs[0].rev", sb) === "", "review toggles back");
  // theme
  sb.document.documentElement.dataset.theme = "light";
  sb.toggleTheme();
  ok(vm.runInContext("DB.settings.theme", sb) === "sunrise", "toggle advances light → sunrise");
  sb.toggleTheme(); sb.toggleTheme();
  ok(vm.runInContext("DB.settings.theme", sb) === "light", "toggle cycles dark → light");
  vm.runInContext("DB.settings.theme='';", sb);
  sb.applyTheme();
  ok(sb.document.documentElement.dataset.theme === "sunrise", "fresh installs default to sunrise");
  const css = fs.readFileSync(path.join(R, "css", "style.css"), "utf8");
  ok(css.includes('[data-theme="sunrise"]') && css.includes("--bg:#f6f1e6") && css.includes(".sr-row"), "sunrise theme + search styles shipped");
  // full dashboard render, with and without active child
  vm.runInContext("DB.activeId='h1';", sb);
  sb.renderDashboard();
  ok(sb.document.getElementById("dashHome").innerHTML.includes("Patients today"), "dashboard renders clinic stats");
  ok(sb.document.getElementById("dashQueue").innerHTML.includes("#1"), "dashboard renders queue");
  ok(sb.document.getElementById("dashAlerts").innerHTML.includes("children overdue"), "dashboard renders alerts");
  ok(sb.document.getElementById("dashHero").innerHTML.includes("Start visit") && sb.document.getElementById("dashHero").innerHTML.includes("dashSearch"), "hero has search + visit entry");
  ok(sb.document.getElementById("dashHero").innerHTML.includes("MRN 0007"), "hero shows active MRN");
  vm.runInContext("DB.__keep=DB.children; DB.children=[]; DB.activeId=null;", sb);
  sb.renderDashboard();
  ok(sb.document.getElementById("dashHome").innerHTML.includes("Patients today"), "clinic stats survive empty roster");
  ok(sb.document.getElementById("dashVac").innerHTML.includes("Select a patient above"), "patient cards degrade gracefully");
  ok(sb.document.getElementById("dashChildTag").textContent === "No patient selected", "tag shows no-selection state");
  vm.runInContext("DB.children=DB.__keep; delete DB.__keep; DB.activeId='h1';", sb);
  // saveChild assigns MRN (after the double-submit window)
  await new Promise((r) => setTimeout(r, 2600));
  sb.document.getElementById("cId").value = "";
  sb.document.getElementById("cName").value = "Mira Nair";
  sb.document.getElementById("cDob").value = "2023-05-05";
  sb.document.getElementById("cPhone").value = "";
  sb.saveChild();
  ok(/^\d{4}$/.test(vm.runInContext("DB.children[DB.children.length-1].mrn", sb)), "registration auto-assigns MRN");

  // ---- v10.11.1: color printing ----
  vm.runInContext("delete DB.settings.colorPrint;", sb);
  ok(sb.applyPrintMode() === true, "print defaults to color");
  sb.document.getElementById("sColorPrint").checked = false;
  sb.savePrintPref();
  ok(vm.runInContext("DB.settings.colorPrint", sb) === false && sb.applyPrintMode() === false, "ink-saver toggle persists");
  sb.document.getElementById("sColorPrint").checked = true;
  sb.savePrintPref();
  const cssP = fs.readFileSync(path.join(R, "css", "style.css"), "utf8");
  ok(cssP.includes(".page.printing{animation:none;-webkit-print-color-adjust:exact") && cssP.includes("body.bw-print .page.printing{filter:grayscale(1)}"), "print CSS forces color, grayscale opt-out");

  console.log(`\ncloud-offline: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("cloud-offline harness error:", e && e.message || e); process.exit(1); });

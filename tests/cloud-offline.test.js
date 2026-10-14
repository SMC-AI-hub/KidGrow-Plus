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
  ok(TP.roleRank("owner") === "Doctor" && TP.roleRank("admin") === "Doctor" && TP.roleRank("doctor") === "Doctor", "roleRank: clinical leads");
  ok(TP.roleRank("nurse") === "Nurse" && TP.roleRank("pharmacist") === "Nurse" && TP.roleRank("lab") === "Nurse" && TP.roleRank("mrd") === "Nurse", "roleRank: staff");
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

  console.log(`\ncloud-offline: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("cloud-offline harness error:", e && e.message || e); process.exit(1); });

// NeoKid Care — API function tests (M2). Health endpoint shape + proof that no
// secret/key material ever appears in responses (marker-env technique).
const health = require("../api/health");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.log("FAIL:", n); } };
const mkRes = () => { const r = { _s: 0, _b: null, status(c) { r._s = c; return r; }, json(o) { r._b = o; return r; } }; return r; };

async function main() {
  ok(typeof health === "function", "health handler loads");
  ok(typeof require("../api/create-subscription.js") === "function", "create-subscription loads");
  ok(typeof require("../api/razorpay-webhook.js") === "function", "webhook loads");

  const saved = { ...process.env };
  process.env.SUPABASE_URL = "https://MARKER_URL_xyz.supabase.co";
  process.env.SUPABASE_ANON_KEY = "MARKER_ANON_KEY_abc123";
  process.env.RAZORPAY_KEY_ID = "rzp_MARKER_KEY";
  process.env.RAZORPAY_KEY_SECRET = "MARKER_SECRET";
  process.env.RAZORPAY_WEBHOOK_SECRET = "MARKER_WEBHOOK";
  const realFetch = global.fetch;
  global.fetch = async () => ({ ok: true });
  const r1 = mkRes();
  await health({}, r1);
  global.fetch = realFetch;
  const s1 = JSON.stringify(r1._b);
  ok(r1._s === 200 && r1._b.status === "ok", "health returns 200 {status:ok}");
  ok(!/MARKER/.test(s1) && !/supabase\.co/.test(s1), "health leaks no URLs/keys (marker scan)");
  ok(r1._b.checks.supabaseConfigured === true && r1._b.checks.supabaseLive === true, "health reports booleans + live ping");
  ok(r1._b.checks.razorpayConfigured === true && r1._b.checks.webhookSecretSet === true, "health reports billing config presence");
  ok(/^\d+\.\d+\.\d+/.test(r1._b.version || ""), "health carries app version");
  ok(!Number.isNaN(Date.parse(r1._b.time || "")), "health carries valid timestamp");

  delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY;
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
  const r2 = mkRes();
  await health({}, r2);
  ok(r2._s === 200 && r2._b.checks.supabaseConfigured === false && !("supabaseLive" in r2._b.checks), "health degrades cleanly with no env");
  // ---- M6 FHIR read facade ----
  const fhir = require("../api/fhir/[[...slug]].js");
  const FM = fhir.mappers;
  const fp = FM.fhirPatient({ local_id: "c_1", mrn: "CC-1", name: "Aarav", sex: "male", dob: "2023-01-02", ga_at_birth_weeks: 38.5, birth_weight_g: 3100 });
  ok(fp.resourceType === "Patient" && fp.id === "c_1" && fp.identifier[0].value === "CC-1" && fp.gender === "male" && fp.birthDate === "2023-01-02", "Patient maps identity");
  ok(fp.extension.length === 2 && FM.fhirPatient({ local_id: "c_2", sex: "?" }).gender === "unknown", "Patient extensions + gender fallback");
  const fe = FM.fhirEncounter({ local_id: "e_1", patient_local_id: "c_1", kind: "nicu", status: "closed", started_at: "2026-10-02T09:00:00Z" });
  ok(fe.status === "finished" && fe.class.code === "IMP" && fe.subject.reference === "Patient/c_1", "Encounter maps class + subject");
  const fobs = FM.fhirGrowthObs({ local_id: "g_1", patient_local_id: "c_1", measured_at: "2026-10-07T09:00:00Z", wt_kg: 2.45, len_cm: 46, hc_cm: 33 });
  ok(fobs.length === 3 && fobs[0].code.coding[0].code === "29463-7" && fobs[0].valueQuantity.value === 2.45, "growth row expands to LOINC observations");
  ok(FM.fhirGrowthObs({ local_id: "g_2", wt_kg: 3 }).length === 1, "sparse growth row emits one observation");
  const fm = FM.fhirMAR({ local_id: "m_1", patient_local_id: "c_1", drug: "Morphine", dose: "0.05 mg", status: "given", given_at: "2026-10-07T10:05:00Z", given_by: "Dr A", witness: "Nurse Joy" });
  ok(fm.status === "completed" && /Morphine/.test(fm.medicationCodeableConcept.text) && /Joy/.test(fm.note[0].text), "MAR maps status + witness");
  ok(FM.fhirConsent({ local_id: "k_1", patient_local_id: "c_1", purpose: "care", status: "granted" }).status === "active", "Consent granted = active");
  const rM = mkRes();
  await fhir({ method: "GET", url: "/api/fhir/metadata", headers: {} }, rM);
  ok(rM._s === 200 && rM._b.resourceType === "CapabilityStatement" && rM._b.rest[0].resource.length === 5, "metadata lists 5 resources");
  const r405 = mkRes();
  await fhir({ method: "POST", url: "/api/fhir/Patient?tenant=11111111-1111-1111-1111-111111111111", headers: {} }, r405);
  ok(r405._s === 405, "writes rejected (read-only)");
  const r401 = mkRes();
  await fhir({ method: "GET", url: "/api/fhir/Patient?tenant=11111111-1111-1111-1111-111111111111", headers: {} }, r401);
  ok(r401._s === 401, "missing user JWT rejected");
  const r400 = mkRes();
  await fhir({ method: "GET", url: "/api/fhir/Patient", headers: { authorization: "Bearer xxxxxxxxxxxxxxxxxxxx" } }, r400);
  ok(r400._s === 400, "missing tenant rejected");
  const r404 = mkRes();
  await fhir({ method: "GET", url: "/api/fhir/Procedure?tenant=11111111-1111-1111-1111-111111111111", headers: { authorization: "Bearer xxxxxxxxxxxxxxxxxxxx" } }, r404);
  ok(r404._s === 404, "unknown resource rejected");
  const fSaved = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY };
  process.env.SUPABASE_URL = "https://MARKER_FHIR.supabase.co";
  process.env.SUPABASE_ANON_KEY = "MARKER_FHIR_KEY";
  const seen = {};
  global.fetch = async (url, opts) => {
    seen.url = url; seen.auth = opts.headers.Authorization; seen.key = opts.headers.apikey;
    return { ok: true, json: async () => [{ local_id: "c_1", mrn: "CC-1", name: "A", sex: "male" }] };
  };
  const rP = mkRes();
  await fhir({ method: "GET", url: "/api/fhir/Patient?tenant=11111111-1111-1111-1111-111111111111", headers: { authorization: "Bearer USER_JWT_TOKEN_123456" } }, rP);
  global.fetch = realFetch;
  ok(rP._s === 200 && rP._b.resourceType === "Bundle" && rP._b.total === 1 && rP._b.entry[0].resource.id === "c_1", "search returns mapped Bundle");
  ok(/\/rest\/v1\/patients\?/.test(seen.url) && seen.url.includes("tenant_id=eq.11111111-1111-1111-1111-111111111111") && seen.auth === "Bearer USER_JWT_TOKEN_123456" && seen.key === "MARKER_FHIR_KEY", "tenant scoped + user JWT forwarded upstream");
  ok(!/MARKER/.test(JSON.stringify(rP._b)), "Bundle leaks no key material");
  global.fetch = async () => { throw new Error("MARKER_BOOM"); };
  const r502 = mkRes();
  await fhir({ method: "GET", url: "/api/fhir/Patient?tenant=11111111-1111-1111-1111-111111111111", headers: { authorization: "Bearer USER_JWT_TOKEN_123456" } }, r502);
  global.fetch = realFetch;
  ok(r502._s === 502 && !/MARKER/.test(JSON.stringify(r502._b)), "upstream failure is generic (no leak)");
  if (fSaved.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = fSaved.url;
  if (fSaved.key === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = fSaved.key;

  // ---- billing center: billing-info + cancel-subscription ----
  const billInfo = require("../api/billing-info.js");
  const billCancel = require("../api/cancel-subscription.js");
  ok(typeof billInfo === "function" && typeof billCancel === "function", "billing handlers load");
  process.env.SUPABASE_URL = "https://MARKER_URL_xyz.supabase.co";
  process.env.SUPABASE_ANON_KEY = "MARKER_ANON_KEY_abc123";
  process.env.SUPABASE_SERVICE_KEY = "MARKER_SERVICE_KEY_def456";
  process.env.RAZORPAY_KEY_ID = "rzp_MARKER_KEY";
  process.env.RAZORPAY_KEY_SECRET = "MARKER_SECRET_ghi789";
  const J = (o) => ({ ok: true, json: async () => o });
  const J401 = () => ({ ok: false, json: async () => ({}) });
  const billFetch = (profile) => async (url) => {
    if (String(url).includes("/auth/v1/user")) return J({ id: "u-bill-1", email: "doc@clinic.in" });
    if (String(url).includes("/rest/v1/profiles")) return J([profile]);
    if (String(url).includes("/subscriptions/sub_9/invoices") || String(url).includes("/invoices?")) {
      return J({ items: [
        { id: "inv_1", date: 1760486400, status: "paid", gross_amount: 49900, currency: "INR", short_url: "https://rzp.io/i/one" },
        { id: "inv_0", date: 1757808000, status: "paid", gross_amount: 49900, currency: "INR", short_url: "https://rzp.io/i/zero" },
      ] });
    }
    if (String(url).includes("/subscriptions/")) {
      if (String(url).includes("/cancel")) return J({ id: "sub_9" });
      return J({ id: "sub_9", status: "active", charge_at: 1763078400, current_end: 1763078400, paid_count: 3, remaining_count: 57 });
    }
    return J({});
  };
  const fullProfile = { sub_status: "active", trial_ends_at: null, current_period_end: "2026-11-14T00:00:00.000Z", razorpay_sub_id: "sub_9", razorpay_customer_id: "cust_9" };
  const rB401 = mkRes();
  await billInfo({ method: "GET", headers: {} }, rB401);
  ok(rB401._s === 401, "billing-info needs session");
  const rB405 = mkRes();
  await billInfo({ method: "POST", headers: { authorization: "Bearer x" } }, rB405);
  ok(rB405._s === 405, "billing-info GET only");
  global.fetch = billFetch(fullProfile);
  const rB = mkRes();
  await billInfo({ method: "GET", headers: { authorization: "Bearer USER_JWT_0123456789abcdef" } }, rB);
  global.fetch = realFetch;
  ok(rB._s === 200 && rB._b.sub_status === "active" && rB._b.subscription.status === "active", "billing-info returns status + subscription");
  ok(rB._b.invoices.length === 2 && rB._b.invoices[0].amount === 499 && rB._b.invoices[0].short_url === "https://rzp.io/i/one", "billing-info lists invoices with links");
  ok(!/MARKER/.test(JSON.stringify(rB._b)), "billing-info leaks no key material (marker scan)");
  global.fetch = billFetch({ sub_status: "trialing", razorpay_sub_id: "" });
  const rBT = mkRes();
  await billInfo({ method: "GET", headers: { authorization: "Bearer USER_JWT_0123456789abcdef" } }, rBT);
  global.fetch = realFetch;
  ok(rBT._s === 200 && rBT._b.subscription === null && rBT._b.invoices.length === 0, "billing-info trial has no subscription");
  global.fetch = async (url) => (String(url).includes("/auth/v1/user") ? J401() : J({}));
  const rBU = mkRes();
  await billInfo({ method: "GET", headers: { authorization: "Bearer STALE" } }, rBU);
  global.fetch = realFetch;
  ok(rBU._s === 401, "billing-info rejects stale session");
  const rC401 = mkRes();
  await billCancel({ method: "POST", headers: {} }, rC401);
  ok(rC401._s === 401, "cancel needs session");
  const rC405 = mkRes();
  await billCancel({ method: "GET", headers: { authorization: "Bearer x" } }, rC405);
  ok(rC405._s === 405, "cancel POST only");
  global.fetch = billFetch(fullProfile);
  const rC = mkRes();
  await billCancel({ method: "POST", headers: { authorization: "Bearer USER_JWT_0123456789abcdef" } }, rC);
  global.fetch = realFetch;
  ok(rC._s === 200 && rC._b.ok === true && rC._b.cancel_at_cycle_end === true, "cancel at cycle end ok");
  global.fetch = billFetch({ sub_status: "trialing", razorpay_sub_id: "" });
  const rCN = mkRes();
  await billCancel({ method: "POST", headers: { authorization: "Bearer USER_JWT_0123456789abcdef" } }, rCN);
  global.fetch = realFetch;
  ok(rCN._s === 400, "cancel with no subscription rejected");

  // ---- webhook: HMAC signature + billing state machine ----
  const crypto = require("crypto");
  const { EventEmitter } = require("events");
  const webhook = require("../api/razorpay-webhook.js");
  process.env.RAZORPAY_WEBHOOK_SECRET = "MARKER_WEBHOOK";
  process.env.SUPABASE_URL = "https://MARKER_URL_xyz.supabase.co";
  process.env.SUPABASE_SERVICE_KEY = "MARKER_SERVICE_KEY_def456";
  const mkReq = (body) => {
    const r = new EventEmitter();
    r.method = "POST"; r.headers = {};
    process.nextTick(() => { r.emit("data", Buffer.from(body)); r.emit("end"); });
    return r;
  };
  const seenWh = { patches: [], current: "created" };
  global.fetch = async (url, opts) => {
    if (String(url).includes("profiles?razorpay_sub_id")) return J([{ id: "u-wh-1", sub_status: seenWh.current }]);
    if (String(url).includes("profiles?id=eq.")) { seenWh.patches.push(JSON.parse(opts.body)); return J({}); }
    return J({});
  };
  const runWh = async (event, ent, sigOk) => {
    const body = JSON.stringify({ event, payload: { subscription: { entity: ent } } });
    const req = mkReq(body);
    req.headers["x-razorpay-signature"] = sigOk
      ? crypto.createHmac("sha256", "MARKER_WEBHOOK").update(Buffer.from(body)).digest("hex") : "bogus";
    const rr = mkRes();
    await webhook(req, rr);
    return rr;
  };
  const rW401 = await runWh("subscription.activated", { id: "sub_9" }, false);
  ok(rW401._s === 401, "webhook rejects bad signature");
  seenWh.current = "created"; seenWh.patches = [];
  const rWAuth = await runWh("subscription.authenticated", { id: "sub_9" }, true);
  ok(rWAuth._s === 200 && seenWh.patches.length === 1 && seenWh.patches[0].sub_status === "authenticated", "webhook: authenticated stays gated (not active)");
  seenWh.current = "authenticated"; seenWh.patches = [];
  const rWAct = await runWh("subscription.activated", { id: "sub_9", current_end: 1763078400 }, true);
  ok(rWAct._s === 200 && seenWh.patches[0].sub_status === "active" && !!seenWh.patches[0].current_period_end, "webhook: activated grants active + period end");
  seenWh.current = "created"; seenWh.patches = [];
  const rWFail = await runWh("payment.failed", { id: "pay_1", subscription_id: "sub_9" }, true);
  ok(rWFail._s === 200 && seenWh.patches.length === 0, "webhook: failed FIRST charge grants nothing");
  seenWh.current = "active"; seenWh.patches = [];
  const rWFail2 = await runWh("payment.failed", { id: "pay_2", subscription_id: "sub_9" }, true);
  ok(rWFail2._s === 200 && seenWh.patches.length === 1 && seenWh.patches[0].sub_status === "past_due", "webhook: failed recurring charge -> past_due");

  // ---- create-subscription ----
  const createSub = require("../api/create-subscription.js");
  process.env.SUPABASE_ANON_KEY = "MARKER_ANON_KEY_abc123";
  process.env.RAZORPAY_KEY_ID = "rzp_MARKER_KEY";
  process.env.RAZORPAY_KEY_SECRET = "MARKER_SECRET_ghi789";
  process.env.RAZORPAY_PLAN_ID = "plan_MARKER";
  global.fetch = async (url, opts) => {
    if (String(url).includes("/auth/v1/user")) return J({ id: "u-new-1", email: "new@clinic.in" });
    if (String(url).includes("/rest/v1/profiles") && (!opts || !opts.method)) return J([{ razorpay_customer_id: "" }]);
    if (String(url).includes("/rest/v1/profiles")) return J({});
    if (String(url).includes("/customers")) return J({ id: "cust_new" });
    if (String(url).includes("/subscriptions")) return J({ id: "sub_new" });
    return J({});
  };
  const rS405 = mkRes();
  await createSub({ method: "GET", headers: {} }, rS405);
  ok(rS405._s === 405, "create-subscription POST only");
  const rS401 = mkRes();
  await createSub({ method: "POST", headers: {} }, rS401);
  ok(rS401._s === 401, "create-subscription needs session");
  const rS = mkRes();
  await createSub({ method: "POST", headers: { authorization: "Bearer USER_JWT_0123456789abcdef" } }, rS);
  global.fetch = realFetch;
  ok(rS._s === 200 && rS._b.subscription_id === "sub_new", "create-subscription provisions sub");
  ok(!/MARKER_SECRET/.test(JSON.stringify(rS._b)), "create-subscription leaks no secret");

  // ---- F11 guard: rate limit + validators + bounded reads ----
  const G = require("../api/_guard");
  G._resetForTests();
  const mkGReq = (ip) => ({ headers: { "x-forwarded-for": ip || "9.9.9.9" }, socket: {} });
  let trips = 0;
  for (let i = 0; i < 61; i++) { if (!G.rateLimit(mkGReq(), { prefix: "t", max: 60 }).ok) trips++; }
  ok(trips === 1, "rate limit trips on 61st request in window");
  ok(G.rateLimit(mkGReq("8.8.8.8"), { prefix: "t", max: 60 }).ok, "rate limit is per-IP");
  ok(!G.isTokenShape("") && !G.isTokenShape("short") && G.isTokenShape("USER_JWT_0123456789abcdef"), "token shape check");
  ok(G.isUuid("11111111-1111-1111-1111-111111111111") && !G.isUuid("nope"), "uuid check");
  ok(G.isEmail("doc@clinic.in") && !G.isEmail("a@b"), "email check");
  ok(G.cleanStr("x".repeat(300), 64).length === 64, "cleanStr truncates");
  const mkGStream = (bufs) => ({ _h: {}, on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return this; }, go() { (bufs || []).forEach((b) => this._h.data.forEach((f) => f(b))); this._h.end.forEach((f) => f()); } });
  const gS1 = mkGStream([Buffer.from("a".repeat(100))]);
  const gP1 = G.readRawCapped(gS1, 64).then(() => "resolved", () => "rejected");
  gS1.go();
  ok((await gP1) === "rejected", "bounded read rejects oversized body");
  const gS2 = mkGStream([Buffer.from("ok")]);
  const gP2 = G.readRawCapped(gS2, 64).then((b) => b.toString(), () => "X");
  gS2.go();
  ok((await gP2) === "ok", "bounded read passes small body");
  G._resetForTests();

  // ---- F17 error beacon ----
  const errBeacon = require("../api/err.js");
  const rE405 = mkRes();
  await errBeacon({ method: "GET", headers: {} }, rE405);
  ok(rE405._s === 405, "beacon POST only");
  const rE400 = mkRes();
  await errBeacon({ method: "POST", headers: {}, body: { page: "", msg: "" } }, rE400);
  ok(rE400._s === 400, "beacon rejects shapeless body");
  const rE = mkRes();
  await errBeacon({ method: "POST", headers: {}, body: { page: "pg-rx", msg: "TypeError: x is null", ver: "v10.46" } }, rE);
  ok(rE._s === 204, "beacon accepts shaped error");
  G._resetForTests();
  for (let i = 0; i < 31; i++) await errBeacon({ method: "POST", headers: {}, body: { page: "p", msg: "m" } }, mkRes());
  const rEL = mkRes();
  await errBeacon({ method: "POST", headers: {}, body: { page: "p", msg: "m" } }, rEL);
  ok(rEL._s === 429, "beacon rate-limited past 30/min");
  G._resetForTests();

  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);

  console.log(`\napi: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("api harness error:", (e && e.message) || e); process.exit(1); });

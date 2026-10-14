// KidGrow Pro — API function tests (M2). Health endpoint shape + proof that no
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
  const fhir = require("../api/fhir.js");
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

  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);

  console.log(`\napi: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("api harness error:", (e && e.message) || e); process.exit(1); });

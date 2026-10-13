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
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);

  console.log(`\napi: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("api harness error:", (e && e.message) || e); process.exit(1); });

/* Vercel serverless: create a Razorpay subscription for the signed-in user.
   Env needed: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY),
   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID */
const RZP = "https://api.razorpay.com/v1";
const G = require("./_guard");

async function rzp(path, body) {
  const r = await fetch(RZP + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64"),
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.description) || "Razorpay error");
  return j;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (G.limited(req, res, { prefix: "sub", max: 20 })) return;
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.RAZORPAY_PLAN_ID) return res.status(503).json({ error: "PAYMENTS_NOT_CONFIGURED" });
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
    if (!G.isTokenShape(token)) return res.status(401).json({ error: "Sign in first." });
    // Verify Supabase JWT -> user
    const me = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
    });
    const user = await me.json().catch(() => ({}));
    if (!me.ok || !user.id) return res.status(401).json({ error: "Session expired — sign in again." });

    // Find or create Razorpay customer, then subscription
    const svc = { apikey: (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY), Authorization: "Bearer " + (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY), "Content-Type": "application/json" };
    const profR = await fetch(process.env.SUPABASE_URL + "/rest/v1/profiles?id=eq." + user.id + "&select=razorpay_customer_id", { headers: svc });
    const prof = (await profR.json().catch(() => []))[0] || {};
    let customerId = prof.razorpay_customer_id || "";
    if (!customerId) {
      const c = await rzp("/customers", { email: user.email || "", notes: { supabase_id: user.id } });
      customerId = c.id;
    }
    const sub = await rzp("/subscriptions", {
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_id: customerId,
      customer_notify: 1,
      total_count: 60, // 5 years of monthly billing
      notes: { supabase_id: user.id },
    });
    await fetch(process.env.SUPABASE_URL + "/rest/v1/profiles?id=eq." + user.id, {
      method: "PATCH", headers: svc,
      body: JSON.stringify({ razorpay_sub_id: sub.id, razorpay_customer_id: customerId, sub_status: "created" }),
    });
    return res.status(200).json({ subscription_id: sub.id, key_id: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    console.error("[create-subscription] 500:", (e && e.message) || e);
    return res.status(500).json({ error: "Could not start subscription." });
  }
};

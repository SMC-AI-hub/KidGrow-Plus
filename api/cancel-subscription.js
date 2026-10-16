/* Vercel serverless: cancel at end of billing cycle for the signed-in user.
   The webhook flips sub_status when Razorpay confirms. Access stays until
   current_period_end — we never cut paid time short. */
const RZP = "https://api.razorpay.com/v1";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
    if (!token) return res.status(401).json({ error: "Sign in first." });
    const me = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
    });
    const user = await me.json().catch(() => ({}));
    if (!me.ok || !user.id) return res.status(401).json({ error: "Session expired — sign in again." });
    const svc = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_KEY, "Content-Type": "application/json" };
    const profR = await fetch(process.env.SUPABASE_URL + "/rest/v1/profiles?id=eq." + user.id + "&select=razorpay_sub_id", { headers: svc });
    const prof = (await profR.json().catch(() => []))[0] || {};
    if (!prof.razorpay_sub_id) return res.status(400).json({ error: "No active subscription to cancel." });
    const r = await fetch(RZP + "/subscriptions/" + encodeURIComponent(prof.razorpay_sub_id) + "/cancel?cancel_at_cycle_end=1", {
      method: "POST",
      headers: { Authorization: "Basic " + Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64") },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.description) || "Razorpay error");
    return res.status(200).json({ ok: true, cancel_at_cycle_end: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Could not cancel." });
  }
};

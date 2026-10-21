/* Vercel serverless: billing center data for the signed-in user.
   Env needed: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_KEY,
   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET.
   Returns subscription status + invoices. Never returns secrets. */
const RZP = "https://api.razorpay.com/v1";
const G = require("./_guard");

async function rzpGet(path) {
  const r = await fetch(RZP + path, {
    headers: {
      Authorization: "Basic " + Buffer.from(process.env.RAZORPAY_KEY_ID + ":" + process.env.RAZORPAY_KEY_SECRET).toString("base64"),
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error && j.error.description) || "Razorpay error");
  return j;
}

async function authedUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /i, "");
  if (!G.isTokenShape(token)) return null;
  const me = await fetch(process.env.SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: "Bearer " + token },
  });
  const user = await me.json().catch(() => ({}));
  return me.ok && user.id ? user : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });
  if (G.limited(req, res, { prefix: "bill", max: 60 })) return;
  try {
    const user = await authedUser(req);
    if (!user) return res.status(401).json({ error: "Sign in first." });
    const svc = { apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: "Bearer " + process.env.SUPABASE_SERVICE_KEY };
    const profR = await fetch(
      process.env.SUPABASE_URL + "/rest/v1/profiles?id=eq." + user.id +
      "&select=sub_status,trial_ends_at,current_period_end,razorpay_sub_id,razorpay_customer_id",
      { headers: svc });
    const prof = (await profR.json().catch(() => []))[0] || {};
    const out = {
      email: user.email || "",
      sub_status: prof.sub_status || "none",
      trial_ends_at: prof.trial_ends_at || null,
      current_period_end: prof.current_period_end || null,
      subscription: null,
      invoices: [],
    };
    if (prof.razorpay_sub_id && process.env.RAZORPAY_KEY_ID) {
      try {
        const s = await rzpGet("/subscriptions/" + encodeURIComponent(prof.razorpay_sub_id));
        out.subscription = {
          id: s.id, status: s.status || "",
          charge_at: s.charge_at ? new Date(s.charge_at * 1000).toISOString() : null,
          current_end: s.current_end ? new Date(s.current_end * 1000).toISOString() : null,
          paid_count: s.paid_count || 0, remaining_count: s.remaining_count || 0,
          short_url: s.short_url || "",
        };
      } catch (e) { out.subscription_error = true; }
      try {
        const inv = await rzpGet("/invoices?subscription_id=" + encodeURIComponent(prof.razorpay_sub_id) + "&count=24");
        out.invoices = ((inv && inv.items) || []).map((v) => ({
          id: v.id || "", date: v.date ? new Date(v.date * 1000).toISOString() : null,
          amount: (v.gross_amount || v.amount || 0) / 100, currency: v.currency || "INR",
          status: v.status || "", short_url: v.short_url || "",
        }));
      } catch (e) { /* invoices optional — subscription status is the source of truth */ }
    }
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || "Billing unavailable." });
  }
};

/* Vercel serverless: Razorpay webhook -> update subscription in Supabase.
   Env needed: SUPABASE_URL, SUPABASE_SERVICE_KEY, RAZORPAY_WEBHOOK_SECRET.
   Configure in Razorpay dashboard: subscription.authenticated/charged/
   activated/cancelled/completed/expired + payment.failed */
const crypto = require("crypto");

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const raw = await readRaw(req);
    const sig = req.headers["x-razorpay-signature"] || "";
    const expect = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "").update(raw).digest("hex");
    if (!sig || sig !== expect) return res.status(401).json({ error: "bad signature" });

    const evt = JSON.parse(raw.toString("utf8"));
    const name = evt.event || "";
    const ent = (evt.payload && (evt.payload.subscription || {}).entity) || (evt.payload && (evt.payload.payment || {}).entity) || {};
    const subId = ent.id && String(ent.id).startsWith("sub_") ? ent.id : (ent.subscription_id || "");
    const svc = {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: "Bearer " + process.env.SUPABASE_SERVICE_KEY,
      "Content-Type": "application/json",
    };
    const sb = (path, opts) => fetch(process.env.SUPABASE_URL + "/rest/v1/" + path, { headers: svc, ...opts });

    let patch = null;
    if (name === "subscription.authenticated" || name === "subscription.activated" || name === "subscription.charged") {
      patch = { sub_status: "active" };
      if (ent.current_end) patch.current_period_end = new Date(ent.current_end * 1000).toISOString();
    } else if (name === "subscription.cancelled") patch = { sub_status: "cancelled" };
    else if (name === "subscription.completed" || name === "subscription.expired") patch = { sub_status: "expired" };
    else if (name === "payment.failed") patch = { sub_status: "past_due" };

    if (patch && subId) {
      // find user by razorpay_sub_id
      const r = await sb("profiles?razorpay_sub_id=eq." + encodeURIComponent(subId) + "&select=id");
      const rows = await r.json().catch(() => []);
      if (rows[0]) {
        await sb("profiles?id=eq." + rows[0].id, { method: "PATCH", body: JSON.stringify(patch) });
        await sb("subscription_events", { method: "POST", body: JSON.stringify({ user_id: rows[0].id, event: name, razorpay_sub_id: subId, payload: evt }) });
      }
    }
    return res.status(200).json({ status: "ok" });
  } catch (e) {
    return res.status(500).json({ error: e.message || "webhook failed" });
  }
};

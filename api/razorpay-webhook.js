/* Vercel serverless: Razorpay webhook -> update subscription in Supabase.
   Env needed: SUPABASE_URL, SUPABASE_SERVICE_KEY, RAZORPAY_WEBHOOK_SECRET.
   Configure in Razorpay dashboard: subscription.authenticated/charged/
   activated/cancelled/completed/expired + payment.failed */
const crypto = require("crypto");
const G = require("./_guard");

function readRaw(req) { return G.readRawCapped(req, 262144); } // F11: 256KB cap (DoS bound)

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (G.limited(req, res, { prefix: "wh", max: 120 })) return;
  try {
    const raw = await readRaw(req);
    const sig = req.headers["x-razorpay-signature"] || "";
    const expect = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "").update(raw).digest("hex");
    const sigBuf = Buffer.from(String(sig), "hex"), expBuf = Buffer.from(expect, "hex");
    const sigOk = sigBuf.length > 0 && sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
    if (!sigOk) return res.status(401).json({ error: "bad signature" });

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

    let patch = null, guardFrom = null;
    // NOTE: authenticated (mandate ok, first charge pending) stays gated as
    // "pending" — only activated/charged (money moved) grants active.
    if (name === "subscription.authenticated") patch = { sub_status: "authenticated" };
    else if (name === "subscription.activated" || name === "subscription.charged") {
      patch = { sub_status: "active" };
      if (ent.current_end) patch.current_period_end = new Date(ent.current_end * 1000).toISOString();
    } else if (name === "subscription.cancelled") patch = { sub_status: "cancelled" };
    else if (name === "subscription.completed" || name === "subscription.expired") patch = { sub_status: "expired" };
    // A failed FIRST charge must not grant access: past_due only counts when
    // the user previously paid (active/cancelled/past_due).
    else if (name === "payment.failed") { patch = { sub_status: "past_due" }; guardFrom = ["active", "cancelled", "past_due"]; }

    if (patch && subId) {
      // find user by razorpay_sub_id
      const r = await sb("profiles?razorpay_sub_id=eq." + encodeURIComponent(subId) + "&select=id,sub_status");
      const rows = await r.json().catch(() => []);
      if (rows[0]) {
        if (!guardFrom || guardFrom.indexOf(rows[0].sub_status) > -1) {
          await sb("profiles?id=eq." + rows[0].id, { method: "PATCH", body: JSON.stringify(patch) });
        }
        await sb("subscription_events", { method: "POST", body: JSON.stringify({ user_id: rows[0].id, event: name, razorpay_sub_id: subId, payload: evt }) });
      }
    }
    return res.status(200).json({ status: "ok" });
  } catch (e) {
    console.error("[razorpay-webhook] 500:", (e && e.message) || e);
    return res.status(500).json({ error: "webhook failed" });
  }
};

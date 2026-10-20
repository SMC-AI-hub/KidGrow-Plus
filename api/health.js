/* GET /api/health — liveness + dependency presence for uptime monitors.
   NEVER echoes secrets, URLs, or key material — booleans only. */
let VERSION = "10.50.0";
try { VERSION = require("../package.json").version || VERSION; } catch (e) {}

module.exports = async function handler(req, res) {
  const out = {
    status: "ok",
    app: "kidgrow-pro",
    version: VERSION,
    time: new Date().toISOString(),
    checks: {
      supabaseConfigured: !!process.env.SUPABASE_URL,
      razorpayConfigured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      webhookSecretSet: !!process.env.RAZORPAY_WEBHOOK_SECRET,
    },
  };
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(process.env.SUPABASE_URL + "/auth/v1/health", {
        headers: { apikey: process.env.SUPABASE_ANON_KEY },
        signal: ctl.signal,
      });
      clearTimeout(t);
      out.checks.supabaseLive = r.ok;
    } catch (e) { out.checks.supabaseLive = false; }
  }
  return res.status(200).json(out);
};

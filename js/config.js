/* =====================================================================
   KidGrow Pro — cloud / subscription config (PUBLIC values only — safe to ship).
   Fill these in, commit, redeploy. Leave blank = local-only mode (today's
   behaviour: open app, data on device, no login). See PRODUCTION-SETUP.md.
   Server secrets (service key, Razorpay secret, webhook secret) live ONLY in
   Vercel env vars — never in this file.
   ===================================================================== */
window.KIDGROW_CONFIG = {
  SUPABASE_URL: "",        // e.g. "https://xyzcompany.supabase.co"
  SUPABASE_ANON_KEY: "",   // Supabase → Settings → API → anon public key
  RAZORPAY_KEY_ID: "",     // Razorpay → Settings → API Keys → Key ID (rzp_live_xxx)
  PLAN_NAME: "KidGrow Pro Monthly",
  PLAN_PRICE: "₹499/month",
  TRIAL_DAYS: 14,          // must match trial interval in supabase/schema.sql
  OFFLINE_GRACE_DAYS: 7    // paid users stay usable offline this long after last check
};

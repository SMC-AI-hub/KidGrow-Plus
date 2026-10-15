/* =====================================================================
   KidGrow Pro — cloud / subscription config (PUBLIC values only — safe to ship).
   Fill these in, commit, redeploy. Leave blank = local-only mode (today's
   behaviour: open app, data on device, no login). See PRODUCTION-SETUP.md.
   Server secrets (service key, Razorpay secret, webhook secret) live ONLY in
   Vercel env vars — never in this file.
   ===================================================================== */
window.KIDGROW_CONFIG = {
  SUPABASE_URL: "https://bubnidgejmbzkevxvthl.supabase.co",        // e.g. "https://xyzcompany.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Ym5pZGdlam1iemtldnh2dGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjgxODAsImV4cCI6MjEwNzY0NDE4MH0.snE07RKn10WdnTGIdxV90ElQh8C9nPnAoCIsM8cmW4I",   // Supabase → Settings → API → anon public key
  RAZORPAY_KEY_ID: "",     // Razorpay → Settings → API Keys → Key ID (rzp_live_xxx)
  PLAN_NAME: "KidGrow Pro Monthly",
  PLAN_PRICE: "₹499/month",
  TRIAL_DAYS: 14,          // must match trial interval in supabase/schema.sql
  OFFLINE_GRACE_DAYS: 7    // paid users stay usable offline this long after last check
};

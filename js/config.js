/* =====================================================================
   NeoKid Care — cloud / subscription config (PUBLIC values only — safe to ship).
   Multi-env: the app picks keys by hostname, so staging and prod both build
   from main with zero branch juggling and no way to point staging at prod data.
   - kidgrow-staging.* / localhost / unknown hosts  → staging keys (safe default)
   - kidgrow-prod.* (+ custom prod domains added below) → prod keys
   ?env=staging|prod overrides the pick (testing only).
   Server secrets (service key, Razorpay secret, webhook secret) live ONLY in
   Vercel env vars — never in this file.
   ===================================================================== */
(function () {
  var STAGING = {
    SUPABASE_URL: "https://bubnidgejmbzkevxvthl.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1Ym5pZGdlam1iemtldnh2dGhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNjgxODAsImV4cCI6MjEwNzY0NDE4MH0.snE07RKn10WdnTGIdxV90ElQh8C9nPnAoCIsM8cmW4I"
  };
  var PROD = {
    SUPABASE_URL: "https://jmlvcrekttbzibqitftj.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImptbHZjcmVrdHRiemlicWl0ZnRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwNzk3MDQsImV4cCI6MjEwNzY1NTcwNH0.Rt6sucMB101Z2sfn_DdvrUeC2FJWH0fLYOCH9X0EKmM"
  };
  var PROD_HOSTS = ["kidgrow-prod"]; // substrings of location.hostname; add custom domain here (kidgrow-plus retired 2026-10-21)
  var host = "", query = "";
  try {
    if (typeof location !== "undefined" && location) {
      host = location.hostname || "";
      query = location.search || "";
    }
  } catch (e) { host = ""; }
  var pick = "staging";
  if (/[?&]env=prod\b/.test(query)) pick = "prod";
  else if (/[?&]env=staging\b/.test(query)) pick = "staging";
  else if (PROD_HOSTS.some(function (h) { return host.indexOf(h) > -1; })) pick = "prod";
  var env = pick === "prod" ? PROD : STAGING;
  var g = (typeof window !== "undefined" && window) || (typeof globalThis !== "undefined" && globalThis) || {};
  g.KIDGROW_CONFIG = {
    SUPABASE_URL: env.SUPABASE_URL,
    SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
    KIDGROW_ENV: pick, // "staging" | "prod" — surfaced for banners/debugging
    RAZORPAY_KEY_ID: "",     // Razorpay → Settings → API Keys → Key ID (rzp_live_xxx)
    PLAN_NAME: "NeoKid Care Monthly",
    PLAN_PRICE: "₹499/month",
    TRIAL_DAYS: 14,          // must match trial interval in supabase/schema.sql
    OFFLINE_GRACE_DAYS: 7    // paid users stay usable offline this long after last check
  };
})();

# KidGrow Pro — production setup (Supabase + Vercel + Razorpay)

What you get: clinic accounts with login, a **14-day free trial**, **monthly subscription**
billing in ₹, automatic **cloud backup**, and **multi-device sync** — while the app keeps
working **offline** (paid users get 7 days offline grace).

You do 4 things (accounts are yours — nobody can do this part for you):
**Supabase → Razorpay → Vercel → paste 3 keys into the app.** ~45 minutes total.

> Until you paste keys into `js/config.js`, the app runs exactly as today —
> local-only, no login. Nothing breaks while you set this up.

---

## Step 1 — Supabase (database + login) — ~10 min

1. Go to **https://supabase.com** → sign up → **New project**.
   - Name: `kidgrow-pro`, set a database password (save it somewhere), region: **Mumbai (ap-south-1)**.
   - Wait ~2 min for provisioning.
2. **SQL Editor** (left sidebar) → **New query** → paste the entire contents of
   `supabase/schema.sql` from this repo → **Run**.
   - Creates `profiles` (accounts + trial + subscription), `clinic_snapshots`
     (cloud backups), `subscription_events` (billing audit) — with row-level
     security so each clinic sees **only its own data**.
3. **Project Settings → API** (left sidebar bottom) — copy these 3 values:
   - `Project URL` → e.g. `https://xyzcompany.supabase.co`
   - `anon public` key → goes into the app (safe to ship)
   - `service_role secret` key → goes into Vercel ONLY (never in the app/repo!)
4. **Authentication → Sign In / Up** (defaults are fine): email confirmation stays **ON**
   (clinics confirm their email, then the 14-day trial starts automatically).

## Step 2 — Razorpay (monthly billing in ₹) — ~15 min + KYC wait

1. Go to **https://razorpay.com** → sign up as a business → complete KYC
   (PAN + bank account; approval usually 1–3 days — meanwhile use **Test Mode**).
2. Stay in **Test Mode** (toggle, top bar) for now.
3. **Products → Subscriptions → Plans → Create Plan**:
   - Billing: **Monthly**, amount (e.g. **₹499**), name: `KidGrow Pro Monthly`.
   - Copy the **Plan ID** (`plan_xxxx`).
4. **Settings → API Keys → Generate** (test mode) → copy **Key ID** (`rzp_test_…`)
   and **Key Secret**.
5. Webhooks come after Step 3 (you need your Vercel URL first) — don't skip it:
   **Settings → Webhooks → Add** → URL `https://YOUR-APP.vercel.app/api/razorpay-webhook`
   → secret (make one up, save it) → enable events:
   `subscription.authenticated`, `subscription.activated`, `subscription.charged`,
   `subscription.cancelled`, `subscription.completed`, `subscription.expired`,
   `payment.failed`.

## Step 3 — Vercel (hosting + payment backend) — ~10 min

1. Go to **https://vercel.com** → sign up with GitHub → **Add New → Project** →
   import **`KidGrow-Plus`** → Deploy (defaults; framework preset: Other).
2. After the first deploy: **Project → Settings → Environment Variables** — add all 7:
   | Variable | Value from |
   |---|---|
   | `SUPABASE_URL` | Step 1.3 |
   | `SUPABASE_ANON_KEY` | Step 1.3 |
   | `SUPABASE_SERVICE_KEY` | Step 1.3 (secret!) |
   | `RAZORPAY_KEY_ID` | Step 2.4 |
   | `RAZORPAY_KEY_SECRET` | Step 2.4 (secret!) |
   | `RAZORPAY_PLAN_ID` | Step 2.3 |
   | `RAZORPAY_WEBHOOK_SECRET` | Step 2.5 (secret!) |
3. **Deployments → ⋯ → Redeploy** (so the new variables take effect).
4. Note your URL: `https://kid-grow-plus-xxx.vercel.app` (rename in Settings if you like).
   Now finish **Step 2.5** (webhook) with this URL.

## Step 4 — switch the app to cloud mode — ~5 min

1. Edit **`js/config.js`** in the repo — fill the 3 public values:
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` (Step 1.3), `RAZORPAY_KEY_ID` (Step 2.4).
   - Set `PLAN_PRICE` to match your Razorpay plan (e.g. `"₹499/month"`).
2. Commit + push. Both sites redeploy automatically (~1 min):
   - Vercel (production, with subscriptions) and GitHub Pages (demo mirror —
     note: Pages has no `/api/*`, so Subscribe only works on the Vercel URL;
     login/trial/sync work on both).

## Step 5 — end-to-end test (do this in Razorpay Test Mode)

1. Open your **Vercel** URL → **Sign up** (new email) → confirm email → sign in.
   - You should see the 🎁 trial banner ("14 days left") and full app access.
2. Add a child, wait ~10 s → **Settings → ☁️ Cloud** should say "Synced just now ✓".
3. Open the same URL in a **different browser / Incognito** → sign in →
   **Download from cloud** → your child appears. Sync works. ✅
4. Tap **Subscribe** → pay with a [Razorpay test card](https://razorpay.com/docs/payments/testing/)
   (e.g. `4111 1111 1111 1111`) → within ~30 s the banner clears and Settings shows
   **✅ Subscribed**. (If it stalls: Vercel → Logs, and Razorpay → Webhooks → check delivery.)
5. Expired-trial check: in Supabase → Table Editor → `profiles`, set your
   `trial_ends_at` to yesterday → reload app → 💎 paywall appears. Set it back. ✅

## Going live (real money)

1. Razorpay: finish KYC → toggle to **Live Mode** → recreate the plan + keys
   (live objects are separate) → update the webhook URL (same Vercel URL).
2. Vercel env vars: replace test values with **live** Key ID/Secret/Plan ID/Webhook secret → Redeploy.
3. `js/config.js`: replace `RAZORPAY_KEY_ID` with the **live** `rzp_live_…` → commit + push.
4. Take one real ₹ subscription yourself, then refund/cancel it in the Razorpay dashboard.
5. Optional: custom domain (Vercel → Settings → Domains) + your logo/pricing tweaks.

## Money & cost notes

- Supabase free tier + Vercel hobby tier comfortably cover starting out (tens of clinics).
- Razorpay charges a small % per successful charge (check current India pricing —
  domestic cards/UPI/netbanking supported, including UPI AutoPay for mandates).
- You see every billing event in Supabase → `subscription_events`; every charge lands
  in your Razorpay Settlements → your bank account on Razorpay's schedule.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Payment backend not reachable" | Vercel env vars missing/stale → add → **Redeploy** |
| Paid but still trial banner | Webhook not delivered: check Razorpay → Webhooks → logs; URL must be exact `/api/razorpay-webhook`; secret must match Vercel var |
| "Session expired — sign in again" | Normal after long idle; sign in again |
| Offline clinic | Works for 7 days after last online check, then asks to go online once |
| Data conflict between devices | App asks: keep this device OR cloud (loser kept as local fallback) |

## Security recap

- `service_role` key, Razorpay secret, webhook secret: **Vercel env vars only**, never committed.
- `SUPABASE_ANON_KEY` + `RAZORPAY_KEY_ID` in `js/config.js` are public by design;
  Supabase **RLS** guarantees clinics can only read/write **their own** rows.
- Webhook calls are HMAC-verified; forged "I paid" requests are rejected.

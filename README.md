# KidGrow Pro 👶 — Paediatric Clinic Suite (IAP Standards Edition)

Offline-first web app for child health records (birth–18 y), built to Indian Academy
of Pediatrics (IAP) standards. Installs as an app (PWA) on Android, iPhone, Windows —
works fully offline after first open. No backend, no build step, no database server.

> **Live demo:** host this folder on any static host (setup below) — or serve locally:
> `python3 -m http.server 8080` → http://localhost:8080

## ✨ What's inside (25 modules)

| Area | Modules |
|---|---|
| Overview | Dashboard (hero + clinic pulse), Children registry, Newborn care, Schedule & reminders |
| Clinical | Milestones (13 bands, 4 domains), Vaccination record (IAP ACVIP 2023-24), QR vaccine card, AEFI register, Growth (WHO/CDC/IAP), Labs & anaemia, Screening (asthma + dental), Diet planner, Visits (SOAP), Prescription (mg/kg engine), E-consent with signature |
| Front office | Tokens & billing, Vaccine stock (auto-deduct + expiry), TV token display |
| Insights | Analytics, Emergency dose reckoner (PALS), Parent handouts (EN/TA/HI), Reports & certificates, CSV/ABHA/JSON exports |
| System | Users + PIN roles + audit trail, Settings (clinic profile, logo, letterheads) |

Plus: demo clinic data on first run, Tamil + Hindi parent handouts, WhatsApp reminder
sharing, print-ready Rx / receipts / certificates, dark mode.

## 🚀 Host it free (2 minutes)

Any static host works — the app is just HTML/CSS/JS:

- **Netlify Drop:** unzip → drag the folder onto https://app.netlify.com/drop (no account needed) → instant `https://…netlify.app` link
- **GitHub Pages:** push this repo → Settings → Pages → Deploy from branch → `https://<you>.github.io/<repo>/`
- **Cloudflare Pages / Vercel / any web space:** upload the folder as-is (needs HTTPS for installable mode)

## 📲 Install as an app

- **Android (Chrome):** ⋮ → Install app · **iPhone (Safari):** Share → Add to Home Screen
- **Windows (Chrome/Edge):** Install icon in the address bar

## 🔒 Data & privacy

All records stay in the browser (localStorage) on the clinic's own device —
nothing is uploaded anywhere. Use Dashboard → Export backup regularly; the app
also keeps an automatic backup copy and validates every import.

## 🛠️ Tech

Vanilla HTML + CSS + JS, zero dependencies, zero build. PWA via `manifest.json` +
`sw.js` (offline-first, background refresh, update banner, app shortcuts).
`serve.py` is a tiny no-cache dev server. `tools/build_refs.py` regenerates the
growth references (below) from official sources.

## 📈 Growth suite — accuracy notes

| Age | Reference | Data |
|---|---|---|
| 0–5 y | WHO MGRS 2006 (exact daily LMS) | weight, length/height, BMI, head circ., MUAC (≥3 mo), weight-for-length 45–110 cm, weight-for-height 65–120 cm |
| 2–20 y | CDC 2000 + 2022 extended BMI (exact LMS, alternative view) | weight, stature, BMI |
| 5–18 y | IAP 2015-aligned screening curves (default) + IAP adult-equiv BMI lines 23/27 | weight, height, BMI |
| Preterm | Corrected age to 24 mo + PMA tracking | LBW / preterm classes |

Methods: LMS z-scores with the WHO restricted-SD adjustment beyond ±3;
length/height auto-adjusted ±0.7 cm per WHO rule; weight-for-height as the
primary wasting metric <5 y; SAM/MAM triage with oedema + appetite;
CDC %BMIp95 obesity classes; growth-velocity analysis against standard norms;
Tanner/SMR staging with precocious/delayed puberty flags; upper:lower segment
ratio + arm-span screening; mid-parental height target band on charts.

Fenton 2013 data are license-only (ucalgary.ca/fenton) — preterm infants below
term-equivalent age are directed to official NICU charts; post-discharge
assessment uses corrected age on exact WHO standards.

*Screening aid — clinical judgement prevails. Confirm diagnostic labels on
official printed charts.*

## 📄 License

All rights reserved — private clinic software.

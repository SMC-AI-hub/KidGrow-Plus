# Dashboard values (security record)

Copied from the Supabase dashboard (not SQL) by the owner. Staging recorded
2026-10-23; prod pending.

| # | Value | Staging (`bubnidgejmbzkevxvthl`) | Prod (`jmlvcrekttbzibqitftj`) |
|---|-------|----------------------------------|-------------------------------|
| 1 | Project ref | `bubnidgejmbzkevxvthl` | `jmlvcrekttbzibqitftj` |
| 2 | Region | ap-south-1 | ? |
| 3 | Postgres version (as shown) | 17.11.0.003 | ? |
| 4 | MFA/TOTP enabled? | Yes | ? |
| 5 | Email-confirmation setting | ON (was OFF; enabled by owner 2026-10-23) | ON (already on) |
| 6 | Backup plan | None — Free plan, no automated backups | ? (confirm Pro/PITR!) |
| 7 | Earliest restore point | n/a (no backups) | ? |
| 8 | JWT expiry (seconds) | ? | ? |

Bonus (staging, API → signing keys): current key id
`ad2468af-19eb-45d3-bfb8-1f3f456005a1`, ECC P-256, created ~8 days before
2026-10-23. (Key IDs only — not sensitive.)
Bonus (prod, Settings → JWT Keys 2026-10-23, screenshot
`evidence/ui/prod-jwt-keys-2026-10-23.png`): current
`a57ec55d-eb42-4275-b426-43b76957701c` (ECC P-256, 8 days ago); previous
`dbe95cba-066e-4db5-9df6-81bc61f4335a` (HS256 shared secret, rotated 8 days
ago) — i.e. prod migrated HS256 → ECC ~Oct 15. Dashboard advises revoking
previous keys once all tokens expired; rotation was 8 days ago so the
previous key is revokable now (recommended, both projects).

## Notes

- Staging has NO automated backups (Free plan). Acceptable for staging, but
  prod MUST have a paid backup/PITR plan before go-live — confirm value 6/7
  for prod.
- Project-ref check: values above are staging (`bubnidgejmbzkevxvthl` ≠ prod
  `jmlvcrekttbzibqitftj`). Never mix the two when applying migrations.
- Prod Data API posture observed 2026-10-23 (screenshot
  `evidence/ui/prod-dataapi-settings-2026-10-23.png`): 16/16 tables exposed,
  0/23 functions exposed, Max rows 1000, search_path public+extensions.
- Org plan badge = FREE on the prod project view → prod likely ALSO without
  automated backups/PITR. Upgrade to a paid plan before go-live (mandatory).
- Prod "Automatically expose new tables" is ON — Supabase itself recommends
  OFF. Recommend disabling on prod (and staging) so future tables stay
  private until explicitly exposed. RLS remains the live gate either way.

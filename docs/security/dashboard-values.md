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

Bonus (staging, API → signing keys): key id
`ad2468af-19eb-45d3-bfb8-1f3f456005a1`, ECC P-256, created ~8 days before
2026-10-23. (Key ID only — not sensitive.)

## Notes

- Staging has NO automated backups (Free plan). Acceptable for staging, but
  prod MUST have a paid backup/PITR plan before go-live — confirm value 6/7
  for prod.
- Project-ref check: values above are staging (`bubnidgejmbzkevxvthl` ≠ prod
  `jmlvcrekttbzibqitftj`). Never mix the two when applying migrations.

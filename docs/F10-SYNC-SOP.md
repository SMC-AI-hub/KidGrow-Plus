# F10 — Sync-collision SOP disclosure (staff must read before multi-device use)

NeoKid Care syncs whole-database snapshots between devices and auto-merges them
(`js/syncmerge.js`, convergent union — no conflict popups by design).

## What staff must know

1. **Same-field edits on two offline devices:** the merge keeps the LOCAL
   device's value and writes an audit note (`SyncMerge` entry). It does NOT ask.
2. **New records (visits, Rx, vaccines, bills) never overwrite each other** —
   they union by id. Only edits to the SAME field of the SAME record collide.
3. **Rule of thumb:** finish and sync one device before editing the same patient
   on another. The sync line shows "Synced … ✓" when converged.
4. **If two staff must edit simultaneously,** divide by patient, not by field.
5. **After any "Sync failed — will retry":** do NOT re-enter the same data on a
   second device — the retry will deliver it. Duplicate entry creates duplicate
   rows that must be merged by hand (use Patients → Merge duplicates for charts).

## Collisions are auditable

Every tie-keep writes a device audit entry; security-relevant actions also
mirror to the server audit (F6). Review Users → Audit weekly during pilot.

Owner acknowledgement: ______________________ Date: __________

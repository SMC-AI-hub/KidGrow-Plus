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

## M4 relational sync: deferred (E4 verdict, 2026-10-21)

The per-row relational sync engine (`js/sync-rel.js`) is **present but dormant**:
its server link was never wired (`Cloud._sb` does not exist), so its push/pull
never run. This is deliberate until a live end-to-end drill passes on staging:

- The supported sync path is the **encrypted blob backup + convergent merge**
  above — nothing on this page changes because of M4.
- If Settings shows "Relational sync on standby", that is expected: your data
  is still backed up via the blob path. Do NOT wait for relational sync.
- Offline edits are still detected and queued locally (capped 1,000 ops) so a
  future arming has a clean backlog; the queue does not affect the app.
- Arming requires (owner + engineer): Supabase access (F3), tenant session
  wiring, then a live two-device drill (push, pull, conflict, delete) with a
  rollback snapshot. Until then the verdict stays: **keep blob + monitor**.

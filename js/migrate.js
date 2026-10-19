/* NeoKid Care — schema versioning + migrations (Phase 1 infra).
   DB._sv tracks the record schema. Every phase adds ONE migration that only
   ADDS containers/fields — existing data is never altered or dropped.
   Old backups (no _sv) migrate on import AND on load. */
const SCHEMA_V = 2;
function migEnsureChildV1(c) {
  if (!c || typeof c !== "object") return c;
  if (!c.perinatal || typeof c.perinatal !== "object") c.perinatal = {};
  if (!c.maternal || typeof c.maternal !== "object") c.maternal = {};
  if (!c.family || typeof c.family !== "object") c.family = {};
  if (!Array.isArray(c.allergies)) c.allergies = [];
  if (!Array.isArray(c.problems)) c.problems = [];
  if (Array.isArray(c.visits)) c.visits.forEach((v) => { if (v && !Array.isArray(v.icd)) v.icd = []; });
  return c;
}
function migEnsureVisitV2(v) {
  if (!v || typeof v !== "object") return v;
  if (!v.vitals || typeof v.vitals !== "object") v.vitals = {};
  if (!v.exam || typeof v.exam !== "object") v.exam = {};
  if (typeof v.template !== "string") v.template = "";
  return v;
}
const MIGRATIONS = [
  { v: 1, note: "Phase 1: perinatal/maternal/family containers + allergies + problems + visit ICD", up(db) { (db.children || []).forEach(migEnsureChildV1); } },
  { v: 2, note: "Phase 2: visit vitals + exam + template", up(db) { (db.children || []).forEach((c) => { (c.visits || []).forEach(migEnsureVisitV2); }); } },
];
function migrateDB(db) {
  if (!db || typeof db !== "object") return { from: 0, to: SCHEMA_V, applied: [] };
  let from = db._sv || 0;
  const applied = [];
  for (const m of MIGRATIONS) {
    if (m.v > from) {
      try { m.up(db); } catch (e) { /* migration must never break load/import */ }
      from = m.v;
      applied.push(m.v);
    }
  }
  db._sv = SCHEMA_V;
  return { from: (applied.length ? applied[0] - 1 : SCHEMA_V), to: SCHEMA_V, applied };
}
// Self-boot: app.js load() runs before this file parses, so migrate the live
// DB here too (load/import/fresh paths also call migrateDB — all idempotent).
try { if (typeof DB !== "undefined" && DB && Array.isArray(DB.children)) migrateDB(DB); } catch (e) {}

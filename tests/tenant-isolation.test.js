// KidGrow Pro M1 — cross-tenant isolation suite. Proves at the DATABASE POLICY
// layer that Tenant A cannot reach Tenant B's rows via list/search/IDOR/
// insert/update/delete, that strangers see nothing, and that audit is append-only.
// Runs against embedded Postgres (PG17, zero setup) or $DATABASE_URL (scratch DB).
// Use: node tests/tenant-isolation.test.js   (synthetic data only)
const fs = require("fs"), os = require("os"), path = require("path");
const ROOT = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.log("FAIL:", n); } };
const A = "11111111-1111-1111-1111-111111111111"; // owner, hospital A
const B = "22222222-2222-2222-2222-222222222222"; // owner, hospital B
const C = "33333333-3333-3333-3333-333333333333"; // stranger, no membership
const N = "44444444-4444-4444-4444-444444444444"; // nurse, member of A only

const SHIM = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
DO $outer$ BEGIN IF NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'auth' AND p.proname = 'uid') THEN
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $inner$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $inner$;
END IF; END $outer$;`;

async function withClaim(client, sub, fn) {
  await client.query("BEGIN");
  try {
    if (sub) await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [sub]);
    const r = await fn();
    await client.query("COMMIT");
    return r;
  } catch (e) { try { await client.query("ROLLBACK"); } catch (_) {} throw e; }
}
async function expectDeny(promise) {
  try { await promise; return "allowed"; }
  catch (e) { return e && ["42501", "P0001"].includes(e.code) ? "denied" : "error:" + (e.code || e.message); }
}

async function main() {
  let owner, app, stop = async () => {}, tag = "";
  try {
    if (process.env.DATABASE_URL) {
      const { Client } = require("pg");
      owner = new Client({ connectionString: process.env.DATABASE_URL });
      await owner.connect(); tag = "DATABASE_URL";
      console.log("NOTE: using $DATABASE_URL — point it at a scratch database.");
    } else {
      const m = require("embedded-postgres");
      const Cls = m.default || m.EmbeddedPostgres || m;
      const ep = new Cls({ databaseDir: path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kg-pg-")), "db"), user: "postgres", password: "postgres", port: 55434, persistent: false, onLog: () => {}, onError: () => {} });
      await ep.initialise();
      await ep.start();
      owner = ep.getPgClient(); await owner.connect(); tag = "embedded-postgres PG17";
      stop = async () => { try { await owner.end(); } catch (_) {} try { await ep.stop(); } catch (_) {} };
    }
  } catch (e) {
    console.log("SKIP: no Postgres available (" + (e.message || e) + ").");
    console.log("To run: (a) npm install (embedded Postgres, needs network once), or");
    console.log("       (b) DATABASE_URL=postgres://user:pass@host:5432/scratch node tests/tenant-isolation.test.js");
    process.exit(0);
  }
  console.log("backend:", tag);

  // ---- schema ----
  await owner.query(SHIM);
  await owner.query(fs.readFileSync(path.join(ROOT, "supabase/schema.sql"), "utf8"));
  const migDir = path.join(ROOT, "supabase/migrations");
  for (const f of fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort()) {
    await owner.query(fs.readFileSync(path.join(migDir, f), "utf8"));
  }
  await owner.query("DROP ROLE IF EXISTS app");
  await owner.query("CREATE ROLE app LOGIN PASSWORD 'app-test-pw'");
  await owner.query("GRANT CONNECT ON DATABASE postgres TO app");
  await owner.query("GRANT USAGE ON SCHEMA public TO app");
  await owner.query("GRANT USAGE ON SCHEMA auth TO app"); // Supabase grants this to `authenticated` by default
  await owner.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app");
  await owner.query("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app");
  const { Client } = require("pg");
  const appCfg = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, "://app:app-test-pw@") }
    : { host: "127.0.0.1", port: 55434, user: "app", password: "app-test-pw", database: "postgres" };
  app = new Client(appCfg); await app.connect();

  // ---- setup: two hospitals, one patient each (as the apps would) ----
  const tA = await withClaim(app, A, async () => (await app.query("INSERT INTO tenants (name, plan) VALUES ('City Care (synthetic)', 'clinic') RETURNING id")).rows[0].id);
  const tB = await withClaim(app, B, async () => (await app.query("INSERT INTO tenants (name, plan) VALUES ('Metro Kids (synthetic)', 'nicu') RETURNING id")).rows[0].id);
  ok(tA && tB && tA !== tB, "two tenants created with distinct random ids");
  const mA = await withClaim(app, A, async () => (await app.query("SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tA, A])).rows);
  ok(mA.length === 1 && mA[0].role === "owner", "creator auto-becomes owner (trigger)");
  const pA = await withClaim(app, A, async () => (await app.query("INSERT INTO patients (tenant_id, mrn, name, dob, sex) VALUES ($1,'A-001','Aarav Test','2023-01-02','male') RETURNING id", [tA])).rows[0].id);
  const pB = await withClaim(app, B, async () => (await app.query("INSERT INTO patients (tenant_id, mrn, name, dob, sex) VALUES ($1,'B-001','Diya Test','2022-06-03','female') RETURNING id", [tB])).rows[0].id);
  await withClaim(app, A, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'nurse')", [tA, N]));
  await withClaim(app, A, async () => app.query("INSERT INTO tenant_settings (tenant_id, display_name, mrn_prefix) VALUES ($1,'City Care','CC-')", [tA]));
  await withClaim(app, B, async () => app.query("INSERT INTO tenant_settings (tenant_id, display_name, mrn_prefix) VALUES ($1,'Metro Kids','MK-')", [tB]));

  // ---- attack matrix ----
  const listB = await withClaim(app, B, async () => (await app.query("SELECT id FROM patients")).rows);
  ok(listB.length === 1 && listB[0].id === pB, "B list/search sees only B rows");
  const searchB = await withClaim(app, B, async () => (await app.query("SELECT id FROM patients WHERE name ILIKE '%test%'")).rows);
  ok(searchB.length === 1 && searchB[0].id === pB, "B name-search cannot find A patient");
  const idor = await withClaim(app, B, async () => (await app.query("SELECT id FROM patients WHERE id=$1", [pA])).rows);
  ok(idor.length === 0, "B cannot fetch A row by guessed UUID (IDOR)");
  ok(await expectDeny(withClaim(app, B, async () => app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'X-1','Intruder')", [tA]))) === "denied", "B cannot insert into A tenant");
  ok((await withClaim(app, B, async () => (await app.query("UPDATE patients SET name='Pwned' WHERE id=$1", [pA])).rowCount)) === 0, "B update of A row touches 0 rows");
  ok((await withClaim(app, B, async () => (await app.query("DELETE FROM patients WHERE id=$1", [pA])).rowCount)) === 0, "B delete of A row touches 0 rows");
  const setB = await withClaim(app, B, async () => (await app.query("SELECT display_name FROM tenant_settings WHERE tenant_id=$1", [tA])).rows);
  ok(setB.length === 0, "B cannot read A branding/settings");
  ok((await withClaim(app, B, async () => (await app.query("UPDATE tenant_settings SET display_name='Pwned' WHERE tenant_id=$1", [tA])).rowCount)) === 0, "B cannot overwrite A branding");
  const listC = await withClaim(app, C, async () => (await app.query("SELECT id FROM patients")).rows);
  ok(listC.length === 0, "stranger lists 0 patients");
  ok(await expectDeny(withClaim(app, C, async () => app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'X-9')", [tA]))) === "denied", "stranger insert denied");
  const list0 = await withClaim(app, null, async () => (await app.query("SELECT id FROM patients")).rows);
  ok(list0.length === 0, "unauthenticated lists 0 patients");
  const listN = await withClaim(app, N, async () => (await app.query("SELECT id FROM patients")).rows);
  ok(listN.length === 1 && listN[0].id === pA, "nurse of A sees A rows (and only A)");
  ok((await withClaim(app, N, async () => (await app.query("UPDATE tenant_settings SET display_name='Nurse' WHERE tenant_id=$1", [tA])).rowCount)) === 0, "nurse cannot change tenant settings");
  ok((await withClaim(app, A, async () => (await app.query("UPDATE tenant_settings SET display_name='City Care+ ' WHERE tenant_id=$1", [tA])).rowCount)) === 1, "owner can change own settings");

  // ---- encounters: composite FK blocks cross-tenant links ----
  await withClaim(app, B, async () => app.query("INSERT INTO encounters (tenant_id, patient_id, kind) VALUES ($1,$2,'opd')", [tB, pB]));
  let fkBlocked = false;
  try { await withClaim(app, B, async () => app.query("INSERT INTO encounters (tenant_id, patient_id, kind) VALUES ($1,$2,'opd')", [tB, pA])); }
  catch (e) { fkBlocked = e.code === "23503"; }
  ok(fkBlocked, "encounter cannot link B tenant to A patient (composite FK)");
  const encB = await withClaim(app, B, async () => (await app.query("SELECT id FROM encounters")).rows);
  ok(encB.length === 1, "B lists only own encounters");

  // ---- audit: members append own, only owner/admin/auditor read, never rewrite ----
  await withClaim(app, A, async () => app.query("INSERT INTO audit_events (tenant_id, actor_id, action, record_table, record_id) VALUES ($1,$2,'patient.view','patients',$3)", [tA, A, pA]));
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO audit_events (tenant_id, actor_id, action) VALUES ($1,$2,'spoof')", [tA, B]))) === "denied", "cannot forge another actor_id in audit");
  ok(await expectDeny(withClaim(app, B, async () => app.query("INSERT INTO audit_events (tenant_id, actor_id, action) VALUES ($1,$2,'x')", [tA, B]))) === "denied", "cannot write audit into foreign tenant");
  const audN = await withClaim(app, N, async () => (await app.query("SELECT id FROM audit_events")).rows);
  ok(audN.length === 0, "nurse cannot read audit log");
  const audA = await withClaim(app, A, async () => (await app.query("SELECT id FROM audit_events")).rows);
  ok(audA.length === 1, "owner reads own audit trail");
  // RLS filters UPDATE/DELETE (no error) — assert 0 rows touched + row intact.
  const audUpd = await withClaim(app, A, async () => (await app.query("UPDATE audit_events SET action='edited' WHERE tenant_id=$1", [tA])).rowCount);
  const audStill = await withClaim(app, A, async () => (await app.query("SELECT action FROM audit_events WHERE tenant_id=$1", [tA])).rows);
  ok(audUpd === 0 && audStill.length === 1 && audStill[0].action === "patient.view", "audit is append-only (no update)");
  const audDel = await withClaim(app, A, async () => (await app.query("DELETE FROM audit_events WHERE tenant_id=$1", [tA])).rowCount);
  const audLeft = await withClaim(app, A, async () => (await app.query("SELECT id FROM audit_events WHERE tenant_id=$1", [tA])).rows);
  ok(audDel === 0 && audLeft.length === 1, "audit is append-only (no delete)");

  // ---- last-owner guard ----
  ok(await expectDeny(withClaim(app, A, async () => app.query("DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tA, A]))) === "denied", "cannot remove the last owner");

  // ---- same MRN in two tenants must coexist ----
  await withClaim(app, B, async () => app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'A-001','Same-MRN Other-Tenant')", [tB]));
  const mrnB = await withClaim(app, B, async () => (await app.query("SELECT name FROM patients WHERE mrn='A-001'")).rows);
  ok(mrnB.length === 1 && mrnB[0].name === "Same-MRN Other-Tenant", "MRN uniqueness is per-tenant, not global");

  // ================= M3 (0002): quotas, lifecycle, invites, break-glass, consents =================
  const D = "55555555-5555-5555-5555-555555555555"; // quota-tenant owner
  const E = "66666666-6666-6666-6666-666666666666"; // invitee
  const F = "77777777-7777-7777-7777-777777777777"; // wrong-email stranger
  await owner.query("INSERT INTO auth.users (id, email) VALUES ($1,'owner-a@synthetic.test'),($2,'nurse-e@synthetic.test'),($3,'stranger-f@synthetic.test') ON CONFLICT (id) DO NOTHING", [A, E, F]);

  // ---- quota values ----
  const q = async (p, k) => (await owner.query("SELECT public.plan_quota($1,$2) AS v", [p, k])).rows[0].v;
  ok((await q("solo", "users")) === "1" && (await q("clinic", "patients")) === "5000", "plan_quota returns plan limits");
  ok((await q("enterprise", "users")) === null && (await q("trial", "patients")) === "200", "enterprise unlimited, trial capped");

  // ---- member quota enforced (tA has owner+nurse = 2; solo allows 1) ----
  await withClaim(app, A, async () => app.query("UPDATE tenants SET plan='solo' WHERE id=$1", [tA]));
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'doctor')", [tA, F]))) === "denied", "member insert over quota denied");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET plan='clinic' WHERE id=$1", [tA]));

  // ---- patient quota enforced (solo = 500) ----
  const tD = await withClaim(app, D, async () => (await app.query("INSERT INTO tenants (name, plan) VALUES ('Quota Test (synthetic)', 'solo') RETURNING id")).rows[0].id);
  const bulk = [];
  for (let i = 0; i < 500; i++) bulk.push(`($1,'Q-${i}','Quota ${i}')`);
  await withClaim(app, D, async () => app.query(`INSERT INTO patients (tenant_id, mrn, name) VALUES ${bulk.join(",")}`, [tD]));
  ok(await expectDeny(withClaim(app, D, async () => app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'Q-OVER','Over')", [tD]))) === "denied", "501st patient on solo plan denied");
  const qCount = await withClaim(app, D, async () => (await app.query("SELECT count(*) AS n FROM patients WHERE tenant_id=$1", [tD])).rows[0].n);
  ok(qCount === "500", "quota holds exactly 500 rows");

  // ---- suspension: read-only, never blind ----
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='suspended', suspended_at=now() WHERE id=$1", [tA]));
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'S-1','Susp')", [tA]))) === "denied", "suspended: owner insert denied");
  ok((await withClaim(app, A, async () => (await app.query("UPDATE patients SET name='X' WHERE id=$1", [pA])).rowCount)) === 0, "suspended: owner update touches 0");
  ok((await withClaim(app, A, async () => (await app.query("SELECT id FROM patients WHERE id=$1", [pA])).rows)).length === 1, "suspended: owner still reads (export-safe)");
  ok((await withClaim(app, N, async () => (await app.query("SELECT id FROM patients")).rows)).length === 1, "suspended: members still read");
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO invites (tenant_id, email, role) VALUES ($1,'x@y.z','nurse')", [tA]))) === "denied", "suspended: invite creation denied");
  await withClaim(app, N, async () => app.query("INSERT INTO break_glass_events (tenant_id, actor_id, reason) VALUES ($1,$2,'Emergency care needed')", [tA, N]));
  ok(true, "suspended: break-glass stays loggable (deliberate)");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='active', suspended_at=null WHERE id=$1", [tA]));

  // ---- grace window ----
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='grace', grace_until=now()+interval '3 days' WHERE id=$1", [tA]));
  await withClaim(app, A, async () => app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'G-1','Grace')", [tA]));
  ok(true, "grace (valid): writes allowed");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET grace_until=now()-interval '1 day' WHERE id=$1", [tA]));
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'G-2','Late')", [tA]))) === "denied", "grace (expired): writes denied");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='active', grace_until=null WHERE id=$1", [tA]));

  // ---- closed: members blind, owners keep export ----
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='closed' WHERE id=$1", [tA]));
  ok((await withClaim(app, N, async () => (await app.query("SELECT id FROM patients")).rows)).length === 0, "closed: members see nothing");
  ok((await withClaim(app, A, async () => (await app.query("SELECT id FROM patients")).rows)).length >= 1, "closed: owners keep read/export");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='active' WHERE id=$1", [tA]));

  // ---- legal hold blocks delete ----
  await withClaim(app, A, async () => app.query("UPDATE patients SET legal_hold=true WHERE id=$1", [pA]));
  ok((await withClaim(app, A, async () => (await app.query("DELETE FROM patients WHERE id=$1", [pA])).rowCount)) === 0, "legal_hold: owner delete blocked");
  await withClaim(app, A, async () => app.query("UPDATE patients SET legal_hold=false WHERE id=$1", [pA]));

  // ---- consents: isolated, withdraw-not-erase ----
  const cA = await withClaim(app, A, async () => (await app.query("INSERT INTO consents (tenant_id, patient_id, purpose, granted_by) VALUES ($1,$2,'care','Mother') RETURNING id", [tA, pA])).rows[0].id);
  ok(!!cA, "consent recorded");
  await withClaim(app, A, async () => app.query("UPDATE consents SET status='withdrawn', withdrawn_at=now() WHERE id=$1", [cA]));
  ok((await withClaim(app, B, async () => (await app.query("SELECT id FROM consents WHERE patient_id=$1", [pA])).rows)).length === 0, "B cannot see A consents");
  ok(await expectDeny(withClaim(app, B, async () => app.query("INSERT INTO consents (tenant_id, patient_id, purpose) VALUES ($1,$2,'care')", [tA, pA]))) === "denied", "B cannot write A consent");
  ok((await withClaim(app, A, async () => (await app.query("DELETE FROM consents WHERE id=$1", [cA])).rowCount)) === 0, "consents cannot be deleted (withdraw only)");

  // ---- break-glass rules ----
  let shortRej = false;
  try { await withClaim(app, N, async () => app.query("INSERT INTO break_glass_events (tenant_id, actor_id, reason) VALUES ($1,$2,'short')", [tA, N])); }
  catch (e) { shortRej = e.code === "23514"; }
  ok(shortRej, "break-glass rejects short reasons (min 8 chars)");
  const bgN = await withClaim(app, N, async () => (await app.query("SELECT id FROM break_glass_events WHERE tenant_id=$1", [tA])).rows);
  ok(bgN.length >= 1, "actor reads own break-glass rows");
  ok((await withClaim(app, B, async () => (await app.query("SELECT id FROM break_glass_events")).rows)).length === 0, "B cannot read A break-glass");
  ok((await withClaim(app, A, async () => (await app.query("SELECT id FROM break_glass_events WHERE tenant_id=$1", [tA])).rows)).length >= 1, "owner audits break-glass");

  // ---- invites: email-bound, single-use, expiring ----
  const inv = await withClaim(app, A, async () => (await app.query("INSERT INTO invites (tenant_id, email, role) VALUES ($1,'nurse-e@synthetic.test','nurse') RETURNING token", [tA])).rows[0].token);
  ok(typeof inv === "string" && inv.length >= 32, "invite token issued");
  ok((await withClaim(app, E, async () => (await app.query("SELECT id FROM invites")).rows)).length === 1, "invitee sees own invite");
  ok((await withClaim(app, F, async () => (await app.query("SELECT id FROM invites")).rows)).length === 0, "wrong-email user sees no invite");
  ok(await expectDeny(withClaim(app, F, async () => app.query("SELECT public.accept_invite($1)", [inv]))) === "denied", "wrong-email accept rejected");
  const joined = await withClaim(app, E, async () => (await app.query("SELECT public.accept_invite($1) AS t", [inv])).rows[0].t);
  ok(joined === tA, "invitee joins the right tenant");
  const mE = await withClaim(app, E, async () => (await app.query("SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tA, E])).rows);
  ok(mE.length === 1 && mE[0].role === "nurse", "membership created with invited role");
  ok(await expectDeny(withClaim(app, E, async () => app.query("SELECT public.accept_invite($1)", [inv]))) === "denied", "invite single-use (replay rejected)");
  await withClaim(app, A, async () => app.query("INSERT INTO invites (tenant_id, email, role, expires_at) VALUES ($1,'nurse-e@synthetic.test','nurse', now()-interval '1 day')", [tA]));
  const oldTok = await withClaim(app, A, async () => (await app.query("SELECT token FROM invites WHERE tenant_id=$1 AND accepted_at IS NULL ORDER BY created_at DESC LIMIT 1", [tA])).rows[0].token);
  ok(await expectDeny(withClaim(app, E, async () => app.query("SELECT public.accept_invite($1)", [oldTok]))) === "denied", "expired invite rejected");

  // ================= M4 (0003): idempotent apply ops =================
  const P1 = { tenant_id: tA, local_id: "c_kid1", client_rev: "2026-10-01T10:00:00Z", mrn: "CC-1", name: "Aarav Sync", dob: "2023-01-02", sex: "male", birth_weight_g: 3100, guardian: { mother: "M" }, allergies: ["penicillin"] };
  const ap = async (u, fn, row) => (await withClaim(app, u, async () => (await app.query(`SELECT public.${fn}($1) AS r`, [JSON.stringify(row)])).rows[0].r));
  ok(await ap(A, "apply_patient_op", P1) === "inserted", "apply_patient_op inserts");
  ok(await ap(A, "apply_patient_op", { ...P1, name: "Aarav S.", client_rev: "2026-10-02T10:00:00Z" }) === "updated", "newer rev updates");
  ok(await ap(A, "apply_patient_op", { ...P1, name: "Stale", client_rev: "2026-10-01T09:00:00Z" }) === "stale", "older rev rejected as stale");
  ok(await ap(A, "apply_patient_op", { ...P1, name: "Replay", client_rev: "2026-10-02T10:00:00Z" }) === "stale", "replay of same rev is a safe no-op");
  const p1name = await withClaim(app, A, async () => (await app.query("SELECT name FROM patients WHERE tenant_id=$1 AND local_id='c_kid1'", [tA])).rows[0].name);
  ok(p1name === "Aarav S.", "LWW kept the newest write");
  ok(await expectDeny(withClaim(app, B, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ ...P1, local_id: "c_evil" })]))) === "denied", "cross-tenant apply rejected");
  ok(await expectDeny(withClaim(app, C, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify(P1)]))) === "denied", "stranger apply rejected");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='suspended' WHERE id=$1", [tA]));
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ ...P1, local_id: "c_susp", mrn: "CC-S" })]))) === "denied", "apply while suspended rejected");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='active' WHERE id=$1", [tA]));
  ok(await expectDeny(withClaim(app, D, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ tenant_id: tD, local_id: "c_q", client_rev: "2026-10-03T00:00:00Z", mrn: "Q-X", name: "Over" })]))) === "denied", "apply over patient quota rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ ...P1, local_id: "" })]))) === "denied", "missing local_id rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ ...P1, local_id: "c_fut", mrn: "CC-F", dob: "2031-01-01" })]))) === "denied", "future dob rejected");
  const E1 = { tenant_id: tA, local_id: "e_v1", client_rev: "2026-10-02T11:00:00Z", patient_local_id: "c_kid1", kind: "opd", status: "closed", started_at: "2026-10-02T09:00:00Z" };
  ok(await ap(A, "apply_encounter_op", E1) === "inserted", "apply_encounter_op inserts");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_encounter_op($1)", [JSON.stringify({ ...E1, local_id: "e_ghost", patient_local_id: "c_nonexistent" })]))) === "denied", "encounter for unknown patient rejected");
  ok(await expectDeny(withClaim(app, B, async () => app.query("SELECT public.apply_encounter_op($1)", [JSON.stringify({ ...E1, tenant_id: tB, local_id: "e_x" })]))) === "denied", "encounter cannot steal another tenant's patient");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_encounter_op($1)", [JSON.stringify({ ...E1, local_id: "e_bad", kind: "surgery" })]))) === "denied", "invalid encounter kind rejected");
  const K1 = { tenant_id: tA, local_id: "k_c1", client_rev: "2026-10-02T12:00:00Z", patient_local_id: "c_kid1", purpose: "care", status: "granted", granted_by: "Mother" };
  ok(await ap(A, "apply_consent_op", K1) === "inserted", "apply_consent_op inserts");
  ok(await ap(A, "apply_consent_op", { ...K1, status: "withdrawn", client_rev: "2026-10-03T12:00:00Z" }) === "updated", "consent withdraw updates");
  ok(await ap(A, "apply_patient_op", { ...P1, deleted: "true", client_rev: "2026-10-04T10:00:00Z" }) === "updated", "soft-delete via deleted flag");
  const p1del = await withClaim(app, A, async () => (await app.query("SELECT deleted_at FROM patients WHERE tenant_id=$1 AND local_id='c_kid1'", [tA])).rows[0].deleted_at);
  ok(!!p1del, "deleted_at stamped, row preserved for audit");

  // ================= M5 (0004): clinical apply ops =================
  const ac = async (u, table, row) => (await withClaim(app, u, async () => (await app.query("SELECT public.apply_clinical_op($1,$2) AS r", [table, JSON.stringify(row)])).rows[0].r));
  ok(await ap(A, "apply_patient_op", { tenant_id: tA, local_id: "c_m5kid", client_rev: "2026-10-05T09:00:00Z", mrn: "CC-M5", name: "M5 Kid", dob: "2026-09-01", sex: "female" }) === "inserted", "M5 patient seeded");
  const N1 = { tenant_id: tA, local_id: "n_a1", client_rev: "2026-10-06T08:00:00Z", patient_local_id: "c_m5kid", admitted_at: "2026-10-06T08:00:00Z", birth_weight_g: 2400, ga_weeks: 36, status: "admitted", indication: "RDS" };
  ok(await ac(A, "nicu_admissions", N1) === "inserted", "admission inserts");
  ok(await ac(A, "nicu_admissions", { ...N1, status: "discharged", outcome: "stable", client_rev: "2026-10-09T10:00:00Z" }) === "updated", "admission discharge updates");
  ok(await ac(A, "nicu_admissions", { ...N1, indication: "stale", client_rev: "2026-10-06T07:00:00Z" }) === "stale", "stale admission rev rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["nicu_admissions", JSON.stringify({ ...N1, local_id: "n_ghost", patient_local_id: "c_nope" })]))) === "denied", "admission for unknown patient rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["nicu_admissions", JSON.stringify({ ...N1, local_id: "n_bad", status: "vacation" })]))) === "denied", "invalid admission status rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["nicu_admissions", JSON.stringify({ ...N1, local_id: "n_fut", admitted_at: "2031-05-01T00:00:00Z" })]))) === "denied", "future admitted_at rejected");
  const R1 = { tenant_id: tA, local_id: "r_d1", client_rev: "2026-10-07T08:00:00Z", admission_local_id: "n_a1", round_date: "2026-10-07", weight_g: 2450, vitals: { spo2: 94 }, feeds: { ml: 120 }, events: [], note: "stable" };
  ok(await ac(A, "nicu_rounds", R1) === "inserted", "NICU round inserts");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["nicu_rounds", JSON.stringify({ ...R1, local_id: "r_ghost", admission_local_id: "n_nope" })]))) === "denied", "round for unknown admission rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["nicu_rounds", JSON.stringify({ ...R1, local_id: "r_fut", round_date: "2031-01-01" })]))) === "denied", "future round_date rejected");
  const M1 = { tenant_id: tA, local_id: "m_d1", client_rev: "2026-10-07T09:00:00Z", patient_local_id: "c_m5kid", drug: "Morphine", dose: "0.05 mg", route: "IV", freq: "q4h", controlled: true, status: "scheduled", scheduled_at: "2026-10-07T10:00:00Z" };
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["mar_entries", JSON.stringify(M1)]))) === "denied", "controlled drug without witness rejected");
  ok(await ac(A, "mar_entries", { ...M1, witness: "Nurse Joy", given_by: "Dr A", given_at: "2026-10-07T10:05:00Z", status: "given" }) === "inserted", "witnessed controlled dose inserts");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["mar_entries", JSON.stringify({ ...M1, local_id: "m_bad", witness: "x", status: "vaporized" })]))) === "denied", "invalid MAR status rejected");
  const G1 = { tenant_id: tA, local_id: "g_m1", client_rev: "2026-10-07T11:00:00Z", patient_local_id: "c_m5kid", measured_at: "2026-10-07T09:00:00Z", wt_kg: 2.45, len_cm: 46, hc_cm: 33, source: "ward" };
  ok(await ac(A, "growth_points", G1) === "inserted", "growth point inserts");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["growth_points", JSON.stringify({ ...G1, local_id: "g_bad", wt_kg: 900 })]))) === "denied", "absurd weight rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["growth_points", JSON.stringify({ ...G1, local_id: "g_fut", measured_at: "2031-01-01T00:00:00Z" })]))) === "denied", "future measured_at rejected");
  ok(await expectDeny(withClaim(app, B, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["mar_entries", JSON.stringify({ ...M1, local_id: "m_x" })]))) === "denied", "cross-tenant clinical apply rejected");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["oddtable", JSON.stringify({ ...M1, local_id: "m_y" })]))) === "denied", "unknown clinical table rejected");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='suspended' WHERE id=$1", [tA]));
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["growth_points", JSON.stringify({ ...G1, local_id: "g_susp" })]))) === "denied", "clinical apply while suspended rejected");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET status='active' WHERE id=$1", [tA]));
  const aSees = await withClaim(app, A, async () => (await app.query("SELECT count(*)::int AS n FROM mar_entries WHERE tenant_id=$1", [tA])).rows[0].n);
  const bSees = await withClaim(app, B, async () => (await app.query("SELECT count(*)::int AS n FROM mar_entries WHERE tenant_id=$1", [tA])).rows[0].n);
  ok(aSees === 1 && bSees === 0, "clinical SELECT isolated by tenant");

  // ================= 0005: billing profiles + trial provisioning =================
  const ep = await withClaim(app, A, async () => (await app.query("SELECT public.ensure_profile() AS r")).rows[0].r);
  const trialDays = (Date.parse(ep.trial_ends_at) - Date.now()) / 864e5;
  ok(ep.id === A && ep.sub_status === "trialing" && trialDays > 13.9 && trialDays <= 14.01, "ensure_profile provisions a 14-day trial");
  const ep2 = await withClaim(app, A, async () => (await app.query("SELECT public.ensure_profile() AS r")).rows[0].r);
  const profN = await withClaim(app, A, async () => (await app.query("SELECT count(*)::int AS n FROM profiles WHERE id=$1", [A])).rows[0].n);
  ok(ep2.id === A && profN === 1, "ensure_profile is idempotent");
  ok(await expectDeny(app.query("SELECT public.ensure_profile()")) === "denied", "ensure_profile without login rejected");
  const bSeesProf = await withClaim(app, B, async () => (await app.query("SELECT count(*)::int AS n FROM profiles WHERE id=$1", [A])).rows[0].n);
  ok(bSeesProf === 0, "profiles are owner-readable only");
  ok(await expectDeny(withClaim(app, B, async () => app.query("INSERT INTO profiles (id) VALUES ($1)", [B]))) === "denied", "direct profile insert denied");
  const selfGrant = await withClaim(app, A, async () => app.query("UPDATE profiles SET sub_status='active', trial_ends_at='2099-01-01' WHERE id=$1", [A]));
  ok(selfGrant.rowCount === 0, "self-grant to active affects no rows (no update policy)");
  const stAfter = await withClaim(app, A, async () => (await app.query("SELECT sub_status FROM profiles WHERE id=$1", [A])).rows[0].sub_status);
  ok(stAfter === "trialing", "failed self-grant changed nothing");
  ok(await expectDeny(owner.query("UPDATE profiles SET sub_status='gold' WHERE id=$1", [A])) === "error:23514", "junk sub_status violates CHECK");
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO subscription_events (user_id, event) VALUES ($1,'x')", [A]))) === "denied", "direct subscription_events insert denied");
  const seOwn = await withClaim(app, A, async () => (await app.query("SELECT count(*)::int AS n FROM subscription_events WHERE user_id=$1", [A])).rows[0].n);
  ok(seOwn === 0, "owner can read own (empty) subscription events");

  try { await app.end(); } catch (_) {}
  await stop();
  console.log(`\nisolation: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("isolation harness error:", e.message || e); process.exit(1); });

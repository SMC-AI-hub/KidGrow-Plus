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
  await owner.query(fs.readFileSync(path.join(ROOT, "supabase/migrations/0001_tenant_core.sql"), "utf8"));
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

  try { await app.end(); } catch (_) {}
  await stop();
  console.log(`\nisolation: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("isolation harness error:", e.message || e); process.exit(1); });

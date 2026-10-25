// NeoKid Care M1 — cross-tenant isolation suite. Proves at the DATABASE POLICY
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
CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz);
DO $outer$ BEGIN IF NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'auth' AND p.proname = 'uid') THEN
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $inner$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $inner$;
END IF;
IF NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'auth' AND p.proname = 'jwt') THEN
  CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $inner$ SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb $inner$;
END IF; END $outer$;`;

async function withClaim(client, sub, fn, aal) {
  await client.query("BEGIN");
  try {
    if (sub) {
      await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [sub]);
      await client.query("SELECT set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: sub, aal: aal || "aal2" })]);
    }
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
  // Mirror Supabase's built-in roles: vanilla Postgres lacks them and 0006
  // grants EXECUTE to `authenticated`. Idempotent — safe on real Supabase too.
  await owner.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  END $$;`);
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
  await owner.query("GRANT authenticated TO app"); // Supabase parity: app traffic runs as `authenticated` (carries 0006 EXECUTE grant)
  const { Client } = require("pg");
  const appCfg = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, "://app:app-test-pw@") }
    : { host: "127.0.0.1", port: 55434, user: "app", password: "app-test-pw", database: "postgres" };
  app = new Client(appCfg); await app.connect();

  await owner.query("INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1,'owner-a@synthetic.test',now()),($2,'owner-b@synthetic.test',now()),($3,'nurse-n@synthetic.test',now()) ON CONFLICT (id) DO NOTHING", [A, B, N]); // 0010: writers confirmed before setup writes
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
  await owner.query("INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1,'owner-a@synthetic.test',now()),($2,'nurse-e@synthetic.test',now()),($3,'stranger-f@synthetic.test',now()),($4,'owner-b@synthetic.test',now()),($5,'stranger-c@synthetic.test',now()),($6,'owner-d@synthetic.test',now()),($7,'nurse-n@synthetic.test',now()) ON CONFLICT (id) DO NOTHING", [A, E, F, B, C, D, N]);

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

  // ================= 0007: role governance (Phase 2) =================
  const RU = "88888888-8888-8888-8888-888888888888"; // readonly member of A
  const BL = "99999999-9999-9999-9999-999999999999"; // billing member of A
  const AD = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // admin of A
  const O3 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // spare user for owner-grant tests
  await owner.query("INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1,'readonly-ru@synthetic.test',now()),($2,'billing-bl@synthetic.test',now()),($3,'admin-ad@synthetic.test',now()),($4,'spare-o3@synthetic.test',now()) ON CONFLICT (id) DO NOTHING", [RU, BL, AD, O3]); // 0010: all suite writers confirmed
  await withClaim(app, A, async () => app.query("UPDATE tenants SET plan='hospital' WHERE id=$1", [tA])); // quota headroom
  await withClaim(app, A, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'readonly'),($1,$3,'billing'),($1,$4,'admin')", [tA, RU, BL, AD]));
  const rList = await withClaim(app, RU, async () => (await app.query("SELECT id FROM patients")).rows);
  ok(rList.length >= 1, "readonly member still reads own-tenant patients");
  ok(await expectDeny(withClaim(app, RU, async () => app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'R-1','Nope')", [tA]))) === "denied", "readonly insert denied");
  ok(await expectDeny(withClaim(app, RU, async () => app.query("UPDATE patients SET name='X' WHERE id=$1", [pA]))) === "denied", "readonly update denied (loud 42501: USING passes, WITH CHECK fails)");
  ok(await expectDeny(withClaim(app, RU, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ tenant_id: tA, local_id: "c_ro", client_rev: "2026-10-10T00:00:00Z", mrn: "CC-RO", name: "Ro" })]))) === "denied", "readonly sync-RPC denied");
  ok(await expectDeny(withClaim(app, RU, async () => app.query("SELECT public.apply_clinical_op($1,$2)", ["growth_points", JSON.stringify({ tenant_id: tA, local_id: "g_ro", client_rev: "2026-10-10T00:00:00Z", patient_local_id: "c_m5kid", wt_kg: 3 })]))) === "denied", "readonly clinical-RPC denied");
  ok(await expectDeny(withClaim(app, BL, async () => app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'BILL-1')", [tA]))) === "denied", "billing insert denied");
  const nPat = await withClaim(app, N, async () => (await app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'N-1','Nurse Admit') RETURNING id", [tA])).rows[0].id);
  ok(!!nPat, "nurse CAN admit patients (writer role)");
  ok(await ac(N, "mar_entries", { tenant_id: tA, local_id: "m_nurse1", client_rev: "2026-10-10T09:00:00Z", patient_local_id: "c_m5kid", drug: "Paracetamol", dose: "120 mg", route: "PO", freq: "sos", status: "given", given_by: "Nurse N", given_at: "2026-10-10T09:05:00Z" }) === "inserted", "nurse CAN chart MAR via RPC");
  ok((await withClaim(app, A, async () => (await app.query("DELETE FROM patients WHERE id=$1", [pA])).rowCount)) === 0, "owner hard delete is now a silent no-op");
  const pAStill = await withClaim(app, A, async () => (await app.query("SELECT id FROM patients WHERE id=$1", [pA])).rows);
  ok(pAStill.length === 1, "blocked delete left the row intact");
  ok(await expectDeny(withClaim(owner, A, async () => owner.query("DELETE FROM patients WHERE id=$1", [pA]))) === "denied", "trigger backstop fires when RLS is bypassed (owner session + claim)");
  const delPols = await owner.query("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname='public' AND cmd='DELETE' AND tablename IN ('patients','encounters','consents','nicu_admissions','nicu_rounds','mar_entries','growth_points')");
  ok(delPols.rows[0].n === 0, "no DELETE policies survive on clinical tables");
  await owner.query("GRANT anon TO app"); // test-only: let the harness wear the anon role
  await app.query("SET ROLE anon");
  ok(await expectDeny(app.query("SELECT public.apply_patient_op($1)", [JSON.stringify(P1)])) === "denied", "anon cannot execute sync RPC");
  ok(await expectDeny(app.query("SELECT public.accept_invite('nope')")) === "denied", "anon cannot execute accept_invite");
  await app.query("RESET ROLE");
  await owner.query("REVOKE anon FROM app");
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'superwizard')", [tA, O3]))) === "error:23514", "junk role violates CHECK");
  const admDoc = await withClaim(app, AD, async () => (await app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'doctor') RETURNING user_id", [tA, O3])).rows);
  ok(admDoc.length === 1, "admin can grant doctor");
  await withClaim(app, A, async () => app.query("DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tA, O3]));
  ok(await expectDeny(withClaim(app, AD, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'owner')", [tA, O3]))) === "denied", "admin cannot mint owners");
  ok(await expectDeny(withClaim(app, AD, async () => app.query("UPDATE memberships SET role='owner' WHERE tenant_id=$1 AND user_id=$2", [tA, E]))) === "denied", "admin cannot promote to owner");
  ok((await withClaim(app, AD, async () => (await app.query("UPDATE memberships SET role='nurse' WHERE tenant_id=$1 AND user_id=$2", [tA, A])).rowCount)) === 0, "admin cannot demote an owner (0 rows)");
  const aStillOwner = await withClaim(app, A, async () => (await app.query("SELECT role FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tA, A])).rows[0].role);
  ok(aStillOwner === "owner", "failed demotion changed nothing");
  await withClaim(app, A, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'owner')", [tA, O3]));
  ok(true, "owner CAN grant owner (second owner exists)");
  await withClaim(app, A, async () => app.query("DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tA, O3]));
  ok(await expectDeny(withClaim(app, AD, async () => app.query("INSERT INTO invites (tenant_id, email, role) VALUES ($1,'o@x.y','owner')", [tA]))) === "denied", "admin cannot invite owners");
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO invites (tenant_id, email, role) VALUES ($1,'w@x.y','wizard')", [tA]))) === "error:23514", "junk invite role violates CHECK");
  await withClaim(app, A, async () => app.query("UPDATE tenants SET plan='clinic' WHERE id=$1", [tA])); // restore
  // ================= 0008: no RLS-blind privileges to app roles =================
  // (CI never grants these, so this guards the invariant; the live proof is the
  // post-apply check in the 0008 header + the E-block re-run on staging/prod.)
  const priv = async (r, t, p) => (await owner.query("SELECT has_table_privilege($1,$2,$3) AS v", [r, t, p])).rows[0].v;
  ok(await priv("anon", "public.patients", "TRUNCATE") === false, "anon holds no TRUNCATE on patients");
  ok(await priv("authenticated", "public.patients", "TRUNCATE") === false, "authenticated holds no TRUNCATE on patients");
  ok(await priv("anon", "public.patients", "TRIGGER") === false, "anon holds no TRIGGER on patients");
  ok(await priv("authenticated", "public.patients", "TRIGGER") === false, "authenticated holds no TRIGGER on patients");
  // ================= 0009: aal2 enforcement (P3.1) =================
  await withClaim(app, A, async () => app.query("UPDATE tenants SET plan='hospital' WHERE id=$1", [tA])); // quota headroom (denies below must be aal-caused, not quota-caused)
  ok(await expectDeny(withClaim(app, A, async () => app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'AAL1-1')", [tA]), "aal1")) === "denied", "owner aal1 insert denied");
  const aal2Pat = await withClaim(app, A, async () => (await app.query("INSERT INTO patients (tenant_id, mrn, name) VALUES ($1,'AAL2-1','AAL ok') RETURNING id", [tA])).rows[0].id);
  ok(!!aal2Pat, "owner aal2 insert allowed");
  ok(await expectDeny(withClaim(app, A, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ tenant_id: tA, local_id: "c_aal1", client_rev: "2026-10-10T00:00:00Z", mrn: "CC-AAL1", name: "No" })]), "aal1")) === "denied", "owner aal1 sync-RPC denied");
  const nAal1 = await withClaim(app, N, async () => (await app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'N-AAL1') RETURNING id", [tA])).rows[0].id, "aal1");
  ok(!!nAal1, "nurse aal1 insert allowed (MFA-exempt role)");
  await withClaim(app, A, async () => app.query("UPDATE memberships SET role='doctor' WHERE tenant_id=$1 AND user_id=$2", [tA, RU]));
  ok(await expectDeny(withClaim(app, RU, async () => app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'D-AAL1')", [tA]), "aal1")) === "denied", "doctor aal1 insert denied");
  const dAal2 = await withClaim(app, RU, async () => (await app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'D-AAL2') RETURNING id", [tA])).rows[0].id);
  ok(!!dAal2, "doctor aal2 insert allowed");
  await withClaim(app, A, async () => app.query("UPDATE memberships SET role='readonly' WHERE tenant_id=$1 AND user_id=$2", [tA, RU]));
  ok(await expectDeny(withClaim(app, AD, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'nurse')", [tA, O3]), "aal1")) === "denied", "admin aal1 grant denied");
  await withClaim(app, AD, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'nurse')", [tA, O3]));
  ok(true, "admin aal2 grant allowed");
  await withClaim(app, A, async () => app.query("DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tA, O3]));
  ok(await expectDeny(withClaim(app, A, async () => app.query("UPDATE tenants SET name='X' WHERE id=$1", [tA]), "aal1")) === "denied", "owner aal1 tenant update denied");
  await withClaim(app, A, async () => app.query("INSERT INTO audit_events (tenant_id, actor_id, action) VALUES ($1,$2,'aal.probe')", [tA, A]), "aal1");
  const au1 = await withClaim(app, A, async () => (await app.query("SELECT count(*)::int AS n FROM audit_events WHERE tenant_id=$1", [tA])).rows[0].n, "aal1");
  const au2 = await withClaim(app, A, async () => (await app.query("SELECT count(*)::int AS n FROM audit_events WHERE tenant_id=$1", [tA])).rows[0].n);
  ok(au1 === 0 && au2 >= 1, "audit reads: aal1 sees 0 rows, aal2 sees rows");
  await withClaim(app, N, async () => app.query("INSERT INTO break_glass_events (tenant_id, actor_id, reason, scope) VALUES ($1,$2,'night-duty drill probe entry','subscription-gate')", [tA, N]), "aal1");
  ok(true, "break-glass log stays writable at aal1 (emergencies loggable)");
  await withClaim(app, A, async () => app.query("UPDATE memberships SET role='auditor' WHERE tenant_id=$1 AND user_id=$2", [tA, BL]));
  const auAud = await withClaim(app, BL, async () => (await app.query("SELECT count(*)::int AS n FROM audit_events WHERE tenant_id=$1", [tA])).rows[0].n, "aal1");
  ok(auAud >= 1, "auditor reads audit at aal1 (MFA-exempt role)");
  await withClaim(app, A, async () => app.query("UPDATE memberships SET role='billing' WHERE tenant_id=$1 AND user_id=$2", [tA, BL]));
  await withClaim(app, A, async () => app.query("UPDATE tenants SET plan='clinic' WHERE id=$1", [tA])); // restore

  // ================= 0010: email-confirmed writes (P3.3) =================
  await withClaim(app, B, async () => app.query("UPDATE tenants SET plan='hospital' WHERE id=$1", [tB])); // quota headroom (denies below must be email-caused, not quota-caused)
  const G = "cccccccc-cccc-cccc-cccc-cccccccccccc"; // unconfirmed doctor of B
  await owner.query("INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1,'unconfirmed-g@synthetic.test',NULL) ON CONFLICT (id) DO NOTHING", [G]);
  await withClaim(app, B, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'doctor')", [tB, G]));
  ok((await withClaim(app, G, async () => (await app.query("SELECT public.my_email_confirmed() AS v")).rows[0].v)) === false, "helper: unconfirmed -> false");
  ok(await expectDeny(withClaim(app, G, async () => app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'G-UNC')", [tB]))) === "denied", "unconfirmed doctor insert denied");
  ok(await expectDeny(withClaim(app, G, async () => app.query("SELECT public.apply_patient_op($1)", [JSON.stringify({ tenant_id: tB, local_id: "c_g", client_rev: "2026-10-10T00:00:00Z", mrn: "CC-G", name: "No" })]))) === "denied", "unconfirmed sync-RPC denied");
  await withClaim(app, B, async () => app.query("INSERT INTO audit_events (tenant_id, actor_id, action) VALUES ($1,$2,'probe-b')", [tB, B]));
  await owner.query("UPDATE auth.users SET email_confirmed_at=NULL WHERE id=$1", [B]);
  const bUnc = await withClaim(app, B, async () => (await app.query("SELECT count(*)::int AS n FROM audit_events WHERE tenant_id=$1", [tB])).rows[0].n);
  ok(bUnc >= 1, "unconfirmed owner still reads audit (reads ungated)");
  ok(await expectDeny(withClaim(app, B, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'nurse')", [tB, C]))) === "denied", "unconfirmed owner grant denied");
  await owner.query("UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1", [B]);
  await withClaim(app, B, async () => app.query("INSERT INTO memberships (tenant_id, user_id, role) VALUES ($1,$2,'nurse')", [tB, C]));
  ok(true, "re-confirmed owner grant allowed");
  await withClaim(app, B, async () => app.query("DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tB, C]));
  await owner.query("UPDATE auth.users SET email_confirmed_at=now() WHERE id=$1", [G]);
  ok((await withClaim(app, G, async () => (await app.query("SELECT public.my_email_confirmed() AS v")).rows[0].v)) === true, "helper: confirmed -> true");
  const gPat = await withClaim(app, G, async () => (await app.query("INSERT INTO patients (tenant_id, mrn) VALUES ($1,'G-CONF') RETURNING id", [tB])).rows[0].id);
  ok(!!gPat, "confirmed doctor insert allowed");
  await withClaim(app, B, async () => app.query("UPDATE tenants SET plan='nicu' WHERE id=$1", [tB])); // restore

  // ================= 0011: guarded RPC input casts (P3.4/L5) =================
  const errOf = async (promise) => { try { await promise; return { code: "OK", msg: "" }; } catch (e) { return { code: e.code || "?", msg: e.message || "" }; } };
  const eT = await errOf(ap(A, "apply_patient_op", { ...P1, tenant_id: "not-a-uuid" }));
  ok(eT.code === "P0001" && eT.msg === "bad tenant_id", "garbage tenant_id -> clean P0001 'bad tenant_id' (no 22P02)");
  const eR = await errOf(ap(A, "apply_patient_op", { ...P1, client_rev: "not-a-time" }));
  const eR2 = await errOf(ap(A, "apply_patient_op", { ...P1, client_rev: "2026-13-45T99:99:99Z" }));
  ok(eR.code === "P0001" && eR.msg === "bad client_rev", "garbage client_rev -> clean P0001 'bad client_rev'");
  ok(eR2.code === "P0001" && eR2.msg === "bad client_rev", "out-of-range client_rev (22008) -> clean P0001 'bad client_rev'");
  const eE = await errOf(ap(A, "apply_encounter_op", { tenant_id: "zzz", local_id: "e1", client_rev: "2026-10-01T10:00:00Z" }));
  ok(eE.code === "P0001" && eE.msg === "bad tenant_id", "guard covers all four RPCs (encounter)");
  const eN = await errOf(ap(A, "apply_patient_op", { ...P1, client_rev: null }));
  ok(eN.code === "P0001" && eN.msg === "client_rev required", "NULL client_rev path unchanged ('client_rev required')");
  const eTN = await errOf(ap(A, "apply_patient_op", { ...P1, tenant_id: null }));
  ok(eTN.code === "P0001" && eTN.msg === "tenant_id required", "NULL tenant_id path unchanged ('tenant_id required')");

  // ================= 0012: tenant minting gates (P3.2) =================
  const H = "dddddddd-dddd-dddd-dddd-dddddddddddd"; // unconfirmed outsider
  await owner.query("INSERT INTO auth.users (id, email, email_confirmed_at) VALUES ($1,'h-owner@synthetic.test',NULL) ON CONFLICT (id) DO NOTHING", [H]);
  ok(await expectDeny(withClaim(app, H, async () => app.query("INSERT INTO tenants (name) VALUES ('Hacker Clinic')"))) === "denied", "unconfirmed user cannot mint tenants (t_ins email gate)");
  const c0 = await withClaim(app, A, async () => (await app.query("SELECT public.my_created_tenant_count() AS v")).rows[0].v);
  const tC = await withClaim(app, A, async () => (await app.query("INSERT INTO tenants (name) VALUES ('C Clinic (synthetic)') RETURNING id")).rows[0].id);
  ok(!!tC, "confirmed owner mints (gate is email-only, no cap)");
  const c1 = await withClaim(app, A, async () => (await app.query("SELECT public.my_created_tenant_count() AS v")).rows[0].v);
  ok(Number(c1) === Number(c0) + 1, "mint counter increments (audit trail queryable)");
  // owner-invite TOCTOU: B invites H as owner, then is demoted before H accepts
  const tokH = await withClaim(app, B, async () => (await app.query("INSERT INTO invites (tenant_id, email, role) VALUES ($1,'h-owner@synthetic.test','owner') RETURNING token", [tB])).rows[0].token);
  ok(!!tokH, "owner can still invite owners (owner-only preserved)");
  await withClaim(app, B, async () => app.query("UPDATE memberships SET role='owner' WHERE tenant_id=$1 AND user_id=$2", [tB, G]));
  await withClaim(app, G, async () => app.query("UPDATE memberships SET role='admin' WHERE tenant_id=$1 AND user_id=$2", [tB, B]));
  const eH = await errOf(withClaim(app, H, async () => app.query("SELECT public.accept_invite($1)", [tokH])));
  ok(eH.code === "P0001" && eH.msg === "inviter is no longer an owner", "stale owner-invite rejected after inviter demotion");
  await withClaim(app, G, async () => app.query("UPDATE memberships SET role='owner' WHERE tenant_id=$1 AND user_id=$2", [tB, B]));
  await withClaim(app, B, async () => app.query("UPDATE memberships SET role='doctor' WHERE tenant_id=$1 AND user_id=$2", [tB, G]));
  await withClaim(app, B, async () => app.query("DELETE FROM invites WHERE token=$1", [tokH]));
  // NULL-created_by grandfather: pre-0012 owner-invite still acceptable
  await owner.query("INSERT INTO invites (tenant_id, email, role) VALUES ($1,'h-owner@synthetic.test','owner')", [tB]);
  const tokG = await withClaim(app, B, async () => (await app.query("SELECT token FROM invites WHERE tenant_id=$1 AND email='h-owner@synthetic.test' AND accepted_at IS NULL ORDER BY created_at DESC LIMIT 1", [tB])).rows[0].token);
  const accG = await withClaim(app, H, async () => (await app.query("SELECT public.accept_invite($1) AS t", [tokG])).rows[0].t);
  ok(accG === tB, "pre-0012 (unstamped) owner-invite still accepted");
  await withClaim(app, B, async () => app.query("DELETE FROM memberships WHERE tenant_id=$1 AND user_id=$2", [tB, H]));

  try { await app.end(); } catch (_) {}
  await stop();
  console.log(`\nisolation: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("isolation harness error:", e.message || e); process.exit(1); });

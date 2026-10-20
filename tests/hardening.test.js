// NeoKid Care — static hardening suite (M1). Fast checks, no harness:
// SW api-bypass, security headers, PIN-hash presence, backup password minimum,
// secret scan, dangerous sinks, reproducible deps, RLS-policy boundary markers.
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.log("FAIL:", n); } };
const read = (f) => fs.readFileSync(path.join(R, f), "utf8");

// 1. Service worker never caches API traffic
const sw = read("sw.js");
ok(sw.includes('startsWith("/api/")') && sw.indexOf("/api/") < sw.indexOf("caches.match"), "SW bypasses /api/* before any cache access");

// 2. Security headers
let vj;
try { vj = JSON.parse(read("vercel.json")); ok(true, "vercel.json parses"); }
catch (e) { ok(false, "vercel.json parses"); }
const allHeaders = (vj.headers || []).flatMap((h) => h.headers || []).map((h) => h.key + ": " + h.value).join("\n");
for (const h of ["Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy", "Content-Security-Policy"]) {
  ok(allHeaders.includes(h), "header present: " + h);
}
const csp = (allHeaders.match(/Content-Security-Policy: ([^\n]+)/) || [])[1] || "";
ok(csp.includes("frame-ancestors 'none'"), "CSP: frame-ancestors 'none' (clickjacking)");
ok(csp.includes("connect-src 'self'") && csp.includes("supabase.co"), "CSP: connect-src locked to self + backends");
ok(!csp.includes("unsafe-eval"), "CSP: no unsafe-eval");

// 3. PINs hashed, plaintext path gone
const front = read("js/front.js");
ok(!/u\.pin\s*=\s*pin/.test(front) && !/role,\s*pin\s*\}/.test(front), "no plaintext PIN storage in front.js");
ok(front.includes("pinHash") && front.includes("pinSalt") && front.includes("crypto.subtle"), "salted-hash PIN path present");
ok(front.includes("kidgrow_pin_guard") && front.includes("locked 60s"), "PIN brute-force lockout present");

// 4. Encrypted backup needs a real password
ok(/length < 8/.test(read("js/ops.js")) && !/min 4 characters/.test(read("js/ops.js")), "encrypted-backup password minimum is 8");

// 5. Secret scan (placeholders like rzp_test_xxxx must NOT trip; real keys must)
const skip = new Set(["node_modules", ".git", "package-lock.json"]);
let hits = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    if (!/\.(js|json|md|sql|html|py|example)$/.test(e.name)) continue;
    const t = fs.readFileSync(p, "utf8");
    const pats = [/github_pat_[A-Za-z0-9_]+/, /rzp_(live|test)_[A-Za-z0-9]{6,}/, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/, /whsec_[A-Za-z0-9]{6,}/];
    for (const re of pats) {
      const m = t.match(re); if (!m) continue;
      if (m[0].startsWith("eyJ")) {
        let role = "";
        try { role = JSON.parse(Buffer.from(m[0].split(".")[1], "base64").toString()).role || ""; } catch (e) {}
        if (role === "anon") continue; // anon keys are public by design (ship in config.js)
      }
      hits.push(path.relative(R, p) + ":" + m[0].slice(0, 18) + "…");
    }
  }
})(R);
ok(!hits.length, "secret scan clean" + (hits.length ? " (" + hits.join(", ") + ")" : ""));

// 6. Dangerous sinks (app code, excluding vendored libs)
let sinks = [];
for (const f of fs.readdirSync(path.join(R, "js")).filter((f) => f.endsWith(".js"))) {
  const t = read("js/" + f);
  if (/eval\s*\(|new Function|document\.write/.test(t)) sinks.push("js/" + f);
}
ok(!sinks.length, "no eval/new-Function/document.write in app JS" + (sinks.length ? " (" + sinks.join(",") + ")" : ""));

// 7. Repo hygiene + reproducible deps
ok(!fs.existsSync(path.join(R, "fetch.log")) && !fs.existsSync(path.join(R, "serve.py")), "junk logs removed, serve.py moved to tools/");
ok(fs.existsSync(path.join(R, "tools/serve.py")), "tools/serve.py present");
ok(fs.existsSync(path.join(R, "package.json")) && fs.existsSync(path.join(R, "package-lock.json")), "package.json + lockfile present");

// 8. Every RLS policy in the tenant migration enforces a tenant boundary
const mig = read("supabase/migrations/0001_tenant_core.sql");
const blocks = mig.split(/create policy /i).slice(1).map((b) => b.slice(0, b.indexOf(";")));
ok(blocks.length >= 15, blocks.length + " RLS policies found in migration");
const open = blocks.filter((b) => !/my_tenant_ids|my_tenant_role|auth\.uid/.test(b));
ok(!open.length, "every policy carries a tenant-boundary marker" + (open.length ? " (" + open.length + " open!)" : ""));
ok((mig.match(/enable row level security/g) || []).length >= 6, "RLS enabled on all tenant tables");
ok(!/on audit_events for (update|delete)/i.test(mig), "audit_events has no update/delete policy (append-only)");

// 9. Logging policy: console.error for render faults only — never patient data
let noisy = [];
for (const f of fs.readdirSync(path.join(R, "js")).filter((f) => f.endsWith(".js") && f !== "qrcode.min.js")) {
  const t = read("js/" + f);
  if (/console\.(log|info|warn|debug)\b/.test(t)) noisy.push("js/" + f);
}
ok(!noisy.length, "no console.log/info/warn/debug in app JS" + (noisy.length ? " (" + noisy.join(",") + ")" : ""));
const errSites = [];
for (const f of fs.readdirSync(path.join(R, "js")).filter((f) => f.endsWith(".js") && f !== "qrcode.min.js")) {
  const n = (read("js/" + f).match(/console\.error/g) || []).length;
  if (n) errSites.push("js/" + f + "x" + n);
}
ok(errSites.length <= 2, "console.error only at known render-fault sites (" + (errSites.join(", ") || "none") + ")");
ok(/LOGGING POLICY/.test(read("js/app.js")), "logging policy documented at the call site");

// 10. CI runs the suites on every push
const ci = read(".github/workflows/ci.yml");
for (const need of ["actions/checkout", "actions/setup-node", "npm ci", "npm test", "npm audit"]) {
  ok(ci.includes(need), "CI workflow contains: " + need);
}

// 11. JS quota mirror matches SQL plan_quota (drift = billing/security bug)
const mig2 = read("supabase/migrations/0002_platform.sql");
const tj = read("js/tenant.js");
function sqlQuota(key) {
  const m = mig2.match(new RegExp("when '" + key + "' then case p_plan([\\s\\S]*?)end"));
  const o = {};
  for (const x of (m ? m[1] : "").matchAll(/when '(\w+)' then (\d+)/g)) o[x[1]] = +x[2];
  return o;
}
function jsQuota(v) {
  const m = tj.match(new RegExp("var " + v + " = \\{([^}]+)\\}"));
  const o = {};
  for (const x of (m ? m[1] : "").matchAll(/(\w+): (\d+)/g)) o[x[1]] = +x[2];
  return o;
}
ok(JSON.stringify(sqlQuota("users")) === JSON.stringify(jsQuota("u")), "quota mirror matches SQL (users)");
ok(JSON.stringify(sqlQuota("patients")) === JSON.stringify(jsQuota("p")), "quota mirror matches SQL (patients)");

// 12. Every table in every migration has RLS enabled
let rlsOk = true, rlsDetail = [];
for (const f of fs.readdirSync(path.join(R, "supabase/migrations")).filter((f) => f.endsWith(".sql"))) {
  const t = read("supabase/migrations/" + f);
  const tables = (t.match(/create table if not exists (\w+)/gi) || []).length;
  const enables = (t.match(/enable row level security/gi) || []).length;
  if (enables < tables) { rlsOk = false; rlsDetail.push(f); }
}
ok(rlsOk, "RLS enabled on every migrated table" + (rlsDetail.length ? " (" + rlsDetail.join(",") + ")" : ""));

// 13. M5 clinical safety rails (static)
const m4 = read("supabase/migrations/0004_clinical.sql");
ok((m4.match(/create table if not exists (\w+)/gi) || []).length === 4, "0004 creates exactly 4 clinical tables");
ok((m4.match(/enable row level security/gi) || []).length === 4, "0004 enables RLS on all 4");
ok(m4.includes("witness required for controlled drugs") && m4.includes("controlled = false or witness <> ''"), "two-person rule in function + CHECK");
ok(m4.includes("unknown clinical table") && m4.includes("tenant_write_ok(tenant_id)"), "table whitelist + write-gate in policies");
const marSrc = read("js/mar.js");
ok((marSrc.match(/witness/gi) || []).length >= 6, "client mirrors the witness rule");
const calcSrc = read("js/calc.js");
ok(calcSrc.includes("capped") && (calcSrc.match(/warnings/gi) || []).length >= 8, "calculators cap + warn, never bare numbers");
const nicuSrc = read("js/nicu.js");
ok(!nicuSrc.includes("splice(") && nicuSrc.includes("outcome is required"), "NICU: no UI delete path, discharge needs outcome");
const growthSrc = read("js/growth.js");
ok(growthSrc.includes("function growthAlerts(") && growthSrc.includes("confirm on chart"), "growth alerts point back to official charts");

// 14. M6 interop + reporting rails (static)
const fhirSrc = read("api/fhir/[[...slug]].js");
ok(fhirSrc.includes('!== "GET"') && fhirSrc.includes("405"), "FHIR facade is GET-only");
ok(!/SERVICE_ROLE|SERVICE_KEY|service_role/i.test(fhirSrc), "FHIR uses no service keys");
ok(fhirSrc.includes('tenant_id: "eq." + tenant') && fhirSrc.includes("tenant query param"), "tenant always scoped upstream");
ok(fhirSrc.includes("Authorization: auth"), "caller JWT forwarded (RLS enforced upstream)");
ok(Object.keys(require(path.join(R, "api/fhir/[[...slug]].js")).TABLES || {}).length === 5, "FHIR exposes exactly 5 whitelisted resources");
const mrdSrc = read("js/mrd.js");
ok(mrdSrc.includes("csvOf(") && mrdSrc.includes("auditSafe("), "MRD exports escape + audit");
const clinSrc = read("js/clinic.js");
ok(clinSrc.includes("with 2+ measures") && clinSrc.includes("metricsClinicalHTML"), "analytics shows denominators + clinical row");

// 15. Formulary review rails (static)
const rxSrc = read("js/rx.js");
ok((rxSrc.match(/formularyStatus/g) || []).length >= 2, "Rx picker + calc surface review status");
const frontSrc = read("js/front.js");
ok(["formulary", "nicu", "mar", "calc", "mrd"].every((p) => frontSrc.includes('"' + p + '"')), "role map covers new clinical pages");
const formSrc = read("js/formulary.js");
ok(formSrc.includes("needSafe(2") && formSrc.includes('guardSubmit("formulary")'), "reviews are role-gated + double-submit guarded");
ok(read("js/drugs.js").includes("ALWAYS verify"), "formulary keeps its verify warning");

const cfgSrc = read("js/config.js");
ok(cfgSrc.includes('"kidgrow-plus"') && cfgSrc.includes('"kidgrow-prod"'), "PROD_HOSTS covers canonical + legacy prod hosts (F2)");
{
  const pkg = JSON.parse(read("package.json"));
  const appVer = (read("js/cloud.js").match(/var APP_VER = "v([\d.]+)"/) || [])[1] || "";
  const healthFb = (read("api/health.js").match(/let VERSION = "([\d.]+)"/) || [])[1] || "";
  const norm = (v) => String(v).replace(/(\.0)+$/, "");
  ok(norm(pkg.version) === norm(appVer) && norm(appVer) === norm(healthFb) && !!norm(appVer), `release versions agree (pkg ${pkg.version} / app v${appVer} / health ${healthFb}, F13)`);
  const cloudSrc = read("js/cloud.js");
  ok(cloudSrc.includes('syncBusy("up")') && cloudSrc.includes('syncBusy("down")'), "sync busy-guard called on both push and pull (quick win)");
  ok((cloudSrc.match(/syncFree\("/g) || []).length >= 6, "busy-guard freed on every exit path");
  ok(cloudSrc.includes("window.APP_VER"), "APP_VER exposed globally for version proof (F13)");
}

console.log(`\nhardening: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

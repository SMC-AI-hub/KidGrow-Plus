// KidGrow Pro — static hardening suite (M1). Fast checks, no harness:
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
    const pats = [/github_pat_[A-Za-z0-9_]+/, /rzp_(live|test)_[A-Za-z0-9]{6,}/, /eyJ[A-Za-z0-9_-]{20,}/, /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/, /whsec_[A-Za-z0-9]{6,}/];
    for (const re of pats) { const m = t.match(re); if (m) hits.push(path.relative(R, p) + ":" + m[0].slice(0, 18) + "…"); }
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

console.log(`\nhardening: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

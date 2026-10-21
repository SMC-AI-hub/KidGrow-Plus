// NeoKid Care — M4 relational-sync verdict pins (E4). The engine is dormant by
// construction (Cloud._sb was never wired); these lock the verdict in code so
// a future "arm M4" flips the checklist deliberately, with live E2E.
// Use: node tests/syncrel.test.js
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }
const read = (f) => fs.readFileSync(path.join(R, f), "utf8");

const rel = read("js/sync-rel.js"), cloud = read("js/cloud.js"), tenant = read("js/tenant.js");

// 1. client RPC map ⊆ server functions (parity across the wire)
const rpcNames = [...rel.matchAll(/"(apply_[a-z_]+)"/g)].map((m) => m[1]);
const sqlFns = [];
for (const f of ["supabase/migrations/0003_sync.sql", "supabase/migrations/0004_clinical.sql"]) {
  for (const m of read(f).matchAll(/function public\.(apply_[a-z_]+)\(/gi)) sqlFns.push(m[1].toLowerCase());
}
const rpcMissing = [...new Set(rpcNames)].filter((r) => !sqlFns.includes(r));
ok(rpcNames.length > 0 && rpcMissing.length === 0, `RPC map ⊆ migrations (${[...new Set(rpcNames)].join(",")})`);

// 2. arming checklist — dormant by construction (E4 verdict: keep blob)
ok(cloud.includes("sb: function") && !/Cloud\._sb|_sb:/.test(cloud), "ARM-1 OPEN: cloud.js exposes sb, not _sb (M4/M3-server dormant)");
ok(tenant.includes("Cloud.tenantId = function"), "ARM-2 READY: tenant.js assigns Cloud.tenantId");
ok(rel.includes("Cloud._sb") && rel.includes("function live()"), "ARM-3 PINNED: sync-rel live() requires Cloud._sb (do not arm without live E2E)");

// 3. offline accumulator stays bounded while dormant
ok(/q\.length >= 1000/.test(rel), "outbox capped at 1000 while dormant");
ok(rel.includes("~deleted") && rel.includes("deleted_at"), "tombstone markers present for future arming");

// 4. standby honesty (no silent no-op button)
ok(rel.includes("Relational sync is on standby") && rel.includes("standby + \"<h3>"), "syncNow toasts + card shows standby when !live");

// 5. SOP discloses the verdict to staff
ok(read("docs/F10-SYNC-SOP.md").includes("M4 relational sync: deferred"), "SOP discloses M4-deferred status");

console.log(`syncrel: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

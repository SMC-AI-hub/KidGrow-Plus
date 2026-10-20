// NeoKid Care — command palette suite (v10.43 quick win). Pure-core asserts +
// wiring. Use: node tests/cmdk.test.js
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
const { cmdkMatch, cmdkBuild, cmdkActions } = require("../js/cmdk.js");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }

ok(cmdkMatch("Aarav Sharma Priya 99999 MRN1", "sha"), "match: substring");
ok(cmdkMatch("Aarav Sharma Priya 99999", "sharma 999"), "match: multi-word");
ok(cmdkMatch("Anything", ""), "match: empty query passes");
ok(!cmdkMatch("Aarav Sharma", "zzz"), "match: miss");
ok(cmdkMatch("Vaccination Digital Record", "vax record") === false, "match: no fuzzy overreach");
ok(cmdkMatch("Vaccination Digital Record", "vaccination"), "match: prefix word");

const pats = [{ id: "c1", name: "Aarav Sharma", parent: "Priya", phone: "999", mrn: "M1", age: "1y", sex: "Boy" },
  { id: "c2", name: "Diya Nair", parent: "K", phone: "888", mrn: "M2", age: "2y", sex: "Girl" }];
const pages = [{ page: "vaccines", title: "Vaccination Digital Record" }, { page: "rx", title: "Prescription" }];
{
  const r = cmdkBuild("sha", pats, pages, cmdkActions());
  ok(r.length === 1 && r[0].sec === "Patients" && r[0].run === "pick:c1", "build: patient hit with pick run-key");
  const rp = cmdkBuild("prescription", pats, pages, cmdkActions());
  ok(rp.some((x) => x.run === "go:rx") && rp.some((x) => x.run === "act:rx"), "build: page + action both surface");
  ok(cmdkBuild("", pats, pages, cmdkActions()).length === 2 + 2 + cmdkActions().length, "build: empty query lists all");
  const many = [];
  for (let i = 0; i < 50; i++) many.push({ id: "x" + i, name: "Kid", parent: "", phone: "", mrn: "" });
  ok(cmdkBuild("", many, [], []).length === 30, "build: capped at 30 rows");
  ok(cmdkActions().some((a) => a.id === "register") && cmdkActions().some((a) => a.id === "upload"), "actions cover register + sync");
}

const src = fs.readFileSync(path.join(R, "js", "cmdk.js"), "utf8");
const html = fs.readFileSync(path.join(R, "index.html"), "utf8");
const app = fs.readFileSync(path.join(R, "js", "app.js"), "utf8");
const sw = fs.readFileSync(path.join(R, "sw.js"), "utf8");
ok(src.includes('e.key === "k"') && src.includes("e.ctrlKey || e.metaKey"), "Ctrl+K / Cmd+K listener");
ok(src.includes('"mCmdK"') && src.includes('role="dialog"'), "accessible modal shell");
ok(src.includes("matchChildren") && src.includes("getRecentIds"), "reuses ranked patient search (recents first)");
ok(src.includes("roleBlock"), "palette respects role gating");
ok(html.includes('id="cmdkBtn"') && html.includes('data-act="cmdkOpen"'), "topbar trigger button (delegated, E2a)");
ok(html.includes("js/cmdk.js"), "script tag present");
ok(sw.includes("./js/cmdk.js"), "SW shell caches palette");
ok(html.includes('data-act="openChildModal">+ Register child</button>'), "patients page register entry point (delegated, E2a)");
ok(app.includes('onclick="openChildModal()">+ Register child</button>'), "dashboard hero register entry point");

console.log(`cmdk: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

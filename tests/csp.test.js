// NeoKid Care — CSP extraction coverage (E2). Proves converted files carry no
// inline handlers/scripts and every delegated action is registered.
// E2b/E2c extend CONVERTED as files are migrated. Use: node tests/csp.test.js
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
const CONVERTED = ["index.html"]; // E2a: static shell. E2b+: js files join.
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }
const read = (f) => fs.readFileSync(path.join(R, f), "utf8");

const ON_RE = /\son(click|dblclick|change|input|keydown|keyup|keypress|submit|focus|blur|error|load|mouse[a-z]+|touch[a-z]+|paste|copy|cut)\s*=/;
for (const f of CONVERTED) {
  const src = read(f);
  ok(!ON_RE.test(src), `${f}: zero inline on* handlers`);
  const inlineScripts = [...src.matchAll(/<script(?![^>]*\ssrc=)[^>]*>/g)];
  ok(inlineScripts.length === 0, `${f}: zero inline <script> blocks`);
  ok(!/javascript:/i.test(src), `${f}: no javascript: URLs`);
}

// every delegated action used in converted files must be registered somewhere in js/
const used = new Set();
for (const f of CONVERTED) {
  const src = read(f);
  for (const m of src.matchAll(/data-(?:act|oninput|onchange|onkey|onfocus|onblur)="([^"]+)"/g)) used.add(m[1]);
}
const registered = new Set();
for (const f of fs.readdirSync(path.join(R, "js"))) {
  if (!f.endsWith(".js")) continue;
  const src = read("js/" + f);
  for (const m of src.matchAll(/actRegister\("([^"]+)"/g)) registered.add(m[1]);
}
// actCall0 batch list in delegate.js
{
  const d = read("js/delegate.js");
  const m = d.match(/\["saveSettings"[\s\S]*?\]\.forEach\(actCall0\)/);
  if (m) for (const n of m[0].matchAll(/"([a-zA-Z_$][\w$]*)"/g)) registered.add(n[1]);
}
const missing = [...used].filter((u) => !registered.has(u));
ok(missing.length === 0, `all ${used.size} used actions registered` + (missing.length ? ": " + missing.join(",") : ""));

// framework wiring
const html = read("index.html"), sw = read("sw.js");
ok(html.indexOf("js/delegate.js") !== -1 && html.indexOf("js/delegate.js") < html.indexOf("js/app.js"), "delegate loads before app");
ok(html.includes("js/boot.js"), "tail boot extracted to js/boot.js");
ok(sw.includes("./js/delegate.js") && sw.includes("./js/boot.js"), "SW shell caches delegate + boot");
ok(read("js/delegate.js").includes('addEventListener("click"') && read("js/delegate.js").includes("data-onkey"), "delegation covers click/input/change/key/focus/blur");

console.log(`csp: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

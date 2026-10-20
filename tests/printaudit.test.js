// NeoKid Care — print-head audit suite. Every printable page puts ONLY its
// document on paper: entry forms are no-print, stored values that live in
// inputs are re-rendered as print-only text. Use: node tests/printaudit.test.js
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }
const src = (f) => fs.readFileSync(path.join(R, f), "utf8");

// --- entry forms hidden on paper ---
ok(src("js/letters.js").includes('<div class="grid g2 no-print">'), "letters: form + saved list no-print");
ok(src("js/aefi.js").includes('<div class="card no-print"><h3>📝 Record event</h3>'), "aefi: record-event form no-print");
ok(src("js/aefi.js").includes('<div class="card"><h3>📋 Events</h3>'), "aefi: events register still prints");
ok(src("js/labs.js").includes('<div class="card"><div class="no-print"><h3>🧪 Add lab report</h3>'), "labs: entry form wrapped no-print");
{
  const s = src("js/labs.js");
  ok(s.indexOf("＋ Save report</button></div>") !== -1 && s.indexOf("＋ Save report</button></div>") < s.indexOf("📈 Hb trend"), "labs: no-print wrapper closes before Hb trend");
}
ok(src("js/mrd.js").includes("<div class='form-grid no-print'><div><label>From</label>"), "mrd: range filter no-print");
ok(src("js/mrd.js").includes("Register range:"), "mrd: range printed as text");
ok(src("js/front.js").includes('<div class="form-grid no-print">\n        <input type="hidden" id="uId">'), "users: add-user form no-print");
ok(src("js/front.js").includes("${esc(u.name)}</b> <span") , "users: user list still prints");

// --- screen suite: inputs hidden, values re-rendered as text ---
{
  const s = src("js/screen.js");
  ok(s.includes('<div class="form-grid no-print">\n    <div><label>Severity</label>'), "screen: asthma entry grid no-print");
  ok(s.includes('<div class="print-only"><dl class="kv"><dt>Severity</dt>'), "screen: print-only asthma summary");
  ok(s.includes('<div class="no-print" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">\n    <input type="date" id="pefDate"'), "screen: PEF entry row no-print");
  ok(s.includes("<th>Date</th><th>AM</th><th>PM</th>"), "screen: PEF diary table still prints");
  ok(s.includes('<div class="hint no-print">Tap a tooth'), "screen: dental tap-hint no-print");
  ok(s.includes('<div class="print-only" style="font-size:13px">Teeth:'), "screen: print-only teeth list (buttons vanish on paper)");
  ok(s.includes('<div class="form-grid no-print">\n        <div><label>GA at birth (wk)</label>'), "screen: ROP inputs no-print");
  ok(s.includes('<div class="form-grid no-print">\n        <div><label>Right hand %</label>'), "screen: CCHD inputs no-print");
  ok(s.includes('id="scRopOut"') && s.includes('id="scCchdOut"'), "screen: calculator result divs kept (print as text)");
  ok(s.includes('Screened on <b>${esc(r.date'), "screen: print-only RBSK meta line");
  ok(!/print-only[^]*rbskSet\('ref/.test(s), "screen: RBSK checklist itself untouched");
}

// --- newborn: entry cards hidden, birth record printed as text ---
{
  const s = src("js/nb.js");
  ok(s.includes('<div class="card no-print"><h3>🏥 Delivery & resuscitation</h3>'), "nb: delivery form no-print");
  ok(s.includes('<div class="card no-print" data-fold="nb-apgar">'), "nb: apgar entry no-print");
  ok(s.includes('<div class="card no-print" data-fold="nb-ballard">'), "nb: ballard entry no-print");
  ok(s.includes('<div class="card print-only"><h3>🏥 Birth record</h3>'), "nb: print-only birth record card");
  ok(s.includes("APGAR 5&prime;") && s.includes("Ballard</dt>"), "nb: birth record covers APGAR + Ballard");
  ok(s.includes('<div class="card"><h3>📖 Birth register (all children)</h3>'), "nb: birth register still prints");
}

// --- dedicated print shells stay doc-only ---
{
  const html = src("index.html");
  for (const id of ["pg-conprint", "pg-dayprint", "pg-growthprint", "pg-msprint", "pg-nicuprint", "pg-summary"]) {
    const m = html.match(new RegExp(`<section class="page" id="${id}">([\\s\\S]*?)</section>`));
    ok(!!m, `shell present: ${id}`);
    if (m) ok(!/<input|<select|<textarea|<button|form-grid|toolbar/.test(m[1]), `shell doc-only: ${id}`);
  }
}

// --- print-only mechanics locked ---
{
  const css = src("css/style.css");
  ok(css.includes(".print-only{display:none!important}"), "print-only hidden on screen");
  ok(/@media print\{[\s\S]*?\.print-only\{display:block!important\}/.test(css), "print-only shown on paper");
}

console.log(`printaudit: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

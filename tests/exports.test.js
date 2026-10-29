// NeoKid Care - CSV export formula-injection regression (KG-PT-003).
// Loads the REAL js/exports.js (its top-level actRegister block is try/catch-wrapped,
// so it boots in node with two tiny stubs) and asserts every CSV cell quoter
// neutralises spreadsheet formulas. Pre-fix: FAILS (payloads pass through raw).
// Use: node tests/exports.test.js
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; } else { fail++; console.log("FAIL:", n); } };

// ---- stubs for call-time globals (never invoked at require time) ----
global.VACCINE_SCHEDULE = [];
global.dmy = (s) => String(s == null ? "" : s);

vm.runInThisContext(fs.readFileSync(path.join(R, "js", "exports.js"), "utf8"), { filename: "exports.js" });
ok(typeof csvEsc === "function", "csvEsc loads from js/exports.js");
ok(typeof csvOf === "function", "csvOf loads from js/exports.js");

// ---- 1. formula payload matrix: every trigger char must be neutralised ----
const payloads = ["=2+5", "+3+3", "-2+2", "@SUM(A1:A10)", "\t=1+1", "\r=1+1"];
// NOTE: leading-SPACE formulas ("   =cmd…") are inert in Excel/Sheets/LibreOffice
// (a space first-char is never evaluated), so first-char-only sanitizing is enough
// and benign values pass through byte-identical.
payloads.forEach((p) => {
  const cell = csvEsc(p);
  // After optional quote-strip, first non-space char must NOT be a live trigger.
  const bare = cell.replace(/^"|"$/g, "").replace(/^'/, "X").trimStart();
  const live = /^[=+\-@]/.test(cell.replace(/^"|"$/g, "").trimStart());
  ok(!live, "neutralised: " + JSON.stringify(p) + " -> " + JSON.stringify(cell));
  void bare;
});

// ---- 2. benign values unchanged (data-preserving sanitizer) ----
[["Normal Name", "Normal Name"], ["12345", "12345"], [42, "42"], ["", ""], [null, ""],
 ["O'Brien", "O'Brien"], ["a,b", '"a,b"'], ['say "hi"', '"say ""hi"""'], ["line1\nline2", '"line1\nline2"'],
 [" - note with leading space-dash", " - note with leading space-dash"]].forEach(([inp, want]) => {
  ok(csvEsc(inp) === want, "benign passthrough: " + JSON.stringify(inp));
});

// ---- 3. csvOf joining still valid ----
ok(csvOf([["a", "b"], ["c", "d"]]) === "a,b\nc,d", "csvOf joins rows/cells");

// ---- 4. end-to-end: UIP row with hostile child name ----
const hostile = [{ name: "=HYPERLINK(\"https://evil/x\",\"click\")", dob: "2024-01-01", sex: "F", father: "F", mother: "M", phone: "+91-1", vaccines: {} }];
const uip = uipCsv(hostile);
const firstCell = uip.split("\n")[1].split(",")[0];
ok(!/^[=+\-@]/.test(firstCell.replace(/^"|"$/g, "").trimStart()), "uipCsv hostile name neutralised: " + firstCell);

// ---- 5. static pins: sibling exporters must delegate to csvEsc (no legacy quoters) ----
const legacyQ = '"${String(v == null ? "" : v).replace(/"/g';
[["js/docs.js", "csvEsc(v)"], ["js/ops.js", "csvEsc(v)"], ["js/front.js", ".map(csvEsc)"]].forEach(([f, needle]) => {
  const src = fs.readFileSync(path.join(R, f), "utf8");
  ok(src.indexOf(needle) >= 0, f + " delegates to csvEsc");
  ok(src.indexOf(legacyQ) < 0, f + " has no legacy quoter");
});

console.log(`exports: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

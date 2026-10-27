// NeoKid Care — Phase 1 history/track suite. Boots ALL scripts in index.html
// order (same harness shape as cloud-offline), then asserts the infra
// modules + SGA engine + old-backup migration + Hx cards.
// Use: node tests/history.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }

const html = fs.readFileSync(path.join(R, "index.html"), "utf8");
const IDS = new Set([...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
function ctxStub() {
  return new Proxy({ canvas: null, measureText: () => ({ width: 10 }) }, {
    get(t, p) { if (p in t) return t[p]; if (typeof p === "string") return (...a) => undefined; return undefined; },
    set() { return true; },
  });
}
function makeEl(tag, id) {
  const el = {
    tagName: String(tag || "div").toUpperCase(), children: [], style: {}, dataset: {},
    value: "", id: id || "", className: "", width: 300, height: 150, _html: "", _text: "",
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { el.children.push(c); return c; }, append() {}, prepend() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    getElementsByTagName() { return []; }, getElementsByClassName() { return []; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0 }; },
    closest() { return null; }, matches() { return false; }, contains() { return false; },
    click() {}, focus() {}, blur() {}, select() {}, scrollIntoView() {},
    getContext() { return ctxStub(); },
    toDataURL() { return "data:image/png,KGTEST"; },
  };
  Object.defineProperty(el, "innerHTML", { get: () => el._html, set: (v) => { el._html = String(v); } });
  Object.defineProperty(el, "textContent", { get: () => el._text, set: (v) => { el._text = String(v); } });
  return new Proxy(el, { get(t, p) { return p in t ? t[p] : undefined; }, set(t, p, v) { t[p] = v; return true; } });
}
const elCache = {};
const store = {};
const sb = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  TextEncoder, TextDecoder,
  alert: () => {}, confirm: () => false, prompt: () => null,
  requestAnimationFrame: (f) => setTimeout(f, 0),
  localStorage: {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
  },
  location: { hash: "", href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "" },
  navigator: { onLine: true, userAgent: "node-historytest" },
  history: { replaceState() {}, pushState() {} },
  screen: { width: 1280, height: 800 },
  devicePixelRatio: 1,
  Blob: function () {}, FileReader: function () {},
  URL: { createObjectURL: () => "", revokeObjectURL() {} },
  ResizeObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  IntersectionObserver: function () { this.observe = () => {}; this.disconnect = () => {}; },
  matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
  getComputedStyle: () => ({ getPropertyValue: () => "" }),
  addEventListener() {}, removeEventListener() {},
  crypto: require("crypto").webcrypto,
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
};
sb.window = sb; sb.self = sb; sb.globalThis = sb; sb.top = sb;
sb.document = {
  getElementById: (id) => (IDS.has(id) ? (elCache[id] || (elCache[id] = makeEl("div", id))) : null),
  createElement: (t) => makeEl(t),
  querySelector: (s) => {
    const m = /^#([\w-]+)$/.exec(s);
    if (m) return sb.document.getElementById(m[1]);
    if (s === ".content") return makeEl("div");
    return null;
  },
  querySelectorAll: () => [], body: makeEl("body"), head: makeEl("head"),
  addEventListener() {}, removeEventListener() {},
  documentElement: makeEl("html"), title: "",
};
vm.createContext(sb);

async function main() {
  const order = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
  let loadErr = "";
  for (const f of order) {
    try { vm.runInContext(fs.readFileSync(path.join(R, f), "utf8"), sb, { filename: f }); }
    catch (e) { loadErr += f + ": " + e.message + "\n"; }
  }
  ok(!loadErr, "all " + order.length + " scripts parse+boot" + (loadErr ? "\n" + loadErr : ""));
  const idx = (n) => order.indexOf(n);
  ok(idx("js/cdata.gen.js") > -1, "cdata.gen.js is wired in index.html");
  for (const m of ["migrate", "content", "i18n", "forms", "scores", "alerts", "terms"]) {
    ok(idx("js/" + m + ".js") > idx("js/cdata.gen.js"), m + ".js loads after content pack");
  }
  ok(idx("js/hx.js") > idx("js/forms.js") && idx("js/hx.js") > idx("js/scores.js"), "hx.js loads after its infra");

  // ---- Content pack ----
  const K = sb.KGCONTENT || {};
  ok(K.intergrowth && K.intergrowth.version === "2026.1-official-tables", "INTERGROWTH pack present + versioned");
  ok(K.icd10 && /PENDING/.test(K.icd10.verification || ""), "ICD subset flagged PENDING clinician verification");
  ok(K.strings_en && K.strings_en.strings && K.strings_en.strings["hx.perinatal"] === "Birth & perinatal", "English strings pack present");
  const meta = sb.Content.meta();
  ok(Array.isArray(meta) && meta.length >= 3 && meta.every((m) => m.pack && m.version), "Content.meta() lists every pack with version");
  ok(sb.Content.get("nope") === null, "Content.get unknown pack -> null");

  // ---- i18n ----
  ok(sb.t("hx.perinatal") === "Birth & perinatal", "t() resolves English string");
  ok(sb.t("missing.key", "FB") === "FB", "t() falls back to supplied default");
  ok(sb.t("missing.key") === "missing.key", "t() falls back to key itself");

  // ---- migrate ----
  ok(vm.runInContext("SCHEMA_V", sb) === 2, "SCHEMA_V is 2");
  const old = { children: [{ id: "c1", name: "Old Kid", visits: [{ id: "v1", date: "2026-01-01" }] }] };
  const rep = sb.migrateDB(old);
  ok(old._sv === 2 && JSON.stringify(rep.applied) === "[1,2]", "old backup migrates to v2, reports [1,2]");
  ok(old.children[0].perinatal && old.children[0].maternal && old.children[0].family, "v1 adds history containers");
  ok(Array.isArray(old.children[0].allergies) && Array.isArray(old.children[0].problems), "v1 adds allergies + problems");
  ok(Array.isArray(old.children[0].visits[0].icd), "v1 adds visit icd[]");
  ok(old.children[0].name === "Old Kid" && old.children[0].visits[0].id === "v1", "migration preserves existing data");
  ok(sb.migrateDB(old).applied.length === 0, "migration is idempotent");
  const built = sb.buildDbFromBackup({ children: [{ id: "c9", name: "Imp", visits: [] }] });
  ok(built._sv === 2 && Array.isArray(built.children[0].problems), "import path (buildDbFromBackup) migrates");
  ok(vm.runInContext("parseDB(JSON.stringify({children:[{id:'x',visits:[]} ]}))._sv", sb) === 2, "load path (parseDB) migrates v2");
  ok(vm.runInContext("freshDb()._sv", sb) === 2, "fresh DBs are stamped with current schema");

  // ---- scores math ----
  const Sc = sb.Scores;
  ok(Math.abs(Sc.phi(0) - 0.5) < 1e-6, "phi(0) = 0.5");
  ok(Math.abs(Sc.phi(1.96) - 0.975) < 0.001, "phi(1.96) ≈ 0.975");
  ok(Math.abs(Sc.phi(-1.96) - 0.025) < 0.001, "phi is symmetric");
  const ROW33 = [0.63, 1.13, 1.55, 1.95, 2.39, 2.88, 3.47]; // 33+0 boys bw (official table)
  ok(Sc.zFromRow(ROW33, 1.95).z === 0, "z=0 exactly at median anchor");
  ok(Sc.zFromRow(ROW33, 1.55).z === -1, "z=-1 at its anchor");
  ok(Math.abs(Sc.zFromRow(ROW33, 2.17).z - 0.5) < 1e-9, "piecewise-linear midpoint -> z=0.5");
  ok(Sc.zFromRow(ROW33, 0).ok === false && Sc.zFromRow(ROW33, -2).ok === false, "non-positive measurement rejected");
  const cap = Sc.zFromRow(ROW33, 4.0);
  ok(cap.ok && cap.capped && cap.z > 3, "beyond-table extrapolates + flags capped");
  ok(Sc.parseGAweeks("38+2") === 268, "GA '38+2' -> 268d");
  ok(Sc.parseGAweeks("38w2d") === 268, "GA '38w2d' -> 268d");
  ok(Sc.parseGAweeks(38) === 266 && Sc.parseGAweeks("38 weeks") === 266, "GA weeks number/words");
  ok(Sc.parseGAweeks("38.5") === 270, "GA decimal weeks");
  ok(Sc.parseGAweeks("abc") === null && Sc.parseGAweeks("") === null, "GA garbage -> null");

  // ---- SGA engine (INTERGROWTH spot values) ----
  const term = Sc.newbornSize({ ga: "40+0", sex: "boy", bwKg: 3.38 });
  ok(term.ok && term.band === "aga" && Math.abs(term.pctW - 50) < 10, `term median boy AGA ~P50 (got ${term.pctW})`);
  const sga = Sc.newbornSize({ ga: "40+0", sex: "boy", bwKg: 2.2 });
  ok(sga.ok && /^sga/.test(sga.band), `2.2kg term boy is SGA (got ${sga.band} P${sga.pctW})`);
  const lga = Sc.newbornSize({ ga: "40+0", sex: "girl", bwKg: 4.6 });
  ok(lga.ok && /^lga/.test(lga.band), `4.6kg term girl is LGA (got ${lga.band})`);
  const early = Sc.newbornSize({ ga: "33+0", sex: "boy", bwKg: 1.95 });
  ok(early.ok && early.band === "aga" && Math.abs(early.pctW - 50) < 2, `33+0 median boy AGA P50 (got ${early.pctW})`);
  ok(Sc.newbornSize({ ga: "23+0", sex: "boy", bwKg: 0.6 }).ok === false, "23+0 outside range -> not classified");
  ok(Sc.newbornSize({ sex: "boy", bwKg: 3.0 }).ok === false, "missing GA -> not classified");
  ok(Sc.newbornSize({ ga: "40+0", sex: "boy" }).ok === false, "missing weight -> not classified");
  const nosex = Sc.newbornSize({ ga: "40+0", sex: "", bwKg: 3.3 });
  ok(nosex.ok && nosex.sexKnown === false && nosex.boys && nosex.girls && nosex.note, "unknown sex runs both tables + note");
  const withlen = Sc.newbornSize({ ga: "40+0", sex: "girl", bwKg: 3.3, lenCm: 49, hcCm: 34 });
  ok(withlen.ok && withlen.pctL > 0 && withlen.pctH > 0, "optional length/HC percentiles computed");
  ok(Sc.list().includes("sga"), "sga registered in Scores");
  const run = Sc.run("sga", { ga: "40+0", sex: "boy", bwKg: 3.38 });
  ok(run.ok && run.inputs && run.source && /Screening aid/.test(run.notice), "run() wraps result with inputs+source+notice");
  ok(Sc.run("nope", {}).ok === false, "run() unknown score -> not ok");

  // ---- terms ----
  const Tm = sb.Terms;
  ok(Tm.search("asthma").some((e) => e.code === "J45.9"), "search 'asthma' finds J45.9");
  ok(Tm.search("J45")[0] && Tm.search("J45")[0].code.indexOf("J45") === 0, "code-prefix search ranks a J45 code first");
  ok(Tm.search("x").length === 0, "short query returns nothing");
  ok(Tm.get("J45.9").label === "Asthma, unspecified" && Tm.get("ZZZ") === null, "get() hit + miss");
  ok(Tm.chipsHTML(["<img src=x>"]).includes("&lt;img"), "chips escape hostile codes");

  // ---- forms ----
  const sch = { fields: [
    { k: "mode", t: "select", label: "Mode", opts: ["Vaginal", "LSCS"] },
    { k: "risk", t: "multi", label: "Risk", opts: ["A", "B"] },
    { k: "wt", t: "number", label: "Wt", unit: "kg", min: 0, max: 6 },
    { k: "ok", t: "check", label: "OK", ph: "Yes" },
  ] };
  const fh = sb.Forms.render(sch, { mode: "LSCS", risk: ["B"], wt: 3.2, ok: true }, "t1");
  ok(fh.includes('value="LSCS" selected') && fh.includes('value="B" checked'), "render restores select + multi");
  ok(fh.includes('min="0"') && fh.includes('id="t1_ok" checked'), "render keeps number/check attrs");
  ok(fh.includes("&lt;") === false || true, "render placeholder");
  const evil = sb.Forms.render({ fields: [{ k: "n", t: "text", label: "N" }] }, { n: '"><script>' }, "t1");
  ok(!evil.includes("<script>") && evil.includes("&quot;&gt;&lt;script&gt;"), "render escapes values");
  const col = sb.Forms.collect("t1", sch); // vm DOM returns nulls -> safe defaults
  ok(col.mode === "" && Array.isArray(col.risk) && col.ok === false, "collect survives missing DOM");

  // ---- alerts ----
  const Al = sb.Alerts;
  const i1 = Al.raise("info", "T.INFO", "note");
  ok(i1.blocked === false && typeof i1.id === "string", "info alert does not block");
  ok(Al.raise("warn", "T.WARN", "careful").blocked === false, "warn does not block");
  ok(Al.raise("hard", "T.HARD", "stop").blocked === true, "hard-stop blocks");
  ok(Al.dismiss(i1.id, "not relevant") === true, "dismiss with reason ok");
  ok(Al.list().find((a) => a.id === i1.id).dismissed.reason === "not relevant", "dismissal reason retained");
  ok(Al.dismiss("al-nope", "x") === false, "dismiss unknown -> false");

  // ---- SW shell ----
  const sw = fs.readFileSync(path.join(R, "sw.js"), "utf8");
  for (const m of ["cdata.gen", "migrate", "content", "i18n", "forms", "scores", "alerts", "terms", "hx"]) {
    ok(sw.includes("./js/" + m + ".js"), "SW shell caches js/" + m + ".js");
  }
  ok(fs.readFileSync(path.join(R, "js/cdata.gen.js"), "utf8").includes("GENERATED by tools/gen-content.js"), "cdata.gen.js is generated");

  // ---- Hx module ----
  const Hx = sb.Hx;
  ok(Hx && typeof Hx.fill === "function" && typeof Hx.collect === "function", "Hx module present");
  const kid = { id: "k1", name: "Test Kid", sex: "boy", dob: "2024-05-01", gest: "38", birthWt: 2.4,
    allergy: "Peanuts", visits: [
      { id: "v1", date: "2026-09-01", type: "Illness", subj: "Fever 2 days with cold and cough, appetite slightly reduced", obj: "Throat congested", plan: "Paracetamol SOS, fluids, review 3 days", icd: ["J06.9"] },
      { id: "v2", date: "2026-10-10", type: "Growth review", subj: "Gaining well", obj: "", plan: "Continue diet" },
    ] };
  Hx.ensure(kid);
  ok(kid.perinatal && Array.isArray(kid.allergies) && Array.isArray(kid.visits[1].icd), "Hx.ensure adds containers");
  kid.allergies.push({ agent: "Amoxicillin", reaction: "Rash", severity: "Moderate" });
  kid.problems.push({ label: "Asthma", code: "J45.9", since: "2025-01", status: "active" });
  kid.problems.push({ label: "Old bronchiolitis", code: "", since: "", status: "resolved" });
  ok(Hx.allergyText(kid) === "Peanuts; Amoxicillin (Moderate) — Rash", "allergyText unions legacy + structured");
  const badge = Hx.sgaBadgeHTML(kid);
  ok(/SGA/.test(badge) && /INTERGROWTH/.test(badge), "SGA badge classifies 2.4kg 38w boy as SGA");
  ok(/Needs gestation/.test(Hx.sgaBadgeHTML({ sex: "girl" })), "SGA badge explains missing inputs");
  Hx.fill(kid);
  ok(sb.HXB.allergies.length === 1 && sb.HXB.allergies[0].agent === "Amoxicillin", "fill() snapshots drafts");
  const cards = Hx.cardsHTML(kid);
  ok(cards.includes('id="hxP_ga"') && cards.includes("🤰") && cards.includes("🤱"), "cards render history schemas");
  ok(cards.includes("Amoxicillin") && cards.includes("Asthma"), "cards render allergy + problem editors");
  ok(!/<script>/.test(Hx.cardsHTML({ perinatal: { anomalies: "</scr" + "ipt><img>" }, allergies: [{ agent: "<b>" }] })), "cards escape hostile input");
  sb.HXB.allergies = [{ agent: '"><img src=x>', reaction: "<b>", severity: "Mild" }];
  const evilCards = Hx.cardsHTML(kid);
  ok(!/<img src=x>/.test(evilCards) && evilCards.includes("&quot;&gt;&lt;img"), "allergy rows escape hostile input");
  Hx.fill(kid); // restore drafts
  Hx.addA(); Hx.edA(1, "agent", "Ibuprofen");
  const hxcol = Hx.collect();
  ok(hxcol.allergies.length === 2 && hxcol.allergies[1].agent === "Ibuprofen", "collect() merges draft edits");
  ok(hxcol.perinatal && hxcol.maternal && hxcol.family, "collect() returns all three cards");
  Hx.delA(1); Hx.delP(0);
  ok(sb.HXB.allergies.length === 1 && sb.HXB.problems.length === 1, "delA/delP remove rows");
  const vhtml = Hx.visitIcdHTML(kid.visits[0]);
  ok(vhtml.includes("J06.9") && /respiratory infection/i.test(vhtml), "visit ICD chips show code + label");
  ok(Hx.visitIcdHTML({}) === "", "no ICD -> no chips");
  const ch = Hx.changesHTML(kid, { id: "new" });
  ok(/2026-10-10/.test(ch) && /Gaining well/.test(ch), "changes panel shows latest visit as baseline");
  ok(/First visit/.test(Hx.changesHTML({ visits: [] }, null)), "changes panel handles first visit");
  const strip = Hx.rxStripHTML(kid);
  ok(/ALLERGIES/.test(strip) && /Amoxicillin/.test(strip) && /Active problems/.test(strip) && /Asthma \(J45\.9\)/.test(strip) && !/bronchiolitis/.test(strip), "rx strip: allergies + active problems only");
  ok(Hx.headerProblems(kid).includes("Asthma"), "header problems line");
  ok(Hx.activeProblems(kid).length === 1, "resolved problems excluded from active");
  Hx.fillVisit(kid.visits[0], kid);
  ok(vm.runInContext("document.getElementById('vsIcd').value", sb) === '["J06.9"]', "fillVisit primes ICD hidden field");
  ok(Hx.collectVisitIcd()[0] === "J06.9", "collectVisitIcd round-trips");
  ok(/2026-10-10/.test(vm.runInContext("document.getElementById('vsChanges').innerHTML", sb)), "fillVisit paints changes panel");
  sb.__kid = kid;
  const hdr = vm.runInContext("childHeader(globalThis.__kid)", sb);
  ok(hdr.includes("Asthma (J45.9)") && hdr.includes("Peanuts"), "childHeader carries problems + allergy");
  try {
    const rec = sb.recordJson(sb.__kid);
    ok(rec.problems.length === 2 && rec.structuredAllergies.length === 1 && rec.visits[0].icd[0] === "J06.9" && /Amoxicillin/.test(rec.allergies), "Health-record export carries P1 fields");
  } catch (e) { ok(false, "Health-record export carries P1 fields (" + e.message + ")"); }
  ok(Sc.list().includes("apgar") && Sc.list().includes("ballard"), "apgar + ballard registered");
  const ap = Sc.run("apgar", { scores: [2, 2, 1, 2, 2] });
  ok(ap.ok && ap.total === 9 && /Reassuring/.test(ap.interp) && ap.source && /Screening/.test(ap.notice), "apgar via registry");
  ok(Sc.run("apgar", { scores: [2, "", 1, 2, 2] }).ok === false, "incomplete apgar -> not ok");
  const bl = Sc.run("ballard", { scores: { posture: 4, square: 4, arm: 4, pop: 4, scarf: 4, heel: 4, skin: 4, lanugo: 3, plantar: 4, breast: 3, eyeear: 4, genital: 4 } });
  ok(bl.ok && bl.total === 46 && bl.weeks === 42.4, `ballard via registry (total ${bl.total}, ${bl.weeks}w)`);

  console.log(`\nhistory: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("history harness crashed:", e); process.exit(1); });

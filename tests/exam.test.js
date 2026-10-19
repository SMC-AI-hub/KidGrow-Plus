// NeoKid Care — Phase 2 templates/exam suite. Boots ALL scripts in index.html
// order (same harness shape as history), then asserts vitals bands + flags,
// templates, exam compose, the v1→v2 migration and the v10.32 backup fixture.
// Use: node tests/exam.test.js
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
  navigator: { onLine: true, userAgent: "node-examtest" },
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
  ok(idx("js/exam.js") > idx("js/hx.js") && idx("js/exam.js") > idx("js/cdata.gen.js"), "exam.js loads after hx + content");
  ok(fs.readFileSync(path.join(R, "sw.js"), "utf8").includes("./js/exam.js"), "SW shell caches js/exam.js");

  // ---- packs ----
  const K = sb.KGCONTENT || {};
  ok(K.vitals && K.vitals.version === "2026.1-p2" && /PENDING/.test(K.vitals.verification || ""), "vitals pack versioned + PENDING");
  ok(K.vitals.bands.length === 6 && Object.keys(K.vitals.bpScreen.boys).length === 12, "vitals: 6 bands + 12 BP ages/sex");
  ok(K.templates && K.templates.templates.length === 6, "templates pack: 6 templates");
  ok(K.templates.templates.every((x) => x.id && x.title && x.s && x.o && x.p), "every template has title + S/O/P");

  // ---- age bands ----
  const Ex = sb.Ex;
  ok(Ex && typeof Ex.applyTemplate === "function", "Ex module present");
  ok(Ex.bandForAge(10).id === "neonate", "10d -> neonate");
  ok(Ex.bandForAge(200).id === "infant", "200d -> infant");
  ok(Ex.bandForAge(500).id === "toddler", "500d -> toddler");
  ok(Ex.bandForAge(1500).id === "preschool", "1500d -> preschool");
  ok(Ex.bandForAge(3000).id === "school", "3000d -> school");
  ok(Ex.bandForAge(5000).id === "adol", "5000d -> adolescent");
  ok(Ex.bandForAge(-5) === null && Ex.bandForAge(99999) === null, "out-of-range ages -> null");

  // ---- flags: temp / HR / RR / SpO2 ----
  const F = (v, d, s) => Ex.flagsFor(v, d, s);
  ok(F({}, 500, "boy").length === 0, "empty vitals -> no flags");
  ok(F({ t: "37.1" }, 500, "boy").length === 0, "37.1C -> no flag");
  ok(F({ t: "38.5" }, 500, "boy").some((f) => /Fever 38.5/.test(f.text)), "38.5C -> fever flag");
  ok(F({ t: "39.4" }, 500, "boy").some((f) => /High fever/.test(f.text)), "39.4C -> high-fever flag");
  ok(F({ t: "34.8" }, 500, "boy").some((f) => /Low temperature/.test(f.text)), "34.8C -> hypothermia flag");
  ok(F({ hr: "130" }, 200, "girl").length === 0, "infant HR 130 in range");
  ok(F({ hr: "190" }, 200, "girl").some((f) => /Tachycardia/.test(f.text)), "infant HR 190 -> tachycardia");
  ok(F({ hr: "90" }, 200, "girl").some((f) => /Bradycardia/.test(f.text)), "infant HR 90 -> bradycardia");
  ok(F({ hr: "150" }, 500, "boy").some((f) => /Tachycardia/.test(f.text)), "toddler HR 150 -> tachycardia");
  ok(F({ rr: "60" }, 200, "girl").some((f) => /Tachypnoea/.test(f.text)), "infant RR 60 -> tachypnoea");
  ok(F({ rr: "40" }, 200, "girl").length === 0, "infant RR 40 in range");
  ok(F({ spo2: "97" }, 500, "boy").length === 0, "SpO2 97 -> no flag");
  ok(F({ spo2: "93" }, 500, "boy").some((f) => /low/.test(f.text)), "SpO2 93 -> low flag");
  ok(F({ spo2: "88" }, 500, "boy").some((f) => /critically/.test(f.text)), "SpO2 88 -> critical flag");

  // ---- flags: BP (AAP 2017 Table 6 + adolescent staging) ----
  ok(F({ sys: "110", dia: "65" }, 3105, "boy").some((f) => /107\/69/.test(f.text)), "8y boy 110/65 >= 107/69 -> flag");
  ok(F({ sys: "100", dia: "60" }, 3105, "boy").length === 0, "8y boy 100/60 -> no flag");
  ok(F({ sys: "105" }, 2300, "girl").some((f) => /105\/67/.test(f.text)), "6y girl sys 105 >= 105 -> flag");
  ok(F({ sys: "100", dia: "60" }, 2300, "girl").length === 0, "6y girl 100/60 -> no flag");
  ok(F({ sys: "110", dia: "70" }, 200, "girl").length === 0, "infant BP -> recorded, no threshold");
  ok(F({ sys: "125", dia: "75" }, 5000, "boy").some((f) => /elevated/.test(f.text)), "14y 125/75 -> elevated");
  ok(F({ sys: "132", dia: "82" }, 5000, "boy").some((f) => /Stage 1/.test(f.text)), "14y 132/82 -> stage 1");
  ok(F({ sys: "145", dia: "92" }, 5000, "girl").some((f) => /Stage 2/.test(f.text)), "14y 145/92 -> stage 2");
  ok(F({ sys: "110", dia: "70" }, 5000, "boy").length === 0, "14y 110/70 -> no flag");
  ok(F({ dia: "66" }, 2300, "girl").length === 0, "6y girl dia 66 < 67 -> no flag");
  ok(F({ dia: "66" }, 2300, "").length === 1, "unknown sex uses sensitive threshold -> flag");
  ok(Ex.flagsHTML({}, 500, "boy").includes("Enter vitals"), "flagsHTML empty -> prompt");
  ok(Ex.flagsHTML({ t: "37" }, 500, "boy").includes("in range"), "flagsHTML normal -> reassurance");
  ok(Ex.flagsHTML({ t: "38.6" }, 500, "boy").includes("Fever"), "flagsHTML fever -> flag text");

  // ---- templates ----
  ok(Ex.template("fever-uri").title === "Fever / URI", "template lookup");
  ok(Ex.template("nope") === null, "unknown template -> null");
  vm.runInContext("document.getElementById('vsSubj').value='';document.getElementById('vsObj').value='';document.getElementById('vsPlan').value=''", sb);
  Ex.applyTemplate("fever-uri");
  ok(vm.runInContext("document.getElementById('vsSubj').value", sb).includes("Fever:"), "apply fills empty Subjective");
  ok(vm.runInContext("document.getElementById('vsObj').value", sb).includes("Throat:"), "apply fills empty Objective");
  ok(vm.runInContext("document.getElementById('vsPlan').value", sb).includes("ORS") === false, "fever template has its own plan");
  ok(vm.runInContext("document.getElementById('vsTemplate').value", sb) === "fever-uri", "apply records template id");
  ok(vm.runInContext("document.getElementById('vsTplIcd').innerHTML", sb).includes("J06.9"), "apply renders suggested ICD buttons");
  vm.runInContext("document.getElementById('vsSubj').value='Prior note'", sb);
  Ex.applyTemplate("well");
  const appended = vm.runInContext("document.getElementById('vsSubj').value", sb);
  ok(appended.startsWith("Prior note") && appended.includes("Appetite:"), "apply appends (never overwrites) non-empty boxes");
  vm.runInContext("document.getElementById('vsIcd').value='[]'", sb);
  Ex.addSuggest("J45.9");
  ok(vm.runInContext("document.getElementById('vsIcd').value", sb) === '["J45.9"]', "suggested code feeds the ICD picker");

  // ---- exam ----
  sb.EXB.exam = { gen: { st: "n" }, chest: { st: "ab", note: "wheeze" }, skin: { st: "ne" } };
  ok(Ex.composeExam() === "General: normal; Chest: ABNORMAL — wheeze", "compose skips N.E., formats findings");
  ok(Ex.composeExam({}) === "", "compose empty -> empty");
  Ex.edE("cvs", "st", "n");
  ok(sb.EXB.exam.cvs.st === "n", "edE writes draft");
  vm.runInContext("document.getElementById('vsObj').value=''", sb);
  Ex.insertExam();
  ok(vm.runInContext("document.getElementById('vsObj').value", sb).startsWith("Exam: General: normal"), "insertExam appends to Examination");
  const exRows = Ex.examHTML({ gen: { note: '"><img>' } });
  ok(!/<img>/.test(exRows) && exRows.includes("&quot;&gt;&lt;img"), "exam rows escape hostile notes");
  ok(Ex.vitalsHTML({ t: 38.2 }).includes('id="vxT"') && Ex.vitalsHTML({}).includes('id="vxFlags"'), "vitals widget renders inputs + flags box");

  // ---- fill/collect ----
  Ex.fillVisit({ vitals: { t: 37.5 }, exam: { gen: { st: "n" } }, template: "well" }, { dob: "2024-06-01", sex: "boy" });
  ok(vm.runInContext("document.getElementById('vsVitalsBox').innerHTML", sb).includes('id="vxT"'), "fillVisit injects vitals widget");
  ok(vm.runInContext("document.getElementById('exRows').innerHTML", sb).includes("HEENT"), "fillVisit injects exam grid");
  ok(vm.runInContext("document.getElementById('vsTemplate').innerHTML", sb).includes("fever-uri"), "fillVisit builds template picker");
  const cv = Ex.collectVisit();
  ok(cv.vitals && cv.exam && typeof cv.template === "string", "collectVisit returns vitals+exam+template");
  ok(cv.exam.gen && cv.exam.gen.st === "n", "collectVisit keeps draft exam");

  // ---- migration v1 -> v2 + 0 -> 2 chain ----
  ok(vm.runInContext("SCHEMA_V", sb) === 2, "SCHEMA_V is 2");
  const v1 = { _sv: 1, children: [{ id: "c1", name: "V1 Kid", perinatal: {}, visits: [{ id: "a", icd: [] }] }] };
  const rep = sb.migrateDB(v1);
  ok(v1._sv === 2 && JSON.stringify(rep.applied) === "[2]", "v1 backup migrates to v2, reports [2]");
  ok(v1.children[0].visits[0].vitals && v1.children[0].visits[0].exam && v1.children[0].visits[0].template === "", "v2 adds vitals+exam+template to visits");
  ok(v1.children[0].name === "V1 Kid", "v2 migration preserves data");
  const v0 = { children: [{ id: "c0", name: "V0", visits: [{ id: "a" }] }] };
  const rep0 = sb.migrateDB(v0);
  ok(JSON.stringify(rep0.applied) === "[1,2]" && v0._sv === 2, "v0 backup chains 1->2");
  ok(v0.children[0].problems && v0.children[0].visits[0].vitals, "chain adds P1 + P2 containers");
  const fix = JSON.parse(fs.readFileSync(path.join(R, "tests/fixtures/backup-v10.32.json"), "utf8"));
  const imp = sb.buildDbFromBackup(fix);
  ok(imp._sv === 2 && imp.children.length === 2 && imp.children[0].name === "Legacy Girl", "v10.32 fixture imports to v2 intact");
  ok(Array.isArray(imp.children[0].visits[0].icd) && imp.children[0].visits[0].vitals && imp.children[0].perinatal, "fixture gains P1 + P2 containers");

  // ---- visit display + save hook ----
  const vline = Ex.visitVitalsHTML({ vitals: { t: 38.6, hr: 150 }, date: "2026-10-01" }, { dob: "2024-06-01", sex: "boy" });
  ok(vline.includes("T 38.6") && /2 flags/.test(vline), "visit line shows vitals + flag count");
  ok(Ex.visitVitalsHTML({ vitals: {} }, {}) === "", "no vitals -> no line");
  ok(Ex.raiseFlagsOnSave({ vitals: { t: "39.2" }, date: "2026-10-01" }, { dob: "2024-01-01", name: "Flag Kid" }) === 1, "save hook counts flags");
  ok(Ex.raiseFlagsOnSave({ vitals: { t: "37" } }, { dob: "2024-01-01" }) === 0, "save hook quiet when normal");

  console.log(`\nexam: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("exam harness crashed:", e); process.exit(1); });

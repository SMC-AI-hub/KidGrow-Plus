// NeoKid Care — Phase T productive-timeline suite. Same full-boot harness
// as history.test.js (ALL scripts in index.html order), then asserts:
// T4 one-liners + expand, T1 story-header rows, T2 attention rail,
// T3 problem grouping + views, and event keys/refs.
// Use: node tests/timeline.test.js
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

  // ---- Phase T fixtures (dates relative to today -> deterministic) ----
  const iso = (d) => d.toISOString().slice(0, 10);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  const tia = { id: "tia1", name: "Tia Test", dob: "2023-06-01", sex: "girl",
    birthWt: 2.9, gest: 39, blood: "O+",
    problems: [{ label: "Asthma", code: "J45", status: "active" }, { label: "Iron deficiency", code: "D50.9", status: "active" }, { label: "Cold", status: "resolved" }],
    visits: [
      { id: "v1", date: "2026-09-01", type: "Follow-up", subj: "Cold and cough for 3 days", obj: "Chest clear", assess: "Viral URI", plan: "PCM + fluids, review 2 days", icd: ["J06.9"], vitals: { t: "38.5", hr: "140" } },
      { id: "v2", date: "2026-10-05", type: "Review", subj: "Wheeze at night, needs inhaler", obj: "", assess: "Asthma, partly controlled", plan: "Start ICS, review 2 weeks", icd: ["J45"], vitals: {} },
      { id: "v3", date: "2026-10-18", type: "Visit", subj: "", obj: "", assess: "", plan: "", icd: [], vitals: {} },
    ],
    rx: [{ id: "r1", date: "2026-10-06", dx: "Asthma", items: [{ drug: "Salbutamol" }], advice: "", review: "", by: "Dr" }],
    vaccines: {}, extraVac: [],
    measures: [{ date: "2026-08-01", wt: 14.4, ht: 95 }, { date: "2026-09-01", wt: 14.2, ht: 96 }, { date: "2026-10-01", wt: 13.9, ht: 97 }],
    labs: [{ id: "l1", date: "2026-10-10", hb: "11.0", rev: "" }, { id: "l2", date: "2026-09-01", hb: "11.5", rev: "2026-09-02" }],
    aefi: [{ id: "a1", date: day(-6), code: "DPT", vacLabel: "DPT booster", severity: "Moderate", outcome: "Recovering", reported: "No" }] };
  sb.TIA = tia;
  vm.runInContext(`DB.children=[TIA]; DB.activeId='tia1'; DB.appts=[{id:'a1',childId:'tia1',date:'${day(4)}',time:'10:00',type:'Review',done:false}];`, sb);

  // ---- T4 one-liners ----
  ok(sb.visitOneLiner(tia.visits[0]) === "Cold and cough for 3 days → J06.9 → PCM + fluids, review 2 days", "one-liner complaint→dx→plan");
  ok(sb.visitOneLiner({}) === "Visit", "one-liner empty visit falls back");
  ok(sb.visitOneLiner({ type: "Review", subj: "Doing well" }) === "Doing well → Review", "one-liner uses visit type when no ICD");
  ok(sb.visitOneLiner({ subj: "x".repeat(120) }) === "x".repeat(60) + "…", "one-liner truncates long complaint");
  ok(sb.tlHead("aaa bbb ccc", 8) === "aaa bbb…", "tlHead cuts at word boundary");
  ok(sb.visitFullHTML(tia.visits[0]).includes("Viral URI") && sb.visitFullHTML(tia.visits[0]).includes("ICD:"), "expanded note shows full SOAP + ICD");

  // ---- T1 story header ----
  const snap = sb.timelineSnapshot(tia);
  ok(snap.includes("Birth") && snap.includes("2.9 kg") && snap.includes("39 wk"), "T1 birth line");
  ok(!snap.includes("preterm"), "T1 no false preterm flag");
  ok(sb.timelineSnapshot({ ...tia, gest: 33 }).includes("preterm"), "T1 preterm flagged");
  ok(/\(\d+%\)/.test(snap), "T1 immunisation %");
  ok(snap.includes("losing ▼"), "T1 growth trend losing");
  ok(snap.includes("Next visit") && snap.includes("Review"), "T1 next appointment");
  ok(sb.timelineNextAppt({ id: "nobody" }) === null, "T1 no appt -> null");
  const epi = { ...tia, id: "epi1", chronic: { epilepsy: { seizures: [{}], aeds: [] } } };
  ok(sb.timelineChronicFlags(epi).join() === "Epilepsy" && sb.timelineSnapshot(epi).includes("Epilepsy"), "T1 chronic registry flag");
  ok(sb.timelineChronicFlags(tia).length === 0, "T1 no chronic flags when registries empty");

  // ---- T2 attention rail ----
  const attn = sb.timelineAttention(tia);
  ok(attn.length === 5, "T2 five triggers, got " + attn.length);
  ok(attn[0].page === "vaccines" && attn[0].red && /overdue/.test(attn[0].text), "T2 overdue vaccines first + red");
  ok(attn.some((a) => a.page === "growth" && a.red && a.text.includes("Weight down")), "T2 weight-loss flag");
  ok(attn.some((a) => a.page === "labs" && a.text.includes("1 lab report")), "T2 unreviewed lab count");
  ok(attn.some((a) => a.page === "aefi" && a.text.includes("AEFI watch")), "T2 AEFI watch");
  ok(attn.some((a) => a.page === "schedule"), "T2 upcoming appointment");
  const schedCodes = JSON.parse(vm.runInContext("JSON.stringify(VACCINE_SCHEDULE.filter(v=>v.dueDays<=0).map(v=>v.vaccines.map(x=>x.code)).flat())", sb));
  const clr = { id: "clr1", name: "Clear Kid", dob: vm.runInContext("todayISO()", sb), sex: "boy", visits: [], rx: [], vaccines: {}, extraVac: [], measures: [], labs: [], aefi: [], problems: [] };
  schedCodes.forEach((cd) => { clr.vaccines[cd] = { date: clr.dob }; });
  const clrAttn = sb.timelineAttention(clr);
  ok(clrAttn.length === 0, "T2 all-clear newborn, got " + JSON.stringify(clrAttn));
  ok(sb.timelineAttentionHTML(clr).includes("All clear"), "T2 all-clear message");
  const six = { id: "six1", name: "Six", dob: day(-45), sex: "girl", visits: [], rx: [], vaccines: {}, extraVac: [],
    measures: [{ date: day(-6), wt: 3.0 }, { date: day(-1), wt: 2.8 }],
    labs: [{ id: "l9", date: day(-1), hb: "10", rev: "" }],
    aefi: [{ id: "a9", date: day(-2), code: "BCG", vacLabel: "BCG", severity: "Mild", outcome: "", reported: "No" }], problems: [] };
  vm.runInContext(`DB.appts.push({id:'a6',childId:'six1',date:'${day(4)}',time:'09:00',type:'Weigh',done:false});`, sb);
  const sixAttn = sb.timelineAttention(six);
  ok(sixAttn.length === 5 && !sixAttn.some((a) => a.page === "schedule"), "T2 six triggers capped, lowest priority drops");
  ok(sixAttn[0].page === "vaccines" && sixAttn.some((a) => a.page === "growth"), "T2 overdue still leads a full rail");

  // ---- T3 problem grouping ----
  const groups = sb.timelineProblemGroups(tia, "all");
  ok(groups.length === 3, "T3 two problems + General, got " + groups.length);
  ok(groups[0].prob.code === "J45" && groups[0].items.length === 2, "T3 asthma group collects visit + Rx by code");
  ok(groups[1].prob.code === "D50.9" && groups[1].items.length === 0, "T3 unlinked problem shows empty");
  ok(!groups[2].prob && groups[2].items.length === 2, "T3 General catches unmatched visits");
  ok(sb.tlMatchProblem({ kind: "visit", ref: { subj: "Asthma review, doing well", icd: [] } }, tia.problems).code === "J45", "T3 label fallback matches without code");
  ok(sb.tlMatchProblem({ kind: "visit", ref: { subj: "Wheeze", icd: ["J45.0"] } }, tia.problems).code === "J45", "T3 code containment J45.0 -> J45");
  ok(sb.tlMatchProblem({ kind: "visit", ref: { subj: "Fever", icd: ["R50.9"] } }, tia.problems) === null, "T3 unrelated visit unmatched");
  ok(!groups.some((g) => g.prob && g.prob.label === "Cold"), "T3 resolved problem excluded");
  const rxg = sb.timelineProblemGroups(tia, "rx");
  ok(rxg.length === 2 && rxg[0].items.length === 1 && rxg.every((g) => g.prob), "T3 kind filter applies, empty General omitted");
  const phtml = sb.timelineHTML(tia, "all", "problems");
  ok(phtml.includes("General / unlinked") && phtml.includes("J45") && phtml.includes("tl-cardhead"), "T3 problems view renders groups");
  ok(!phtml.includes("ctx-group"), "T3 problems view has no month dividers");
  const pempty = sb.timelineProblemsHTML({ ...tia, visits: [], rx: [], problems: [] }, "all");
  ok((pempty.match(/tl-cardhead/g) || []).length === 4 && pempty.includes("No visits or prescriptions yet"), "U empty problems view still shows 4 cards + hint");

  // ---- Chronology view + expand wiring ----
  const ch = sb.timelineHTML(tia, "all");
  ok(ch.includes("ctx-group") && ch.includes('data-act="timelineView"'), "chrono keeps month groups + view toggle");
  ok(ch.includes("Cold and cough for 3 days → J06.9") && ch.includes('data-act="timelineExpand"'), "T4 one-liner in feed with expand affordance");
  ok(ch.includes("HR 140") && ch.includes("38.5"), "T4 vitals stay inline");
  ok(!ch.includes("Viral URI"), "T4 full note hidden until expanded");
  vm.runInContext("timelineEvents(TIA).forEach((e) => { if (e.kind === 'visit') TIMELINE_OPEN[e.key] = 1; });", sb);
  const chOpen = sb.timelineHTML(tia, "all");
  ok(chOpen.includes("Viral URI") && chOpen.includes("▾"), "T4 expand reveals full SOAP");
  vm.runInContext("Object.keys(TIMELINE_OPEN).forEach((k) => delete TIMELINE_OPEN[k]);", sb);
  const evil = { ...tia, id: "evil1", visits: [{ id: "e1", date: "2026-10-01", type: "Visit", subj: "Fever<script>", plan: "Rest", icd: [] }] };
  const eh = sb.timelineHTML(evil, "all");
  ok(!eh.includes("<script>") && eh.includes("Fever&lt;script&gt;"), "T4 one-liner escapes HTML");
  const tev = sb.timelineEvents(tia);
  ok(tev.every((e) => e.key) && tev.filter((e) => e.kind === "visit").every((e) => e.ref && e.ref.subj !== undefined), "events carry keys + visit refs");
  ok(vm.runInContext("TIMELINE_VIEW", sb) === "chrono", "default view is Chronology");
  ok(vm.runInContext("typeof Act !== 'undefined' && !!(Act.timelineView && Act.timelineExpand)", sb), "view + expand actions registered");

  // ---- Phase U: category cards ----
  const cardMap = { all: 4, visit: 1, rx: 1, vax: 1, growth: 1, labs: 1, aefi: 1 };
  ok(Object.entries(cardMap).every(([k, n]) => sb.tlCardsFor(k).length === n), "U chips map to card sets");
  ok(sb.tlCardsFor("visit")[0] === "issues" && sb.tlCardsFor("aefi")[0] === "vax", "U visit->Issues, aefi->Vaccine");
  vm.runInContext("Object.keys(TIMELINE_CARDS).forEach((k) => delete TIMELINE_CARDS[k]); TIMELINE_CARDS.issues=1;", sb);
  const pcards = sb.timelineProblemsHTML(tia, "all"); // cards only (phtml includes snapshot+rail)
  ok((pcards.match(/tl-cardhead/g) || []).length === 4, "U four card heads");
  ok(pcards.includes("2 problems · 4 entries") && pcards.includes("5 to act"), "U Issues face counts");
  ok(pcards.includes("Needs action") && pcards.includes("overdue") && pcards.includes('data-arg="vaccines"'), "U Issues attention on top");
  ok(pcards.includes("Asthma") && pcards.includes("2 entries") && !pcards.includes("Salbutamol"), "U problem groups collapsed by default");
  vm.runInContext('TIMELINE_CARDS["g:P:J45"]=1;', sb);
  ok(sb.timelineProblemsHTML(tia, "all").includes("Salbutamol"), "U group expand reveals entries");
  vm.runInContext('delete TIMELINE_CARDS["g:P:J45"];', sb);
  ok(pcards.includes("13.9 kg") && pcards.includes("-0.3 kg") && !pcards.includes("14.4 kg"), "U Growth face latest-only");
  vm.runInContext("TIMELINE_CARDS.growth=1;", sb);
  ok(sb.timelineProblemsHTML(tia, "all").includes("14.4 kg"), "U Growth expand reveals history");
  vm.runInContext("delete TIMELINE_CARDS.growth;", sb);
  ok(pcards.includes("losing") && /\(\d+%\)/.test(pcards), "U Growth losing badge + Vaccine immun-%");
  vm.runInContext("TIMELINE_CARDS.vax=1;", sb);
  const vaxOpen = sb.timelineProblemsHTML(tia, "all");
  ok(vaxOpen.includes("DPT booster") && vaxOpen.includes("AEFI (1)"), "U AEFI folds into Vaccine card");
  vm.runInContext("delete TIMELINE_CARDS.vax;", sb);
  ok(pcards.includes("Hb 11.0") && pcards.includes("1 to review"), "U Labs face latest + review count");
  ok(sb.timelineEvents(tia).filter((e) => e.kind === "labs" && e.flag === "to review").length === 1, "U lab events carry review flag");
  const soloGrowth = sb.timelineProblemsHTML(tia, "growth");
  ok(soloGrowth.includes('data-arg="growth"') && !soloGrowth.includes('data-arg="vax"') && !soloGrowth.includes('data-arg="issues"'), "U growth chip isolates Growth card");
  ok(soloGrowth.includes("14.4 kg"), "U solo card force-opens");
  ok(sb.timelineProblemsHTML(tia, "labs").includes("Hb 11.0"), "U labs chip isolates Labs card");
  const evilProb = sb.timelineProblemsHTML({ ...tia, problems: [{ label: "X<script>" }] }, "all");
  ok(!evilProb.includes("<script>") && evilProb.includes("X&lt;script&gt;"), "U problem labels escaped");
  ok(sb.timelineProblemsHTML(clr, "visit").includes("All clear."), "U all-clear Issues for healthy child");
  ok(sb.tlGrowthCard({ ...tia, measures: [] }).body.includes("Open Growth"), "U empty Growth card jumps to page");
  ok(vm.runInContext("typeof Act !== 'undefined' && !!Act.timelineCard", sb), "U card toggle action registered");
  vm.runInContext("Object.keys(TIMELINE_CARDS).forEach((k) => delete TIMELINE_CARDS[k]); TIMELINE_CARDS.issues=1;", sb);

  console.log(`\ntimeline: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("timeline harness crashed:", e); process.exit(1); });

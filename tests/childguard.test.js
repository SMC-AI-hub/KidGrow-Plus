// NeoKid Care — child-safety guard regression suite (2026-11-04).
// Proves BOTH chosen safeguards: (A) app-wide twin-confirm banner +
// clinical-write gate, and (B) required explicit child pick on the six
// highest-risk entry forms. Pure VM harness: no browser, no network, no DB.
// Run: node tests/childguard.test.js
const fs = require("fs"), vm = require("vm"), path = require("path");
const R = path.join(__dirname, "..");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }
const read = (f) => fs.readFileSync(path.join(R, f), "utf8");

/* ---------- minimal DOM / app harness ---------- */
function mkEl(id, value) {
  const el = {
    id: id || "", value: value || "", innerHTML: "", textContent: "", className: "",
    style: {}, dataset: {}, disabled: false, parentNode: null, children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {},
    appendChild(c) { el.children.push(c); return c; }, append() {}, prepend() {}, remove() {},
    insertBefore(c) { el.children.push(c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, matches() { return false; },
    addEventListener() {}, focus() {}, click() {},
  };
  return el;
}
function harness(kids, activeId) {
  const els = {};
  const get = (id) => {
    if (!els[id]) els[id] = mkEl(id);
    return els[id];
  };
  // pre-create the six form containers so injection can find them
  ["mVisit", "mGrowth", "mVac", "mTanner", "mExtra", "mAppt"].forEach(get);
  get("cgBanner");
  const store = {};
  const sb = {
    console, setTimeout: (f) => { try { f(); } catch (e) {} return 1; }, clearTimeout,
    Date, JSON, Object, Array, String, Number, Math, RegExp,
    sessionStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; },
    },
    DB: { children: kids, activeId: activeId == null ? (kids[0] ? kids[0].id : null) : activeId },
    toasts: [],
    toast: (m) => sb.toasts.push(String(m)),
    setActive: (id) => { sb.DB.activeId = id; },
    child: () => sb.DB.children.find((c) => c.id === sb.DB.activeId) || sb.DB.children[0] || null,
    actNames: {},
    actRegister: (n, f) => { sb.actNames[n] = f; },
    document: {
      getElementById: get,
      createElement: (t) => mkEl(""),
      querySelector: () => null, querySelectorAll: () => [],
    },
    module: { exports: {} },
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  vm.createContext(sb);
  vm.runInContext(read("js/childguard.js"), sb, { filename: "js/childguard.js" });
  return { sb, els, get };
}

/* ---------- 1. Twin / look-alike detection ---------- */
{
  const { sb } = harness([], null);
  const api = sb.module.exports;
  ok(!!api && typeof api.cgTwinPeers === "function", "module exports pure helpers");
  const twins = [
    { id: "t1", name: "Abhinaya Twin 1", dob: "2020-04-01", mother: "Meena", mrn: "A-1" },
    { id: "t2", name: "Abhinaya (Twin 2)", dob: "2020-04-01", mother: "Meena", mrn: "A-2" },
  ];
  ok(api.cgTwinMark("Abhinaya Twin 1") && api.cgTwinMark("Baby T2") && !api.cgTwinMark("Abhinaya"), "twin markers detected, plain names untouched");
  ok(api.cgBaseName("Abhinaya Twin 1") === "abhinaya" && api.cgBaseName("Abhinaya (Twin 2)") === "abhinaya", "twin-marked names share a stripped base");
  const p = api.cgTwinPeers(twins[0], twins);
  ok(p.length === 1 && p[0].id === "t2", "name-based twin pair detected (the exact reported case)");
  const byDob = [
    { id: "a", name: "Kavin", dob: "2021-01-01", mother: "Priya" },
    { id: "b", name: "Nila", dob: "2021-01-01", mother: "Priya" },
  ];
  ok(api.cgTwinPeers(byDob[0], byDob).length === 1, "same DOB + shared parent detected (twins / duplicate registration)");
  const byGroup = [
    { id: "g1", name: "Riya", dob: "2022-02-02", twinGroup: "G7" },
    { id: "g2", name: "Diya", dob: "2022-02-02", twinGroup: "G7" },
  ];
  ok(api.cgTwinPeers(byGroup[0], byGroup).length === 1, "explicit twinGroup link honoured");
  const unrelated = [
    { id: "u1", name: "Arjun", dob: "2020-01-01", mother: "Asha", phone: "9000000001" },
    { id: "u2", name: "Arjun", dob: "2019-06-06", mother: "Valli", phone: "9000000002" },
  ];
  ok(api.cgTwinPeers(unrelated[0], unrelated).length === 0, "unrelated same-name children are NOT flagged");
  ok(api.cgTwinPeers(twins[0], [twins[0]]).length === 0, "a single child has no peers");

  /* ---------- 2. Confirmation fingerprint invalidation ---------- */
  const sig0 = api.cgSig(twins[0], [twins[1]]);
  ok(sig0 === api.cgSig(twins[0], [twins[1]]), "signature stable for unchanged identity");
  ok(sig0 !== api.cgSig(Object.assign({}, twins[0], { name: "Abhinaya Twin 3" }), [twins[1]]), "rename invalidates confirmation");
  ok(sig0 !== api.cgSig(Object.assign({}, twins[0], { dob: "2020-04-02" }), [twins[1]]), "DOB edit invalidates confirmation");
  ok(sig0 !== api.cgSig(Object.assign({}, twins[0], { mrn: "A-9" }), [twins[1]]), "MRN edit invalidates confirmation");
  ok(sig0 !== api.cgSig(twins[0], []), "removal of the sibling invalidates confirmation");
  ok(sig0 !== api.cgSig(twins[1], [twins[0]]), "switching to the other twin invalidates confirmation");
}

/* ---------- 3. Option B: explicit pick required on the six forms ---------- */
{
  const kids = [{ id: "c1", name: "Abhinaya Twin 1", dob: "2020-04-01", mother: "Meena" }];
  const h = harness(kids, "c1");
  const { sb, get } = h;
  const api = sb.module.exports;
  const fid = "mVisit", selId = api.CG_PICK[fid];
  ok(Object.keys(api.CG_PICK).length === 6 && api.CG_PICK.mAppt === "aChild", "six highest-risk forms covered (appointment reuses #aChild)");
  ok(!!api.CG_SAVE_BTN[fid] && api.CG_GUARDED.saveVisit === 1, "save actions are registered as guarded");

  const saveBtn = mkEl(""); saveBtn.getAttribute = (a) => (a === "data-act" ? "saveVisit" : null);
  const modal = get(fid); modal.querySelectorAll = () => [saveBtn];
  sb.cgFormOpen(fid);
  ok(get(selId).value === "" || get(selId).value === undefined, "form opens with NO child selected");
  ok(saveBtn.disabled === true, "Save button is locked on open");

  // blocked regardless of whether Option A is confirmed
  sb.cgConfirm();
  ok(sb.cgAllow("saveVisit", { closest: () => ({ id: fid }) }) === false, "B gate blocks a save with no explicit pick even after A confirmation");
  ok(sb.toasts.some((t) => /Select the child/i.test(t)), "blocked save explains what to do");

  get(selId).value = "c1";
  sb.cgPick(Object.assign(get(selId), { closest: () => ({ id: fid }), id: selId }));
  ok(saveBtn.disabled === false, "explicit pick unlocks Save");
  ok(sb.cgAllow("saveVisit", { closest: () => ({ id: fid }) }) === true, "B gate allows the save once a child is picked");
  ok(sb.cgAllow("saveSettings", null) === true, "non-clinical saves are never gated");
}

/* ---------- 3b. Injected markup itself is neutral ---------- */
{
  const h = harness([
    { id: "t1", name: "Abhinaya Twin 1", dob: "2020-04-01", mrn: "A-1" },
    { id: "t2", name: "Abhinaya Twin 2", dob: "2020-04-01", mrn: "A-2" },
  ], "t1");
  const ids = Object.keys(h.sb.CG_PICK).filter((f) => f !== "mAppt");
  const rows = ids.map((fid) => h.get(fid).children[0]).filter(Boolean);
  ok(rows.length === 5, "all five injected forms receive a pick row");
  ok(rows.every((r) => /<option value="">— select child —<\/option>/.test(r.innerHTML)), "each pick starts on a neutral empty option (no default twin)");
  ok(rows.every((r) => r.innerHTML.includes("A-1") && r.innerHTML.includes("A-2")), "each option shows MRN so twins are distinguishable");
  ok(rows.every((r, i) => r.innerHTML.includes('id="cgLock_' + ids[i] + '"')), "each pick row carries its lock note");
  ok(h.sb.CG_PICK.mAppt === "aChild", "appointment form reuses #aChild (no duplicate picker)");
  ok(h.sb.module.exports.cgEsc('<x>&"') === "&lt;x&gt;&amp;&quot;", "all rendered child identifiers are HTML-escaped");
}

/* ---------- 4. Option A: app-wide twin confirm + write gate ---------- */
{
  const twins = [
    { id: "t1", name: "Abhinaya Twin 1", dob: "2020-04-01", mother: "Meena" },
    { id: "t2", name: "Abhinaya Twin 2", dob: "2020-04-01", mother: "Meena" },
  ];
  const h = harness(twins, "t1");
  const { sb, get } = h;
  // no modal ancestor → this is an app-wide write (Option A's scope)
  const el = { closest: () => null };
  ok(sb.cgAllow("saveRx", el) === false, "twin pair + no confirmation blocks clinical writes app-wide");
  ok(sb.toasts.some((t) => /Twin \/ look-alike/i.test(t)), "blocked save points to the banner");
  ok(/Confirm — Abhinaya Twin 1/.test(get("cgBanner").innerHTML) && /cgConfirm/.test(get("cgBanner").innerHTML), "unconfirmed banner asks for explicit confirmation");
  ok(/Abhinaya Twin 2/.test(get("cgBanner").innerHTML), "banner names the matching record");

  sb.cgConfirm();
  ok(sb.cgAllow("saveRx", el) === true, "banner confirmation unlocks clinical writes");
  ok(/Confirmed — working on Abhinaya Twin 1/.test(get("cgBanner").innerHTML), "confirmed state is visible");

  sb.cgReset();
  ok(sb.cgAllow("saveRx", el) === false, "\"Change confirmation\" re-locks writes");

  sb.cgConfirm();
  sb.DB.activeId = "t2";
  ok(sb.cgAllow("saveRx", el) === false, "switching the active child requires a fresh confirmation");
  sb.cgConfirm();
  ok(sb.cgAllow("saveRx", el) === true, "confirming the new active child unlocks again");

  sb.cgConfirm();
  sb.DB.children[1].name = "Abhinaya Twin 2 (renamed)";
  ok(sb.cgAllow("saveRx", el) === false, "renaming a sibling invalidates the confirmation");
}
{
  const { sb, get } = harness([{ id: "solo", name: "Solo Kid", dob: "2023-03-03" }], "solo");
  ok(sb.cgAllow("saveRx", { closest: () => null }) === true, "a clinic with no twin pair is unaffected (Option A silent)");
  ok(get("cgBanner").innerHTML === "", "no banner is rendered when no look-alike pair exists");
}
{
  const { sb } = harness([], null);
  ok(sb.cgAllow("saveVisit", null) === true, "no children = fail-open (headless / first-run)");
}

/* ---------- 5. Wiring: shipped, cached, CSP-clean, versioned ---------- */
{
  const html = read("index.html"), sw = read("sw.js"), css = read("css/style.css");
  const app = read("js/app.js"), del = read("js/delegate.js"), clin = read("js/clinic.js");
  const cg = read("js/childguard.js"), csp = read("tests/csp.test.js"), pkg = read("package.json");
  ok(html.includes('<div id="cgBanner"') && html.indexOf('id="cgBanner"') < html.indexOf('id="pg-dashboard"'), "banner slot sits above every page in .content");
  ok(html.includes('<script src="js/childguard.js"></script>'), "guard script shipped in index.html");
  ok(html.indexOf("js/childguard.js") < html.indexOf("js/boot.js"), "guard loads before the tail boot");
  ok(html.includes('id="aChild" data-onchange="cgPick"'), "appointment picker routes through the explicit-pick handler");
  ok(sw.includes('"./js/childguard.js"'), "guard is in the offline shell cache");
  ok(/const CACHE = "neokid-v51"/.test(sw), "SW cache bumped so cached clients receive the fix");
  ok(del.includes("cgAllow(name, el)"), "single choke point in delegated actRun");
  ok(app.includes('"renderPatientHeaders", "cgRender"'), "cgRender is called by renderAll on every screen");
  ok(app.includes("cgFormOpen(id)"), "cgFormOpen resets the pick whenever a form is opened");
  ok(clin.includes("— select child —") && !/\$\{c\.id === DB\.activeId \? " selected"/.test(clin), "appointment form no longer pre-selects the active (wrong) twin");
  ok(["cg-banner", "cg-pick", "cg-lock", "cg-flash", "cg-actions", "cg-title", "cg-note"].every((c) => css.includes("." + c)), "all additive CSS classes present");
  ok(css.includes("@media print{.cg-banner-slot,.cg-pick,.cg-lock{display:none!important}}"), "guard chrome never prints into a clinical record");
  ok(!/[^.\w-]on(click|change|input|submit|focus|blur|error)\s*=/.test(cg) && !/<script(?![^>]*\ssrc=)[^>]*>/.test(cg) && !/javascript:/i.test(cg), "guard is CSP-clean (no inline handlers / scripts / javascript: URLs)");
  for (const n of ["cgConfirm", "cgSwitch", "cgReset", "cgPick"]) {
    ok(new RegExp('actRegister\\("' + n + '"').test(cg), "delegated action " + n + " registered");
    ok(csp.includes('"js/childguard.js"'), "csp.test.js treats the guard as a converted file");
  }
  ok(!/console\.(log|info|warn|debug|error)/.test(cg), "guard logs nothing (no PHI in logs)");
  ok(!/\beval\s*\(|new Function|document\.write/.test(cg), "guard uses no dangerous sinks");
  ok(pkg.includes('"version": "10.53.3"') && read("api/health.js").includes('10.53.3') && read("js/cloud.js").includes('v10.53.3'), "release version pins agree (v10.53.3)");
  ok(read("package.json").includes("tests/childguard.test.js"), "new suite is chained into npm test");

  // static action registration coverage mirrors tests/csp.test.js
  const used = [...cg.matchAll(/data-(?:act|oninput|onchange|onkey|onfocus|onblur|onerror)="([^"]+)"/g)].map((m) => m[1]);
  ok(used.length >= 4 && used.every((u) => new RegExp('actRegister\\("' + u + '"').test(cg)), "every generated delegated action is registered");

  // Every name in CG_GUARDED must be a real, registered delegated action —
  // otherwise a typo silently leaves a clinical write ungated.
  const allSrc = ["index.html", ...fs.readdirSync(path.join(R, "js")).filter((f) => f.endsWith(".js")).map((f) => "js/" + f)]
    .map((f) => read(f)).join("\n");
  const known = new Set();
  for (const m of allSrc.matchAll(/actRegister\("([^"]+)"|actCall0\("([^"]+)"|actCallN\("([^"]+)"|data-act="([^"${]+)"/g))
    for (const v of m.slice(1)) if (v) known.add(v);
  for (const m of allSrc.matchAll(/\[([^\]]+)\]\s*\.forEach\((?:actCall0|function \(n\) \{ actCall0\(n\); \})\)/g))
    for (const n of m[1].matchAll(/"([^"]+)"/g)) known.add(n[1]);
  const gatedBlock = cg.match(/var CG_GUARDED = \{\};\s*\[([\s\S]*?)\]\.forEach\(function \(n\) \{ CG_GUARDED\[n\]/)[1];
  const guarded = [...gatedBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const unknown = guarded.filter((n) => !known.has(n));
  ok(guarded.length >= 60 && unknown.length === 0, `all ${guarded.length} gated clinical actions exist and are registered` + (unknown.length ? ": " + unknown.join(",") : ""));
}

console.log(`childguard: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

// NeoKid Care — convergent sync suite (v10.41). Pure merge-engine asserts +
// two-device convergence simulation + cloud.js wiring. Use: node tests/syncmerge.test.js
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
const SyncMerge = require("../js/syncmerge.js");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }
const clone = (o) => JSON.parse(JSON.stringify(o));

function baseChild(id, name) {
  return {
    id, name: name || ("Child " + id), dob: "2022-01-01", sex: "M", mrn: "MRN" + id,
    measures: [{ id: "m1", d: "2024-01-01", wt: 10 }], vaccines: {}, visits: [], rx: [], labs: [],
    problems: [], allergies: [], consents: [], aefi: [], mar: [], milestones: {}, tanner: [], letters: [],
  };
}
function baseDB() {
  return {
    children: [baseChild("c1", "Asha")], activeId: "c1",
    settings: { clinic: "City Clinic", theme: "light", autoSync: true },
    tokens: [], appts: [], bills: [], users: [], doctors: [], remLog: [], stocklog: [],
    formularyReviews: [], vaxstock: [], audit: [{ t: "2024-01-01T00:00:00.000Z", cid: "", user: "ph", action: "Seed", detail: "seed" }],
    _deleted: [], session: { user: "deviceA" }, msBand: "x", gTab: "wt", gRef5: 1, gLines: 1, gSub: 1, gFull: 0,
    gAssessId: "g1", lastBackup: "2024-05-01", _cloudWelcomed: true, corrAge: false, _sv: 3,
  };
}

// --- 1. subset + hash ---
{
  const d = baseDB(), sd = SyncMerge.data(d);
  for (const k of SyncMerge.LOCAL_KEYS) ok(!(k in sd), "sync subset excludes device-local key " + k);
  for (const k of ["children", "settings", "tokens", "appts", "bills", "users", "doctors", "audit", "_deleted", "remLog", "stocklog", "formularyReviews", "vaxstock", "_sv"]) ok(k in sd, "sync subset keeps " + k);
  const a = baseDB(), b = baseDB();
  b.session = { user: "deviceB" }; b.activeId = null; b.msBand = "y"; b.gTab = "ht"; b.settings.theme = "dark"; b.lastBackup = "2025-01-01";
  ok(SyncMerge.hash(a) === SyncMerge.hash(b), "hash ignores device noise (session/activeId/UI/theme)");
  const c = baseDB();
  c.children.push(baseChild("c2", "Babu"));
  c.children.reverse();
  const d2 = baseDB();
  d2.children.unshift(baseChild("c2", "Babu"));
  ok(SyncMerge.hash(c) === SyncMerge.hash(d2), "hash is order-insensitive (children order)");
  const e = baseDB(), f = baseDB();
  f.children[0].visits.push({ id: "v1", d: "2024-06-01", note: "cold" });
  ok(SyncMerge.hash(e) !== SyncMerge.hash(f), "hash detects real data change");
  ok(typeof SyncMerge.hash({}) === "string" && SyncMerge.hash(null) === SyncMerge.hash(undefined), "hash tolerates empty input");
}

// --- 2. child + record union ---
{
  const a = baseDB(), b = baseDB();
  b.children.push(baseChild("c2", "Babu"));
  const m = SyncMerge.merge(a, b);
  ok(m.db.children.length === 2 && m.db.children.some((c) => c.id === "c2"), "child added on cloud joins local");
  ok(m.changedLocal === true && m.changedCloud === false, "cloud-ahead flags correct");

  const p = baseDB(), q = baseDB();
  p.children[0].visits.push({ id: "v1", d: "2024-06-01", note: "cold" });
  q.children[0].labs.push({ id: "l1", d: "2024-06-02", test: "CBC" });
  const m2 = SyncMerge.merge(p, q);
  ok(m2.db.children[0].visits.length === 1 && m2.db.children[0].labs.length === 1, "visit on A + lab on B both survive");
  ok(m2.changedLocal === true && m2.changedCloud === true, "both-ahead flags correct");
  ok(m2.notes.length === 0, "additive merge produces no scalar notes");

  const r = baseDB(), s = baseDB();
  r.children[0].milestones = { smile: "2022-03-01" };
  s.children[0].milestones = { sit: "2022-07-01" };
  const m3 = SyncMerge.merge(r, s);
  ok(m3.db.children[0].milestones.smile && m3.db.children[0].milestones.sit, "milestone keys union");

  const t = baseDB(), u = baseDB();
  t.children[0].vaccines = { BCG: { date: "2022-01-02" } };
  u.children[0].vaccines = { OPV0: { date: "2022-01-02" } };
  const m4 = SyncMerge.merge(t, u);
  ok(m4.db.children[0].vaccines.BCG && m4.db.children[0].vaccines.OPV0, "vaccine codes union");
}

// --- 3. scalar ties: local wins, dropped value kept in audit ---
{
  const a = baseDB(), b = baseDB();
  a.children[0].phone = "111"; b.children[0].phone = "222";
  const m = SyncMerge.merge(a, b);
  ok(m.db.children[0].phone === "111", "scalar tie keeps local value");
  ok(m.notes.length === 1 && m.notes[0].path.includes("phone"), "scalar tie recorded in notes");
  const entry = m.db.audit.find((e) => e.action === "Sync merge");
  ok(!!entry && entry.detail.includes("222"), "dropped cloud value preserved in audit detail");
  const mB = SyncMerge.merge(b, a); // symmetric run: B-local keeps 222
  ok(mB.db.children[0].phone === "222", "tie is side-deterministic (each side keeps its own)");

  const v1 = baseDB(), v2 = baseDB();
  v1.children[0].vaccines = { BCG: { date: "2022-01-02" } };
  v2.children[0].vaccines = { BCG: { date: "2022-02-05" } };
  const mV = SyncMerge.merge(v1, v2);
  ok(mV.db.children[0].vaccines.BCG.date === "2022-01-02" && mV.notes.length === 1, "same vaccine, two dates: local wins + noted");

  const e1 = baseDB(), e2 = baseDB();
  e1.children[0].blood = ""; e2.children[0].blood = "O+";
  ok(SyncMerge.merge(e1, e2).db.children[0].blood === "O+", "empty local adopts cloud value");
  const e3 = baseDB(), e4 = baseDB();
  e3.children[0].blood = "A+"; e4.children[0].blood = "";
  ok(SyncMerge.merge(e3, e4).db.children[0].blood === "A+", "empty cloud keeps local value");
}

// --- 4. top-level merges ---
{
  const a = baseDB(), b = baseDB();
  a.audit.unshift({ t: "2024-06-01T00:00:00.000Z", cid: "", user: "A", action: "Vx", detail: "a" });
  b.audit.unshift({ t: "2024-06-02T00:00:00.000Z", cid: "", user: "B", action: "Vx", detail: "b" });
  const m = SyncMerge.merge(a, b);
  ok(m.db.audit.length === 3 && m.db.audit[0].detail === "b", "audit unions, newest first");

  const big = [];
  for (let i = 0; i < 600; i++) big.push({ t: "2024-01-01T00:00:00.000Z", cid: "", user: "x", action: "A" + i, detail: "d" + i });
  const c = baseDB(); c.audit = big;
  ok(SyncMerge.merge(c, baseDB()).db.audit.length === 500, "audit capped at 500");

  const d1 = baseDB(), d2 = baseDB();
  d1._deleted = [{ erasedAt: "2024-01-01", child: { id: "x1", name: "Old" } }];
  d2._deleted = [{ erasedAt: "2024-02-01", child: { id: "x2", name: "Older" } }];
  ok(SyncMerge.merge(d1, d2).db._deleted.length === 2, "_deleted unions");

  const s1 = baseDB(), s2 = baseDB();
  s1._sv = 3; s2._sv = 5;
  ok(SyncMerge.merge(s1, s2).db._sv === 5, "_sv takes max");

  const t1 = baseDB(), t2 = baseDB();
  t1.settings.clinic = "City Clinic"; t1.settings.theme = "light"; t1.settings.autoSync = true; t1.settings.encSync = false;
  t2.settings.clinic = "City Clinic"; t2.settings.theme = "dark"; t2.settings.autoSync = false; t2.settings.encSync = true;
  const st = SyncMerge.merge(t1, t2).db.settings;
  ok(st.theme === "light" && st.autoSync === true && st.encSync === false, "device settings (theme/autoSync/encSync) stay local");
  const u1 = baseDB(), u2 = baseDB();
  u2.settings.clinic = "New Name Clinic";
  ok(SyncMerge.merge(u1, u2).db.settings.clinic === "City Clinic", "clinic scalar tie keeps local");
  const w1 = baseDB(), w2 = baseDB();
  delete w1.settings.reg; w2.settings.reg = "REG-9";
  ok(SyncMerge.merge(w1, w2).db.settings.reg === "REG-9", "missing key adopts cloud value");

  const p1 = baseDB(), p2 = baseDB();
  p1.appts = [{ id: "a1", when: "d1" }]; p2.appts = [{ id: "a2", when: "d2" }];
  p1.tokens = [{ id: "t1" }]; p2.tokens = [{ id: "t2" }];
  p1.bills = [{ id: "b1" }]; p2.bills = [{ id: "b2" }];
  const pm = SyncMerge.merge(p1, p2).db;
  ok(pm.appts.length === 2 && pm.tokens.length === 2 && pm.bills.length === 2, "appts/tokens/bills union by id");
}

// --- 5. idempotence, local-key preservation, robustness ---
{
  const a = baseDB(), b = baseDB();
  b.children.push(baseChild("c2"));
  const m1 = SyncMerge.merge(a, b);
  const m2 = SyncMerge.merge(m1.db, b);
  ok(m2.changedLocal === false && m2.changedCloud === false, "merge is idempotent (re-merge is a no-op)");
  ok(SyncMerge.merge(a, a).changedLocal === false, "merge with self is a no-op");

  const l = baseDB(), r = baseDB();
  l.activeId = "c1"; l.session = { user: "A" }; l.msBand = "bandA";
  r.activeId = null; r.session = { user: "B" }; r.msBand = "bandB";
  r.children.push(baseChild("c9"));
  const lm = SyncMerge.merge(l, r).db;
  ok(lm.activeId === "c1" && lm.session.user === "A" && lm.msBand === "bandA", "merge preserves local device keys");
  ok(lm.children.length === 2, "...while still adopting cloud children");

  let threw = false;
  try { SyncMerge.merge(null, undefined); SyncMerge.merge({}, { children: [] }); SyncMerge.merge(baseDB(), { enc: "x" }); }
  catch (e) { threw = true; }
  ok(!threw, "merge tolerates null/empty/foreign payloads");
}

// --- 6. two-device convergence simulation ---
{
  const cloud0 = baseDB();
  const devA = clone(cloud0), devB = clone(cloud0);
  devA.children.push(baseChild("cA", "Anaya"));                       // A registers a patient
  devA.children[0].visits.push({ id: "vA", d: "2024-06-01", note: "fever" }); // A records a visit
  devB.children[0].labs.push({ id: "lB", d: "2024-06-01", test: "CBC" });     // B records a lab
  devB.appts.push({ id: "apB", when: "2024-06-05" });                  // B books an appointment
  devA.session = { user: "A" }; devB.session = { user: "B" };          // device noise

  const upA = SyncMerge.merge(devA, cloud0);                           // A syncs first
  ok(upA.changedCloud === true, "A has updates for the cloud");
  const cloud1 = upA.db;
  const upB = SyncMerge.merge(devB, cloud1);                           // B syncs second
  ok(upB.changedLocal === true && upB.changedCloud === true, "B both receives and contributes");
  const cloud2 = upB.db;
  const finA = SyncMerge.merge(upA.db, cloud2);                        // A syncs again
  ok(finA.changedLocal === true && finA.changedCloud === false, "A catches up, cloud complete");

  const finalA = finA.db, finalB = upB.db;
  ok(SyncMerge.hash(finalA) === SyncMerge.hash(finalB), "devices converge to identical sync-state");
  ok(finalA.children.length === 2 && finalB.children.length === 2, "both see the new patient");
  ok(finalA.children[0].visits.length === 1 && finalB.children[0].labs.length === 1, "visit + lab both present everywhere");
  ok(finalA.appts.length === 1 && finalB.appts.length === 1, "appointment present everywhere");
  ok(finalA.session.user === "A" && finalB.session.user === "B", "device identity untouched by convergence");
  const finB2 = SyncMerge.merge(finalB, cloud2);
  ok(finB2.changedLocal === false && finB2.changedCloud === false, "steady state: further syncs are no-ops");
}

// --- 7. cloud.js wiring (convergent, no modal) ---
{
  const syCloud = fs.readFileSync(path.join(R, "js", "cloud.js"), "utf8");
  const html = fs.readFileSync(path.join(R, "index.html"), "utf8");
  const sw = fs.readFileSync(path.join(R, "sw.js"), "utf8");
  ok(syCloud.includes("SyncMerge.hash") && /function localHash\(\)[\s\S]*?SyncMerge\.hash/.test(syCloud), "localHash uses the stable sync-subset hash");
  ok(!syCloud.includes("conflictModal(") && !syCloud.includes("_confUp") && !syCloud.includes("mConflict"), "conflict modal fully removed");
  ok(syCloud.includes("pushInsert(manual, m.db)") && syCloud.includes("pushInsert(false, m.db)"), "push + pull upload the merged union");
  ok(/function applySnapshot\(data, quiet\)[\s\S]*?SyncMerge\.merge/.test(syCloud), "applySnapshot merge-applies (never wholesale-replaces)");
  ok(html.indexOf("js/syncmerge.js") !== -1 && html.indexOf("js/syncmerge.js") < html.indexOf("js/cloud.js"), "syncmerge loads before cloud");
  ok(sw.includes("./js/syncmerge.js"), "SW shell caches syncmerge");
  ok(/var APP_VER = "v10\.50"/.test(syCloud) && /neokid-v45/.test(sw), "version pins (app v10.50, sw v45)");
}

console.log(`syncmerge: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

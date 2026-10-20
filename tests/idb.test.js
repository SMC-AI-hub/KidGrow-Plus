// NeoKid Care — IndexedDB shadow logic suite (E1/F4, v10.48). Decision logic
// is unit-tested here (node has no IndexedDB); live storage is browser-proven
// (kgshot2/phaseE1proof.py) + CI smoke. Use: node tests/idb.test.js
const IDB = require("../js/idb.js");
let pass = 0, fail = 0;
function ok(c, name) { if (c) { pass++; } else { fail++; console.log("FAIL:", name); } }

async function main() {
  ok(IDB.hash("abc") === IDB.hash("abc") && IDB.hash("abc") !== IDB.hash("abd"), "hash stable + sensitive");
  ok(/^[0-9a-f]+$/.test(IDB.hash("x")), "hash is hex");
  const p = IDB.pack('{"a":1}');
  ok(p.json === '{"a":1}' && p.len === 7 && p.hash === IDB.hash('{"a":1}') && typeof p.at === "number", "pack wraps json+at+len+hash");
  const meta = (at) => ({ at, len: 7, hash: IDB.hash('{"a":1}') });
  const wrap = (at, json) => ({ json: json == null ? '{"a":1}' : json, at, len: 7, hash: IDB.hash(json == null ? '{"a":1}' : json) });
  ok(IDB.pickNewer(meta(100), wrap(200)) === "idb", "newer valid shadow wins");
  ok(IDB.pickNewer(meta(300), wrap(200)) === "ls", "newer LS wins");
  ok(IDB.pickNewer(meta(200), wrap(200)) === "ls", "tie goes to LS (doubt rule)");
  ok(IDB.pickNewer(meta(100), { json: '{"a":1}', at: 200, len: 7, hash: "deadbeef" }) === "ls", "corrupt shadow hash loses");
  ok(IDB.pickNewer(meta(100), null) === "ls", "missing shadow loses");
  ok(IDB.pickNewer(meta(100), { at: 200 }) === "ls", "shapeless shadow loses");
  ok(IDB.pickNewer(null, wrap(200)) === "idb", "missing LS meta + valid shadow adopts");
  ok(IDB.mirror('{"a":1}') === true, "mirror is fire-and-forget safe without indexedDB");
  const st = await IDB.verify();
  ok(st && st.mode === "ls" && st.error === "unavailable", "verify no-ops honestly without indexedDB");
  IDB._setCutover(true);
  const st2 = await IDB.verify();
  ok(st2.mode === "idb-armed" && st2.adopt === null, "cutover arms but adopts nothing without storage");
  IDB._setCutover(false);

  console.log(`idb: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error("idb harness error:", (e && e.message) || e); process.exit(1); });

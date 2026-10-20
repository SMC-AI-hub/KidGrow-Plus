/* NeoKid Care — convergent multi-device sync (v10.41). Pure merge engine:
   devices exchange full snapshots but compare + merge a canonical SYNCABLE
   subset (device-local/UI keys excluded), so any two devices converge to the
   same union no matter the order they sync in. No conflict modal, ever.
   Scalar ties (same field edited both sides) keep the local value and write
   the dropped value into the audit trail — never silent. */
var SYNC_LOCAL_KEYS = ["session", "activeId", "msBand", "gTab", "gRef5", "gLines",
  "gSub", "gFull", "gAssessId", "lastBackup", "_cloudWelcomed", "corrAge"];
var SYNC_LOCAL_SETTINGS = ["theme", "autoSync", "encSync"];
function smClone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
function smIsObj(o) { return !!o && typeof o === "object" && !Array.isArray(o); }
function smEmpty(v) { return v === null || v === undefined || v === ""; }
function smStable(o) {
  if (Array.isArray(o)) return "[" + o.map(smStable).join(",") + "]";
  if (smIsObj(o)) return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + smStable(o[k])).join(",") + "}";
  return JSON.stringify(o === undefined ? null : o);
}
function smSortArrays(o) {
  if (Array.isArray(o)) {
    const m = o.map(smSortArrays);
    m.sort((x, y) => (smStable(x) < smStable(y) ? -1 : smStable(x) > smStable(y) ? 1 : 0));
    return m;
  }
  if (smIsObj(o)) { const n = {}; Object.keys(o).forEach((k) => { n[k] = smSortArrays(o[k]); }); return n; }
  return o;
}
function smHashStr(s) {
  if (typeof hashStr === "function") { try { return hashStr(s); } catch (e) {} }
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
/* Canonical syncable subset: everything except device-local keys. */
function syncDataOf(db) {
  const out = {};
  try {
    for (const k of Object.keys(db || {})) {
      if (SYNC_LOCAL_KEYS.includes(k)) continue;
      out[k] = smClone(db[k]);
      if (k === "settings" && smIsObj(out[k])) for (const sk of SYNC_LOCAL_SETTINGS) delete out[k][sk];
    }
  } catch (e) {}
  return out;
}
/* Order-insensitive hash: equal data on any device → equal hash. */
function syncHashOf(db) {
  try { return smHashStr(smStable(smSortArrays(syncDataOf(db)))); } catch (e) { return ""; }
}
function smNote(notes, path, kept, dropped) {
  if (!notes || notes.length >= 50) return;
  notes.push({ path, kept: kept === undefined ? null : kept, dropped: dropped === undefined ? null : dropped });
}
/* Generic deep merge: a wins scalar ties (noted), arrays union by id/value. */
function smDeep(a, b, path, notes) {
  if (smStable(a) === smStable(b)) return smClone(a);
  if (Array.isArray(a) && Array.isArray(b)) {
    const out = [], seen = new Set();
    const keyOf = (x) => (smIsObj(x) && (typeof x.id === "string" || typeof x.id === "number")) ? `id:${x.id}` : `v:${smStable(x)}`;
    const byIdA = new Map();
    for (const x of a) { const k = keyOf(x); seen.add(k); if (k.startsWith("id:")) byIdA.set(k, x); out.push(smClone(x)); }
    for (const x of b) {
      const k = keyOf(x);
      if (!seen.has(k)) { seen.add(k); out.push(smClone(x)); continue; }
      if (k.startsWith("id:")) {
        const i = out.findIndex((y) => keyOf(y) === k);
        out[i] = smDeep(byIdA.get(k), x, `${path}[${x.id}]`, notes);
      }
    }
    return out;
  }
  if (smIsObj(a) && smIsObj(b)) {
    const out = {};
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in a)) out[k] = smClone(b[k]);
      else if (!(k in b)) out[k] = smClone(a[k]);
      else out[k] = smDeep(a[k], b[k], p, notes);
    }
    return out;
  }
  if (smEmpty(a) && !smEmpty(b)) return smClone(b);
  if (!smEmpty(a) && smEmpty(b)) return smClone(a);
  smNote(notes, path || "(root)", a, b);
  return smClone(a);
}
function smMergeAudit(a, b) {
  const out = [], seen = new Set();
  for (const e of [...(a || []), ...(b || [])]) {
    const k = `${(e && e.t) || ""}|${(e && e.user) || ""}|${(e && e.action) || ""}|${(e && e.detail) || ""}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(e);
  }
  out.sort((x, y) => String((y && y.t) || "").localeCompare(String((x && x.t) || "")));
  return out.slice(0, 500);
}
function smMergeDeleted(a, b) {
  const out = new Map();
  for (const d of (a || [])) if (d && d.child && d.child.id) out.set(d.child.id, smClone(d));
  for (const d of (b || [])) {
    if (!d || !d.child || !d.child.id) continue;
    if (out.has(d.child.id)) out.set(d.child.id, smDeep(out.get(d.child.id), d, `_deleted[${d.child.id}]`, null));
    else out.set(d.child.id, smClone(d));
  }
  return [...out.values()];
}
/* Full merge. Returns {db, changedLocal, changedCloud, notes}. db keeps ALL of
   the local device's local-keys; only syncable keys come from the union. */
function syncMerge(localDB, cloudDB) {
  const notes = [];
  const A = syncDataOf(localDB), B = syncDataOf(cloudDB || {});
  const M = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (k === "audit") M[k] = smMergeAudit(A[k], B[k]);
    else if (k === "_deleted") M[k] = smMergeDeleted(A[k], B[k]);
    else if (k === "_sv") M[k] = Math.max(+A[k] || 0, +B[k] || 0);
    else if (k === "settings") {
      const s = smDeep(A[k] || {}, B[k] || {}, "settings", notes);
      const ls = ((localDB || {}).settings) || {};
      for (const sk of SYNC_LOCAL_SETTINGS) {
        if (ls[sk] !== undefined) s[sk] = smClone(ls[sk]);
        else delete s[sk];
      }
      M[k] = s;
    }
    else if (k in A && k in B) M[k] = smDeep(A[k], B[k], k, notes);
    else M[k] = smClone(k in A ? A[k] : B[k]);
  }
  // Scalar-tie notes join the audit trail (dedupe by detail so re-merges stay quiet).
  try {
    const have = new Set((M.audit || []).map((e) => `${(e && e.action) || ""}|${(e && e.detail) || ""}`));
    for (const n of notes) {
      const detail = `Field ${n.path}: kept ${JSON.stringify(n.kept)}, cloud had ${JSON.stringify(n.dropped)} — review if wrong.`;
      if (have.has(`Sync merge|${detail}`)) continue;
      have.add(`Sync merge|${detail}`);
      (M.audit = M.audit || []).unshift({ t: new Date().toISOString(), cid: "", user: "sync", action: "Sync merge", detail });
    }
    M.audit = (M.audit || []).slice(0, 500);
  } catch (e) {}
  const db = smClone(localDB || {});
  for (const k of Object.keys(M)) db[k] = M[k];
  let changedLocal = true, changedCloud = true;
  try {
    const mh = smHashStr(smStable(smSortArrays(syncDataOf(Object.assign({}, localDB, M)))));
    changedLocal = mh !== smHashStr(smStable(smSortArrays(A)));
    changedCloud = mh !== smHashStr(smStable(smSortArrays(B)));
  } catch (e) {}
  return { db, changedLocal, changedCloud, notes };
}
var SyncMerge = {
  LOCAL_KEYS: SYNC_LOCAL_KEYS, LOCAL_SETTINGS: SYNC_LOCAL_SETTINGS,
  data: syncDataOf, hash: syncHashOf, merge: syncMerge,
};
try { if (typeof window !== "undefined" && window) window.SyncMerge = SyncMerge; } catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = SyncMerge; } catch (e2) {}

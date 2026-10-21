/* NeoKid Care — duplicate-patient merge (F16, v10.45).
   Pure core (no DOM): findDupCandidates + mergeChildren. UI glue lives in
   app.js (openMergeModal). Merge keeps the KEEP record's identity, unions
   clinical arrays by id, fills blank scalars from DROP, and soft-deletes
   DROP with an audit trail. */
function mergeNorm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function findDupCandidates(children) {
  const out = [];
  try {
    const kids = (children || []).filter((c) => c && !c._deleted);
    for (let i = 0; i < kids.length && out.length < 50; i++) {
      for (let j = i + 1; j < kids.length && out.length < 50; j++) {
        const a = kids[i], b = kids[j];
        let why = "";
        if (a.mrn && b.mrn && String(a.mrn) === String(b.mrn)) why = "same MRN " + a.mrn;
        else if (mergeNorm(a.name) && mergeNorm(a.name) === mergeNorm(b.name) && (a.dob || "") === (b.dob || "") && a.dob) why = "same name + DOB";
        else if (a.phone && b.phone && String(a.phone) === String(b.phone) && (a.dob || "") === (b.dob || "") && a.dob) why = "same phone + DOB";
        if (why) out.push({ a: a.id, b: b.id, why });
      }
    }
  } catch (e) {}
  return out;
}
var MERGE_ARRAYS = ["visits", "measures", "rx", "labs", "aefi", "mar", "consents", "letters", "tanner", "problems"];
function mergeChildren(db, keepId, dropId) {
  const res = { ok: false, why: "", moved: {}, filled: [] };
  try {
    const kids = (db && db.children) || [];
    const keep = kids.find((c) => c && c.id === keepId && !c._deleted);
    const drop = kids.find((c) => c && c.id === dropId && !c._deleted);
    if (!keep || !drop) { res.why = "Both records must exist."; return res; }
    if (keepId === dropId) { res.why = "Cannot merge a record into itself."; return res; }
    const keyOf = (x) => (x && (x.id || x.code || x.date + "|" + JSON.stringify(x).slice(0, 60))) || JSON.stringify(x);
    MERGE_ARRAYS.forEach((f) => {
      const ka = Array.isArray(keep[f]) ? keep[f] : [], da = Array.isArray(drop[f]) ? drop[f] : [];
      if (!da.length) return;
      const seen = {};
      ka.forEach((x) => { seen[keyOf(x)] = 1; });
      let n = 0;
      da.forEach((x) => { const k = keyOf(x); if (!seen[k]) { seen[k] = 1; ka.push(x); n++; } });
      keep[f] = ka;
      if (n) res.moved[f] = n;
    });
    // vaccines: object keyed by code — union, keep wins ties
    keep.vaccines = keep.vaccines || {};
    Object.keys(drop.vaccines || {}).forEach((code) => {
      if (!keep.vaccines[code]) { keep.vaccines[code] = drop.vaccines[code]; res.moved.vaccines = (res.moved.vaccines || 0) + 1; }
    });
    // milestones object: fill blanks
    keep.milestones = keep.milestones || {};
    Object.keys(drop.milestones || {}).forEach((k) => {
      if (keep.milestones[k] === undefined || keep.milestones[k] === "") { keep.milestones[k] = drop.milestones[k]; res.filled.push("milestone:" + k); }
    });
    // allergies: union of arrays, keep legacy string
    const au = {};
    (Array.isArray(keep.allergies) ? keep.allergies : []).forEach((a) => { au[mergeNorm((a && a.agent) || a)] = (a && a.agent) ? a : { agent: String(a) }; });
    (Array.isArray(drop.allergies) ? drop.allergies : []).forEach((a) => { const k = mergeNorm((a && a.agent) || a); if (k && !au[k]) { au[k] = (a && a.agent) ? a : { agent: String(a) }; res.moved.allergies = (res.moved.allergies || 0) + 1; } });
    if (Object.keys(au).length) keep.allergies = Object.keys(au).map((k) => au[k]);
    if (!keep.allergy && drop.allergy) { keep.allergy = drop.allergy; res.filled.push("allergy"); }
    // blank scalars: fill from drop (never overwrite keep's identity/data)
    ["parent", "mother", "father", "phone", "addr", "mrn", "sex", "blood", "gest", "birthWt", "birthHt"].forEach((f) => {
      if ((keep[f] === undefined || keep[f] === "" || keep[f] === null) && drop[f] !== undefined && drop[f] !== "" && drop[f] !== null) {
        keep[f] = drop[f]; res.filled.push(f);
      }
    });
    if (!keep.created || (drop.created && drop.created < keep.created)) keep.created = drop.created || keep.created;
    drop._deleted = true;
    drop._mergedInto = keepId;
    drop._mergedAt = (typeof todayISO === "function") ? todayISO() : "";
    try {
      const msg = `${drop.name} → ${keep.name} (${Object.keys(res.moved).map((k) => k + "+" + res.moved[k]).join(", ") || "no clinical rows"}${res.filled.length ? "; filled " + res.filled.join(",") : ""})`;
      if (typeof auditSafe === "function") auditSafe("Patients merged", msg);
      else if (typeof log === "function" && typeof DB !== "undefined") log("Patients merged", msg);
    } catch (e) {}
    res.ok = true;
  } catch (e) { res.why = "Merge failed: " + ((e && e.message) || e); }
  return res;
}
try { if (typeof window !== "undefined") { window.findDupCandidates = findDupCandidates; window.mergeChildren = mergeChildren; } } catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = { mergeNorm, findDupCandidates, mergeChildren, MERGE_ARRAYS }; } catch (e2) {}

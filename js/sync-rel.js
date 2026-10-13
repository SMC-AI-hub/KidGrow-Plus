/* =====================================================================
   KidGrow Pro — M4 relational sync: dual-write outbox + LWW conflict safety.
   Local storage stays the source of truth for rich detail; identity +
   encounter/consent skeletons sync to Postgres via idempotent apply_*_op()
   RPCs (see 0003_sync.sql). Offline queues in localStorage; replays are safe.
   Pure helpers in window.SyncPure are unit-tested; live paths need Supabase.
   Loaded after tenant.js, before ops.js.
   ===================================================================== */
(function () {
"use strict";

var OB_KEY = "kidgrow_outbox", REV_KEY = "kidgrow_revs", PULL_KEY = "kidgrow_pull_rev", CF_KEY = "kidgrow_conflicts";
var TABLE_RANK = { patients: 0, encounters: 1, consents: 2, nicu_admissions: 3, nicu_rounds: 4, mar_entries: 5, growth_points: 6 };
var RPC = { patients: "apply_patient_op", encounters: "apply_encounter_op", consents: "apply_consent_op", nicu_admissions: "apply_clinical_op", nicu_rounds: "apply_clinical_op", mar_entries: "apply_clinical_op", growth_points: "apply_clinical_op" };

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function toast(m) {
  var t = $("syncToast");
  if (!t) { t = document.createElement("div"); t.id = "syncToast"; t.style.cssText = "position:fixed;left:50%;bottom:102px;transform:translateX(-50%);background:#0c2340;color:#fff;padding:12px 20px;border-radius:12px;font-size:14px;z-index:10002;box-shadow:0 10px 30px rgba(0,0,0,.4);max-width:92vw;text-align:center"; document.body.appendChild(t); }
  t.textContent = m; t.style.display = "block";
  clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = "none"; }, 3400);
}

/* ---------------- pure helpers (tested) ---------------- */
function hashStr(s) { var h = 5381, i; s = String(s); for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(16); }
function opId() { return "op" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function revNow() { return new Date().toISOString(); }
function snapshotChild(c) {
  c = c || {};
  return { name: c.name || "", sex: c.sex || "", dob: c.dob || "", blood: c.blood || "", birthWt: c.birthWt || "", gest: c.gest || "", birthLen: c.birthLen || "", birthHC: c.birthHC || "", father: c.father || "", mother: c.mother || "", phone: c.phone || "", allergy: c.allergy || "" };
}
function snapshotVisit(v) { v = v || {}; return { date: v.date || "", type: v.type || "", subj: v.subj || "", obj: v.obj || "", plan: v.plan || "" }; }
function mrnFor(child, prefix) {
  var base = String((child && child.mrn) || (child && child.id) || "noid").replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase() || "X";
  return String(prefix || "") + base;
}
function sexMap(s) {
  s = String(s || "").toLowerCase();
  if (s === "male" || s === "boy" || s === "m") return "male";
  if (s === "female" || s === "girl" || s === "f") return "female";
  if (s === "other") return "other";
  return "unknown";
}
function sexBack(s) { return s === "male" ? "boy" : s === "female" ? "girl" : (s === "other" ? "other" : ""); }
function gaParse(g) { var n = parseFloat(String(g == null ? "" : g)); return isNaN(n) || n <= 0 ? null : Math.round(n * 10) / 10; }
function wtToG(w) {
  var n = parseFloat(w);
  if (isNaN(n) || n <= 0) return null;
  return n > 30 ? Math.round(n) : Math.round(n * 1000); // >30 => already grams
}
function childToPatient(child, prefix) {
  child = child || {};
  return {
    local_id: "c_" + (child.id || "noid"), mrn: mrnFor(child, prefix), name: child.name || "",
    dob: child.dob || null, sex: sexMap(child.sex), ga_at_birth_weeks: gaParse(child.gest),
    birth_weight_g: wtToG(child.birthWt),
    guardian: { father: child.father || "", mother: child.mother || "", phone: child.phone || "" },
    allergies: child.allergy ? [String(child.allergy)] : []
  };
}
function kindMap(t) {
  t = String(t || "").toLowerCase();
  if (/nicu/.test(t)) return "nicu";
  if (/picu/.test(t)) return "picu";
  if (/emerg|casual/.test(t)) return "emergency";
  if (/admis|ipd|ward/.test(t)) return "admission";
  if (/follow|review/.test(t)) return "followup";
  return "opd";
}
function kindLabel(k) { return { opd: "OPD", emergency: "Emergency", admission: "Admission", nicu: "NICU", picu: "PICU", followup: "Follow-up" }[k] || "OPD"; }
function visitToEncounter(childId, visit, today) {
  visit = visit || {};
  return {
    local_id: "e_" + (visit.id || "noid"), patient_local_id: "c_" + (childId || "noid"),
    kind: kindMap(visit.type), status: (visit.date || "") < (today || "9999") ? "closed" : "open",
    started_at: (visit.date || "2000-01-01") + "T00:00:00Z"
  };
}
function consentToRow(childId, k, idx) {
  k = k || {};
  var p = String(k.purpose || "care"), s = String(k.status || "granted");
  if (["care", "billing", "research", "marketing", "sharing"].indexOf(p) < 0) p = "care";
  if (["granted", "withdrawn", "expired"].indexOf(s) < 0) s = "granted";
  return {
    local_id: "k_" + (k.id || (childId + "_" + idx)), patient_local_id: "c_" + childId,
    purpose: p, status: s, granted_by: k.by || k.granted_by || "", note: k.note || k.text || ""
  };
}
function pickWinner(localRev, remoteRev, localOp, remoteOp) {
  if ((localRev || "") === (remoteRev || "")) return (localOp || "") >= (remoteOp || "") ? "local" : "remote";
  return (localRev || "") > (remoteRev || "") ? "local" : "remote";
}
function detectConflict(localRev, lastPulledRev, remoteRev, localHash, remoteHash) {
  var localDirty = !lastPulledRev || (localRev || "") > lastPulledRev;
  var remoteNew = !lastPulledRev || (remoteRev || "") > lastPulledRev;
  return !!(localDirty && remoteNew && localHash !== remoteHash);
}
function obEnqueue(q, op) {
  q = q || [];
  if (q.some(function (o) { return o.opId === op.opId; })) return { q: q, added: false };
  if (q.length >= 1000) return { q: q, added: false, error: "outbox full (1000) — sync or dismiss failures" };
  return { q: q.concat([{ opId: op.opId, ts: op.ts, table: op.table, localId: op.localId, row: op.row, attempts: 0, nextRetry: null, lastError: "" }]), added: true };
}
function obAck(q, opId) { return (q || []).filter(function (o) { return o.opId !== opId; }); }
function obFail(q, opId, err, nowMs) {
  return (q || []).map(function (o) {
    if (o.opId !== opId) return o;
    var a = (o.attempts || 0) + 1;
    var fatal = /quota|read-only|not a member|invalid|unknown patient|future/i.test(String(err || ""));
    return { opId: o.opId, ts: o.ts, table: o.table, localId: o.localId, row: o.row, attempts: fatal ? 99 : a, nextRetry: fatal ? null : nowMs + Math.min(1800e3, 5000 * Math.pow(2, a)), lastError: String(err || "").slice(0, 200) };
  });
}
function obDue(q, nowMs) {
  return (q || []).filter(function (o) { return (o.attempts || 0) < 10 && (o.nextRetry == null || o.nextRetry <= nowMs); })
    .sort(function (a, b) { return (a.ts - b.ts) || ((TABLE_RANK[a.table] || 0) - (TABLE_RANK[b.table] || 0)) || (a.opId < b.opId ? -1 : 1); });
}
function canSubmitAt(store, key, nowMs, windowMs) {
  store = store || {}; windowMs = windowMs || 2500;
  if (nowMs - (store[key] || 0) < windowMs) return { ok: false, store: store };
  var n = {}; for (var k in store) n[k] = store[k];
  n[key] = nowMs;
  return { ok: true, store: n };
}
function snapshotAdm(a) { a = a || {}; return { admittedAt: a.admittedAt || "", birthWtG: a.birthWtG || "", ga: a.ga || "", indication: a.indication || "", status: a.status || "", dischargedAt: a.dischargedAt || "", outcome: a.outcome || "" }; }
function snapshotRound(r) { r = r || {}; return { date: r.date || "", wtG: r.wtG || "", vitals: r.vitals || {}, feeds: r.feeds || {}, events: r.events || [], note: r.note || "" }; }
function snapshotMar(e) { e = e || {}; return { drug: e.drug || "", dose: e.dose || "", route: e.route || "", freq: e.freq || "", controlled: !!e.controlled, scheduledAt: e.scheduledAt || "", status: e.status || "", givenAt: e.givenAt || "", givenBy: e.givenBy || "", witness: e.witness || "", logs: e.logs || [] }; }
function snapshotMeasure(m) { m = m || {}; return { date: m.date || "", wt: m.wt || "", ht: m.ht || "", hc: m.hc || "", muac: m.muac || "" }; }
function numOrNull(x) { var n = parseFloat(x); return isNaN(n) ? null : n; }
function admToRow(childId, a) {
  a = a || {};
  return { local_id: "n_" + (a.id || "noid"), patient_local_id: "c_" + (childId || "noid"),
    admitted_at: a.admittedAt || null, birth_weight_g: numOrNull(a.birthWtG), ga_weeks: numOrNull(a.ga),
    status: a.status || "admitted", indication: a.indication || "",
    discharged_at: a.dischargedAt || null, outcome: a.outcome || "" };
}
function roundToRow(admId, r) {
  r = r || {};
  return { local_id: "r_" + (r.id || "noid"), admission_local_id: "n_" + (admId || "noid"),
    round_date: r.date || null, weight_g: numOrNull(r.wtG), vitals: r.vitals || {}, feeds: r.feeds || {},
    events: r.events || [], note: r.note || "" };
}
function marToRow(childId, e) {
  e = e || {};
  return { local_id: "m_" + (e.id || "noid"), patient_local_id: "c_" + (childId || "noid"),
    drug: e.drug || "", dose: e.dose || "", route: e.route || "", freq: e.freq || "",
    controlled: !!e.controlled, status: e.status || "scheduled", scheduled_at: e.scheduledAt || null,
    given_at: e.givenAt || null, given_by: e.givenBy || "", witness: e.witness || "", note: e.note || "" };
}
function measureToRow(childId, m) {
  m = m || {};
  return { local_id: "g_" + (m.id || "noid"), patient_local_id: "c_" + (childId || "noid"),
    measured_at: (m.date || "2000-01-01") + "T00:00:00Z", wt_kg: numOrNull(m.wt), len_cm: numOrNull(m.ht),
    hc_cm: numOrNull(m.hc), muac_cm: numOrNull(m.muac), source: m.src || "" };
}
function flushParams(table, row) {
  return RPC[table] === "apply_clinical_op" ? { p_table: table, p_row: row } : { p_row: row };
}
window.SyncPure = {
  hashStr: hashStr, opId: opId, revNow: revNow, snapshotChild: snapshotChild, snapshotVisit: snapshotVisit,
  mrnFor: mrnFor, sexMap: sexMap, sexBack: sexBack, gaParse: gaParse, wtToG: wtToG,
  childToPatient: childToPatient, visitToEncounter: visitToEncounter, consentToRow: consentToRow,
  kindMap: kindMap, kindLabel: kindLabel, pickWinner: pickWinner, detectConflict: detectConflict,
  obEnqueue: obEnqueue, obAck: obAck, obFail: obFail, obDue: obDue, canSubmitAt: canSubmitAt,
  snapshotAdm: snapshotAdm, snapshotRound: snapshotRound, snapshotMar: snapshotMar, snapshotMeasure: snapshotMeasure,
  admToRow: admToRow, roundToRow: roundToRow, marToRow: marToRow, measureToRow: measureToRow, flushParams: flushParams
};

/* ---------------- double-submit guard ---------------- */
var submitStore = {};
window.guardSubmit = function (key) {
  var r = canSubmitAt(submitStore, key, Date.now());
  submitStore = r.store;
  return r.ok;
};

/* ---------------- local stores ---------------- */
function lsGet(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function sb() { try { return (typeof Cloud !== "undefined" && Cloud._sb) ? Cloud._sb() : null; } catch (e) { return null; } }
function tenantId() { try { return (typeof Cloud !== "undefined" && Cloud.tenantId) ? Cloud.tenantId() : null; } catch (e) { return null; } }
function live() { try { return !!(typeof Cloud !== "undefined" && Cloud.enabled && Cloud.user && Cloud.user() && tenantId() && sb()); } catch (e) { return false; } }
function mrnPrefix() { try { if (typeof Tenant !== "undefined" && Tenant._prefix) return Tenant._prefix(); } catch (e) {} return ""; }

/* ---------------- scan: diff local DB -> outbox (dual-write detector) ---------------- */
function enqueueOp(table, localId, row) {
  var q = lsGet(OB_KEY, []);
  var r = obEnqueue(q, { opId: opId(), ts: Date.now(), table: table, localId: localId, row: row });
  if (r.added) lsSet(OB_KEY, r.q);
  return r;
}
function scanLocal() {
  if (typeof DB === "undefined" || !DB.children) return 0;
  var revs = lsGet(REV_KEY, {}), n = 0, seen = {}, i, j, c, lid, h, v, vlid, vh, k, klid, kh, idsDirty = false;
  for (i = 0; i < DB.children.length; i++) {
    c = DB.children[i]; lid = "c_" + (c.id || "noid"); seen[lid] = 1;
    h = hashStr(JSON.stringify(snapshotChild(c)));
    if (!revs[lid] || revs[lid].hash !== h) {
      var prow = childToPatient(c, mrnPrefix()); prow.client_rev = revNow();
      enqueueOp("patients", lid, prow);
      revs[lid] = { rev: prow.client_rev, hash: h }; n++;
    }
    for (j = 0; j < (c.visits || []).length; j++) {
      v = c.visits[j]; vlid = "e_" + (v.id || "noid"); seen[vlid] = 1;
      vh = hashStr(JSON.stringify(snapshotVisit(v)));
      if (!revs[vlid] || revs[vlid].hash !== vh) {
        var erow = visitToEncounter(c.id, v, (typeof todayISO === "function" ? todayISO() : "9999-12-31")); erow.client_rev = revNow();
        enqueueOp("encounters", vlid, erow);
        revs[vlid] = { rev: erow.client_rev, hash: vh }; n++;
      }
    }
    for (j = 0; j < (c.consents || []).length; j++) {
      k = c.consents[j]; klid = "k_" + (k.id || (c.id + "_" + j)); seen[klid] = 1;
      kh = hashStr(JSON.stringify(k));
      if (!revs[klid] || revs[klid].hash !== kh) {
        var krow = consentToRow(c.id, k, j); krow.client_rev = revNow();
        enqueueOp("consents", klid, krow);
        revs[klid] = { rev: krow.client_rev, hash: kh }; n++;
      }
    }
    var adms = (c.nicu && c.nicu.admissions) || [], ai, a, alid, ah, ri, r, rlid, rh, ei, e, elid, eh, mi, m, mlid, mh, arow, rrow, mrow, grow;
    for (ai = 0; ai < adms.length; ai++) {
      a = adms[ai]; alid = "n_" + (a.id || "noid"); seen[alid] = 1;
      ah = hashStr(JSON.stringify(snapshotAdm(a)));
      if (!revs[alid] || revs[alid].hash !== ah) {
        arow = admToRow(c.id, a); arow.client_rev = revNow();
        enqueueOp("nicu_admissions", alid, arow);
        revs[alid] = { rev: arow.client_rev, hash: ah }; n++;
      }
      for (ri = 0; ri < (a.rounds || []).length; ri++) {
        r = a.rounds[ri]; rlid = "r_" + (r.id || "noid"); seen[rlid] = 1;
        rh = hashStr(JSON.stringify(snapshotRound(r)));
        if (!revs[rlid] || revs[rlid].hash !== rh) {
          rrow = roundToRow(a.id, r); rrow.client_rev = revNow();
          enqueueOp("nicu_rounds", rlid, rrow);
          revs[rlid] = { rev: rrow.client_rev, hash: rh }; n++;
        }
      }
    }
    for (ei = 0; ei < (c.mar || []).length; ei++) {
      e = c.mar[ei]; elid = "m_" + (e.id || "noid"); seen[elid] = 1;
      eh = hashStr(JSON.stringify(snapshotMar(e)));
      if (!revs[elid] || revs[elid].hash !== eh) {
        mrow = marToRow(c.id, e); mrow.client_rev = revNow();
        enqueueOp("mar_entries", elid, mrow);
        revs[elid] = { rev: mrow.client_rev, hash: eh }; n++;
      }
    }
    for (mi = 0; mi < (c.measures || []).length; mi++) {
      m = c.measures[mi];
      if (!m.id && typeof uid === "function") { m.id = uid(); idsDirty = true; }
      mlid = "g_" + (m.id || "noid"); seen[mlid] = 1;
      mh = hashStr(JSON.stringify(snapshotMeasure(m)));
      if (!revs[mlid] || revs[mlid].hash !== mh) {
        grow = measureToRow(c.id, m); grow.client_rev = revNow();
        enqueueOp("growth_points", mlid, grow);
        revs[mlid] = { rev: grow.client_rev, hash: mh }; n++;
      }
    }
  }
  for (lid in revs) { // tombstones for locally deleted entities
    if (!seen[lid] && revs[lid].hash !== "~deleted" && /^(c|e|k|n|r|m|g)_/.test(lid)) {
      var trow = { local_id: lid, client_rev: revNow(), deleted: "true" };
      if (lid.indexOf("c_") === 0) { trow.mrn = "DEL-" + lid; }
      var tmap = { c: "patients", e: "encounters", k: "consents", n: "nicu_admissions", r: "nicu_rounds", m: "mar_entries", g: "growth_points" };
      enqueueOp(tmap[lid.charAt(0)] || "patients", lid, trow);
      revs[lid] = { rev: trow.client_rev, hash: "~deleted" }; n++;
    }
  }
  lsSet(REV_KEY, revs);
  if (idsDirty && typeof save === "function") { try { save(); } catch (e) {} }
  return n;
}

/* ---------------- flush: outbox -> server ---------------- */
var flushing = false, pullQueued = false;
function flush() {
  if (flushing || !live()) return Promise.resolve({ ran: false });
  flushing = true;
  var c = sb(), tid = tenantId();
  var q = lsGet(OB_KEY, []);
  var due = obDue(q, Date.now()).slice(0, 50);
  var chain = Promise.resolve(), done = 0, failed = 0, stale = 0;
  due.forEach(function (op) {
    chain = chain.then(function () {
      var row = {}; for (var k in op.row) row[k] = op.row[k];
      row.tenant_id = tid;
      return c.rpc(RPC[op.table], flushParams(op.table, row)).then(function (r) {
        if (r.error) throw new Error(r.error.message || "apply failed");
        if (r.data === "stale") { stale++; pullQueued = true; }
        else done++;
        lsSet(OB_KEY, obAck(lsGet(OB_KEY, []), op.opId));
      }).catch(function (e) {
        failed++;
        lsSet(OB_KEY, obFail(lsGet(OB_KEY, []), op.opId, e.message, Date.now()));
      });
    });
  });
  return chain.then(function () {
    flushing = false;
    lsSet("kidgrow_last_flush", new Date().toISOString());
    if (pullQueued) { pullQueued = false; pull(); }
    renderSyncCard();
    if (failed) toast("Sync: " + done + " sent, " + failed + " failed (see Sync card).");
    return { ran: true, done: done, failed: failed, stale: stale };
  }).catch(function () { flushing = false; return { ran: true }; });
}

/* ---------------- pull: server -> local ---------------- */
function findLocal(table, lid) {
  var id = String(lid).slice(2), i, j, c;
  for (i = 0; i < (DB.children || []).length; i++) {
    c = DB.children[i];
    if (table === "patients" && c.id === id) return { child: c };
    if (table === "encounters") for (j = 0; j < (c.visits || []).length; j++) if (c.visits[j].id === id) return { child: c, visit: c.visits[j] };
    if (table === "consents") for (j = 0; j < (c.consents || []).length; j++) if ((c.consents[j].id || (c.id + "_" + j)) === id) return { child: c, consent: c.consents[j], idx: j };
    if (table === "nicu_admissions" || table === "nicu_rounds" || table === "mar_entries" || table === "growth_points") {
      var adms = (c.nicu && c.nicu.admissions) || [], x, y;
      if (table === "nicu_admissions") for (x = 0; x < adms.length; x++) if (adms[x].id === id) return { child: c, adm: adms[x] };
      if (table === "nicu_rounds") for (x = 0; x < adms.length; x++) for (y = 0; y < (adms[x].rounds || []).length; y++) if (adms[x].rounds[y].id === id) return { child: c, adm: adms[x], round: adms[x].rounds[y] };
      if (table === "mar_entries") for (x = 0; x < (c.mar || []).length; x++) if (c.mar[x].id === id) return { child: c, mar: c.mar[x] };
      if (table === "growth_points") for (x = 0; x < (c.measures || []).length; x++) if (c.measures[x].id === id) return { child: c, measure: c.measures[x] };
    }
  }
  return null;
}
function applyRemotePatient(c, row) {
  c.name = row.name || c.name; c.dob = row.dob || c.dob; c.sex = sexBack(row.sex) || c.sex;
  if (row.ga_at_birth_weeks != null) c.gest = String(row.ga_at_birth_weeks);
  if (row.birth_weight_g != null) c.birthWt = Math.round(row.birth_weight_g / 100) / 10;
  if (row.guardian) { c.father = row.guardian.father || c.father; c.mother = row.guardian.mother || c.mother; c.phone = row.guardian.phone || c.phone; }
  if (row.allergies && row.allergies.length) c.allergy = row.allergies[0];
}
function pull() {
  if (!live()) return Promise.resolve({ ran: false });
  var c = sb(), tid = tenantId(), since = lsGet(PULL_KEY, null);
  function fetchTable(table) {
    var q = c.from(table).select("*").eq("tenant_id", tid).order("client_rev", { ascending: true }).limit(500);
    if (since) q = q.gt("client_rev", since);
    return q.then(function (r) { if (r.error) throw r.error; return r.data || []; });
  }
  return Promise.all([fetchTable("patients"), fetchTable("encounters"), fetchTable("consents"), fetchTable("nicu_admissions"), fetchTable("nicu_rounds"), fetchTable("mar_entries"), fetchTable("growth_points")]).then(function (sets) {
    var revs = lsGet(REV_KEY, {}), conflicts = lsGet(CF_KEY, []), added = 0, updated = 0, removed = 0, maxRev = since;
    function bump(r) { if (r && (!maxRev || r > maxRev)) maxRev = r; }
    sets[0].forEach(function (row) {
      bump(row.client_rev);
      var lid = row.local_id; if (!lid) return;
      var f = findLocal("patients", lid), cur = f ? hashStr(JSON.stringify(snapshotChild(f.child))) : null;
      var last = revs[lid];
      if (row.deleted_at) {
        if (f) {
          DB.children = DB.children.filter(function (x) { return x.id !== f.child.id; });
          delete revs[lid]; removed++;
          try { if (typeof log === "function") log("Sync remove", f.child.name); } catch (e) {}
        }
        return;
      }
      if (!f) {
        var nc = { id: lid.slice(2) }; if (typeof normalizeChild === "function") normalizeChild(nc);
        applyRemotePatient(nc, row); nc._stub = true;
        DB.children.push(nc); revs[lid] = { rev: row.client_rev, hash: hashStr(JSON.stringify(snapshotChild(nc))) }; added++;
        return;
      }
      if (!last || (row.client_rev || "") > (last.rev || "")) {
        if (last && cur !== last.hash && detectConflict(last.rev, last.rev, row.client_rev, cur, hashStr(JSON.stringify(row)))) {
          conflicts.push({ localId: lid, table: "patients", localRev: last.rev, remoteRev: row.client_rev, remote: row, at: revNow() });
        } else {
          applyRemotePatient(f.child, row);
          revs[lid] = { rev: row.client_rev, hash: hashStr(JSON.stringify(snapshotChild(f.child))) }; updated++;
        }
      }
    });
    // M4: encounter/consent headers merge as stubs only when the patient exists locally.
    sets[1].forEach(function (row) {
      bump(row.client_rev);
      if (!row.local_id || row.deleted_at) return;
      var pf = row.patient_local_id ? findLocal("patients", row.patient_local_id) : null;
      if (!pf) return;
      var f = findLocal("encounters", row.local_id);
      if (!f && typeof normalizeChild === "function") {
        pf.child.visits = pf.child.visits || [];
        pf.child.visits.push({ id: row.local_id.slice(2), date: String(row.started_at || "").slice(0, 10), type: kindLabel(row.kind), subj: "", obj: "", plan: "", _stub: true });
        revs[row.local_id] = { rev: row.client_rev, hash: "~stub" }; added++;
      } else if (f) revs[row.local_id] = { rev: row.client_rev, hash: revs[row.local_id] ? revs[row.local_id].hash : "~" };
    });
    sets[2].forEach(function (row) {
      bump(row.client_rev);
      if (!row.local_id) return;
      var pf = row.patient_local_id ? findLocal("patients", row.patient_local_id) : null;
      if (pf && !findLocal("consents", row.local_id)) {
        pf.child.consents = pf.child.consents || [];
        pf.child.consents.push({ id: row.local_id.slice(2), purpose: row.purpose, status: row.status, by: row.granted_by, note: row.note, _stub: true });
        revs[row.local_id] = { rev: row.client_rev, hash: "~stub" }; added++;
      }
    });
    // M5: clinical rows converge by pure LWW on client_rev (see OPERATIONS: patients = review queue, clinical = auto-LWW).
    function clinNewer(lid, rrev) { var l = revs[lid]; return !l || (rrev || "") > (l.rev || ""); }
    sets[3].forEach(function (row) {
      bump(row.client_rev);
      if (!row.local_id || row.deleted_at) return;
      var pf3 = row.patient_local_id ? findLocal("patients", row.patient_local_id) : null;
      if (!pf3) return;
      var f3 = findLocal("nicu_admissions", row.local_id);
      if (!f3) {
        var NA = pf3.child.nicu || (pf3.child.nicu = {}); NA.admissions = NA.admissions || [];
        NA.admissions.push({ id: row.local_id.slice(2), admittedAt: row.admitted_at, birthWtG: row.birth_weight_g, ga: row.ga_weeks, indication: row.indication, status: row.status, dischargedAt: row.discharged_at, outcome: row.outcome, rounds: [], _stub: true });
        revs[row.local_id] = { rev: row.client_rev, hash: "~stub" }; added++;
      } else if (clinNewer(row.local_id, row.client_rev)) {
        f3.adm.status = row.status; f3.adm.outcome = row.outcome || f3.adm.outcome;
        f3.adm.dischargedAt = row.discharged_at || f3.adm.dischargedAt;
        f3.adm.indication = row.indication || f3.adm.indication;
        revs[row.local_id] = { rev: row.client_rev, hash: hashStr(JSON.stringify(snapshotAdm(f3.adm))) }; updated++;
      }
    });
    sets[4].forEach(function (row) {
      bump(row.client_rev);
      if (!row.local_id || row.deleted_at) return;
      var af4 = row.admission_local_id ? findLocal("nicu_admissions", row.admission_local_id) : null;
      if (!af4) return;
      var f4 = findLocal("nicu_rounds", row.local_id);
      if (!f4) {
        af4.adm.rounds = af4.adm.rounds || [];
        af4.adm.rounds.push({ id: row.local_id.slice(2), date: row.round_date, wtG: row.weight_g, vitals: row.vitals || {}, feeds: row.feeds || {}, events: row.events || [], note: row.note || "", _stub: true });
        revs[row.local_id] = { rev: row.client_rev, hash: "~stub" }; added++;
      } else if (clinNewer(row.local_id, row.client_rev)) {
        f4.round.wtG = row.weight_g; f4.round.vitals = row.vitals || {}; f4.round.feeds = row.feeds || {};
        f4.round.events = row.events || []; f4.round.note = row.note || "";
        revs[row.local_id] = { rev: row.client_rev, hash: hashStr(JSON.stringify(snapshotRound(f4.round))) }; updated++;
      }
    });
    sets[5].forEach(function (row) {
      bump(row.client_rev);
      if (!row.local_id || row.deleted_at) return;
      var pf5 = row.patient_local_id ? findLocal("patients", row.patient_local_id) : null;
      if (!pf5) return;
      var f5 = findLocal("mar_entries", row.local_id);
      if (!f5) {
        pf5.child.mar = pf5.child.mar || [];
        pf5.child.mar.push({ id: row.local_id.slice(2), drug: row.drug, dose: row.dose, route: row.route, freq: row.freq, controlled: !!row.controlled, scheduledAt: row.scheduled_at, status: row.status, givenAt: row.given_at, givenBy: row.given_by, witness: row.witness, note: row.note || "", logs: [], _stub: true });
        revs[row.local_id] = { rev: row.client_rev, hash: "~stub" }; added++;
      } else if (clinNewer(row.local_id, row.client_rev)) {
        f5.mar.status = row.status; f5.mar.givenAt = row.given_at || f5.mar.givenAt;
        f5.mar.givenBy = row.given_by || f5.mar.givenBy; f5.mar.witness = row.witness || f5.mar.witness;
        revs[row.local_id] = { rev: row.client_rev, hash: hashStr(JSON.stringify(snapshotMar(f5.mar))) }; updated++;
      }
    });
    sets[6].forEach(function (row) {
      bump(row.client_rev);
      if (!row.local_id || row.deleted_at) return;
      var pf6 = row.patient_local_id ? findLocal("patients", row.patient_local_id) : null;
      if (!pf6) return;
      var f6 = findLocal("growth_points", row.local_id);
      if (!f6) {
        pf6.child.measures = pf6.child.measures || [];
        pf6.child.measures.push({ id: row.local_id.slice(2), date: String(row.measured_at || "").slice(0, 10), wt: row.wt_kg, ht: row.len_cm, hc: row.hc_cm, muac: row.muac_cm, _stub: true });
        revs[row.local_id] = { rev: row.client_rev, hash: "~stub" }; added++;
      } else if (clinNewer(row.local_id, row.client_rev)) {
        f6.measure.wt = row.wt_kg; f6.measure.ht = row.len_cm; f6.measure.hc = row.hc_cm; f6.measure.muac = row.muac_cm;
        revs[row.local_id] = { rev: row.client_rev, hash: hashStr(JSON.stringify(snapshotMeasure(f6.measure))) }; updated++;
      }
    });
    lsSet(REV_KEY, revs); lsSet(CF_KEY, conflicts);
    if (maxRev) lsSet(PULL_KEY, maxRev);
    lsSet("kidgrow_last_pull", new Date().toISOString());
    if (added || updated || removed) {
      try {
        if (typeof save === "function") save();
        if (typeof syncChildPicker === "function") syncChildPicker();
        if (typeof renderAll === "function") renderAll();
        if (Cloud.audit) Cloud.audit("sync.pull", "patients", "", { added: added, updated: updated, removed: removed });
      } catch (e) {}
    }
    renderSyncCard();
    if (conflicts.length) toast(conflicts.length + " sync conflict(s) need review (Sync card).");
    return { ran: true, added: added, updated: updated, removed: removed, conflicts: conflicts.length };
  }).catch(function (e) { toast("Pull failed: " + (e.message || "offline?")); return { ran: true, error: 1 }; });
}
function resolveConflict(localId, keep) {
  var conflicts = lsGet(CF_KEY, []), revs = lsGet(REV_KEY, {});
  var ix = -1, i;
  for (i = 0; i < conflicts.length; i++) if (conflicts[i].localId === localId) ix = i;
  if (ix < 0) return;
  var cf = conflicts[ix];
  if (keep === "mine") {
    var f = findLocal(cf.table, localId);
    var rev = revNow();
    if (f && f.child) {
      var row = cf.table === "patients" ? childToPatient(f.child, mrnPrefix()) : null;
      if (row) { row.client_rev = rev; enqueueOp(cf.table, localId, row); }
      revs[localId] = { rev: rev, hash: hashStr(JSON.stringify(snapshotChild(f.child))) };
    }
  } else {
    var f2 = findLocal(cf.table, localId);
    if (f2 && f2.child && cf.table === "patients") {
      applyRemotePatient(f2.child, cf.remote);
      revs[localId] = { rev: cf.remote.client_rev, hash: hashStr(JSON.stringify(snapshotChild(f2.child))) };
      try { if (typeof save === "function") save(); if (typeof renderAll === "function") renderAll(); } catch (e) {}
    }
  }
  conflicts.splice(ix, 1);
  lsSet(CF_KEY, conflicts); lsSet(REV_KEY, revs);
  renderSyncCard();
  if (keep === "mine") setTimeout(flush, 500);
}

/* ---------------- status card ---------------- */
function status() {
  var q = lsGet(OB_KEY, []), cf = lsGet(CF_KEY, []);
  return {
    pending: q.filter(function (o) { return (o.attempts || 0) < 10; }).length,
    failed: q.filter(function (o) { return (o.attempts || 0) >= 10; }),
    conflicts: cf.length,
    lastFlush: lsGet("kidgrow_last_flush", null), lastPull: lsGet("kidgrow_last_pull", null)
  };
}
function renderSyncCard() {
  var pg = $("pg-settings"); if (!pg) return;
  var old = $("syncCard"); if (old) old.remove();
  if (typeof Cloud === "undefined" || !Cloud.enabled) return;
  var st = status();
  var card = document.createElement("div");
  card.className = "card"; card.id = "syncCard";
  var fails = st.failed.slice(0, 5).map(function (o) {
    return "<div style='font-size:12px'>❌ " + esc(o.table) + " " + esc(o.localId) + " — " + esc(o.lastError || "failed") + "</div>";
  }).join("");
  card.innerHTML = "<h3>🔄 Relational sync (M4)</h3>" +
    "<div class='hint'>Pending: <b>" + st.pending + "</b> · Failed: <b>" + st.failed.length + "</b> · Conflicts: <b>" + st.conflicts + "</b>" +
    (st.lastFlush ? " · Last push: " + esc(st.lastFlush.slice(0, 16).replace("T", " ")) : "") +
    (st.lastPull ? " · Last pull: " + esc(st.lastPull.slice(0, 16).replace("T", " ")) : "") + "</div>" + fails +
    "<div style='display:flex;gap:8px;flex-wrap:wrap;margin-top:8px'>" +
    "<button class='btn btn-p btn-sm' onclick='SyncEngine.syncNow()'>↻ Sync now</button>" +
    (st.conflicts ? "<button class='btn btn-d btn-sm' onclick='SyncEngine.showConflicts()'>⚠️ Resolve conflicts (" + st.conflicts + ")</button>" : "") +
    (st.failed.length ? "<button class='btn btn-o btn-sm' onclick='SyncEngine.dismissFailed()'>Dismiss failures (local data kept)</button>" : "") +
    "</div><div class='hint'>Dual-write: encrypted blob backup + relational rows. Offline edits queue automatically.</div>";
  pg.appendChild(card);
}
function showConflicts() {
  var cf = lsGet(CF_KEY, []);
  var rows = cf.map(function (c) {
    return "<div class='card' style='margin-bottom:8px'><b>" + esc(c.table) + " " + esc(c.localId) + "</b><div class='hint'>Yours vs server " + esc(String(c.remoteRev || "").slice(0, 16)) + "</div>" +
      "<button class='btn btn-p btn-sm' onclick='SyncEngine.resolve(\"" + esc(c.localId) + "\",\"mine\")'>Keep mine</button> " +
      "<button class='btn btn-o btn-sm' onclick='SyncEngine.resolve(\"" + esc(c.localId) + "\",\"theirs\")'>Take theirs</button></div>";
  }).join("") || "<div class='hint'>No conflicts.</div>";
  var d = document.createElement("div");
  d.innerHTML = '<div class="modal-bg open" id="mConf"><div class="modal" style="max-width:460px"><h3>⚠️ Sync conflicts</h3>' + rows +
    '<button class="btn btn-o" style="width:100%;margin-top:8px" onclick="document.getElementById(\'mConf\').remove()">Close</button></div></div>';
  (document.getElementById("cloudRoot") || document.body).appendChild(d.firstChild);
}

/* ---------------- engine ---------------- */
var scanT = null, flushT = null;
function scheduleScan() { if (scanT) clearTimeout(scanT); scanT = setTimeout(function () { scanT = null; try { scanLocal(); renderSyncCard(); scheduleFlush(); } catch (e) {} }, 3000); }
function scheduleFlush() { if (flushT) clearTimeout(flushT); flushT = setTimeout(function () { flushT = null; flush(); }, 5000); }
var SyncEngine = {
  scan: scanLocal, flush: flush, pull: pull, status: status,
  syncNow: function () { try { scanLocal(); } catch (e) {} flush().then(function () { pull(); }); },
  resolve: resolveConflict, showConflicts: showConflicts,
  dismissFailed: function () {
    if (!confirm("Dismiss failed ops? Your LOCAL data is kept; these rows just won't upload.")) return;
    var q = lsGet(OB_KEY, []).filter(function (o) { return (o.attempts || 0) < 10; });
    lsSet(OB_KEY, q); renderSyncCard();
  }
};
window.SyncEngine = SyncEngine;

// Hook every local save into dual-write (defensive: app works without us).
try {
  if (typeof save === "function" && !save._syncHooked) {
    var _save0 = save;
    save = function () { var r = _save0.apply(null, arguments); try { scheduleScan(); } catch (e) {} return r; };
    save._syncHooked = true;
  }
  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("online", function () { try { scanLocal(); flush().then(function () { pull(); }); } catch (e) {} });
  }
  setInterval(function () { try { if (live()) flush(); } catch (e) {} }, 60000);
  setTimeout(function () { try { renderSyncCard(); } catch (e) {} }, 2500);
} catch (e) {}

})();

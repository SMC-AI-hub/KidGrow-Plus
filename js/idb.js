/* NeoKid Care — IndexedDB shadow store (E1/F4, v10.48).
   Dual-write: every save() mirrors to IndexedDB (async, best-effort).
   localStorage stays the source of truth until IDB_CUTOVER flips — the
   cutover path is implemented and proven but DEFAULTS OFF for a soak
   release; flip only after field evidence (match:true across boots).
   Every entry point resolves (never rejects) and no-ops safely where
   IndexedDB is missing (node/vm/tests, private mode, blocked storage). */
var IDB = (function () {
  var DBNAME = "kidgrow", STORE = "kv", KEY = "kidgrow_pro_v1";
  var IDB_CUTOVER = false; // soak gate: reads cut over only when true
  var __status = { mode: "ls", match: null, lsBytes: 0, idbBytes: 0, error: "" };

  function avail() { try { return typeof indexedDB !== "undefined" && !!indexedDB; } catch (e) { return false; } }

  function idbReq(mode, key, val) {
    if (!avail()) return Promise.resolve(null);
    return new Promise(function (resolve) {
      var done = function (v) { resolve(v); };
      try {
        var open = indexedDB.open(DBNAME, 1);
        open.onupgradeneeded = function () { try { open.result.createObjectStore(STORE); } catch (e) {} };
        open.onsuccess = function () {
          try {
            var db = open.result, t = db.transaction(STORE, mode), st = t.objectStore(STORE);
            var rq = (mode === "readwrite") ? st.put(val, key) : st.get(key);
            var out = null;
            rq.onsuccess = function () { out = rq.result; };
            t.oncomplete = function () { try { db.close(); } catch (e) {} done(mode === "readwrite" ? true : (out === undefined ? null : out)); };
            t.onerror = function () { try { db.close(); } catch (e) {} done(mode === "readwrite" ? false : null); };
          } catch (e) { done(mode === "readwrite" ? false : null); }
        };
        open.onerror = function () { done(mode === "readwrite" ? false : null); };
        open.onblocked = function () { done(mode === "readwrite" ? false : null); };
      } catch (e) { done(mode === "readwrite" ? false : null); }
    });
  }

  function idbHash(s) { // short sync hash for verify display (NOT cryptographic)
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, str = String(s || "");
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }
  function idbPack(json) {
    var j = String(json == null ? "" : json);
    return { json: j, at: Date.now(), len: j.length, hash: idbHash(j) };
  }
  function idbPickNewer(lsMeta, idbWrap) {
    try { // "idb" ONLY when the shadow is provably newer; every doubt -> "ls"
      if (!idbWrap || typeof idbWrap.json !== "string") return "ls";
      var lat = (lsMeta && lsMeta.at) || 0;
      if ((idbWrap.at || 0) > lat && idbWrap.hash === idbHash(idbWrap.json)) return "idb";
      return "ls";
    } catch (e) { return "ls"; }
  }

  function idbMirror(json) { // fire-and-forget from save(); always safe
    try { idbReq("readwrite", KEY, idbPack(json)); } catch (e) {}
    return true;
  }

  function idbStatus() { return __status; }

  function idbVerify() {
    __status = { mode: IDB_CUTOVER ? "idb-armed" : "ls", match: null, lsBytes: 0, idbBytes: 0, error: "", adopt: null };
    if (!avail()) { __status.error = "unavailable"; return Promise.resolve(__status); }
    var lsRaw = "", lsMeta = null;
    try {
      lsRaw = (typeof localStorage !== "undefined" && localStorage.getItem(KEY)) || "";
      var mRaw = (typeof localStorage !== "undefined" && localStorage.getItem(KEY + "_meta")) || "";
      if (mRaw) lsMeta = JSON.parse(mRaw);
    } catch (e) { lsMeta = null; }
    __status.lsBytes = String(lsRaw).length;
    return idbReq("readonly", KEY, null).then(function (wrap) {
      try {
        if (!wrap || typeof wrap.json !== "string") { __status.error = wrap === null ? "shadow empty" : "shadow unreadable"; return __status; }
        __status.idbBytes = wrap.len || String(wrap.json).length;
        __status.match = (wrap.hash === idbHash(String(lsRaw))) && (String(lsRaw).length === (wrap.len || 0));
        if (IDB_CUTOVER && idbPickNewer(lsMeta, wrap) === "idb") { __status.adopt = wrap.json; __status.mode = "idb"; }
      } catch (e) { __status.error = "verify threw"; }
      return __status;
    });
  }

  return {
    mirror: idbMirror, verify: idbVerify, status: idbStatus,
    hash: idbHash, pack: idbPack, pickNewer: idbPickNewer,
    _setCutover: function (v) { IDB_CUTOVER = !!v; },
    _plant: function (json, at) { // TEST-ONLY hook: plant a shadow copy with explicit timestamp
      var w = idbPack(json); w.at = at;
      return idbReq("readwrite", KEY, w);
    },
  };
})();
try { if (typeof window !== "undefined") window.IDB = IDB; } catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = IDB; } catch (e2) {}

/* NeoKid Care — child-safety guard (2026-11-04, v10.53.3).
   Fixes "Twin 1 is selected as default": the app keeps ONE active child in
   DB.activeId and every form writes to it silently. Two safeguards:

   A) Twin-confirm banner, app-wide. When the active child belongs to a twin /
      same-DOB sibling / look-alike pair, an unmissable bar appears above every
      page AND every clinical save action is blocked until the user explicitly
      confirms which twin is being treated (or switches). Confirmation is
      session-scoped and invalidated by a child switch, a rename, a DOB edit,
      or the registration/removal of a sibling.

   B) Explicit child pick on the highest-risk entry forms. Those forms start
      with NO child selected ("— select child —"); Save is disabled and the
      delegated save is blocked until a child is picked by name/DOB/MRN.
      Picking a child IS an explicit identity confirmation (it also satisfies A).

   No data-model change, no schema change, no server change. Detection is a
   conservative heuristic (explicit link fields, twin-marked names, or same
   DOB + shared parent/phone); a clinic with no such pair sees no change at all.
   Class names / selectors here are additive only — see css/style.css header.

   LOGGING POLICY: no patient data is ever logged (we don't log at all).
*/
(function () {
  "use strict";

  /* ---------- pure helpers (unit-tested in tests/childguard.test.js) ---------- */
  function cgEsc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function cgNorm(s) { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
  function cgDigits(s) { return String(s == null ? "" : s).replace(/\D/g, ""); }

  /* "Abhinaya Twin 1" / "Abhinaya (Twin 2)" / "Baby T1" -> "abhinaya" / "baby".
     Anything that is NOT twin-marked keeps its full name, so two unrelated
     children with a common first name are never mistaken for twins. */
  function cgTwinMark(s) {
    return /\b(twins?|triplets?)\b|\bT[123]\b/i.test(String(s == null ? "" : s));
  }
  function cgBaseName(s) {
    var n = String(s == null ? "" : s);
    n = n.replace(/\b(twins?|triplets?)\s*[-#:]?\s*(?:no\.?\s*)?(?:[0-9]+|[ab]|[ivx]{1,4}|one|two|three|first|second|third)?\b/gi, " ");
    n = n.replace(/\bT[123]\b/gi, " ");
    n = n.replace(/[()\[\],.#\-_]+/g, " ");
    return cgNorm(n);
  }
  function cgKids() {
    try { return (typeof DB !== "undefined" && DB && Array.isArray(DB.children)) ? DB.children : []; }
    catch (e) { return []; }
  }
  function cgActive() {
    try { return (typeof child === "function") ? child() : (cgKids()[0] || null); }
    catch (e) { return null; }
  }
  function cgActiveId() {
    try { return (typeof DB !== "undefined" && DB && DB.activeId != null) ? String(DB.activeId) : ""; }
    catch (e) { return ""; }
  }

  /* Return the peers that make `c` ambiguous. Deliberately conservative:
     1. explicit link fields (twinGroup / twinOf / siblingGroup),
     2. BOTH names carry a twin marker AND share the same stripped base name,
     3. same DOB AND a shared mother/father/parent/phone (twins, triplets, or
        a duplicate registration — all are wrong-child hazards). */
  function cgTwinPeers(c, kids) {
    if (!c || !Array.isArray(kids)) return [];
    var nm = String(c.name || ""), base = cgBaseName(nm), marked = cgTwinMark(nm);
    var dob = String(c.dob || ""), grp = c.twinGroup || c.siblingGroup || "";
    var mum = cgNorm(c.mother || c.parent || ""), dad = cgNorm(c.father || "");
    var tel = cgDigits(c.phone), out = [], seen = {};
    kids.forEach(function (o) {
      if (!o || o.id === c.id || seen[o.id]) return;
      var hit = false;
      if (grp && String(grp) === String(o.twinGroup || o.siblingGroup || "")) hit = true;
      if (c.twinOf && String(c.twinOf) === String(o.id)) hit = true;
      if (o.twinOf && String(o.twinOf) === String(c.id)) hit = true;
      if (!hit && marked && base && cgTwinMark(o.name) && cgBaseName(o.name) === base) hit = true;
      if (!hit && dob && dob === String(o.dob || "")) {
        var om = cgNorm(o.mother || o.parent || ""), od = cgNorm(o.father || ""), ot = cgDigits(o.phone);
        if ((mum && mum === om) || (dad && dad === od) || (tel.length >= 7 && tel === ot)) hit = true;
      }
      if (hit) { seen[o.id] = 1; out.push(o); }
    });
    return out;
  }

  /* Confirmation fingerprint: any identity change forces a fresh confirm. */
  function cgSig(c, peers) {
    if (!c) return "";
    var p = (peers || []).map(function (o) { return String(o.id) + ":" + cgNorm(o.name) + ":" + String(o.dob || ""); }).sort().join(",");
    return [String(c.id), cgNorm(c.name), String(c.dob || ""), String(c.mrn || ""), p].join("|");
  }

  /* ---------- configuration ---------- */
  /* B forms: modal id -> child <select> id (aChild already exists in HTML). */
  var CG_PICK = {
    mVisit: "cgPick_mVisit",
    mGrowth: "cgPick_mGrowth",
    mVac: "cgPick_mVac",
    mTanner: "cgPick_mTanner",
    mExtra: "cgPick_mExtra",
    mAppt: "aChild"
  };
  var CG_SAVE_BTN = {
    mVisit: "saveVisit", mGrowth: "saveGrowth", mVac: "saveVaccine",
    mTanner: "saveTanner", mExtra: "saveExtra", mAppt: "saveAppt"
  };
  /* A gate: clinical writes bound to the active child. Non-clinical saves
     (settings, users, stock, branding, cloud, tenant, export, print) are NOT
     gated. Deletes are gated too — deleting the wrong twin's record is just
     as harmful as writing to it. */
  var CG_GUARDED = {};
  [
    "saveVisit", "saveVaccine", "saveGrowth", "saveTanner", "saveExtra", "saveAppt",
    "saveAefi", "saveConsent", "saveLab", "saveRx", "saveBill", "letterSave",
    "markMs", "markReminded", "toggleDispense", "marLogDose", "saveMarEntry",
    "importRxToMar", "addToken", "startVisit", "queueStart", "toggleAppt",
    "chronicAddAed", "chronicDelAed", "chronicSaveExac", "chronicSaveGina",
    "chronicSaveReading", "chronicSaveSeiz", "pefAdd", "pefDel",
    "hxAddA", "hxAddP", "hxDelA", "hxDelP", "nbSet", "nbSetApgar",
    "nbSetScreen", "nbSetBallard", "rbskSet", "sigClear", "withdrawConsent",
    "deleteVisit", "deleteMeasure", "deleteTanner", "deleteExtra",
    "deleteExtraFromForm", "delAefi", "delLab", "delRx", "delConsent",
    "delAppt", "delBill", "clearVaccine", "ironToRx", "pullAefiFromNotes",
    "runCchdCalc", "runRopCalc", "toothToggle", "toggleLabRev", "astToggleTrigger",
    "hriDischarge", "hriDone", "hriEnroll", "hriUndone", "hriBook",
    "saveAdmission", "saveNicuBundle", "saveNicuProc", "saveNicuRound",
    "dischargeNicu", "letterDel"
  ].forEach(function (n) { CG_GUARDED[n] = 1; });

  /* ---------- session state ---------- */
  var CG_KEY = "kgChildGuard.v1";
  var mem = { sig: "", at: 0 };
  var picks = {};       /* modal id -> explicitly picked child id */
  var injected = {};    /* modal id -> bool */

  function cgRead() {
    try {
      if (typeof sessionStorage !== "undefined" && sessionStorage) {
        var raw = sessionStorage.getItem(CG_KEY);
        if (raw) { var v = JSON.parse(raw); return { sig: String(v.sig || ""), at: +v.at || 0 }; }
        return { sig: "", at: 0 };
      }
    } catch (e) {}
    return { sig: mem.sig, at: mem.at };
  }
  function cgWrite(sig) {
    mem = { sig: sig || "", at: Date.now ? Date.now() : 0 };
    try { if (typeof sessionStorage !== "undefined" && sessionStorage) sessionStorage.setItem(CG_KEY, JSON.stringify(mem)); } catch (e) {}
  }
  function cgConfirmed(c, peers) {
    try { return !!c && cgRead().sig !== "" && cgRead().sig === cgSig(c, peers); }
    catch (e) { return false; }
  }
  function cgToast(m) { try { if (typeof toast === "function") toast(m); } catch (e) {} }

  /* ---------- A: banner ---------- */
  function cgPeerLine(o) {
    return cgEsc(o.name || "Unnamed") + (o.mrn ? " · MRN " + cgEsc(o.mrn) : "") + (o.dob ? " · DOB " + cgEsc(o.dob) : "");
  }
  function cgBannerHTML() {
    var c = cgActive();
    if (!c) return "";
    var peers = cgTwinPeers(c, cgKids());
    if (!peers.length) return "";
    var who = cgEsc(c.name || "Unnamed");
    if (cgConfirmed(c, peers)) {
      return '<div class="alert a-green cg-banner" id="cgBannerBox">✅ <div><b>Confirmed — working on ' + who + '</b>' +
        (c.mrn ? " (MRN " + cgEsc(c.mrn) + ")" : "") + '. Entries are unlocked for this child.' +
        '<div class="cg-actions"><button type="button" class="btn btn-o btn-sm" data-act="cgReset">Change confirmation</button></div></div></div>';
    }
    var switches = peers.slice(0, 3).map(function (o) {
      return '<button type="button" class="btn btn-o btn-sm" data-act="cgSwitch" data-arg="' + cgEsc(o.id) + '">⇄ ' + cgEsc(o.name || "other twin") + '</button>';
    }).join("");
    return '<div class="alert a-amber cg-banner cg-locked" id="cgBannerBox">👯 <div>' +
      '<div class="cg-title">Twin / look-alike pair — confirm which child you are treating</div>' +
      '<div>You are on <b>' + who + '</b>' + (c.mrn ? " · MRN " + cgEsc(c.mrn) : "") +
      (c.dob ? " · DOB " + cgEsc(c.dob) : "") + '. Matching record' + (peers.length > 1 ? "s" : "") + ': ' +
      peers.slice(0, 3).map(cgPeerLine).join(" · ") + '.</div>' +
      '<div class="cg-actions"><button type="button" class="btn btn-p btn-sm" data-act="cgConfirm">✓ Confirm — ' + who + ', continue</button>' + switches + '</div>' +
      '<div class="cg-note">Clinical entries are locked until you confirm. Switching the active child requires a fresh confirmation. Appears on every screen.</div>' +
      '</div></div>';
  }

  /* ---------- B: injected child pick row ---------- */
  function cgOptionsHTML() {
    return '<option value="">— select child —</option>' + cgKids().map(function (o) {
      return '<option value="' + cgEsc(o.id) + '">' + cgPeerLine(o) + '</option>';
    }).join("") + '<option value="__other__">Other registered child…</option>';
  }
  function cgInject() {
    Object.keys(CG_PICK).forEach(function (fid) {
      if (injected[fid]) return;
      try {
        var modal = document.getElementById(fid);
        if (!modal) return;
        if (fid === "mAppt") {
          /* aChild already exists; only add the lock note alongside it. */
          try {
            var s0 = document.getElementById("aChild");
            var host = s0 && s0.parentNode ? s0.parentNode : null;
            if (host && host.appendChild && !document.getElementById("cgLock_mAppt")) {
              var note = document.createElement("div");
              note.className = "cg-lock"; note.id = "cgLock_mAppt";
              note.textContent = "🔒 Select a child to unlock Book";
              host.appendChild(note);
            }
          } catch (e) {}
          injected[fid] = true;
          return;
        }
        var row = document.createElement("div");
        row.className = "cg-pick no-print";
        row.setAttribute("data-cg-key", fid);
        row.innerHTML = '<label for="' + cgEsc(CG_PICK[fid]) + '">Child * — who is this entry for?</label>' +
          '<select id="' + cgEsc(CG_PICK[fid]) + '" data-onchange="cgPick" aria-label="Child for this entry">' + cgOptionsHTML() + '</select>' +
          '<div class="cg-lock" id="cgLock_' + cgEsc(fid) + '">🔒 Select a child to unlock Save</div>';
        var anchor = modal.querySelector ? modal.querySelector(".form-grid, .modal-body") : null;
        var host = anchor && anchor.parentNode ? anchor.parentNode : modal;
        if (anchor && host.insertBefore) host.insertBefore(row, anchor);
        else if (host.appendChild) host.appendChild(row);
        injected[fid] = true;
      } catch (e) {}
    });
  }
  function cgPickValue(fid) {
    try {
      var s = document.getElementById(CG_PICK[fid]);
      return s ? String(s.value || "") : "";
    } catch (e) { return ""; }
  }
  function cgPickOK(fid) {
    var v = cgPickValue(fid);
    return !!v && v !== "__other__" && v === cgActiveId();
  }
  function cgFormOpen(id) {
    if (!CG_PICK[id]) return;
    picks[id] = "";
    try {
      var s = document.getElementById(CG_PICK[id]);
      if (s) s.value = "";
    } catch (e) {}
    cgRender();
  }

  /* ---------- render hook (called from renderAll via callRender) ---------- */
  function cgRender() {
    try {
      if (typeof document === "undefined" || !document.getElementById) return;
      cgInject();
      var slot = document.getElementById("cgBanner");
      if (slot) slot.innerHTML = cgBannerHTML();
      var kidSig = cgKids().map(function (o) { return String(o.id) + "|" + cgNorm(o.name) + "|" + String(o.dob || ""); }).join(",");
      Object.keys(CG_PICK).forEach(function (fid) {
        var modal = document.getElementById(fid);
        if (!modal) return;
        var sel = document.getElementById(CG_PICK[fid]);
        if (sel) {
          /* Refresh options only when the roster changed, preserving the pick. */
          try {
            var prevSig = sel.dataset ? sel.dataset.cgSig : null;
            if (fid !== "mAppt" && prevSig !== kidSig) {
              var cur = sel.value;
              sel.innerHTML = cgOptionsHTML();
              if (sel.dataset) sel.dataset.cgSig = kidSig;
              sel.value = cur;
            }
            var want = (picks[fid] && picks[fid] === cgActiveId()) ? picks[fid] : "";
            if (String(sel.value || "") !== want) sel.value = want;
          } catch (e) {}
        }
        var ok = cgPickOK(fid);
        try {
          var btns = modal.querySelectorAll ? modal.querySelectorAll("[data-act]") : [];
          for (var i = 0; i < btns.length; i++) {
            if (btns[i].getAttribute && btns[i].getAttribute("data-act") === CG_SAVE_BTN[fid]) btns[i].disabled = !ok;
          }
        } catch (e) {}
        try {
          var lock = document.getElementById("cgLock_" + fid);
          if (lock) lock.style.display = ok ? "none" : "";
        } catch (e) {}
      });
    } catch (e) {}
  }

  /* ---------- delegated actions ---------- */
  function cgConfirm() {
    var c = cgActive();
    cgWrite(c ? cgSig(c, cgTwinPeers(c, cgKids())) : "");
    cgRender();
    cgToast("✅ Confirmed — " + (c ? String(c.name || "child") : "child") + ". Entries unlocked.");
  }
  function cgReset() { cgWrite(""); cgRender(); cgToast("Confirmation cleared — please confirm the child again."); }
  function cgSwitch(el) {
    var id = "";
    try { id = el && el.getAttribute ? String(el.getAttribute("data-arg") || "") : ""; } catch (e) {}
    if (!id) return;
    cgWrite(""); /* switching is explicit, but the destination must be confirmed */
    try { if (typeof setActive === "function") setActive(id); } catch (e) { cgRender(); }
  }
  function cgPick(el) {
    var id = "", fid = "";
    try {
      id = String(el && el.value || "");
      var m = el && el.closest ? el.closest(".modal-bg") : null;
      fid = m ? String(m.id || "") : "";
      if (!fid && el && el.id === "aChild") fid = "mAppt";
      if (!fid && el && el.closest) {
        var r = el.closest(".cg-pick");
        if (r) fid = String(r.getAttribute("data-cg-key") || "");
      }
    } catch (e) {}
    if (!CG_PICK[fid]) return;
    if (id === "__other__") {
      try { if (el) el.value = ""; } catch (e) {}
      picks[fid] = "";
      cgToast("Use the top-bar “Active child” search to switch child, then re-select here.");
      cgRender();
      return;
    }
    picks[fid] = id;
    if (id && id !== cgActiveId()) {
      try { if (typeof setActive === "function") { setActive(id); } else { cgRender(); } }
      catch (e) { cgRender(); }
    }
    /* An explicit pick by name/DOB/MRN is itself an identity confirmation. */
    if (id) cgConfirm(); else cgRender();
  }

  function cgNudge(msg) {
    cgToast(msg);
    try {
      var b = document.getElementById("cgBannerBox");
      if (b && b.classList) {
        b.classList.add("cg-flash");
        if (typeof setTimeout === "function") setTimeout(function () { try { b.classList.remove("cg-flash"); } catch (e) {} }, 900);
      }
    } catch (e) {}
  }

  /* Single choke point for ALL delegated click actions: A gate + B gate.
     Fail-open only if the app context is unavailable (e.g. a headless unit
     harness with no DB) — never silently bypass in a live app. */
  function cgAllow(name, el) {
    try {
      if (!CG_GUARDED[name]) return true;
      if (typeof DB === "undefined" || !DB) return true;
      if (!cgKids().length) return true;
      var fid = "";
      try {
        var m = el && el.closest ? el.closest(".modal-bg") : null;
        if (m) fid = String(m.id || "");
      } catch (e) {}
      if (CG_PICK[fid] && !cgPickOK(fid)) {
        cgNudge("🔒 Select the child for this entry (Child *) before saving.");
        return false;
      }
      var c = cgActive();
      if (!c) return true;
      var peers = cgTwinPeers(c, cgKids());
      if (peers.length && !cgConfirmed(c, peers)) {
        cgNudge("👯 Twin / look-alike pair — confirm the correct child in the banner before saving.");
        return false;
      }
      return true;
    } catch (e) { return true; }
  }

  /* ---------- exports / boot ---------- */
  var api = {
    cgEsc: cgEsc, cgNorm: cgNorm, cgDigits: cgDigits, cgTwinMark: cgTwinMark,
    cgBaseName: cgBaseName, cgTwinPeers: cgTwinPeers, cgSig: cgSig,
    cgAllow: cgAllow, cgRender: cgRender, cgFormOpen: cgFormOpen,
    cgPick: cgPick, cgConfirm: cgConfirm, cgReset: cgReset, cgSwitch: cgSwitch,
    CG_PICK: CG_PICK, CG_SAVE_BTN: CG_SAVE_BTN, CG_GUARDED: CG_GUARDED
  };
  try {
    if (typeof window !== "undefined") {
      Object.keys(api).forEach(function (k) { window[k] = api[k]; });
    }
  } catch (e) {}
  try {
    if (typeof actRegister === "function") {
      actRegister("cgConfirm", function () { cgConfirm(); });
      actRegister("cgSwitch", function (el) { cgSwitch(el); });
      actRegister("cgReset", function () { cgReset(); });
      actRegister("cgPick", function (el) { cgPick(el); });
    }
  } catch (e) {}
  try {
    if (typeof document !== "undefined" && document.getElementById) { cgInject(); cgRender(); }
  } catch (e) {}
  try { if (typeof module !== "undefined" && module.exports) module.exports = api; } catch (e) {}
})();

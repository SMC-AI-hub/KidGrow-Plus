/* NeoKid Care — ⌘K/Ctrl+K command palette (v10.43 quick win).
   One entry point: patients (ranked, recents first) + pages + actions.
   Pure core (cmdkMatch/cmdkBuild) is unit-tested; DOM shell is lazy. */
function cmdkMatch(hay, q) {
  try {
    const h = String(hay || "").toLowerCase(), n = String(q || "").toLowerCase().trim();
    if (!n) return true;
    return n.split(/\s+/).every((w) => h.indexOf(w) !== -1);
  } catch (e) { return false; }
}
/* Pure assembler: ranked flat list [{sec, icon, label, sub, run}] — run is a key, not a fn. */
function cmdkBuild(q, patients, pages, actions) {
  const out = [];
  try {
    (patients || []).forEach((p) => {
      if (cmdkMatch(`${p.name} ${p.parent} ${p.phone} ${p.mrn}`, q)) {
        out.push({ sec: "Patients", icon: "🧒", label: p.name || "?", sub: [p.age, p.sex, p.mrn && ("MRN " + p.mrn)].filter(Boolean).join(" · "), run: "pick:" + p.id });
      }
    });
    (pages || []).forEach((pg) => {
      if (cmdkMatch(pg.title, q)) out.push({ sec: "Go to", icon: "➡️", label: pg.title, sub: "", run: "go:" + pg.page });
    });
    (actions || []).forEach((a) => {
      if (cmdkMatch(a.label, q)) out.push({ sec: "Do", icon: a.icon || "⚡", label: a.label, sub: "", run: "act:" + a.id });
    });
  } catch (e) {}
  return out.slice(0, 30);
}
function cmdkPatients() {
  const out = [];
  try {
    const kids = ((typeof DB !== "undefined" && DB.children) || []);
    let ranked = kids;
    try {
      if (typeof matchChildren === "function") {
        ranked = matchChildren("", kids, (typeof getRecentIds === "function") ? getRecentIds() : []).map((h) => h.c);
      }
    } catch (e) {}
    ranked.forEach((c) => {
      if (!c) return;
      let age = "";
      try { age = (typeof ageStr === "function" && typeof ageBetween === "function") ? ageStr(ageBetween(c.dob)) : ""; } catch (e2) {}
      out.push({ id: c.id, name: c.name, parent: c.parent || c.mother || c.father || "", phone: c.phone || "", mrn: c.mrn || "", age, sex: c.sex === "boy" ? "Boy" : c.sex === "girl" ? "Girl" : "" });
    });
  } catch (e) {}
  return out;
}
function cmdkPages() {
  const out = [];
  try {
    const T = (typeof TITLES !== "undefined" && TITLES) || {}, R = (typeof RENDER_FOR !== "undefined" && RENDER_FOR) || {};
    Object.keys(R).forEach((page) => {
      try { if (typeof roleBlock === "function" && roleBlock(page)) return; } catch (e) {}
      if (T[page]) out.push({ page, title: T[page] });
    });
  } catch (e) {}
  return out;
}
function cmdkActions() {
  return [
    { id: "register", icon: "＋", label: "Register child" },
    { id: "visit", icon: "🩺", label: "New visit note" },
    { id: "rx", icon: "💊", label: "Write prescription" },
    { id: "upload", icon: "⬆️", label: "Upload to cloud now" },
    { id: "download", icon: "⬇️", label: "Download from cloud" },
    { id: "print", icon: "🖨️", label: "Print this page" },
    { id: "theme", icon: "🌙", label: "Toggle theme" },
  ];
}
function cmdkRun(run) {
  try {
    const [kind, arg] = String(run).split(/:(.+)/);
    if (kind === "pick" && typeof setActive === "function") { setActive(arg); CmdK.close(); return true; }
    if (kind === "go" && typeof go === "function") { CmdK.close(); go(arg); return true; }
    if (kind === "act") {
      CmdK.close();
      if (arg === "register" && typeof openChildModal === "function") openChildModal();
      else if (arg === "visit" && typeof openVisitModal === "function") openVisitModal();
      else if (arg === "rx" && typeof go === "function") go("rx");
      else if (arg === "upload" && typeof Cloud !== "undefined" && Cloud.pushNow) Cloud.pushNow(true);
      else if (arg === "download" && typeof Cloud !== "undefined" && Cloud.pullNow) Cloud.pullNow();
      else if (arg === "print" && typeof printPage === "function") { const a = document.querySelector(".page.active"); if (a && a.id) printPage(a.id); }
      else if (arg === "theme" && typeof toggleTheme === "function") toggleTheme();
      else return false;
      return true;
    }
  } catch (e) {}
  return false;
}
var CmdK = (function () {
  let sel = 0, items = [];
  function el() { return (typeof document !== "undefined") ? document.getElementById("mCmdK") : null; }
  function ensure() {
    if (typeof document === "undefined") return null;
    let m = el();
    if (m) return m;
    m = document.createElement("div");
    m.id = "mCmdK";
    m.className = "modal-bg";
    m.innerHTML = `<div class="modal" style="max-width:520px;padding:12px" role="dialog" aria-label="Search and commands">` +
      `<input id="cmdkQ" placeholder="Type patient, page, or action…  (esc closes)" autocomplete="off" ` +
      `style="width:100%;box-sizing:border-box" oninput="CmdK.render()" onkeydown="CmdK.key(event)">` +
      `<div id="cmdkRes" class="cmdk-res"></div></div>`;
    m.addEventListener("click", (e) => { if (e.target === m) CmdK.close(); });
    document.body.appendChild(m);
    return m;
  }
  function esc2(s) { try { return (typeof esc === "function") ? esc(s) : String(s == null ? "" : s); } catch (e) { return String(s == null ? "" : s); } }
  return {
    open() {
      const m = ensure(); if (!m) return false;
      sel = 0;
      m.classList.add("open");
      const q = document.getElementById("cmdkQ");
      if (q) { q.value = ""; setTimeout(() => { try { q.focus(); } catch (e) {} }, 30); }
      CmdK.render();
      return true;
    },
    close() { const m = el(); if (m) m.classList.remove("open"); },
    isOpen() { const m = el(); return !!(m && m.classList.contains("open")); },
    render() {
      const box = (typeof document !== "undefined") ? document.getElementById("cmdkRes") : null;
      const q = (typeof document !== "undefined" && document.getElementById("cmdkQ") || {}).value || "";
      items = cmdkBuild(q, cmdkPatients(), cmdkPages(), cmdkActions());
      if (!box) return items;
      if (sel >= items.length) sel = 0;
      let lastSec = "";
      box.innerHTML = items.map((it, i) => {
        const h = it.sec !== lastSec ? `<div class="cmdk-sec">${esc2(it.sec)}</div>` : "";
        lastSec = it.sec;
        return h + `<div class="cmdk-row${i === sel ? " sel" : ""}" data-i="${i}" onclick="CmdK.pick(${i})">` +
          `<span style="width:22px;text-align:center">${esc2(it.icon)}</span><span><b>${esc2(it.label)}</b>` +
          (it.sub ? ` <span style="font-size:12px;color:var(--muted)">${esc2(it.sub)}</span>` : "") + `</span></div>`;
      }).join("") || `<div class="hint">No matches — try a name, MRN, phone, page, or action.</div>`;
      return items;
    },
    pick(i) { const it = items[i]; if (it) cmdkRun(it.run); },
    key(e) {
      if (!e) return;
      if (e.key === "Escape") { CmdK.close(); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(sel + 1, items.length - 1); CmdK.render(); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(sel - 1, 0); CmdK.render(); return; }
      if (e.key === "Enter" && items[sel]) { e.preventDefault(); CmdK.pick(sel); }
    },
  };
})();
try {
  if (typeof document !== "undefined" && document.addEventListener) {
    document.addEventListener("keydown", (e) => {
      try {
        if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          if (CmdK.isOpen()) CmdK.close(); else CmdK.open();
        }
      } catch (err) {}
    });
  }
} catch (e) {}
try { if (typeof window !== "undefined" && window) window.CmdK = CmdK; } catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = { cmdkMatch, cmdkBuild, cmdkActions }; } catch (e2) {}

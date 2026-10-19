/* NeoKid Care — coded-terminology service (Phase 1 infra).
   ICD-10 picker over the curated subset (data/icd10.json) + SNOMED map
   where verified. Terms.attach() wires a search box + results + chips. */
function termsEsc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]); }
function termsEntries() {
  try { return ((typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT.icd10 && KGCONTENT.icd10.entries) || []); }
  catch (e) { return []; }
}
function termsSearch(q) {
  q = String(q || "").toLowerCase().trim();
  if (q.length < 2) return [];
  const out = [];
  for (const e of termsEntries()) {
    const code = String(e.code || "").toLowerCase(), lb = String(e.label || "").toLowerCase();
    const score = code.startsWith(q) ? 3 : lb.startsWith(q) ? 2 : (code.includes(q) || lb.includes(q)) ? 1 : 0;
    if (score) out.push({ e, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 12).map((x) => x.e);
}
function termsGet(code) { return termsEntries().find((e) => e.code === code) || null; }
function termsChipsHTML(sel) {
  return (sel || []).map((c) => {
    const e = termsGet(c);
    return `<span class="badge b-blue" style="margin:2px 4px 2px 0;display:inline-flex;gap:6px;align-items:center">${termsEsc(c)}${e ? " · " + termsEsc(e.label) : ""}<a href="javascript:void(0)" data-termsdrop="${termsEsc(c)}" style="text-decoration:none">×</a></span>`;
  }).join("");
}
function termsReadSel(hiddenId) {
  try { const v = JSON.parse(document.getElementById(hiddenId).value || "[]"); return Array.isArray(v) ? v : []; }
  catch (e) { return []; }
}
function termsPaint(hiddenId, chipsId) {
  const sel = termsReadSel(hiddenId);
  const box = document.getElementById(chipsId);
  if (box) box.innerHTML = termsChipsHTML(sel);
}
function termsPick(hiddenId, chipsId, listId, qId, code) {
  try {
    const sel = termsReadSel(hiddenId);
    if (!sel.includes(code)) { sel.push(code); document.getElementById(hiddenId).value = JSON.stringify(sel); }
    termsPaint(hiddenId, chipsId);
    const l = document.getElementById(listId); if (l) l.innerHTML = "";
    const q = document.getElementById(qId); if (q) { q.value = ""; q.focus(); }
  } catch (e) {}
  return false;
}
function termsAttach(qId, listId, chipsId, hiddenId) {
  try {
    const q = document.getElementById(qId), list = document.getElementById(listId);
    if (!q || !list) return;
    termsPaint(hiddenId, chipsId);
    q.oninput = () => {
      const hits = termsSearch(q.value);
      list.innerHTML = hits.map((e) => `<button type="button" class="btn btn-o btn-xs" style="margin:2px 4px 2px 0" onclick="Terms.pick('${hiddenId}','${chipsId}','${listId}','${qId}','${termsEsc(e.code)}')">${termsEsc(e.code)} · ${termsEsc(e.label)}</button>`).join("");
    };
    document.getElementById(chipsId).onclick = (ev) => {
      const a = ev && ev.target && ev.target.closest ? ev.target.closest("[data-termsdrop]") : null;
      if (!a) return;
      const sel = termsReadSel(hiddenId).filter((c) => c !== a.getAttribute("data-termsdrop"));
      document.getElementById(hiddenId).value = JSON.stringify(sel);
      termsPaint(hiddenId, chipsId);
    };
  } catch (e) {}
}
var Terms = { search: termsSearch, get: termsGet, chipsHTML: termsChipsHTML, attach: termsAttach, pick: termsPick };
try { if (typeof window !== "undefined" && window) window.Terms = Terms; } catch (e) {}

/* NeoKid Care — clinical-content access (Phase 1 infra).
   Sources live in data/*.json (clinician-editable); js/cdata.gen.js embeds
   them for offline-first sync loading. Regenerate with node tools/gen-content.js */
function contentGet(name) {
  try { return (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT[name]) || null; }
  catch (e) { return null; }
}
function contentMeta() {
  // Every content pack's provenance — feeds Standards text + verification lists.
  const out = [];
  try {
    const K = (typeof KGCONTENT !== "undefined" && KGCONTENT) || {};
    for (const k of Object.keys(K)) {
      const p = K[k] || {};
      out.push({ pack: k, source: p.source || "?", version: p.version || "?", last_reviewed: p.last_reviewed || null, verification: p.verification || "?" });
    }
  } catch (e) {}
  return out;
}
var Content = { get: contentGet, meta: contentMeta };
try { if (typeof window !== "undefined" && window) window.Content = Content; } catch (e) {}

/* NeoKid Care — regional-language layer, English first (Phase 1 infra).
   Strings live in data/strings.<lang>.json; t() always falls back to English,
   then to the key itself. Hindi/Tamil packs plug in without logic changes. */
var I18N_LANG = "en";
function t(key, fb) {
  try {
    const K = (typeof KGCONTENT !== "undefined" && KGCONTENT) || {};
    const pack = K["strings_" + I18N_LANG] || K.strings_en || {};
    const s = (pack.strings || {})[key];
    if (s != null && s !== "") return s;
    if (I18N_LANG !== "en") {
      const en = ((K.strings_en || {}).strings || {})[key];
      if (en != null && en !== "") return en;
    }
  } catch (e) {}
  return (fb != null ? fb : key);
}
try { if (typeof window !== "undefined" && window) window.t = t; } catch (e) {}

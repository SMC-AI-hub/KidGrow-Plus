/* =====================================================
   NeoKid Care — guideline-source framework (G1)
   Global default + per-module override + validator gates.

   Resolution: module override ("auto" = follow global) ->
   global choice if the module supports it -> module fallback.
   New modes flow ONLY after the validator checks their enable
   box in Settings; until then everything resolves to the
   validated status quo (Mayo TSH, NICE jaundice).

   G1 wires NOTHING into clinical code — pure resolution.
   G2/G3 engines consume guideEffective("tsh"/"bili").
   ===================================================== */
const GUIDE_SUPPORT = { tsh: ["aiims", "aap", "mayo"], bili: ["nice", "iap", "nnf", "aap"] };
const GUIDE_GLOBAL_CHOICES = ["aiims", "aap", "iap", "nnf"];
const GUIDE_STATUS_QUO = { tsh: "mayo", bili: "nice" };
const GUIDE_GLOBAL_DEFAULT = "aiims";
const GUIDE_MODULE_KEY = { tsh: "guideTSH", bili: "guideBili" };
const GUIDE_META = {
  aiims: { label: "AIIMS protocols", note: "Neonatal TSH per ISPAE-2018 (AIIMS-aligned)" },
  aap: { label: "AAP", note: "TSH: CH screening 2023 · Jaundice: hyperbilirubinemia 2022" },
  mayo: { label: "Mayo", note: "s-TSH reference intervals (validated fallback)" },
  nice: { label: "NICE", note: "CG98 threshold table (validated fallback)" },
  iap: { label: "IAP", note: "STG 2022 neonatal jaundice (Box-1 follow-up)" },
  nnf: { label: "NNF", note: "CPG 2019 hyperbilirubinemia (monitoring/stop rules)" },
};

function guideSettings() {
  try { return (typeof DB !== "undefined" && DB && DB.settings) || {}; } catch (_) { return {}; }
}

// A mode is usable if it is the always-on status quo or validator-enabled.
function guideEnabled(module, source) {
  if (!GUIDE_SUPPORT[module] || GUIDE_SUPPORT[module].indexOf(source) < 0) return false;
  if (GUIDE_STATUS_QUO[module] === source) return true;
  const s = guideSettings();
  const en = (s && s.guideEnabled) || {};
  return !!en[module + "_" + source];
}

// Pre-gate candidate: what the settings ask for (for "pending sign-off" badges).
function guideRequested(module) {
  if (!GUIDE_SUPPORT[module]) return null;
  const s = guideSettings();
  const ov = s[GUIDE_MODULE_KEY[module]];
  if (ov && ov !== "auto" && GUIDE_SUPPORT[module].indexOf(ov) >= 0) return ov;
  const g = s.guideSource || GUIDE_GLOBAL_DEFAULT;
  if (GUIDE_GLOBAL_CHOICES.indexOf(g) >= 0 && GUIDE_SUPPORT[module].indexOf(g) >= 0) return g;
  return GUIDE_STATUS_QUO[module];
}

// Post-gate effective source: what the engine may use. Unknown/gated -> status quo.
function guideEffective(module) {
  const req = guideRequested(module);
  if (!req) return null;
  return guideEnabled(module, req) ? req : GUIDE_STATUS_QUO[module];
}

// Non-null when settings request a mode the validator has not enabled yet.
function guidePending(module) {
  const req = guideRequested(module);
  if (!req) return null;
  return req !== guideEffective(module) ? req : null;
}

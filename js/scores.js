/* NeoKid Care — scoring-tool framework + newborn-size engine (Phase 1 infra).
   Scores.register({id,title,inputs,calc,source}) · Scores.run(id, values).
   Every result carries inputs + source + screening notice (ground rule 5).
   SGA engine: INTERGROWTH-21st day-level z-tables (data/intergrowth.json). */
function scorePhi(z) {
  // Standard normal CDF (Abramowitz-Stegun 7.1.26, |err| < 7.5e-8).
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  p = 1 - p;
  return z > 0 ? p : 1 - p;
}
function scoreZFromRow(row, x) {
  // row = measurement values at z = -3..+3. Piecewise-linear; linear
  // extrapolation beyond ±3 (flagged capped) so extremes still classify.
  const Z = [-3, -2, -1, 0, 1, 2, 3];
  if (!row || row.length !== 7 || !(x > 0)) return { ok: false };
  if (x <= row[0]) { const s = row[1] - row[0]; return { ok: true, z: -3 + (x - row[0]) / (s || 1), capped: x < row[0] }; }
  if (x >= row[6]) { const s = row[6] - row[5]; return { ok: true, z: 3 + (x - row[6]) / (s || 1), capped: x > row[6] }; }
  for (let i = 0; i < 6; i++) {
    if (x <= row[i + 1]) {
      const f = (x - row[i]) / ((row[i + 1] - row[i]) || 1);
      return { ok: true, z: Z[i] + f, capped: false };
    }
  }
  return { ok: false };
}
function scoreParseGA(g) {
  // "38+2", "38w2d", "38 weeks", "38.5", 38 → completed-days or null.
  if (g == null || g === "") return null;
  if (typeof g === "number") return Number.isFinite(g) && g > 0 && g < 60 ? Math.round(g * 7) : null;
  const s = String(g).trim();
  let m = s.match(/(\d+)\s*\+\s*(\d)/);
  if (m) return parseInt(m[1], 10) * 7 + parseInt(m[2], 10);
  m = s.match(/(\d+)\s*[wW]\s*(\d)?/);
  if (m) return parseInt(m[1], 10) * 7 + (m[2] ? parseInt(m[2], 10) : 0);
  m = s.match(/(\d+(?:\.\d+)?)/);
  if (m) { const w = parseFloat(m[1]); return w > 0 && w < 60 ? Math.round(w * 7) : null; }
  return null;
}
function igRow(measure, sexKey, gaDays) {
  try {
    const T = (typeof KGCONTENT !== "undefined" && KGCONTENT && KGCONTENT.intergrowth) || null;
    const rows = T && T.tables && T.tables[measure] && T.tables[measure][sexKey];
    const r = rows && rows[String(gaDays)];
    return (r && r.length === 7) ? r : null;
  } catch (e) { return null; }
}
const IG_RANGE = { min: 168, max: 300, label: "24+0–42+6 weeks" }; // 24+0 to 42+6
function igBand(pct) {
  if (!(pct >= 0)) return { band: "unknown", label: "—" };
  if (pct < 3) return { band: "sga-severe", label: "SGA (severe, <3rd)" };
  if (pct < 10) return { band: "sga", label: "SGA (3rd–<10th)" };
  if (pct > 97) return { band: "lga-severe", label: "LGA (severe, >97th)" };
  if (pct > 90) return { band: "lga", label: "LGA (>90th–97th)" };
  return { band: "aga", label: "AGA (10th–90th)" };
}
function newbornSize(o) {
  // o: {ga (any parseable form), sex: boy|girl|..., bwKg, lenCm?, hcCm?}
  o = o || {};
  const gaDays = scoreParseGA(o.ga);
  if (gaDays == null) return { ok: false, reason: "Need gestation to classify size." };
  if (gaDays < IG_RANGE.min || gaDays > IG_RANGE.max) return { ok: false, reason: `Gestation ${Math.floor(gaDays / 7)}+${gaDays % 7} is outside ${IG_RANGE.label} — use official charts.`, gaDays };
  if (!(o.bwKg > 0)) return { ok: false, reason: "Need birth weight to classify size.", gaDays };
  const sexes = (o.sex === "boy" || o.sex === "girl") ? [o.sex + "s"] : ["boys", "girls"];
  const per = sexes.map((sk) => {
    const r = { sex: sk };
    const w = scoreZFromRow(igRow("bw", sk, gaDays), o.bwKg);
    if (!w.ok) { r.ok = false; return r; }
    r.ok = true; r.zW = Math.round(w.z * 100) / 100; r.pctW = Math.round(scorePhi(w.z) * 1000) / 10; r.cappedW = !!w.capped;
    Object.assign(r, igBand(r.pctW));
    for (const [mk, val, pk, zk] of [["lt", o.lenCm, "pctL", "zL"], ["hc", o.hcCm, "pctH", "zH"]]) {
      if (val > 0) {
        const m = scoreZFromRow(igRow(mk, sk, gaDays), val);
        if (m.ok) { r[zk] = Math.round(m.z * 100) / 100; r[pk] = Math.round(scorePhi(m.z) * 1000) / 10; }
      }
    }
    return r;
  }).filter((r) => r.ok);
  if (!per.length) return { ok: false, reason: "Reference row missing.", gaDays };
  const out = { ok: true, gaDays, ga: `${Math.floor(gaDays / 7)}+${gaDays % 7}`, system: "INTERGROWTH-21st newborn size", notice: "Screening aid — clinical judgement prevails" };
  if (per.length === 1) return Object.assign(out, per[0], { sexKnown: true });
  out.sexKnown = false;
  out.boys = per[0].sex === "boys" ? per[0] : per[1];
  out.girls = per[0].sex === "girls" ? per[0] : per[1];
  out.note = out.boys.band === out.girls.band ? `Both sexes: ${out.boys.label}` : "Band depends on sex — record sex to classify.";
  if (out.boys.band === out.girls.band) Object.assign(out, { band: out.boys.band, label: out.boys.label, pctW: null });
  return out;
}
const SCORE_REG = {};
function registerScore(def) { if (def && def.id && typeof def.calc === "function") SCORE_REG[def.id] = def; return def && def.id; }
function runScore(id, values) {
  const d = SCORE_REG[id];
  if (!d) return { ok: false, reason: "Unknown score: " + id };
  try {
    const r = d.calc(values || {});
    r.inputs = values || {}; r.score = id; r.source = d.source || "";
    if (!r.notice) r.notice = "Screening aid — clinical judgement prevails";
    return r;
  } catch (e) { return { ok: false, reason: "Calculator error." }; }
}
registerScore({ id: "sga", title: "Size for gestational age (INTERGROWTH-21st)", source: "Villar et al, Lancet 2014 + 2016 (see data/intergrowth.json)", calc: newbornSize });
// Newborn-module calculators (defined in js/nb.js, loaded before this file)
// join the registry so every score carries inputs + source + screening notice.
try {
  if (typeof apgarTotal === "function") registerScore({ id: "apgar", title: "APGAR score", source: "Apgar V. Anesth Analg 1953 (criteria unchanged)", calc: (vals) => { const r = apgarTotal((vals && vals.scores) || []); return { ok: r.total !== null, total: r.total, interp: r.interp }; } });
  if (typeof ballardGA === "function") registerScore({ id: "ballard", title: "New Ballard Score (maturity)", source: "Ballard et al, J Pediatr 1991", calc: (vals) => { const r = ballardGA((vals && vals.scores) || {}); return { ok: !!r.complete, total: r.total, weeks: Math.round(r.weeks * 10) / 10, label: r.label }; } });
} catch (e) {}
var Scores = { register: registerScore, run: runScore, list: () => Object.keys(SCORE_REG), phi: scorePhi, zFromRow: scoreZFromRow, parseGAweeks: scoreParseGA, newbornSize, IG_RANGE };
try { if (typeof window !== "undefined" && window) window.Scores = Scores; } catch (e) {}

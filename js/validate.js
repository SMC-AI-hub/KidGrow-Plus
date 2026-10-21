/* NeoKid Care — central validators (F15, v10.44).
   Hard ranges reject the physiologically impossible; soft bands warn on the
   unusual. Every clinical save should route numeric entry through V.
   Ranges are plausibility guards, NOT clinical targets — targets live in the
   PENDING packs and need clinician sign-off (F1) before real-world use. */
var V = (function () {
  var R = {
    wt:   { label: "Weight", unit: "kg", min: 0.3, max: 200, warnLo: 0.5, warnHi: 150 },
    wtG:  { label: "Weight", unit: "g", min: 300, max: 15000 },
    ht:   { label: "Length/height", unit: "cm", min: 20, max: 230 },
    hc:   { label: "Head circumference", unit: "cm", min: 20, max: 70 },
    muac: { label: "MUAC", unit: "cm", min: 5, max: 40 },
    temp: { label: "Temperature", unit: "°C", min: 30, max: 45, warnLo: 35, warnHi: 41 },
    hr:   { label: "Heart rate", unit: "/min", min: 30, max: 250 },
    rr:   { label: "Resp. rate", unit: "/min", min: 8, max: 120 },
    spo2: { label: "SpO₂", unit: "%", min: 50, max: 100, warnLo: 90 },
    sys:  { label: "Systolic BP", unit: "mmHg", min: 40, max: 250 },
    dia:  { label: "Diastolic BP", unit: "mmHg", min: 20, max: 150 },
  };
  function num(x) { const n = Number(x); return (typeof n === "number" && isFinite(n)) ? n : NaN; }
  function check(field, value) {
    const r = R[field];
    if (!r) return { ok: true };
    if (value === "" || value === null || value === undefined) return { ok: true, empty: true };
    const n = num(value);
    if (isNaN(n)) return { ok: false, why: r.label + " must be a number." };
    if (n < r.min || n > r.max) return { ok: false, why: r.label + " looks wrong (expected " + r.min + "–" + r.max + " " + r.unit + ")." };
    let warn = "";
    if (r.warnLo !== undefined && n < r.warnLo) warn = r.label + " " + n + " " + r.unit + " is unusually low — double-check.";
    if (r.warnHi !== undefined && n > r.warnHi) warn = r.label + " " + n + " " + r.unit + " is unusually high — double-check.";
    return { ok: true, warn };
  }
  const VITMAP = { t: "temp", temp: "temp", hr: "hr", rr: "rr", spo2: "spo2", sys: "sys", dia: "dia" };
  function checkVitals(v) {
    const bad = [], warns = [];
    v = v || {};
    Object.keys(VITMAP).forEach((k) => {
      if (v[k] === "" || v[k] === null || v[k] === undefined) return;
      const r = check(VITMAP[k], v[k]);
      if (!r.ok) bad.push(r.why);
      else if (r.warn) warns.push(r.warn);
    });
    return { bad, warns };
  }
  return { RANGES: R, check, checkVitals };
})();
try { if (typeof window !== "undefined") window.V = V; } catch (e) {}
try { if (typeof module !== "undefined" && module.exports) module.exports = V; } catch (e2) {}

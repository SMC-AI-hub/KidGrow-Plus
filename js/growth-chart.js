/* KidGrow Pro — growth chart renderer (canvas, offline).
   Curves sampled from EXACT WHO/CDC LMS tables; IAP 5-18 screening curves. */
const GCHART_META = {
  wfa:  { title: "Weight-for-age", unit: "kg", age: true },
  lhfa: { title: "Length / Height-for-age", unit: "cm", age: true },
  wfh:  { title: "Weight-for-length / height", unit: "kg", age: false },
  bmi:  { title: "BMI-for-age", unit: "kg/m²", age: true },
  hc:   { title: "Head circumference-for-age", unit: "cm", age: true },
  muac: { title: "MUAC-for-age", unit: "cm", age: true },
};
function refLMSFor(ind, sex, x) {
  const ref5 = DB.gRef5 || "iap";
  if (ind === "wfa" || ind === "lhfa" || ind === "bmi") {
    if (x <= 1826) return lmsAt(WHO_REF[ind === "bmi" ? "bmifa" : ind][sxB(sex)], x);
    const m = x / 30.4375;
    if (m > 241) return null;
    if (ref5 === "cdc") {
      const key = ind === "wfa" ? "wt" : ind === "lhfa" ? "ht" : "bmi";
      const T = CDC_REF[key][sxB(sex)];
      if (m < T.x[0] || m > T.x[T.x.length - 1]) return null;
      return lmsAt(T, m);
    }
    return iapLMS(sex, ind === "wfa" ? "wt" : ind === "lhfa" ? "ht" : "bmi", m);
  }
  if (ind === "hc") { if (x < 0 || x > 1826) return null; return lmsAt(WHO_REF.hcfa[sxB(sex)], x); }
  if (ind === "muac") { if (x < 91 || x > 1826) return null; return lmsAt(WHO_REF.muacfa[sxB(sex)], x); }
  return null;
}
function drawGrowthChartInto(cv, ind) {
  if (!cv || typeof WHO_REF === "undefined") return false;
  const c = child(); if (!c) return false;
  ind = ind || gInd();
  const meta = GCHART_META[ind] || GCHART_META.wfa;
  const zMode = (DB.gLines || "pct") === "z";
  const isMain = cv.id === "gChart";
  if (isMain) {
    document.querySelectorAll("#growthTabs button").forEach((x) => x.classList.toggle("active", x.dataset.g === ind));
    document.querySelectorAll("#gLineTabs button").forEach((x) => x.classList.toggle("active", x.dataset.gl === (zMode ? "z" : "pct")));
    document.querySelectorAll("#gRefTabs button").forEach((x) => x.classList.toggle("active", x.dataset.gr === (DB.gRef5 || "iap")));
  }

  // ---- collect points ----
  const pts = [];
  allMeasures(c).forEach((m) => {
    const ga = growthAge(c, m.date);
    const aD = ga.useCorr ? ga.corrD : ga.chronoD;
    if (ind === "wfh") {
      if (m.wt && m.ht) { const L = resolveLenHei(c, m, ga); pts.push({ x: L.value, v: m.wt, birth: !!m.birth, sq: L.measured === "height", date: m.date }); }
      return;
    }
    if (ga.corrNeg) return; // below term-equivalent: not plotted on age charts
    const L = (ind === "lhfa") ? resolveLenHei(c, m, ga) : null;
    const v = ind === "wfa" ? m.wt : ind === "lhfa" ? (L && L.value) : ind === "bmi" ? m.bmi : ind === "hc" ? m.hc : m.muac;
    if (v > 0) pts.push({ x: aD, v, birth: !!m.birth, date: m.date });
  });

  // ---- x range ----
  let x0, x1, xIsDays = meta.age;
  if (!meta.age) {
    const xs = pts.map((p) => p.x);
    const lo = xs.length ? Math.min(...xs) : 60, hi = xs.length ? Math.max(...xs) : 90;
    x0 = Math.min(45, Math.floor(lo - 2)); x1 = Math.max(80, Math.ceil(hi + 2));
    x1 = Math.min(x1, 135);
  } else {
    const gaNow = growthAge(c, todayISO());
    const nowD = gaNow.useCorr ? gaNow.corrD : gaNow.chronoD;
    const maxP = pts.length ? Math.max(...pts.map((p) => p.x)) : 0;
    let need = Math.max(nowD, maxP);
    if (ind === "hc" || ind === "muac") need = Math.min(need, 2100);
    if (DB.gFull && ind !== "hc" && ind !== "muac") { x0 = 0; x1 = 6575; }
    else if (need <= 800) { x0 = 0; x1 = 731; }
    else if (need <= 1920) { x0 = 0; x1 = 1826; }
    else { x0 = 1460; x1 = Math.min(6575, Math.ceil((need + 200) / 365.25) * 365.25); }
    if ((ind === "hc" || ind === "muac") && x1 > 2100) x1 = 2100;
  }

  // ---- reference lines ----
  const lines = zMode
    ? [{ z: -3, l: "−3 SD" }, { z: -2, l: "−2 SD" }, { z: -1, l: "−1 SD" }, { z: 0, l: "Median" }, { z: 1, l: "+1 SD" }, { z: 2, l: "+2 SD" }, { z: 3, l: "+3 SD" }]
    : [3, 10, 25, 50, 75, 90, 97].map((p) => ({ z: invPhi(p / 100), l: "P" + p }));
  const lineColor = (l) => l === "Median" || l === "P50" ? "#0d9488" : /P25|P75|−1 SD|\+1 SD/.test(l) ? "#7aa7e8" : /P10|P90|−2 SD|\+2 SD/.test(l) ? "#f59e0b" : "#ef7d7d";

  // sample curves
  const N = 150, curves = lines.map(() => []);
  if (meta.age) {
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const r = refLMSFor(ind, c.sex, x);
      lines.forEach((ln, k) => curves[k].push(r ? { x, v: lmsVal(r.M, r.S, r.L, ln.z) } : null));
    }
  } else {
    // weight-for-length (45-110) + weight-for-height (65-120)
    for (let i = 0; i <= N; i++) {
      const x = x0 + ((x1 - x0) * i) / N;
      const T = WHO_REF;
      const pick = (x >= 65 && x <= 120 && x > 110) ? T.wfh[sxB(c.sex)] : (x >= 45 && x <= 110 ? (x < 65 ? T.wfl[sxB(c.sex)] : null) : null);
      // overlap 65-110: draw length-based set (primary); height set drawn separately below
      const r = pick ? lmsAt(pick, x) : (x >= 65 && x <= 110 ? lmsAt(T.wfl[sxB(c.sex)], x) : null);
      lines.forEach((ln, k) => curves[k].push(r ? { x, v: lmsVal(r.M, r.S, r.L, ln.z) } : null));
    }
  }

  // ---- y range ----
  let lo = Infinity, hi = -Infinity;
  curves.forEach((cs) => cs.forEach((p) => { if (p && isFinite(p.v)) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); } }));
  pts.forEach((p) => { if (p.x >= x0 && p.x <= x1) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); } });
  if (!isFinite(lo)) { lo = 0; hi = 10; }
  // extras affecting range: IAP BMI lines, MPH band
  let iapLines = null, cdcBMI = null, mph = null;
  if (ind === "bmi" && meta.age && x1 > 1826) {
    iapLines = [];
    const IL = IAP_BMI_LINES[c.sex], a0 = Math.max(60, x0 / 30.4375), a1 = Math.min(216, x1 / 30.4375);
    for (let m = a0; m <= a1; m += 2) iapLines.push({ x: m * 30.4375, ov: interp(IL.ages, IL.ov, m), ob: interp(IL.ages, IL.ob, m), uw: interp(IL.ages, IL.uw, m) });
    iapLines.forEach((o) => { hi = Math.max(hi, o.ob); lo = Math.min(lo, o.uw); });
  }
  if (ind === "bmi" && meta.age && (DB.gRef5 || "iap") === "cdc" && x1 > 731) {
    cdcBMI = [];
    for (let m = Math.max(24, x0 / 30.4375); m <= Math.min(240, x1 / 30.4375); m += 2) {
      const r = lmsAt(CDC_REF.bmi[sxB(c.sex)], m);
      cdcBMI.push({ x: m * 30.4375, p85: lmsVal(r.M, r.S, r.L, 1.0364), p95: lmsVal(r.M, r.S, r.L, 1.6449) });
    }
    cdcBMI.forEach((o) => { hi = Math.max(hi, o.p95); });
  }
  if (ind === "lhfa") { mph = mphTarget(c); if (mph) { hi = Math.max(hi, mph.hi); lo = Math.min(lo, mph.lo); } }
  const span = (hi - lo) || 1; lo -= span * 0.07; hi += span * 0.13;

  // ---- draw ----
  const PR = !!cv._kgPrint; // print trial: hi-res + bolder render for paper
  const FF = (st, w) => (w ? w + " " : "") + (PR ? Math.round(st * 1.12) : st) + "px 'Segoe UI',sans-serif";
  const dpr = (window.devicePixelRatio || 1) * (PR ? 2.5 : 1), W = 900, H = 360;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext("2d"); ctx.scale(dpr, dpr);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  const pL = 54, pR = 16, pT = 14, pB = 36;
  const X = (x) => pL + ((x - x0) / (x1 - x0)) * (W - pL - pR);
  const Y = (v) => pT + (1 - (v - lo) / (hi - lo)) * (H - pT - pB);
  ctx.font = FF(11); ctx.lineWidth = PR ? 1.5 : 1;
  // grid
  ctx.strokeStyle = PR ? "#d9e1ea" : "#edf1f6"; ctx.fillStyle = PR ? "#54637a" : "#8a99ad";
  for (let i = 0; i <= 7; i++) {
    const v = lo + ((hi - lo) * i) / 7;
    ctx.beginPath(); ctx.moveTo(pL, Y(v)); ctx.lineTo(W - pR, Y(v)); ctx.stroke();
    ctx.fillText(v.toFixed(1) + (i === 7 ? " " + meta.unit : ""), 4, Y(v) + 4);
  }
  const xStep = !meta.age ? (x1 - x0 > 50 ? 10 : 5) : (x1 - x0) <= 800 ? 91.3 : (x1 - x0) <= 2000 ? 182.6 : 365.25;
  const xFmt = (x) => !meta.age ? x.toFixed(0) : (x1 - x0) <= 800 ? Math.round(x / 30.4375) + "m" : (x / 365.25).toFixed(x / 365.25 < 10 ? 1 : 0) + "y";
  for (let x = Math.ceil(x0 / xStep) * xStep; x <= x1 + 0.01; x += xStep) {
    ctx.fillText(xFmt(x), X(x) - 12, H - 14);
    ctx.beginPath(); ctx.moveTo(X(x), pT); ctx.lineTo(X(x), H - pB); ctx.stroke();
  }
  ctx.fillStyle = PR ? "#475569" : "#64748b";
  ctx.fillText(!meta.age ? "length / height (cm)" : "age", pL, H - 2);
  // junction marker 5y
  if (meta.age && x0 < 1826 && x1 > 1826 && ind !== "hc" && ind !== "muac") {
    ctx.strokeStyle = "#b6c2d1"; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(X(1826), pT); ctx.lineTo(X(1826), H - pB); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = PR ? "#475569" : "#64748b"; ctx.fillText("5y: WHO → " + ((DB.gRef5 || "iap") === "cdc" ? "CDC" : "IAP"), X(1826) + 5, pT + 12);
  }
  if (meta.age && (ind === "hc" || ind === "muac") && x1 > 1826) {
    ctx.strokeStyle = "#b6c2d1"; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(X(1826), pT); ctx.lineTo(X(1826), H - pB); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = PR ? "#475569" : "#64748b"; ctx.fillText("reference to 5y", X(1826) + 5, pT + 12);
  }
  // MPH band
  if (mph && ind === "lhfa") {
    ctx.fillStyle = "rgba(139,92,246,.08)";
    ctx.fillRect(pL, Y(mph.hi), W - pL - pR, Y(mph.lo) - Y(mph.hi));
    ctx.strokeStyle = "#8b5cf6"; ctx.setLineDash([6, 4]); ctx.lineWidth = PR ? 2 : 1.5;
    ctx.beginPath(); ctx.moveTo(pL, Y(mph.mph)); ctx.lineTo(W - pR, Y(mph.mph)); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#8b5cf6"; ctx.font = FF(10, "bold"); ctx.fillText(`MPH ${mph.mph.toFixed(0)}cm`, W - pR - 78, Y(mph.mph) - 5);
    ctx.font = FF(11);
  }
  // curves
  curves.forEach((cs, k) => {
    ctx.strokeStyle = lineColor(lines[k].l); ctx.lineWidth = (lines[k].l === "Median" || lines[k].l === "P50") ? (PR ? 3.4 : 2.6) : (PR ? 1.9 : 1.3);
    ctx.beginPath(); let pen = false;
    cs.forEach((p) => {
      if (!p || !isFinite(p.v)) { pen = false; return; }
      if (!pen) { ctx.moveTo(X(p.x), Y(p.v)); pen = true; } else ctx.lineTo(X(p.x), Y(p.v));
    });
    ctx.stroke();
    const last = [...cs].reverse().find((p) => p && isFinite(p.v));
    if (last) { ctx.fillStyle = lineColor(lines[k].l); ctx.font = FF(10, "bold"); ctx.fillText(lines[k].l, Math.min(X(last.x) - 24, W - 46), Y(last.v) - 5); ctx.font = FF(11); }
  });
  // wfh: height-based set (dashed, 65-120)
  if (!meta.age) {
    const T = WHO_REF.wfh[sxB(c.sex)];
    [3, 50, 97].forEach((p) => {
      const z = zMode ? (p === 3 ? -2 : p === 50 ? 0 : 2) : invPhi(p / 100);
      ctx.strokeStyle = p === 50 ? "#0d9488" : "#b6c2d1"; ctx.lineWidth = p === 50 ? (PR ? 2.2 : 1.6) : (PR ? 1.5 : 1.1); ctx.setLineDash([5, 4]);
      ctx.beginPath();
      for (let x = Math.max(65, x0); x <= Math.min(120, x1); x += 1) {
        const r = lmsAt(T, x), v = lmsVal(r.M, r.S, r.L, z);
        const px = X(x), py = Y(v);
        if (x === Math.max(65, x0)) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.fillStyle = PR ? "#475569" : "#64748b"; ctx.font = FF(10); ctx.fillText("solid = length-based · dashed = height-based", pL + 6, pT + 12);
    ctx.font = FF(11);
  }
  if (iapLines && iapLines.length) {
    const draw = (key, col, lbl) => {
      ctx.strokeStyle = col; ctx.lineWidth = PR ? 2.6 : 2; ctx.setLineDash([8, 4]); ctx.beginPath();
      iapLines.forEach((o, i) => (i ? ctx.lineTo(X(o.x), Y(o[key])) : ctx.moveTo(X(o.x), Y(o[key]))));
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.font = FF(10, "bold");
      ctx.fillText(lbl, X(iapLines[iapLines.length-1].x) - 64, Y(iapLines[iapLines.length-1][key]) - 6);
      ctx.font = FF(11);
    };
    draw("ob", "#dc2626", "IAP Obese"); draw("ov", "#d97706", "IAP Overwt"); draw("uw", "#8b5cf6", "IAP Underwt");
  }
  if (cdcBMI && cdcBMI.length) {
    ["p85", "p95"].forEach((key) => {
      ctx.strokeStyle = key === "p95" ? "#dc2626" : "#d97706"; ctx.lineWidth = PR ? 2.1 : 1.6; ctx.setLineDash([3, 3]); ctx.beginPath();
      cdcBMI.forEach((o, i) => (i ? ctx.lineTo(X(o.x), Y(o[key])) : ctx.moveTo(X(o.x), Y(o[key]))));
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = FF(10, "bold");
      ctx.fillText(key === "p95" ? "CDC P95" : "CDC P85", X(cdcBMI[cdcBMI.length-1].x) - 56, Y(cdcBMI[cdcBMI.length-1][key]) + 12);
      ctx.font = FF(11);
    });
  }
  // points
  const vis = pts.filter((p) => p.x >= x0 - (x1 - x0) * 0.01 && p.x <= x1 + (x1 - x0) * 0.01);
  if (vis.length) {
    const srt = [...vis].sort((a, b) => a.x - b.x);
    ctx.strokeStyle = "#0f2b4d"; ctx.lineWidth = PR ? 2.8 : 2.2; ctx.beginPath();
    srt.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.v)) : ctx.moveTo(X(p.x), Y(p.v)))); ctx.stroke();
    srt.forEach((p, i) => {
      const last = i === srt.length - 1;
      if (p.sq) {
        ctx.fillStyle = last ? "#dc2626" : "#0f2b4d";
        const _qs = PR ? 5 : 4; ctx.fillRect(X(p.x) - _qs, Y(p.v) - _qs, _qs * 2, _qs * 2);
      } else {
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.v), last ? (PR ? 7 : 6) : p.birth ? (PR ? 6 : 5) : (PR ? 5 : 4), 0, 7);
        if (p.birth && !last) { ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = PR ? 3 : 2.5; ctx.strokeStyle = "#7c3aed"; ctx.stroke(); }
        else { ctx.fillStyle = last ? "#dc2626" : "#0f2b4d"; ctx.fill(); }
      }
      if (last || srt.length <= 9) {
        ctx.fillStyle = "#0f2b4d"; ctx.font = FF(10, "bold");
        ctx.fillText(String(Math.round(p.v * 10) / 10) + (p.birth ? " (B)" : ""), X(p.x) + 7, Y(p.v) - 7);
        ctx.font = FF(11);
      }
    });
  } else {
    ctx.fillStyle = PR ? "#64748b" : "#94a3b8"; ctx.font = FF(14);
    ctx.fillText("No plotted points in this range.", pL + 20, H / 2);
  }
  if (!isMain) return true;
  // titles
  const gaNow = growthAge(c, todayISO());
  const refTxt = !meta.age ? "WHO (length 45–110 · height 65–120)"
    : ind === "hc" || ind === "muac" ? "WHO 0–5 y" + (x1 > 1826 ? " (no curves beyond 5 y)" : "")
    : x1 <= 1826 ? "WHO 0–5 y (exact daily LMS)" : x0 >= 1826 ? ((DB.gRef5 || "iap") === "cdc" ? "CDC 2000 (exact)" : "IAP 2015-aligned (screening)") : "WHO → " + ((DB.gRef5 || "iap") === "cdc" ? "CDC" : "IAP");
  $("gChartTitle").textContent = `${meta.title} — ${c.name}`;
  $("gChartHint").textContent = `${refTxt} · ${c.sex === "boy" ? "Boys" : "Girls"} · ${zMode ? "Z-score lines" : "Percentile lines"} · ${vis.length} point(s)` +
    (gaNow.useCorr ? " · CORRECTED age (preterm)" : "") + (meta.age && ind === "lhfa" ? " · 0.7 cm WHO rule applied" : "") + (!meta.age ? " · ○ length ●/■ standing" : "");
  $("gLegend").innerHTML = `<span><span class="dot" style="background:#0d9488"></span>Median</span>
    <span><span class="dot" style="background:#7aa7e8"></span>${zMode ? "±1 SD" : "P25 / P75"}</span>
    <span><span class="dot" style="background:#f59e0b"></span>${zMode ? "±2 SD" : "P10 / P90"}</span>
    <span><span class="dot" style="background:#ef7d7d"></span>${zMode ? "±3 SD" : "P3 / P97"}</span>
    <span><span class="dot" style="background:#0f2b4d"></span>${esc(c.name)}</span>
    <span><span class="dot" style="background:#fff;border:2px solid #7c3aed"></span>Birth</span>
    ${ind === "bmi" && x1 > 1826 ? `<span><span class="dot" style="background:#d97706"></span>IAP overwt</span><span><span class="dot" style="background:#dc2626"></span>IAP obese</span>` : ""}
    ${ind === "lhfa" && mph ? `<span><span class="dot" style="background:#8b5cf6"></span>MPH band</span>` : ""}`;
}

/* ---------------- multi-chart: overview + full report ---------------- */
function drawGrowthChart() {
  const cv = $("gChart");
  if (!cv || !$("pg-growth").classList.contains("active")) return;
  drawGrowthChartInto(cv, gInd());
}
const GCHART_ORDER = ["wfa", "lhfa", "wfh", "bmi", "hc", "muac"];
function renderGrowthOverview() {
  const box = $("gs-overview"); if (!box) return;
  const c = child(); if (!c) { box.innerHTML = `<div class="empty">No child selected.</div>`; return; }
  box.innerHTML = `<div class="toolbar no-print"><span style="font-size:13px;color:var(--muted)">All six parameters · ${esc(c.name)} · ${(DB.gLines || "pct") === "z" ? "Z-score lines" : "Percentile lines"}</span>
    <span class="sp"></span><button class="btn btn-o btn-sm" onclick="printGrowthFull()">🖨️ Full growth report</button></div>
    <div class="grid g2">${GCHART_ORDER.map((ind) => `<div class="card"><h3>${GCHART_META[ind].title}</h3>
      <canvas class="chart mini" id="gAll-${ind}" width="900" height="360"></canvas></div>`).join("")}</div>`;
  GCHART_ORDER.forEach((ind) => drawGrowthChartInto(document.getElementById("gAll-" + ind), ind));
}
function growthChartImg(ind) {
  try {
    const cv = document.createElement("canvas");
    cv._kgPrint = true; // print trial render
    if (!drawGrowthChartInto(cv, ind)) return "";
    return cv.toDataURL("image/png");
  } catch (e) { return ""; }
}
/* ---------------- comprehensive report builders (pure) ---------------- */
function assessRowFor(A, ind) {
  const rows = (A && A.rows) || [];
  const keys = { wfa: ["WAZ", "WAZ5"], lhfa: ["HAZ", "HAZ5"], wfh: ["WHZ"], bmi: ["BMIZ", "BMIZ5"], hc: ["HCAZ"], muac: ["MUAC"] }[ind] || [];
  return rows.find((r) => keys.includes(r.key)) || null;
}
function assessCaptionFor(A, ind) {
  const r = assessRowFor(A, ind);
  if (!r) return "";
  return `Latest ${esc(r.value)} · P${fmtPct(r.pct)} · z ${zStr(r.z)} · ${esc(r.grade)}`;
}
function growthHistoryHTML(c, rows) {
  const trs = (rows || []).map((m, i, arr) => {
    const tag = `${i === 0 ? "first" : ""}${i === arr.length - 1 ? `${i === 0 ? " + " : ""}latest` : ""}${m.edema ? ` · oedema ${m.edema}` : ""}`;
    return `<tr><td>${fmtDate(m.date)}<br><span style="font-size:11px;color:var(--muted)">${ageStr(ageBetween(c.dob, m.date))}${tag ? ` · ${tag}` : ""}</span></td>` +
      `<td>${m.wt ?? "—"}</td><td>${m.ht ?? "—"}</td><td>${m.bmi ?? "—"}</td><td>${m.hc ?? "—"}</td><td>${m.muac ?? "—"}</td></tr>`;
  }).join("");
  return `<div style="margin-top:14px"><h3>Measurement history (${(rows || []).length})</h3>` +
    `<div style="overflow:auto"><table class="tbl"><tr><th>Date · age</th><th>Wt (kg)</th><th>Ht (cm)</th><th>BMI</th><th>HC (cm)</th><th>MUAC (cm)</th></tr>${trs}</table></div></div>`;
}
function growthVelocityRows(c, rows) {
  // Pure per-interval velocity using the same norms as the Velocity tab.
  const out = [], rs = (rows || []).filter((r) => r.wt && r.ht);
  for (let i = 1; i < rs.length; i++) {
    const a = rs[i - 1], b = rs[i];
    const days = Math.max(1, Math.round((new Date(b.date) - new Date(a.date)) / 86400000));
    const gaA = growthAge(c, a.date), gaB = growthAge(c, b.date);
    const dA = gaA.useCorr ? gaA.corrD : gaA.chronoD, dB = gaB.useCorr ? gaB.corrD : gaB.chronoD;
    const mid = (dA + dB) / 2, N = VEL_NORMS.find((n) => mid <= n.maxD) || VEL_NORMS[VEL_NORMS.length - 1];
    const gpd = ((b.wt - a.wt) * 1000) / days;
    const cpy = ((b.ht - a.ht) / days) * 365.25;
    const hcpm = (a.hc && b.hc) ? ((b.hc - a.hc) / days) * 30.4375 : null;
    out.push({
      a: a.date, b: b.date, days, mid, label: N.label, corr: gaA.useCorr || gaB.useCorr,
      gpd, cpy, hcpm, N,
      vw: velVerdict(gpd, N.wt[0], N.wt[1]), vh: velVerdict(cpy, N.ht[0], N.ht[1]),
      vhc: N.hc ? velVerdict(hcpm, N.hc[0], N.hc[1]) : null,
    });
  }
  return out;
}
function growthVelocityHTML(c, rows) {
  const ivs = growthVelocityRows(c, rows);
  if (!ivs.length) return `<div style="margin-top:14px"><h3>Growth velocity</h3><div class="empty">Need at least 2 measurements with weight + length/height for velocity.</div></div>`;
  const badge = (v) => `<span class="badge ${v.s === "red" ? "b-red" : v.s === "amber" ? "b-amber" : v.s === "gray" ? "b-gray" : "b-green"}">${esc(v.t)}</span>`;
  const trs = ivs.map((v) => {
    let extra = "";
    if (v.mid > 1460 && v.cpy < 4 && v.cpy >= 0) extra = `<br><span class="badge b-red">Ht vel &lt;4 cm/y after 4 y — evaluate</span>`;
    if (v.gpd < 0) extra += `<br><span class="badge b-red">Weight loss — urgent review</span>`;
    return `<tr><td>${fmtDate(v.a)} → ${fmtDate(v.b)}<br><span style="font-size:11px;color:var(--muted)">${v.days} d · ~${esc(v.label)}${v.corr ? " · corr" : ""}</span></td>` +
      `<td><b>${v.gpd.toFixed(1)} g/d</b><br><span style="font-size:11.5px;color:var(--muted)">exp ${v.N.wt[0]}–${v.N.wt[1]}</span><br>${badge(v.vw)}</td>` +
      `<td><b>${v.cpy.toFixed(1)} cm/y</b><br><span style="font-size:11.5px;color:var(--muted)">exp ${v.N.ht[0]}–${v.N.ht[1]}</span><br>${badge(v.vh)}${extra}</td>` +
      `<td>${v.hcpm == null ? "—" : `<b>${v.hcpm.toFixed(2)} cm/mo</b>`}${v.N.hc && v.vhc ? `<br><span style="font-size:11.5px;color:var(--muted)">exp ${v.N.hc[0]}–${v.N.hc[1]}</span><br>${badge(v.vhc)}` : `<br><span style="font-size:11.5px;color:var(--muted)">track curve</span>`}</td></tr>`;
  }).join("");
  return `<div style="margin-top:14px"><h3>Growth velocity between visits</h3>` +
    `<div class="hint">Expected ranges: standard paediatric norms. Short intervals (&lt;2–3 mo) exaggerate error — interpret with centile trends. Preterm uses corrected age.</div>` +
    `<div style="overflow:auto"><table class="tbl"><tr><th>Interval</th><th>Weight gain</th><th>Height velocity</th><th>Head growth</th></tr>${trs}</table></div></div>`;
}
function growthPubertyHTML(c) {
  const mph = mphTarget(c);
  const mphLine = mph
    ? `<p><b>Mid-parental (target) height:</b> ${mph.mph.toFixed(1)} cm <span style="color:var(--muted)">(range ${mph.lo.toFixed(1)}–${mph.hi.toFixed(1)} cm)</span></p>`
    : `<p style="color:var(--muted)">Parental heights not recorded — enter them on Overview for a target-height range.</p>`;
  const ts = ((c.tanner) || []).slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const t = ts[ts.length - 1];
  if (!t) return `<div style="margin-top:14px"><h3>Puberty & predicted height</h3>${mphLine}<p style="color:var(--muted)">No Tanner staging recorded yet — stage annually from 8 y.</p></div>`;
  const gonLbl = c.sex === "boy" ? (TANNER_G[(t.g || 1) - 1] || `G${t.g}`) : (TANNER_B[(t.b || 1) - 1] || `B${t.b}`);
  const ti = tannerInterpret(c, t);
  const tvLine = c.sex === "boy" && (t.tvL || t.tvR) ? `<br>Testicular vol: L ${esc(t.tvL || "—")} mL · R ${esc(t.tvR || "—")} mL` : "";
  const menLine = c.sex === "girl" && t.menarche ? `<br>Menarche: ${fmtDate(t.menarche)}` : "";
  return `<div style="margin-top:14px"><h3>Puberty & predicted height</h3>${mphLine}` +
    `<p><b>Latest Tanner (${fmtDate(t.date)}):</b> ${esc(gonLbl)} · ${esc(TANNER_PH[(t.ph || 1) - 1] || `PH${t.ph}`)}${tvLine}${menLine}${t.note ? `<br>Note: ${esc(t.note)}` : ""}</p>` +
    `<div class="alert ${ti.sev === "red" ? "a-red" : ti.sev === "amber" ? "a-amber" : "a-green"}"><div><b>${esc(ti.t)}.</b> ${esc(ti.b)}</div></div></div>`;
}
function growthMethodsHTML() {
  const ref5 = (typeof DB !== "undefined" && DB.gRef5) || "iap";
  return `<div style="margin-top:14px"><h3>References & methods</h3><ul style="font-size:12.5px;color:var(--muted)">` +
    `<li><b>0–5 y:</b> WHO Child Growth Standards 2006 (MGRS), exact daily LMS interpolation (igrowup method beyond ±3 SD).</li>` +
    `<li><b>5–18 y:</b> this report used <b>${ref5 === "cdc" ? "CDC 2000 exact" : "IAP 2015-aligned screening curves"}</b> (switchable in Growth → Options). IAP BMI lines track the adult 23 (overweight) / 27 (obesity) equivalents.</li>` +
    `<li><b>Length vs height:</b> length &lt;2 y, height ≥2 y; a value measured the “wrong” way is converted with the WHO ±0.7 cm rule.</li>` +
    `<li><b>Preterm</b> (gestation &lt;37 w): corrected age used until 2 y when enabled; PMA shown alongside.</li>` +
    `<li><b>Velocity bands</b> are standard paediatric norms — short intervals (&lt;2–3 mo) exaggerate error; interpret with centile trends.</li>` +
    `<li><b>Head circumference</b> has no IAP/CDC reference beyond 5 y — it is tracked serially with neurodevelopment.</li>` +
    `<li>Screening aid — confirm treatment decisions on official printed charts or specialty software.</li></ul></div>`;
}

function printGrowthFull() {
  const c = child(); if (!c) return;
  const rows = allMeasures(c);
  if (!rows.length) return alert("No measurements to print.");
  const lm = rows[rows.length - 1], A = assessMeasure(c, lm), ga = A.ga;
  const imgs = GCHART_ORDER.map((ind) => ({ ind, img: growthChartImg(ind) }));
  const drawn = imgs.filter((x) => x.img).length;
  const chartSecArr = imgs.map(({ ind, img }) => {
    const cap = assessCaptionFor(A, ind);
    return `<div style="margin-top:0;text-align:center;break-inside:avoid">` +
      (img
        ? `<img src="${img}" style="max-width:100%;border:1px solid #cbd5e1;border-radius:8px">`
        : `<div class="empty">Chart unavailable (${esc(GCHART_META[ind].title)}).</div>`) +
      `<div style="font-size:12px;font-weight:700">${esc(GCHART_META[ind].title)}</div>` +
      (cap ? `<div style="font-size:11.5px;color:var(--muted)">${esc(cap)}</div>` : "") + `</div>`;
  });
  // print trial: two charts side by side per row (pairs kept on one page)
  let chartSecs = "";
  for (let i = 0; i < chartSecArr.length; i += 2)
    chartSecs += `<div class="gprint-pair">${chartSecArr.slice(i, i + 2).join("")}</div>`;
  $("growthFullPrint").innerHTML = `${clinicHeader()}
    <div class="doc-title">📈 COMPREHENSIVE GROWTH REPORT (IAP / WHO)</div>
    ${childHeader(c)}
    <dl class="kv" style="margin-bottom:10px"><dt>Assessment date</dt><dd>${fmtDate(lm.date)} · chrono ${ageStr(ageBetween(c.dob, lm.date))}${ga.useCorr ? " · <b>corrected age used (preterm)</b>" : ""} · PMA ${pmaStr(ga.pmaD)}</dd>
    <dt>Anthropometry</dt><dd>${lm.wt} kg · ${lm.ht} cm (${lm.pos || "auto"}) · BMI ${lm.bmi}${lm.hc ? ` · HC ${lm.hc} cm` : ""}${lm.muac ? ` · MUAC ${lm.muac} cm` : ""}${lm.edema ? ` · <b>oedema ${esc(lm.edema)}</b>` : ""}</dd></dl>
    <h3>Latest assessment — all indicators</h3>
    <table class="tbl"><thead><tr><th>Indicator</th><th>%ile</th><th>Z</th><th>Grade</th></tr></thead>
    ${A.rows.map((r) => `<tr><td><b>${esc(r.label)}</b> <span style="font-size:11px;color:var(--muted)">[${esc(r.ref)}]</span></td><td>${isFinite(r.pct) ? fmtPct(r.pct) : "—"}</td><td>${isFinite(r.z) ? zStr(r.z) : "—"}</td><td><b>${esc(r.grade)}</b></td></tr>`).join("")}</table>
    <h3 style="margin-top:14px">Growth charts (${drawn} of ${imgs.length})</h3>
    ${chartSecs}
    ${growthHistoryHTML(c, rows)}
    ${growthVelocityHTML(c, rows)}
    ${growthPubertyHTML(c)}
    ${growthMethodsHTML()}
    <h3 style="margin-top:14px">Impression & plan</h3>
    ${(A.biv || []).map((f) => `<div>⚠️ ${esc(f)}</div>`).join("")}
    ${A.triage.map((t) => `<div style="margin-bottom:6px"><b>${esc(t.title)}</b><br>${esc(t.body)}</div>`).join("") || "<div>Growing well — continue routine surveillance.</div>"}
    <div class="footer-note">Exact WHO (0–5 y) / CDC + IAP-aligned (5–18 y) references · Confirm diagnostic labels on official charts.</div>
    ${docFooter("Comprehensive growth report")}`;
  printPage("pg-growthprint");
}

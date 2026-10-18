/* NeoKid Care — professional document helpers (letterhead footer + full reports).
   Milestone model (matches app.js): c.milestones["bi_ii"] = "A"|"E"|"N"|"" ;
   MILESTONES[bi] = { band, min, max, items:[{d,t}], red:[] }. */

/* Standard letterhead footer: signatures + generated line. name = document title. */
function docFooter(name) {
  const s = (typeof DB !== "undefined" && DB.settings) || {};
  const ld = (typeof letterDoc === "function") ? letterDoc() : { name: s.doctor || "", reg: s.reg || "" };
  return `<div class="doc-foot">
    <div class="sigrow"><div>Parent / guardian signature: ______________</div>
    <div style="margin-left:auto;text-align:center">Doctor signature &amp; seal<br><br>______________<br>
    <span style="font-size:11px;color:var(--muted)">${esc(ld.name)}${ld.reg ? " · Reg: " + esc(ld.reg) : ""}</span></div></div>
    <div class="gen">${esc(name || "Document")} · Generated ${fmtDate(todayISO())} · ${esc(s.clinic || "NeoKid Care")}${(typeof Tenant !== "undefined" && Tenant._brand && Tenant._brand().name) ? " · " + esc(Tenant._brand().name) : ""} · Computer-assisted record — confirm clinical labels before filing.</div>
  </div>`;
}

function msValLabel(v) {
  return v === "A" ? "✓ Achieved" : v === "E" ? "◐ Emerging" : v === "N" ? "✗ Not yet" : "— Not marked";
}
function msBandCounts(c, bi) {
  const n = { A: 0, E: 0, N: 0, total: MILESTONES[bi].items.length };
  MILESTONES[bi].items.forEach((it, ii) => {
    const v = (c.milestones || {})[bi + "_" + ii];
    if (v === "A" || v === "E" || v === "N") n[v]++;
  });
  n.scored = n.A + n.E + n.N;
  return n;
}
/* Plain-text twin of the renderMilestones() verdict logic in app.js. */
function msBandVerdict(n, bi, curBi) {
  if (bi > curBi) return n.scored
    ? { label: "Assessed ahead", detail: "Scored before this age band — not-yet items still have time; review again when the child reaches this band." }
    : { label: "Not due yet", detail: "Still has time — expected when the child reaches this age band." };
  if (!n.scored) return { label: "Not assessed", detail: "Complete this band during the visit." };
  if (n.N >= 2 || (bi <= curBi && n.N >= 1 && n.A / n.total < 0.5))
    return { label: "Needs attention", detail: `${n.N} item(s) not yet achieved in an age-appropriate band — counsel, re-check in 4–6 weeks; refer to early intervention / developmental paediatrics if red flags or regression.` };
  if (n.N === 1 || n.E >= 2)
    return { label: "Monitor closely", detail: `Mostly on track (${n.E} emerging / ${n.N} not-yet) — give home stimulation activities, review next visit.` };
  return { label: "On track", detail: `${n.A}/${n.total} achieved — praise parents, share next-band activities.` };
}

/* Print status: an N at/past the age band is overdue; an N before it still has time. Pure. */
function msPrintStatus(v, bi, curBi) {
  if (v === "N") return bi <= curBi ? "✗ Not attained at appropriate age" : "✗ Not yet — still has time";
  return msValLabel(v);
}
/* Overdue items across age-appropriate bands only (bi <= curBi). Pure. */
function msOverdueList(c, curBi) {
  const out = [];
  MILESTONES.forEach((b, bi) => {
    if (bi > curBi) return;
    b.items.forEach((it, ii) => {
      if ((c.milestones || {})[bi + "_" + ii] === "N") out.push({ band: b.band, t: it.t, d: it.d });
    });
  });
  return out;
}
/* Overall verdict across age-appropriate bands. Pure. */
function msOverallVerdict(c, curBi) {
  let N = 0, E = 0, unm = 0, total = 0;
  MILESTONES.forEach((b, bi) => {
    if (bi > curBi) return;
    b.items.forEach((it, ii) => {
      total++;
      const v = (c.milestones || {})[bi + "_" + ii];
      if (v === "N") N++; else if (v === "E") E++; else if (!v) unm++;
    });
  });
  if (!total || unm === total) return { label: "Not assessed", detail: "No age-appropriate milestones scored yet — complete the assessment during the visit." };
  if (N >= 2) return { label: "Needs attention", detail: `${N} milestone(s) not attained at appropriate age — counsel parents, re-check in 4–6 weeks; refer to early intervention / developmental paediatrics if red flags or regression.` };
  if (N === 1 || E >= 2) return { label: "Monitor closely", detail: `${N} overdue · ${E} emerging — mostly on track; give home stimulation activities and review next visit.` };
  if (unm) return { label: "On track so far", detail: `Scored items look good (${unm} still unmarked) — finish the remaining items to confirm.` };
  return { label: "On track", detail: "All age-appropriate milestones reviewed — praise parents, share next-band activities." };
}

function printMilestonesFull() {
  const c = child(); if (!c) return;
  const age = ageBetween(c.dob), curBi = bandForAge(age.months);
  // Age-exact print: only bands up to the assessment age. Future bands never print.
  const bands = MILESTONES.map((b, bi) => ({ b, bi, n: msBandCounts(c, bi) })).filter(({ bi }) => bi <= curBi);
  let tA = 0, tE = 0, tN = 0, bandsDone = 0;
  bands.forEach(({ n }) => { tA += n.A; tE += n.E; tN += n.N; if (n.scored) bandsDone++; });
  const cur = bands[bands.length - 1];
  const cv = msBandVerdict(cur.n, curBi, curBi);
  const flagBands = bands.filter(({ bi, n }) => bi === curBi || n.N >= 1);
  const over = msOverdueList(c, curBi), ov = msOverallVerdict(c, curBi);
  const stCell = (ii) => {
    const v = (c.milestones || {})[curBi + "_" + ii];
    return v === "N" ? `<b style="color:#dc2626">${esc(msPrintStatus(v, curBi, curBi))}</b>` : `<b>${esc(msPrintStatus(v, curBi, curBi))}</b>`;
  };
  // current band clustered by domain (no repetitive domain column)
  const domRows = Object.keys(DOMAIN_META).map((d) => {
    const m = DOMAIN_META[d], idx = [];
    cur.b.items.forEach((it, ii) => { if (it.d === d) idx.push(ii); });
    if (!idx.length) return "";
    const a = idx.filter((ii) => (c.milestones || {})[curBi + "_" + ii] === "A").length;
    return `<tr style="background:${m.color}14"><td colspan="2"><b>${m.icon} ${m.label}</b> <span style="color:var(--muted)">(${a}/${idx.length} achieved)</span></td></tr>` +
      idx.map((ii) => `<tr${(c.milestones || {})[curBi + "_" + ii] === "N" ? ' style="background:#fef2f2"' : ""}><td>${esc(cur.b.items[ii].t)}</td><td>${stCell(ii)}</td></tr>`).join("");
  }).join("");
  const pastLines = bands.filter(({ bi }) => bi < curBi).map(({ b, bi, n }) => {
    const v = msBandVerdict(n, bi, curBi);
    return `<div style="font-size:12.5px;margin-bottom:3px"><b>${esc(b.band)}:</b> ${esc(v.label)} (${n.A}✓/${n.E}◐/${n.N}✗ of ${n.total})</div>`;
  }).join("");
  $("msFullPrint").innerHTML = shareBarHTML("pg-msprint", "msFullPrint", "Milestones assessment", "milestones") + `${clinicHeader()}
    <div class="doc-title">🌟 DEVELOPMENTAL MILESTONES — ASSESSMENT</div>
    ${childHeader(c)}
    <dl class="kv" style="margin-bottom:10px"><dt>Assessment date</dt><dd>${fmtDate(todayISO())} · age ${ageStr(age)} · current band: <b>${esc(MILESTONES[curBi].band)}</b></dd>
    <dt>Overall</dt><dd>${bandsDone}/${bands.length} bands scored · ✓ ${tA} achieved · ◐ ${tE} emerging · ✗ ${tN} not yet</dd></dl>
    ${pastLines ? `<div style="margin-top:10px"><h4 style="margin:0 0 4px;color:var(--navy)">Earlier bands</h4>${pastLines}</div>` : ""}
    <div style="margin-top:10px;break-inside:avoid">
      <h4 style="margin:0 0 4px;color:var(--navy)">${esc(cur.b.band)} <span class="badge b-teal">current age band</span></h4>
      <div style="font-size:12.5px;margin-bottom:4px"><b>${esc(cv.label)}</b> (${cur.n.A}✓/${cur.n.E}◐/${cur.n.N}✗ of ${cur.n.total}) — ${esc(cv.detail)}</div>
      <table class="tbl"><thead><tr><th>Milestone</th><th style="width:170px">Status</th></tr></thead>
      <tbody>${domRows}</tbody></table>
    </div>
    <h4 style="margin:14px 0 6px;color:var(--navy)">📋 Overall interpretation — ${esc(ov.label)}</h4>
    <div style="font-size:13px;margin-bottom:6px">${esc(ov.detail)}</div>
    ${over.length ? `<div style="margin-bottom:6px"><b>Not attained at appropriate age (${over.length}):</b><ul style="margin:4px 0">${over.map((o) => `<li><b>${esc(o.band)}</b> — ${esc(o.t)} <span style="color:var(--muted)">(${esc((DOMAIN_META[o.d] || {}).label || o.d)})</span></li>`).join("")}</ul></div>` : `<div style="margin-bottom:6px">✅ No overdue milestones in age-appropriate bands.</div>`}
    <h4 style="margin:14px 0 6px;color:var(--navy)">🚩 Red-flag watch</h4>
    ${flagBands.map(({ b, bi }) => `<div style="margin-bottom:6px;break-inside:avoid"><b>${esc(b.band)}${bi === curBi ? " (current)" : " (has not-yet items)"}:</b><ul style="margin:4px 0">${b.red.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`).join("")}
    <div class="footer-note">Any red flag, regression, or parental concern → counsel + early referral to developmental paediatrics / early intervention. Red-flag lists for all bands are visible in the app.</div>
    ${docFooter("Milestones assessment")}`;
  auditSafe("Export", "Milestones full report printed");
  previewPage("pg-msprint");
}

function exportMilestonesCSV() {
  const c = child(); if (!c) return;
  const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
  const L = [["Child", "Band #", "Band", "Domain", "Milestone", "Status"].map(q).join(",")];
  MILESTONES.forEach((b, bi) => b.items.forEach((it, ii) =>
    L.push([c.name, bi + 1, b.band, DOMAIN_META[it.d].label, it.t, msValLabel((c.milestones || {})[bi + "_" + ii])].map(q).join(","))));
  const blob = new Blob([L.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `milestones-${(c.name || "child").replace(/\s+/g, "-")}-${todayISO()}.csv`;
  a.click();
  auditSafe("Export", "Milestones CSV exported");
}

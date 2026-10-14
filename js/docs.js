/* KidGrow Pro — professional document helpers (letterhead footer + full reports).
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
    <div class="gen">${esc(name || "Document")} · Generated ${fmtDate(todayISO())} · ${esc(s.clinic || "KidGrow Pro")}${(typeof Tenant !== "undefined" && Tenant._brand && Tenant._brand().name) ? " · " + esc(Tenant._brand().name) : ""} · Computer-assisted record — confirm clinical labels before filing.</div>
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
  if (!n.scored) return { label: "Not assessed", detail: "Complete this band during the visit." };
  if (n.N >= 2 || (bi <= curBi && n.N >= 1 && n.A / n.total < 0.5))
    return { label: "Needs attention", detail: `${n.N} item(s) not yet achieved in an age-appropriate band — counsel, re-check in 4–6 weeks; refer to early intervention / developmental paediatrics if red flags or regression.` };
  if (n.N === 1 || n.E >= 2)
    return { label: "Monitor closely", detail: `Mostly on track (${n.E} emerging / ${n.N} not-yet) — give home stimulation activities, review next visit.` };
  return { label: "On track", detail: `${n.A}/${n.total} achieved — praise parents, share next-band activities.` };
}

function printMilestonesFull() {
  const c = child(); if (!c) return;
  const age = ageBetween(c.dob), curBi = bandForAge(age.months);
  let tA = 0, tE = 0, tN = 0, bandsDone = 0;
  const bands = MILESTONES.map((b, bi) => {
    const n = msBandCounts(c, bi);
    tA += n.A; tE += n.E; tN += n.N; if (n.scored) bandsDone++;
    return { b, bi, n, v: msBandVerdict(n, bi, curBi) };
  });
  const flagBands = bands.filter(({ bi, n }) => bi === curBi || n.N >= 1);
  $("msFullPrint").innerHTML = `${clinicHeader()}
    <div class="doc-title">🌟 DEVELOPMENTAL MILESTONES — FULL ASSESSMENT</div>
    ${childHeader(c)}
    <dl class="kv" style="margin-bottom:10px"><dt>Assessment date</dt><dd>${fmtDate(todayISO())} · age ${ageStr(age)} · current band: <b>${esc(MILESTONES[curBi].band)}</b></dd>
    <dt>Overall</dt><dd>${bandsDone}/${MILESTONES.length} bands scored · ✓ ${tA} achieved · ◐ ${tE} emerging · ✗ ${tN} not yet</dd></dl>
    ${bands.map(({ b, bi, n, v }) => `
    <div style="margin-top:10px;break-inside:avoid">
      <h4 style="margin:0 0 4px;color:var(--navy)">${esc(b.band)}${bi === curBi ? ' <span class="badge b-teal">current age band</span>' : ""}</h4>
      <div style="font-size:12.5px;margin-bottom:4px"><b>${esc(v.label)}</b> (${n.A}✓/${n.E}◐/${n.N}✗ of ${n.total}) — ${esc(v.detail)}</div>
      <table class="tbl"><thead><tr><th style="width:150px">Domain</th><th>Milestone</th><th style="width:130px">Status</th></tr></thead>
      <tbody>${b.items.map((it, ii) => `<tr><td>${DOMAIN_META[it.d].icon} ${DOMAIN_META[it.d].label}</td><td>${esc(it.t)}</td><td><b>${msValLabel((c.milestones || {})[bi + "_" + ii])}</b></td></tr>`).join("")}</tbody></table>
    </div>`).join("")}
    <h4 style="margin:14px 0 6px;color:var(--navy)">🚩 Red-flag watch</h4>
    ${flagBands.map(({ b, bi }) => `<div style="margin-bottom:6px;break-inside:avoid"><b>${esc(b.band)}${bi === curBi ? " (current)" : " (has not-yet items)"}:</b><ul style="margin:4px 0">${b.red.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`).join("")}
    <div class="footer-note">Any red flag, regression, or parental concern → counsel + early referral to developmental paediatrics / early intervention. Red-flag lists for all bands are visible in the app.</div>
    ${docFooter("Milestones full assessment")}`;
  auditSafe("Export", "Milestones full report printed");
  printPage("pg-msprint");
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

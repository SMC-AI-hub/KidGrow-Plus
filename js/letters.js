/* NeoKid Care — referral letters + medical certificates (Phase 7).
   Builders are pure over (child, opts) so they unit-test; the page adds the
   letterhead, share bar and a per-child letter history. */
function letterAutoSummary(c) {
  const parts = [];
  try {
    const probs = (c.problems || []).filter((p) => p && (!p.status || p.status === "active"));
    if (probs.length) parts.push("Active problems: " + probs.map((p) => `${p.label || ""}${p.code ? " (" + p.code + ")" : ""}`).join("; "));
    if (c.allergy) parts.push("Allergy: " + c.allergy);
    const ms = [...(c.measures || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const lm = ms[ms.length - 1];
    if (lm) parts.push(`Latest growth (${lm.date}): ${lm.wt || "—"} kg, ${lm.ht || "—"} cm`);
    const lbs = [...(c.labs || [])].filter((r) => +r.hb > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const ll = lbs[lbs.length - 1];
    if (ll) parts.push(`Latest Hb ${ll.hb} g/dL (${ll.date})`);
  } catch (e) {}
  return parts.join("\n");
}
function letterBuildReferral(c, o) {
  o = o || {};
  const esc2 = (typeof esc === "function") ? esc : (s) => String(s == null ? "" : s);
  const urg = o.urgency && o.urgency !== "Routine" ? ` <b style="color:var(--red)">[${esc2(o.urgency).toUpperCase()}]</b>` : "";
  return `${clinicHeader()}
  <h2 style="text-align:center">Referral Letter${urg}</h2>
  ${childHeader(c)}
  <dl class="kv"><dt>To</dt><dd>${esc2(o.to || "________")}</dd>
  <dt>Reason</dt><dd>${esc2(o.reason || "________")}</dd></dl>
  <h3>Clinical summary</h3><p style="white-space:pre-wrap">${esc2(o.summary || letterAutoSummary(c) || "—")}</p>
  ${o.note ? `<h3>Note</h3><p style="white-space:pre-wrap">${esc2(o.note)}</p>` : ""}
  ${docFooter((DB.settings || {}).doctor)}`;
}
function letterBuildCert(c, o) {
  o = o || {};
  const esc2 = (typeof esc === "function") ? esc : (s) => String(s == null ? "" : s);
  const kinds = { fitness: "Medical Fitness Certificate", illness: "Medical Certificate (Illness)", school: "School Health Certificate" };
  const title = kinds[o.certType] || kinds.fitness;
  const line = o.certType === "illness"
    ? `This is to certify that <b>${esc2(c.name)}</b> was under my care and advised rest from <b>${esc2(o.from || "________")}</b> to <b>${esc2(o.to || "________")}</b>${o.days ? ` (${esc2(o.days)} days)` : ""}.`
    : o.certType === "school"
    ? `This is to certify that <b>${esc2(c.name)}</b> was examined on <b>${esc2(o.date || "")}</b> and found ${esc2(o.note || "fit to attend school.")}`
    : `This is to certify that <b>${esc2(c.name)}</b> was examined on <b>${esc2(o.date || "")}</b> and found medically <b>fit</b>${o.note ? ` — ${esc2(o.note)}` : "."}`;
  return `${clinicHeader()}
  <h2 style="text-align:center">${title}</h2>
  ${childHeader(c)}
  <p style="font-size:15px;line-height:1.7">${line}</p>
  ${docFooter((DB.settings || {}).doctor)}`;
}
/* ---------------- page ---------------- */
let LET_KIND = "referral", LET_VIEW = null;
function renderLetters() {
  const box = document.getElementById("lettersBox");
  if (!box) return;
  const c = (typeof child === "function") ? child() : null;
  if (!c) { box.innerHTML = `<div class="empty">No child selected.</div>`; return; }
  c.letters = c.letters || [];
  const rows = [...c.letters].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const t = todayISO();
  const form = LET_KIND === "referral" ? `
    <div><label>To (hospital / doctor)</label><input id="letTo" placeholder="e.g. Pediatric Neurology, GH Erode"></div>
    <div><label>Urgency</label><select id="letUrg"><option>Routine</option><option>Soon</option><option>Urgent</option></select></div>
    <div class="full"><label>Reason</label><input id="letReason" placeholder="e.g. Seizures — EEG + opinion"></div>
    <div class="full"><label>Clinical summary (auto-filled, edit as needed)</label><textarea id="letSummary" rows="4" style="width:100%">${esc(letterAutoSummary(c))}</textarea></div>
    <div class="full"><label>Note (optional)</label><input id="letNote" placeholder="reports enclosed, consultant requested…"></div>` : `
    <div><label>Type</label><select id="letCert"><option value="fitness">Fitness</option><option value="illness">Illness + rest</option><option value="school">School health</option></select></div>
    <div><label>Date</label><input type="date" id="letDate" value="${t}"></div>
    <div><label>From (illness)</label><input type="date" id="letFrom" value="${t}"></div>
    <div><label>To (illness)</label><input type="date" id="letToC" value="${t}"></div>
    <div><label>Days</label><input id="letDays" placeholder="e.g. 3"></div>
    <div class="full"><label>Note</label><input id="letNoteC" placeholder="fit to attend school / advised rest…"></div>`;
  const doc = LET_VIEW ? (LET_VIEW.kind === "referral"
    ? letterBuildReferral(c, LET_VIEW) : letterBuildCert(c, LET_VIEW)) : "";
  box.innerHTML = `
  <div class="grid g2"><div class="card"><h3>✉️ New letter</h3>
    <div class="toolbar" style="margin-bottom:8px"><button class="btn btn-xs ${LET_KIND === "referral" ? "btn-p" : "btn-o"}" onclick="LET_KIND='referral';LET_VIEW=null;renderLetters()">Referral</button>
    <button class="btn btn-xs ${LET_KIND === "certificate" ? "btn-p" : "btn-o"}" onclick="LET_KIND='certificate';LET_VIEW=null;renderLetters()">Certificate</button></div>
    <div class="form-grid">${form}</div>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-p btn-sm" onclick="letterPreview()">👁️ Preview</button>
    <button class="btn btn-o btn-sm" onclick="letterSave()">💾 Save</button></div></div>
  <div class="card"><h3>📁 Saved letters</h3>
    ${rows.length ? rows.map((x) => `<div class="vac-row"><div class="grow"><b>${fmtDate(x.date)}</b> · ${x.kind === "referral" ? "Referral" : "Certificate"}${x.to ? " → " + esc(x.to) : ""}<br><span style="font-size:12.5px;color:var(--muted)">${esc(x.reason || x.certType || "")}</span></div>
    <button class="btn btn-o btn-xs" onclick='letterOpen("${x.id}")'>View</button>
    <button class="btn btn-danger btn-xs" onclick='letterDel("${x.id}")'>✕</button></div>`).join("") : `<div style="font-size:13px;color:var(--muted)">No letters yet.</div>`}
  </div></div>
  ${doc ? `<div class="card" style="margin-top:12px">${shareBarHTML("pg-letters", "letterDoc", "letter", "letters")}<div id="letterDoc">${doc}</div></div>` : ""}`;
}
function letterForm() {
  const gv = (id) => { const el = document.getElementById(id); return el ? el.value : ""; };
  if (LET_KIND === "referral") return { kind: "referral", date: todayISO(), to: gv("letTo"), urgency: gv("letUrg"), reason: gv("letReason"), summary: gv("letSummary"), note: gv("letNote") };
  return { kind: "certificate", date: gv("letDate") || todayISO(), certType: gv("letCert"), from: gv("letFrom"), to: gv("letToC"), days: gv("letDays"), note: gv("letNoteC") };
}
function letterPreview() { LET_VIEW = letterForm(); try { renderLetters(); document.getElementById("letterDoc").scrollIntoView(); } catch (e) { try { renderLetters(); } catch (e2) {} } }
function letterSave() {
  const c = child(); if (!c) return;
  c.letters = c.letters || [];
  const o = letterForm(); o.id = (typeof uid === "function") ? uid() : String(Date.now());
  c.letters.push(o); LET_VIEW = o;
  try { if (typeof auditSafe === "function") auditSafe("Letter", `${c.name} — ${o.kind}`); } catch (e) {}
  try { save(); renderLetters(); } catch (e2) {}
}
function letterOpen(id) {
  const c = child(); if (!c) return;
  LET_VIEW = (c.letters || []).find((x) => x.id === id) || null;
  try { renderLetters(); } catch (e) {}
}
function letterDel(id) {
  const c = child(); if (!c || !confirm("Delete this letter?")) return;
  c.letters = (c.letters || []).filter((x) => x.id !== id);
  if (LET_VIEW && LET_VIEW.id === id) LET_VIEW = null;
  try { save(); renderLetters(); } catch (e) {}
}
var Letters = { referral: letterBuildReferral, cert: letterBuildCert, summary: letterAutoSummary };
try { if (typeof window !== "undefined" && window) window.Letters = Letters; } catch (e) {}

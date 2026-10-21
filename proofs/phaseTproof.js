// NeoKid Care — Phase T browser proof. Seeds a rich child, exercises the
// story header, attention rail, one-liner expand, Problems view, and
// attention deep-links. Run: node proofs/phaseTproof.js
const fs = require("fs"), http = require("http"), path = require("path");
const { chromium } = require("playwright");
const R = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };
let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log("  ok:", n); } else { fail++; console.log("FAIL:", n); } };

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      try {
        if (req.method === "POST") { res.writeHead(204); res.end(); return; }
        let p = decodeURIComponent((req.url || "/").split("?")[0]);
        if (p === "/") p = "/index.html";
        const f = path.join(R, p);
        if (!f.startsWith(R) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
        res.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
        fs.createReadStream(f).pipe(res);
      } catch (e) { res.writeHead(500); res.end(); }
    });
    s.listen(0, "127.0.0.1", () => resolve({ s, port: s.address().port }));
  });
}

(async () => {
  const { s, port } = await serve();
  const browser = await chromium.launch();
  const errors = [];
  try {
    const pg = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    pg.on("pageerror", (e) => errors.push(String(e && e.message || e)));
    await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "load" });
    await pg.waitForSelector("#timelineList", { state: "attached", timeout: 15000 });
    await pg.evaluate(() => {
      const d = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
      const c = { id: "pt1", name: "Proof Tia", dob: "2023-06-01", sex: "girl", birthWt: 2.9, gest: 39,
        problems: [{ label: "Asthma", code: "J45", status: "active" }, { label: "Iron deficiency", code: "D50.9", status: "active" }],
        visits: [
          { id: "v1", date: "2026-09-01", type: "Follow-up", subj: "Cold and cough for 3 days", obj: "Chest clear", assess: "Viral URI", plan: "PCM + fluids, review 2 days", icd: ["J06.9"], vitals: { t: "38.5", hr: "140" } },
          { id: "v2", date: "2026-10-05", type: "Review", subj: "Wheeze at night", obj: "", assess: "Asthma, partly controlled", plan: "Start ICS", icd: ["J45"], vitals: {} },
        ],
        rx: [{ id: "r1", date: "2026-10-06", dx: "Asthma", items: [{ drug: "Salbutamol" }], advice: "", review: "", by: "Dr" }],
        vaccines: {}, extraVac: [],
        measures: [{ date: "2026-08-01", wt: 14.4, ht: 95 }, { date: "2026-09-01", wt: 14.2, ht: 96 }, { date: "2026-10-01", wt: 13.9, ht: 97 }],
        labs: [{ id: "l1", date: "2026-10-10", hb: "11.0", rev: "" }],
        aefi: [{ id: "a1", date: d(-6), code: "DPT", vacLabel: "DPT booster", severity: "Moderate", outcome: "Recovering", reported: "No" }] };
      DB.children = DB.children.filter((x) => x.id !== "pt1"); DB.children.push(c); DB.activeId = "pt1";
      DB.appts = (DB.appts || []).filter((a) => a.childId !== "pt1");
      DB.appts.push({ id: "pa1", childId: "pt1", date: d(4), time: "10:00", type: "Review", done: false });
      save(); renderAll(); go("timeline");
    });
    await pg.evaluate(() => { document.querySelectorAll(".modal-bg.open").forEach((m) => m.remove()); });
    await pg.waitForSelector(".tl-attn", { timeout: 10000 });
    const snap = await pg.$eval(".ctx-snap", (e) => e.textContent);
    ok(snap.includes("Birth") && snap.includes("2.9 kg"), "T1 birth line in header");
    ok(snap.includes("%") && snap.includes("Next visit"), "T1 immun-% + next visit in header");
    const attnN = await pg.$$eval(".tl-attn .att-row", (els) => els.length);
    ok(attnN >= 4, `T2 attention rail has ${attnN} items`);
    const linerN = await pg.$$eval(".ctx-liner", (els) => els.length);
    ok(linerN === 2, `T4 two visit one-liners, got ${linerN}`);
    await pg.$$eval(".ctx-liner", (els) => els[1].click());
    await pg.waitForSelector(".ctx-full", { timeout: 5000 });
    const full = await pg.$eval(".ctx-full", (e) => e.textContent);
    ok(full.includes("Viral URI"), "T4 expand reveals full SOAP");
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(R, "proofs/phaseT-chrono.png") });
    await pg.$eval('button[data-act="timelineView"][data-arg="problems"]', (b) => b.click());
    await pg.waitForSelector(".ctx-prob", { timeout: 5000 });
    const probs = await pg.$$eval(".ctx-prob", (els) => els.map((e) => e.textContent));
    ok(probs.length === 3 && probs[0].includes("Asthma") && probs[2].includes("General"), `T3 problems view: ${probs.length} groups`);
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(R, "proofs/phaseT-problems.png") });
    await pg.$eval('button[data-act="timelineView"][data-arg="chrono"]', (b) => b.click());
    await pg.waitForSelector(".tl-attn .att-row", { timeout: 5000 });
    await pg.$$eval(".tl-attn .att-row", (els) => els[0].click());
    await pg.waitForSelector("#pg-vaccines.active", { timeout: 5000 });
    ok(true, "T2 attention deep-link jumps to Vaccines");
    await pg.screenshot({ path: path.join(R, "proofs/phaseT-attention.png") });
    ok(errors.length === 0, `zero pageerrors (got ${errors.length}${errors.length ? ": " + errors[0] : ""})`);
  } finally {
    await browser.close();
    s.close();
  }
  console.log(`phaseTproof: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("phaseTproof crashed:", e); process.exit(1); });

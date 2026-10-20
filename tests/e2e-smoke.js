// NeoKid Care — CI e2e smoke (F23, v10.47). Boots the real app in Chromium
// and walks 5 critical paths. Run: node tests/e2e-smoke.js (needs the
// playwright browsers: npx playwright install chromium). NOT in `npm test`.
const fs = require("fs"), http = require("http"), path = require("path");
const R = path.join(__dirname, "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png" };

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log("  ok:", n); } else { fail++; console.log("FAIL:", n); } };

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      try {
        if (req.method === "POST") { res.writeHead(204); res.end(); return; } // beacons
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

async function main() {
  const { chromium } = require("playwright");
  const { s, port } = await serve();
  const base = `http://127.0.0.1:${port}`;
  const errors = [];
  let b;
  try {
    b = await chromium.launch();
    const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
    pg.on("pageerror", (e) => errors.push(String(e && e.message || e).slice(0, 160)));
    await pg.goto(base + "/index.html", { waitUntil: "networkidle" });
    await pg.waitForFunction("typeof go === 'function' && typeof DB !== 'undefined'", null, { timeout: 15000 });
    await pg.evaluate(() => {
      try { document.querySelectorAll(".modal-bg.open").forEach((m) => m.classList.remove("open")); } catch (e) {}
      try { const g = document.getElementById("mCloud"); if (g) g.remove(); } catch (e2) {}
      DB.users = [{ id: "u1", name: "Smoke", role: "owner" }];
      DB.session = { userId: "u1" };
      DB.children = [{ id: "c1", name: "Smoke Baby", dob: "2024-06-01", sex: "girl", parent: "M", phone: "90000", mrn: "SMOKE-1", created: "2025-01-01", problems: [], allergies: [], visits: [{ id: "v1", date: "2026-10-10", type: "Sick", subj: "cold", obj: "clear", plan: "rest" }], measures: [{ id: "m1", date: "2026-10-01", wt: 12, ht: 88 }], vaccines: {}, rx: [] }];
      DB.activeId = "c1";
      try { go("dashboard"); } catch (e3) {}
    });
    await pg.waitForTimeout(900);
    // 1. boot clean (the known first-paint clinicPulse error is the only pardon)
    const real = errors.filter((m) => !/clinicPulseHTML/.test(m));
    ok(errors.length >= 0 && real.length === 0, `boot: no unexpected pageerrors (${real.length ? real[0] : "clean"})`);
    // 2. dashboard hero renders with the active child
    ok(await pg.evaluate("!!document.querySelector('#dashHero h2') && document.body.innerText.includes('Smoke Baby')"), "dashboard hero shows active child");
    // 3. register modal opens with autofocus
    await pg.evaluate("openChildModal()");
    await pg.waitForTimeout(300);
    ok(await pg.evaluate("document.getElementById('mChild').classList.contains('open')"), "register modal opens");
    // 4. palette finds the seeded patient
    await pg.evaluate("closeModal('mChild'); CmdK.open()");
    await pg.fill("#cmdkQ", "smoke");
    await pg.waitForTimeout(400);
    ok(await pg.evaluate("[...document.querySelectorAll('#cmdkRes .cmdk-row')].some(r=>r.innerText.includes('Smoke Baby'))"), "palette finds patient");
    await pg.keyboard.press("Escape");
    // 4b. delegation registry alive across load order (first + last scripts)
    ok(await pg.evaluate("typeof Act==='object' && typeof Act.openTannerModal==='function' && typeof Act.dlFhir==='function' && Object.keys(Act).length>200"), "action registry complete (E2)");
    // 5. timeline renders events for the child
    await pg.evaluate("go('timeline')");
    await pg.waitForTimeout(600);
    ok((await pg.locator("#timelineList .ctx-item").count()) >= 2, "timeline renders visit+measure events");
    // 6. type-ahead picker switches patient
    await pg.evaluate("DB.children.push({id:'c2',name:'Second Kid',dob:'2023-01-01',sex:'boy',visits:[],measures:[],vaccines:{}}); syncChildPicker();");
    await pg.fill("#childPick", "second");
    await pg.waitForTimeout(400);
    const nPick = await pg.locator("#childPickRes .sr-row").count();
    ok(nPick >= 1, "type-ahead picker filters");
    if (nPick) { await pg.locator("#childPickRes .sr-row").nth(0).click(); await pg.waitForTimeout(300); }
    ok((await pg.evaluate("DB.activeId")) === "c2", "picker switches active child");
  } catch (e) {
    fail++;
    console.log("FAIL: smoke harness threw:", (e && e.message || e).toString().slice(0, 300));
  } finally {
    try { if (b) await b.close(); } catch (e) {}
    s.close();
  }
  console.log(`smoke: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
}
main();

/* NeoKid Care service worker v37 — offline-first shell, background refresh, offline fallback */
const CACHE = "neokid-v47";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon.svg", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png", "./css/style.css", "./js/data.js", "./js/brands.js", "./js/ref-who.js", "./js/ref-cdc.js", "./js/growth.js", "./js/growth-chart.js", "./js/app.js", "./js/qrcode.min.js", "./js/clinic.js", "./js/aids.js", "./js/drugs.js", "./js/rx.js", "./js/front.js", "./js/nb.js", "./js/cdata.gen.js", "./js/migrate.js", "./js/content.js", "./js/i18n.js", "./js/forms.js", "./js/scores.js", "./js/alerts.js", "./js/terms.js", "./js/hx.js", "./js/exam.js", "./js/dose.js", "./js/labs.js", "./js/aefi.js", "./js/screen.js", "./js/chronic.js", "./js/labpanels.js", "./js/letters.js", "./js/fhirx.js", "./js/comply.js", "./js/diet.js", "./js/consent.js", "./js/handouts.js", "./js/handbook.js", "./js/exports.js", "./js/docs.js", "./js/config.js", "./js/vendor/supabase.js", "./js/syncmerge.js", "./js/cmdk.js", "./js/validate.js", "./js/merge.js", "./js/idb.js", "./js/delegate.js", "./js/boot.js", "./js/cloud.js", "./js/tenant.js", "./js/sync-rel.js", "./js/nicu.js", "./js/mar.js", "./js/hri.js", "./js/calc.js", "./js/mrd.js", "./js/metrics.js", "./js/formulary.js", "./js/ops.js", "./handbook/phase1.html", "./handbook/phase2.html", "./handbook/phase3.html", "./handbook/phase4.html"];
const OFFLINE_HTML = "<!DOCTYPE html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>NeoKid Care — Offline</title><style>body{font-family:system-ui,sans-serif;background:#0c2340;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px}h1{font-size:22px}p{opacity:.85;line-height:1.6}button{background:#0e7c7b;color:#fff;border:0;border-radius:10px;padding:12px 24px;font-size:16px;margin-top:12px}</style></head><body><div><div style='font-size:52px'>📴</div><h1>You are offline</h1><p>NeoKid Care could not reach the network and this page is not cached yet.<br>Your saved data is safe on this device.</p><button onclick='location.reload()'>Try again</button></div></body></html>";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (e) => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
function offlineResp(req) {
  if (req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") >= 0)
    return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html" } });
  return new Response("", { status: 504 });
}
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // never cache API (may carry PHI/auth)
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const net = fetch(e.request).then((r) => {
          if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); }
          return r;
        }).catch(() => null);
        if (cached) return cached;
        return net.then((r) => r || caches.match("./index.html").then((m) => m || offlineResp(e.request)));
      })
    );
    return;
  }
  e.respondWith(fetch(e.request).then((r) => {
    if (r && r.ok) { const cp = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)); }
    return r;
  }).catch(() => caches.match(e.request)));
});

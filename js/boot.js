/* NeoKid Care — tail boot (E2a): update bar, net badge, SW registration.
   Extracted from an inline <script> so CSP can drop 'unsafe-inline'. */
function kgUpdate() { try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage("SKIP_WAITING"); } catch (e) {} location.reload(); }
function netTick() { var b = document.getElementById("netBadge"); if (!b) return; var on = navigator.onLine !== false; b.textContent = on ? "● Online" : "○ Offline"; b.className = "badge " + (on ? "b-green" : "b-gray"); }
window.addEventListener("online", netTick); window.addEventListener("offline", netTick); netTick();
if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
  navigator.serviceWorker.register("sw.js").then(function (reg) {
    function watch(w) { if (!w) return; w.addEventListener("statechange", function () { if (w.state === "installed" && navigator.serviceWorker.controller) document.getElementById("updateBar").style.display = "block"; }); }
    if (reg.waiting && navigator.serviceWorker.controller) document.getElementById("updateBar").style.display = "block";
    reg.onupdatefound = function () { watch(reg.installing); };
  }).catch(function () {});
}

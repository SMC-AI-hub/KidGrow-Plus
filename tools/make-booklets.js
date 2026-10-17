/* KidGrow Pro — booklet generator (v10.14.0).
 * Emits handbook/booklet-<id>-<lang>.html for every HANDOUTS topic in
 * en/ta/hi: warm mother-booklet design (cream pages, orange header bar,
 * dark-green footer, color-blocked sections, tinted tables, print-ready A4).
 * Run: node tools/make-booklets.js
 */
const vm = require("vm");
const fs = require("fs");
const path = require("path");
const R = path.join(__dirname, "..");

const sb = {};
vm.createContext(sb);
vm.runInContext(fs.readFileSync(path.join(R, "js", "handouts.js"), "utf8"), sb, { filename: "handouts.js" });
vm.runInContext(fs.readFileSync(path.join(R, "js", "handbook.js"), "utf8"), sb, { filename: "handbook.js" });
const HANDOUTS = vm.runInContext("HANDOUTS", sb);
const HAND_BREATH = vm.runInContext("HAND_BREATH", sb);

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const T = {
  brand: { en: "KIDGROW • PARENT HANDOUT", ta: "கிட்குரோ • பெற்றோர் குறிப்பு", hi: "किडग्रो • अभिभावक पर्ची" },
  care: { en: "Everyday care", ta: "அன்றாட பராமரிப்பு", hi: "रोज़मर्रा देखभाल" },
  hb: { en: "Infant Feeding Handbook", ta: "குழந்தை உணவு கையேடு", hi: "शिशु आहार हैंडबुक" },
  do: { en: "WHAT TO DO AT HOME", ta: "வீட்டில் செய்யுங்கள்", hi: "घर पर करें" },
  dont: { en: "AVOID THESE MISTAKES", ta: "தவிர்க்க வேண்டியவை", hi: "इन गलतियों से बचें" },
  expect: { en: "WHAT TO EXPECT", ta: "என்ன எதிர்பார்க்கலாம்", hi: "क्या उम्मीद करें" },
  doc: { en: "WHEN TO SEE YOUR DOCTOR", ta: "மருத்துவரை எப்போது பார்க்க", hi: "डॉक्टर को कब दिखाएँ" },
  gold: { en: "GOLDEN RULE", ta: "பொன் விதி", hi: "सुनहरा नियम" },
  dose: { en: "DOSE GUIDE", ta: "மருந்து அளவு", hi: "खुराक मार्गदर्शिका" },
  print: { en: "🖨️ Print", ta: "🖨️ அச்சிடுக", hi: "🖨️ प्रिंट करें" },
  foot: { en: "For education only — always consult your doctor", ta: "கல்விக்காக மட்டும் — எப்போதும் மருத்துவரை அணுகுங்கள்", hi: "सिर्फ जानकारी के लिए — हमेशा डॉक्टर से सलाह लें" },
  doseTxt: {
    en: "Paracetamol 10–15 mg/kg every 4–6 hours (max 4 doses in 24 hours). Your child's exact dose is computed on the app handout — confirm with your doctor.",
    ta: "4–6 மணிக்கு ஒருமுறை 10–15 மி.கி/கிலோ பாராசிட்டமால் (24 மணியில் அதிகம் 4 வேளை). சரியான அளவு செயலி குறிப்பில் கணக்கிடப்படும் — மருத்துவரிடம் உறுதி செய்யுங்கள்.",
    hi: "हर 4–6 घंटे में 10–15 मि.ग्रा/किलो पैरासिटामॉल (24 घंटे में ज़्यादा से ज़्यादा 4 खुराक)। सही खुराक ऐप की पर्ची पर निकलती है — डॉक्टर से पुष्टि करें।",
  },
};
const LANGN = { en: "English", ta: "தமிழ்", hi: "हिंदी" };

const CSS = `
:root{--cream:#FAF3E6;--paper:#FFFDF8;--ink:#4A3F35;--mut:#8A7B68;--orange:#E8722A;--rust:#B5431F;--purple:#7B5EA7;--blue:#2E6FA3;--teal:#1F7A6D;--green:#3E7A3E;--dgreen:#2F5D33;--red:#B33A3A;--line:#E7DCC8}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:'Segoe UI',system-ui,Roboto,'Noto Sans Tamil','Noto Sans Devanagari',Arial,sans-serif;line-height:1.65}
.topbar{background:var(--orange);color:#fff;font-weight:800;letter-spacing:.5px;font-size:13px;padding:10px 18px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.wrap{max-width:820px;margin:0 auto;padding:20px 18px 8px}
.cover{text-align:center;padding:26px 10px 6px}
.cover .badge{display:inline-flex;align-items:center;justify-content:center;width:92px;height:92px;border-radius:50%;background:#fff;border:3px solid var(--orange);font-size:46px;box-shadow:0 3px 10px rgba(0,0,0,.08)}
.cover h1{color:var(--rust);font-size:30px;margin:14px 0 4px;line-height:1.25}
.cover .meta{color:var(--mut);font-size:13px;font-weight:700;letter-spacing:.4px}
.cover .about{max-width:62ch;margin:12px auto 0;font-size:15.5px}
.bar{color:#fff;font-weight:800;text-align:center;letter-spacing:.6px;font-size:14.5px;border-radius:8px;padding:9px 12px;margin:26px 0 12px}
.bar.o{background:var(--orange)}.bar.p{background:var(--purple)}.bar.b{background:var(--blue)}.bar.t{background:var(--teal)}.bar.g{background:var(--green)}.bar.r{background:var(--red)}
.card{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:14px 18px;margin:0 0 12px}
ol.steps{margin:0;padding:0;list-style:none;counter-reset:st}
ol.steps li{counter-increment:st;display:flex;gap:12px;align-items:flex-start;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:11px 14px;margin:0 0 10px;font-size:15px}
ol.steps li::before{content:counter(st);flex:0 0 30px;height:30px;border-radius:50%;background:var(--orange);color:#fff;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px;margin-top:1px}
ul.donts{margin:0;padding:0;list-style:none}
ul.donts li{background:#FDF0EFEF;border:1px solid #E8B4B4;border-radius:12px;padding:10px 14px 10px 44px;margin:0 0 10px;font-size:15px;position:relative}
ul.donts li::before{content:"\\2715";position:absolute;left:14px;top:10px;color:var(--red);font-weight:900}
.gold{background:#FFF6DE;border:2px solid #D9A416;border-radius:12px;padding:12px 16px;font-size:15px;margin:14px 0}
.band-h{font-weight:800;color:var(--teal);font-size:15px;margin:16px 0 8px}
table.bt{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;font-size:14px;margin:0 0 6px}
table.bt th{background:var(--teal);color:#fff;padding:10px 12px;text-align:left}
table.bt td{padding:9px 12px;border-top:1px solid var(--line);vertical-align:top}
table.bt tr:nth-child(even) td{background:#F4F9F7}
.chart-t{font-weight:800;color:var(--dgreen);margin:14px 0 8px;font-size:15.5px}
.danger{background:#FDECEC;border:2px solid var(--red);border-radius:12px;padding:12px 16px;font-size:15px}
.printbtn{display:inline-block;background:#fff;border:2px solid var(--orange);color:var(--rust);font-weight:800;border-radius:999px;padding:8px 22px;font-size:15px;cursor:pointer;margin:18px auto 6px}
.center{text-align:center}
.footer{background:var(--dgreen);color:#fff;text-align:center;font-size:12px;padding:10px 14px;margin-top:26px}
@media print{@page{size:A4;margin:11mm}.no-print{display:none!important}body{background:#fff}.wrap{max-width:none;padding:0}ol.steps li,ul.donts li,.card,.gold,.danger{break-inside:avoid}}
`;

function chartHtml(h, L) {
  if (!h.chart) return "";
  const head = h.chart.head[L].map((c) => `<th>${esc(c)}</th>`).join("");
  const rows = h.chart.rows[L].map((r) => `<tr>${r.map((c, j) => (j === 0 ? `<td><b>${esc(c)}</b></td>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("");
  return `<div class="chart-t">${esc(h.chartTitle[L])}</div><table class="bt"><tr>${head}</tr>${rows}</table>`;
}

function booklet(h, L) {
  const grp = h.grp === "hb" ? T.hb[L] : T.care[L];
  let body = "";
  body += `<div class="cover"><div class="badge">${h.icon}</div><h1>${esc(h.title[L])}</h1><div class="meta">${h.grp === "hb" ? "📖" : "🩺"} ${esc(grp)} • ${esc(LANGN[L])}</div><p class="about">${esc(h.about[L])}</p>`;
  if (h.pearl) body += `<div class="gold"><b>${esc(h.pearl[L])}</b></div>`;
  body += `<div class="center no-print"><button class="printbtn" onclick="window.print()">${esc(T.print[L])}</button></div></div>`;
  if (h.breath) body += `<div class="card">🫁 ${esc(HAND_BREATH[L])}</div>`;
  if (h.dose) body += `<div class="bar b">${esc(T.dose[L])}</div><div class="card">⚖️ ${esc(T.doseTxt[L])}</div>`;
  if (h.play) {
    for (const b of h.bands) {
      body += `<div class="band-h">🧸 ${esc(b.label[L])}</div><ol class="steps">${b.bullets[L].map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
    }
  } else {
    body += `<div class="bar o">${esc(T.do[L])}</div><ol class="steps">${h.bullets[L].map((x) => `<li>${esc(x)}</li>`).join("")}</ol>`;
    body += chartHtml(h, L);
    body += `<div class="bar r">${esc(T.dont[L])}</div><ul class="donts">${h.dont[L].map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`;
    body += `<div class="bar t">${esc(T.expect[L])}</div><div class="card">${esc(h.expect[L])}</div>`;
    body += `<div class="bar r" style="background:var(--red)">🚨 ${esc(T.doc[L])}</div><div class="danger"><b>${esc(h.red[L])}</b></div>`;
  }
  return `<!DOCTYPE html>
<html lang="${L}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(h.title[L])} — KidGrow</title>
<style>${CSS}</style>
</head>
<body>
<div class="topbar"><span>${esc(T.brand[L])}</span><span>${h.icon} ${esc(grp)}</span></div>
<div class="wrap">${body}</div>
<div class="footer">KidGrow Pro • ${esc(T.foot[L])}</div>
</body>
</html>`;
}

let n = 0;
for (const h of HANDOUTS) {
  for (const L of ["en", "ta", "hi"]) {
    fs.writeFileSync(path.join(R, "handbook", `booklet-${h.id}-${L}.html`), booklet(h, L));
    n++;
  }
}
console.log(`booklets written: ${n} (${HANDOUTS.length} topics x 3 langs)`);

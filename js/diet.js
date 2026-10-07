/* =====================================================
   KidGrow Pro — Diet planner + thali chart (Round 4)
   Needs rounded from ICMR-NIN 2020 for counselling.
   Screening aid — individualise for illness/recovery.
   ===================================================== */
function dietNeeds(ageM, sex) {
  const M = (early, bf, lunch, eve, din) => [`Early morning: ${early}`, `Breakfast: ${bf}`, `Lunch: ${lunch}`, `Evening: ${eve}`, `Dinner: ${din}`];
  if (ageM < 6) return {
    band: "0–6 months", kcal: "—", protein: "—", freq: "On demand, 8–12×/day",
    portions: [{ g: "Breastmilk", q: "Exclusive — nothing else, not even water" }],
    menu: M("Breastfeed", "Breastfeed", "Breastfeed", "Breastfeed", "Breastfeed + night feeds"),
    note: "Exclusive breastfeeding to 6 months. Mother needs +600 kcal/day + fluids + iron/calcium.",
  };
  if (ageM < 12) return {
    band: "6–12 months", kcal: "≈650 total (≈350 from foods)", protein: "≈10 g", freq: "2–3 meals + 1–2 snacks + breastfeeds",
    portions: [{ g: "Cereal porridge", q: "½–¾ katori × 2 (rice / ragi / suji)" }, { g: "Dal", q: "2–3 tbsp mashed" }, { g: "Vegetables", q: "2–3 tbsp mashed" }, { g: "Fruit", q: "½ banana / mango" }, { g: "Oil / ghee", q: "2–3 tsp across meals" }, { g: "Milk", q: "Breastfeeds (no cow milk as drink)" }],
    menu: M("Breastfeed", "Ragi / rice porridge + fruit mash", "Dal-rice khichdi + ghee + veg mash", "Banana / papaya mash + breastfeed", "Suji / rice porridge + breastfeed"),
    note: "Start 2–3 spoons once daily; build to ¾ katori × 3 + snacks by 9 mo. 1 new food per 3 days.",
  };
  if (ageM < 36) return {
    band: "1–3 years", kcal: "≈1000", protein: "≈13 g", freq: "3 meals + 2 snacks",
    portions: [{ g: "Rice", q: "1–1.5 katori" }, { g: "Roti", q: "1–2" }, { g: "Dal / pulses", q: "1 katori" }, { g: "Vegetables", q: "1 katori" }, { g: "Fruit", q: "1" }, { g: "Milk / curd", q: "500 mL" }, { g: "Oil / ghee", q: "3–4 tsp" }],
    menu: M("Milk 1 glass", "Idli / dosa / upma + milk", "Rice + dal + veg + curd", "Fruit + groundnut / jaggery snack", "Chapati + dal-veg + milk"),
    note: "Egg eaters: +1 egg at breakfast. Non-veg: egg daily or meat/fish 2–3×/week at lunch.",
  };
  if (ageM < 72) return {
    band: "4–6 years", kcal: "≈1350", protein: "≈16 g", freq: "3 meals + 2 snacks + tiffin",
    portions: [{ g: "Rice", q: "1.5–2 katori" }, { g: "Roti", q: "2–3" }, { g: "Dal / pulses", q: "1–1.5 katori" }, { g: "Vegetables", q: "1.5 katori" }, { g: "Fruit", q: "1–2" }, { g: "Milk / curd", q: "500 mL" }, { g: "Oil / ghee", q: "4–5 tsp" }],
    menu: M("Milk + soaked almonds (4–5)", "Veg paratha / pongal + chutney + milk", "Rice + sambar + veg + curd + appalam", "Sprouts salad / fruit + milk", "Chapati + dal + veg + milk"),
    note: "Egg eaters: 1 egg daily. Non-veg: egg daily or meat/fish 3×/week. Tiffin: veg roll / idli / groundnut ladoo.",
  };
  if (ageM < 120) return {
    band: "7–9 years", kcal: "≈1700", protein: "≈23 g", freq: "3 meals + 2 snacks + tiffin",
    portions: [{ g: "Rice", q: "2–2.5 katori" }, { g: "Roti", q: "3–4" }, { g: "Dal / pulses", q: "1.5 katori" }, { g: "Vegetables", q: "2 katori" }, { g: "Fruit", q: "2" }, { g: "Milk / curd", q: "500 mL" }, { g: "Groundnuts", q: "30 g" }, { g: "Oil / ghee", q: "5 tsp" }],
    menu: M("Milk + almonds", "Dosa / poha / veg sandwich + milk", "Rice + dal + 2 veg + curd", "Fruit + roasted groundnuts / sundal", "Chapati + paneer/egg-veg + dal + milk"),
    note: "Protein at every meal. Limit packets/chips/cola — 'sometimes foods'.",
  };
  if (ageM < 156) return {
    band: "10–12 years", kcal: "≈2100", protein: "≈33 g", freq: "3 meals + 2 snacks + tiffin",
    portions: [{ g: "Rice", q: "2.5–3 katori" }, { g: "Roti", q: "4" }, { g: "Dal / pulses", q: "2 katori" }, { g: "Vegetables", q: "2 katori" }, { g: "Fruit", q: "2" }, { g: "Milk / curd", q: "500 mL" }, { g: "Oil / ghee", q: "5–6 tsp" }],
    menu: M("Milk + almonds + banana", "Paratha / idli-sambar / eggs + milk", "Rice + dal + veg + curd + salad", "Fruit + sundal / peanut chikki", "Chapati + dal + paneer/veg + milk"),
    note: "Pre-teen growth spurt — do not skip breakfast. 60 min active play.",
  };
  const boy = sex !== "girl";
  return {
    band: boy ? "13–18 years (boys)" : "13–18 years (girls)", kcal: boy ? "≈2850" : "≈2450", protein: boy ? "≈55 g" : "≈45 g", freq: "3 meals + 2–3 snacks",
    portions: [{ g: "Rice", q: "3–4 katori" }, { g: "Roti", q: "4–6" }, { g: "Dal / pulses", q: "2 katori" }, { g: "Vegetables", q: "2–3 katori" }, { g: "Fruit", q: "2" }, { g: "Milk / curd", q: "500–750 mL" }, { g: "Oil / ghee", q: "6 tsp" }, { g: "Protein food", q: "Egg / meat / paneer / soya daily" }],
    menu: M("Milk + banana + nuts", "Eggs / paneer bhurji + paratha + milk", "Rice + dal + 2 veg + curd + salad", "Fruit + milk / buttermilk + sundal", "Chapati + dal + veg + paneer + milk"),
    note: (boy ? "Rapid growth — protein + calcium + iron at every meal. " : "Iron + calcium critical — greens + ragi + jaggery + Vit C foods. ") + "No crash diets, no supplement stacks without advice.",
  };
}
/* Balanced-thali donut (pure, fixed ICMR-style proportions) */
function thaliSVG() {
  const segs = [["Cereals", 35, "#f59e0b"], ["Vegetables", 25, "#22c55e"], ["Protein (dal/egg/meat)", 15, "#ef4444"], ["Fruits", 10, "#a855f7"], ["Dairy", 10, "#38bdf8"], ["Oils & nuts", 5, "#92400e"]];
  const cx = 100, cy = 100, R = 80, r = 46;
  let a0 = -Math.PI / 2, paths = "";
  const pt = (a, rr) => `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  segs.forEach(([l, p, col]) => {
    const a1 = a0 + (p / 100) * Math.PI * 2, large = p > 50 ? 1 : 0;
    paths += `<path d="M${pt(a0, R)} A${R},${R} 0 ${large},1 ${pt(a1, R)} L${pt(a1, r)} A${r},${r} 0 ${large},0 ${pt(a0, r)} Z" fill="${col}" stroke="#fff" stroke-width="2"><title>${l} ${p}%</title></path>`;
    a0 = a1;
  });
  return `<svg viewBox="0 0 200 200" style="width:190px;height:auto">${paths}<text x="100" y="96" text-anchor="middle" font-size="15" font-weight="800" fill="#0f172a">My</text><text x="100" y="114" text-anchor="middle" font-size="15" font-weight="800" fill="#0f172a">Thali</text></svg>
  <div style="font-size:12.5px">${segs.map(([l, p, col]) => `<div><span style="display:inline-block;width:11px;height:11px;border-radius:3px;background:${col}"></span> ${l} — ${p}%</div>`).join("")}</div>`;
}
function dietOf(c) { c.diet = c.diet || { type: "veg" }; return c.diet; }
function renderDiet() {
  if (!$("pg-diet")) return;
  const c = child();
  if (!c) { $("dietBox").innerHTML = `<div class="empty">No child selected.</div>`; return; }
  const d = dietOf(c);
  const ageM = ageBetween(c.dob).years * 12 + ageBetween(c.dob).months;
  const needs = dietNeeds(ageM, c.sex);
  let catchup = false;
  try {
    const lm = latestMeasure(c);
    if (lm) { const cl = classifyGrowth(c, lm); const s = ((cl.wt && cl.wt.sev) || "") + ((cl.bmi && cl.bmi.sev) || ""); if (/(red|amber)/.test(s) && !/overweight|obes/i.test((cl.bmi && cl.bmi.label) || "")) catchup = true; }
  } catch (e) {}
  let anaemic = false;
  try {
    const labs = [...(c.labs || [])].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    const last = labs[labs.length - 1];
    if (last && +last.hb > 0 && typeof hbClass === "function") { const h = hbClass(ageM, +last.hb); anaemic = h && h.band !== "normal" && h.band !== "infant"; }
  } catch (e) {}
  const swap = d.type === "veg" ? "Vegetarian plan — combine cereals + pulses every meal (khichdi, dal-roti) + milk + groundnuts for complete protein."
    : d.type === "egg" ? "Egg plan — 1 egg daily on top of the vegetarian base."
    : "Non-veg plan — egg daily or meat/fish 2–4×/week on top of the vegetarian base.";
  $("dietBox").innerHTML = `
  <div class="toolbar"><span style="font-size:13px;color:var(--muted)">ICMR-NIN 2020 based · age band <b>${esc(needs.band)}</b></span>
    <span class="sp"></span>
    <select id="dietType" onchange="dietOf(child()).type=this.value;save();renderDiet()" style="max-width:150px">
      ${["veg", "egg", "nonveg"].map((o) => `<option value="${o}"${d.type === o ? " selected" : ""}>${o === "veg" ? "🥬 Veg" : o === "egg" ? "🥚 Eggetarian" : "🍗 Non-veg"}</option>`).join("")}</select>
    <button class="btn btn-o btn-sm" onclick="printPage('pg-diet')">🖨️ Print chart</button></div>
  <div class="grid g2">
    <div class="card"><h3>🎯 Daily needs</h3>
      <dl class="kv"><dt>Energy</dt><dd><b>${esc(String(needs.kcal))} kcal</b></dd><dt>Protein</dt><dd><b>${esc(String(needs.protein))}</b></dd><dt>Meals</dt><dd>${esc(needs.freq)}</dd></dl>
      <div class="hint">${esc(needs.note || "")}</div>
      <div class="hint">${esc(swap)}</div>
      <h3 style="margin-top:10px">🍽️ Balanced thali</h3>
      <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">${thaliSVG()}</div>
    </div>
    <div class="card"><h3>🧺 Daily portions (household measures)</h3>
      <table class="tbl"><tr><th>Food group</th><th>How much</th></tr>${needs.portions.map((p) => `<tr><td><b>${esc(p.g)}</b></td><td>${esc(p.q)}</td></tr>`).join("")}</table>
    </div>
  </div>
  <div style="height:16px"></div>
  <div class="card"><h3>📅 Sample day menu</h3>
    <table class="tbl">${needs.menu.map((m) => { const i = m.indexOf(":"); return `<tr><td style="white-space:nowrap"><b>${esc(m.slice(0, i))}</b></td><td>${esc(m.slice(i + 1).trim())}</td></tr>`; }).join("")}</table>
    ${catchup ? `<div class="alert a-amber">🍚 <div><b>Catch-up feeding (undernourished):</b> one EXTRA meal daily + 2 tsp oil/ghee in each meal + egg / groundnut / milk every day. Weekly weight check until recovered. Treat worms, anaemia, infections in parallel.</div></div>` : ""}
    ${anaemic ? `<div class="alert a-amber">🩸 <div><b>Anaemia diet:</b> ragi, bajra, greens (murungai / arai keerai), jaggery, dates, groundnuts, egg yolk, meat + Vit-C foods (guava, amla, lemon) WITH meals. Tea/coffee AWAY from meals. Continue iron medicine — food alone won't correct moderate anaemia fast.</div></div>` : ""}
    <div class="hint">Water: safe boiled/cooled, freely. Sweets/packets/cola: only sometimes. This chart counsels — it does not replace individual medical advice.</div>
  </div>`;
}

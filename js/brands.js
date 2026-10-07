/* =====================================================================
   KidGrow Pro — Vaccine brands commonly available in India (selectable)
   Indicative list from manufacturer, CDSCO & retail sources; availability
   varies by region and time. Free-text "Other" is always allowed, so the
   record never blocks a clinic using a different brand.
   b = brand · m = manufacturer/marketer · n = usage note
   ===================================================================== */
const COMBO_HEXA = [
  { b: "Hexaxim", m: "Sanofi", n: "Hexavalent DTaP-HepB-Hib-IPV · single shot" },
  { b: "Infanrix Hexa", m: "GSK", n: "Hexavalent DTaP-HepB-Hib-IPV · single shot" },
  { b: "EasySix", m: "Panacea Biotec", n: "Hexavalent DTwP-HepB-Hib-IPV · single shot" },
  { b: "HexaSiil", m: "Serum Institute", n: "Hexavalent DTwP-HepB-Hib-IPV · single shot" },
];
const COMBO_PENTA_WP = [
  { b: "Pentavac SD / PFS", m: "Serum Institute", n: "DTwP-HepB-Hib · needs separate IPV" },
  { b: "EasyFive-TT", m: "Panacea Biotec", n: "DTwP-HepB-Hib · needs separate IPV" },
  { b: "ComBE Five", m: "Biological E", n: "DTwP-HepB-Hib · needs separate IPV" },
];

const BRAND_GROUPS = {
  bcg: { label: "BCG", items: [
    { b: "TUBERVAC", m: "Serum Institute" },
    { b: "Govt. UIP supply", m: "Govt. of India", n: "Most common at birth" },
  ]},
  opv: { label: "Oral Polio (OPV)", items: [
    { b: "Govt. UIP supply (bOPV)", m: "Govt. of India" },
  ]},
  hepb: { label: "Hepatitis B", items: [
    { b: "Engerix-B", m: "GSK" },
    { b: "Genevac-B", m: "Serum Institute" },
    { b: "Shanvac-B", m: "Sanofi (Shanta)" },
    { b: "Revac-B", m: "Bharat Biotech" },
    { b: "Elovac-B", m: "Indian Immunologicals" },
    { b: "Euvax-B", m: "LG Life Sciences" },
    ...COMBO_HEXA.map((x) => ({ ...x, n: "Combo — same shot as DTP/IPV/Hib" })),
    { b: "Govt. UIP supply", m: "Govt. of India" },
  ]},
  dtp: { label: "DTP (DTwP/DTaP) & combos", items: [
    ...COMBO_HEXA,
    { b: "Pentaxim", m: "Sanofi", n: "DTaP-IPV-Hib · needs separate HepB" },
    { b: "Infanrix Penta", m: "GSK", n: "DTaP-IPV-HepB" },
    ...COMBO_PENTA_WP,
    { b: "Infanrix", m: "GSK", n: "DTaP standalone" },
    { b: "Tetraxim", m: "Sanofi", n: "DTaP-IPV · booster use" },
    { b: "EasyFour-TT", m: "Panacea Biotec", n: "DTwP-Hib · booster" },
    { b: "Govt. UIP supply (pentavalent)", m: "Govt. of India" },
  ]},
  ipv: { label: "Polio, inactivated (IPV)", items: [
    { b: "Imovax Polio", m: "Sanofi", n: "Standalone IPV" },
    { b: "Poliorix", m: "GSK", n: "Standalone IPV" },
    ...COMBO_HEXA.map((x) => ({ ...x, n: "Combo — same shot" })),
    { b: "Pentaxim", m: "Sanofi", n: "Combo — same shot" },
    { b: "Govt. fIPV (intradermal)", m: "Govt. of India" },
  ]},
  hib: { label: "Hib", items: [
    { b: "Hiberix", m: "GSK", n: "Standalone Hib" },
    ...COMBO_HEXA.map((x) => ({ ...x, n: "Combo — same shot" })),
    { b: "Pentaxim", m: "Sanofi", n: "Combo — same shot" },
    ...COMBO_PENTA_WP.map((x) => ({ ...x, n: "Combo — same shot" })),
    { b: "EasyFour-TT", m: "Panacea Biotec", n: "DTwP-Hib · booster" },
    { b: "Govt. UIP (pentavalent)", m: "Govt. of India" },
  ]},
  rota: { label: "Rotavirus", items: [
    { b: "Rotavac / Rotavac 5D", m: "Bharat Biotech", n: "3-dose (6, 10, 14 w)" },
    { b: "Rotasiil", m: "Serum Institute", n: "3-dose" },
    { b: "RotaTeq", m: "MSD", n: "3-dose" },
    { b: "Rotasure", m: "Abbott", n: "3-dose" },
    { b: "Rotarix", m: "GSK", n: "RV1 · 2-dose only (6, 10 w)" },
    { b: "Govt. UIP supply (Rotavac)", m: "Govt. of India" },
  ]},
  pcv: { label: "Pneumococcal (PCV)", items: [
    { b: "Prevenar 13", m: "Pfizer", n: "PCV13" },
    { b: "Pneumosil", m: "Serum Institute", n: "PCV10 (SII)" },
    { b: "Synflorix", m: "GSK", n: "PCV10" },
    { b: "Prevenar 20", m: "Pfizer", n: "PCV20 · newer" },
    { b: "Pneumovax 23", m: "MSD", n: "PPSV23 · high-risk ≥2 y, not routine" },
    { b: "Govt. UIP supply (PCV)", m: "Govt. of India" },
  ]},
  flu: { label: "Influenza", items: [
    { b: "Vaxigrip", m: "Sanofi" },
    { b: "Influvac Tetra", m: "Abbott" },
    { b: "Fluarix Tetra", m: "GSK" },
    { b: "Vaxiflu-4", m: "Zydus" },
    { b: "Nasovac", m: "Serum Institute", n: "Nasal spray · seasonal availability" },
  ]},
  mmr: { label: "MMR / MR", items: [
    { b: "Tresivac", m: "Serum Institute" },
    { b: "Priorix", m: "GSK" },
    { b: "M-M-R II", m: "MSD" },
    { b: "Zyvac MMR", m: "Zydus" },
    { b: "MR — Govt. UIP supply", m: "Govt. of India" },
  ]},
  typhoid: { label: "Typhoid", items: [
    { b: "Typbar TCV", m: "Bharat Biotech", n: "Conjugate · WHO-prequalified" },
    { b: "TyphiBEV", m: "Biological E", n: "Conjugate" },
    { b: "Zyvac TCV", m: "Zydus", n: "Conjugate" },
    { b: "PedaTyph", m: "Bio-Med", n: "Vi polysaccharide" },
    { b: "Typhim Vi", m: "Sanofi", n: "Vi polysaccharide · conjugate preferred" },
  ]},
  vita: { label: "Vitamin A", items: [
    { b: "Govt. supply", m: "Govt. of India" },
  ]},
  hepa: { label: "Hepatitis A", items: [
    { b: "Havrix", m: "GSK", n: "Inactivated · 2-dose" },
    { b: "Avaxim", m: "Sanofi", n: "Inactivated · 2-dose" },
    { b: "Vaqta", m: "MSD", n: "Inactivated · 2-dose" },
    { b: "Biovac-A", m: "Wockhardt" },
    { b: "Live Hep A (single-dose)", m: "Various", n: "Only 1 dose if live attenuated" },
  ]},
  je: { label: "Japanese Encephalitis", items: [
    { b: "Jenvac", m: "Bharat Biotech", n: "Inactivated" },
    { b: "JEEV", m: "Biological E", n: "Inactivated" },
    { b: "Govt. campaign supply", m: "Govt. of India" },
  ]},
  varicella: { label: "Varicella", items: [
    { b: "Varilrix", m: "GSK" },
    { b: "Variped", m: "MSD", n: "Oka/Merck strain" },
  ]},
  tdap: { label: "Tdap / Td", items: [
    { b: "Boostrix", m: "GSK" },
    { b: "Adacel", m: "Sanofi" },
    { b: "Td — Govt. supply", m: "Govt. of India", n: "UIP adolescent Td" },
  ]},
  hpv: { label: "HPV", items: [
    { b: "Cervavac", m: "Serum Institute", n: "qHPV 6/11/16/18 · most affordable" },
    { b: "Gardasil", m: "MSD", n: "qHPV 6/11/16/18" },
    { b: "Gardasil 9", m: "MSD", n: "9-valent · broadest cover" },
    { b: "Cervarix", m: "GSK", n: "Bivalent 16/18" },
  ]},
  /* additional / travel / seasonal (used by "Additional vaccines") */
  mening: { label: "Meningococcal", items: [
    { b: "Menactra", m: "Sanofi", n: "MenACWY" },
    { b: "Menveo", m: "GSK", n: "MenACWY" },
    { b: "Nimenrix", m: "Pfizer", n: "MenACWY" },
  ]},
  rabies: { label: "Rabies", items: [
    { b: "Verorab", m: "Sanofi" },
    { b: "Abhayrab", m: "Indian Immunologicals" },
    { b: "Rabivax", m: "Serum Institute" },
    { b: "Govt. supply", m: "Govt. of India" },
  ]},
  cholera: { label: "Cholera", items: [
    { b: "Shanchol", m: "Sanofi (Shanta)", n: "Oral · 2-dose" },
  ]},
  covid: { label: "COVID-19", items: [
    { b: "Covishield", m: "Serum Institute" },
    { b: "Covaxin", m: "Bharat Biotech" },
    { b: "Corbevax", m: "Biological E" },
  ]},
};

const CODE_GROUP = { BCG: "bcg", OPV0: "opv", VITA1: "vita", JE1: "je", TDAP: "tdap" };
function groupForCode(code) {
  if (CODE_GROUP[code]) return CODE_GROUP[code];
  const p = [["DTP", "dtp"], ["IPV", "ipv"], ["HIB", "hib"], ["HEPB", "hepb"], ["ROTA", "rota"],
             ["PCV", "pcv"], ["FLU", "flu"], ["MMR", "mmr"], ["TCV", "typhoid"], ["VAR", "varicella"],
             ["HEPA", "hepa"], ["HPV", "hpv"]];
  for (const [pre, g] of p) if ((code || "").startsWith(pre)) return g;
  return null;
}
function brandsFor(code) {
  const g = groupForCode(code);
  return g && BRAND_GROUPS[g] ? BRAND_GROUPS[g].items : [];
}
function allBrandOptions() {
  const seen = new Set(), out = [];
  Object.values(BRAND_GROUPS).forEach((g) => g.items.forEach((it) => {
    const k = it.b + "|" + it.m;
    if (!seen.has(k)) { seen.add(k); out.push({ ...it, g: g.label }); }
  }));
  return out.sort((a, b) => a.b.localeCompare(b.b));
}
function matchBrand(codeOrNull, typed, mfrTyped) {
  const t = (typed || "").trim();
  if (!t) return { brand: "", mfr: (mfrTyped || "").trim() };
  const pool = [...brandsFor(codeOrNull), ...allBrandOptions()];
  const hit = pool.find((x) => x.b.toLowerCase() === t.toLowerCase());
  if (hit) return { brand: hit.b, mfr: hit.m };
  return { brand: t, mfr: (mfrTyped || "").trim() };
}
const EXTRA_VACCINE_NAMES = ["Rabies (PEP / PrEP)", "Cholera", "Meningococcal ACWY", "Meningococcal B", "COVID-19",
  "Japanese Encephalitis (extra)", "Typhoid booster (extra)", "Influenza (extra dose)", "Hepatitis B (catch-up)",
  "DPT booster (extra)", "MMR (extra)", "Yellow Fever (travel)", "Oral Polio (campaign/pulse)"];

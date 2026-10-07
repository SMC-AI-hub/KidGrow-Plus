/* =====================================================================
   KidGrow Pro — Clinical Reference Data
   Sources (for screening use):
   • Vaccines: IAP ACVIP Immunization Timetable 2023-24 (routine use)
   • Growth 0–5 y: WHO Multicentre Growth Reference Study 2006
     (endorsed by IAP for under-5s)
   • Growth 5–18 y: Revised IAP Growth Charts 2015 (Khadilkar et al.)
   • BMI overweight/obesity: IAP adult-equivalent 23 / 27 lines
   • Milestones: standard pediatric developmental surveillance bands
   DISCLAIMER: screening aid only — confirm borderline cases on
   official printed IAP/WHO charts & clinical judgement.
   ===================================================================== */

const VACCINE_SCHEDULE = [
  {
    id: "birth", label: "At Birth", sub: "Within 24 hours", dueDays: 0, dueMonths: 0,
    note: "BCG before discharge · OPV as soon as possible · Hep-B within 24 hrs",
    vaccines: [
      { code: "BCG", name: "BCG", dose: "Single", protects: "Tuberculosis (severe forms)", route: "Intradermal 0.1 mL", site: "Left upper arm", cat: "UIP + IAP" },
      { code: "OPV0", name: "Oral Polio Vaccine", dose: "Birth dose (OPV-0)", protects: "Poliomyelitis", route: "Oral · 2 drops", site: "Oral", cat: "UIP + IAP" },
      { code: "HEPB-B", name: "Hepatitis B", dose: "Birth dose", protects: "Hepatitis B", route: "IM 0.5 mL", site: "Anterolateral thigh", cat: "UIP + IAP" },
    ]
  },
  {
    id: "w6", label: "6 Weeks", sub: "42 days", dueDays: 42, dueMonths: 1.5,
    note: "Primary series-1 · DTwP or DTaP · IPV 6-10-14 wk schedule",
    vaccines: [
      { code: "DTP1", name: "DTwP / DTaP", dose: "Dose 1", protects: "Diphtheria, Tetanus, Pertussis", route: "IM 0.5 mL", site: "Anterolateral thigh", cat: "UIP + IAP" },
      { code: "IPV1", name: "Inactivated Polio (IPV)", dose: "Dose 1", protects: "Poliomyelitis", route: "IM 0.5 mL (IAP) / ID fIPV (UIP)", site: "Thigh / R upper arm", cat: "UIP + IAP" },
      { code: "HIB1", name: "Hib", dose: "Dose 1", protects: "H. influenzae type b", route: "IM (pentavalent/hexavalent)", site: "Thigh", cat: "UIP + IAP" },
      { code: "HEPB2", name: "Hepatitis B", dose: "Dose 2", protects: "Hepatitis B", route: "IM (combo)", site: "Thigh", cat: "UIP + IAP" },
      { code: "ROTA1", name: "Rotavirus", dose: "Dose 1", protects: "Rotavirus diarrhoea", route: "Oral", site: "Oral", cat: "UIP + IAP" },
      { code: "PCV1", name: "Pneumococcal (PCV)", dose: "Dose 1", protects: "Pneumonia, meningitis, otitis", route: "IM 0.5 mL", site: "Thigh", cat: "UIP + IAP" },
    ]
  },
  {
    id: "w10", label: "10 Weeks", sub: "70 days", dueDays: 70, dueMonths: 2.5,
    note: "Primary series-2",
    vaccines: [
      { code: "DTP2", name: "DTwP / DTaP", dose: "Dose 2", protects: "Diphtheria, Tetanus, Pertussis", route: "IM 0.5 mL", site: "Anterolateral thigh", cat: "UIP + IAP" },
      { code: "IPV2", name: "Inactivated Polio (IPV)", dose: "Dose 2", protects: "Poliomyelitis", route: "IM / ID", site: "Thigh / arm", cat: "UIP + IAP" },
      { code: "HIB2", name: "Hib", dose: "Dose 2", protects: "H. influenzae type b", route: "IM (combo)", site: "Thigh", cat: "UIP + IAP" },
      { code: "ROTA2", name: "Rotavirus", dose: "Dose 2", protects: "Rotavirus diarrhoea", route: "Oral", site: "Oral", cat: "UIP + IAP" },
      { code: "PCV2", name: "Pneumococcal (PCV)", dose: "Dose 2", protects: "Pneumococcal disease", route: "IM 0.5 mL", site: "Thigh", cat: "IAP" },
    ]
  },
  {
    id: "w14", label: "14 Weeks", sub: "98 days", dueDays: 98, dueMonths: 3.5,
    note: "Primary series-3 · completes infant pentavalent/hexavalent course",
    vaccines: [
      { code: "DTP3", name: "DTwP / DTaP", dose: "Dose 3", protects: "Diphtheria, Tetanus, Pertussis", route: "IM 0.5 mL", site: "Anterolateral thigh", cat: "UIP + IAP" },
      { code: "IPV3", name: "Inactivated Polio (IPV)", dose: "Dose 3", protects: "Poliomyelitis", route: "IM / ID", site: "Thigh / arm", cat: "UIP + IAP" },
      { code: "HIB3", name: "Hib", dose: "Dose 3", protects: "H. influenzae type b", route: "IM (combo)", site: "Thigh", cat: "UIP + IAP" },
      { code: "ROTA3", name: "Rotavirus", dose: "Dose 3*", protects: "Rotavirus diarrhoea", route: "Oral", site: "Oral", cat: "UIP + IAP" },
      { code: "PCV3", name: "Pneumococcal (PCV)", dose: "Dose 3", protects: "Pneumococcal disease", route: "IM 0.5 mL", site: "Thigh", cat: "IAP" },
    ]
  },
  {
    id: "m6", label: "6 Months", sub: "180 days", dueDays: 180, dueMonths: 6,
    note: "Hep-B finale · start annual influenza (2 doses 4 wks apart in 1st year)",
    vaccines: [
      { code: "HEPB3", name: "Hepatitis B", dose: "Dose 3", protects: "Hepatitis B", route: "IM 0.5 mL", site: "Thigh", cat: "UIP + IAP" },
      { code: "FLU1", name: "Influenza (IIV)", dose: "Annual dose 1", protects: "Seasonal influenza", route: "IM", site: "Thigh / deltoid", cat: "IAP" },
    ]
  },
  {
    id: "m7", label: "7 Months", sub: "~210 days", dueDays: 210, dueMonths: 7,
    note: "Second flu priming dose (first year only)",
    vaccines: [
      { code: "FLU2", name: "Influenza (IIV)", dose: "Annual dose 2", protects: "Seasonal influenza", route: "IM", site: "Thigh / deltoid", cat: "IAP" },
    ]
  },
  {
    id: "m9", label: "9 Months", sub: "270 days", dueDays: 270, dueMonths: 9,
    note: "MMR from 9 mo (IAP) · MR under UIP · TCV 9–12 mo",
    vaccines: [
      { code: "MMR1", name: "MMR", dose: "Dose 1", protects: "Measles, Mumps, Rubella", route: "SC 0.5 mL", site: "Right upper arm", cat: "UIP(MR) + IAP" },
      { code: "TCV1", name: "Typhoid Conjugate", dose: "Dose 1", protects: "Typhoid fever", route: "IM 0.5 mL", site: "Thigh / deltoid", cat: "IAP" },
      { code: "VITA1", name: "Vitamin A", dose: "1 lakh IU", protects: "Xerophthalmia (supplement)", route: "Oral 1 mL", site: "Oral", cat: "UIP" },
    ]
  },
  {
    id: "m12", label: "12 Months", sub: "1 year", dueDays: 365, dueMonths: 12,
    note: "Hep-A live = 1 dose; killed = 2 doses 6 mo apart",
    vaccines: [
      { code: "HEPA1", name: "Hepatitis A", dose: "Dose 1", protects: "Hepatitis A", route: "IM", site: "Deltoid / thigh", cat: "IAP" },
      { code: "JE1", name: "Japanese Encephalitis*", dose: "Dose 1 (endemic areas)", protects: "Japanese encephalitis", route: "SC/IM", site: "Arm / thigh", cat: "UIP*" },
    ]
  },
  {
    id: "m15", label: "15 Months", sub: "450 days", dueDays: 450, dueMonths: 15,
    note: "Second-year boosters begin",
    vaccines: [
      { code: "MMR2", name: "MMR", dose: "Dose 2", protects: "Measles, Mumps, Rubella", route: "SC 0.5 mL", site: "Right upper arm", cat: "UIP + IAP" },
      { code: "VAR1", name: "Varicella", dose: "Dose 1", protects: "Chickenpox", route: "SC 0.5 mL", site: "Upper arm", cat: "IAP" },
      { code: "PCVB", name: "Pneumococcal (PCV)", dose: "Booster", protects: "Pneumococcal disease", route: "IM 0.5 mL", site: "Thigh / deltoid", cat: "UIP + IAP" },
    ]
  },
  {
    id: "m18", label: "16–18 Months", sub: "~540 days", dueDays: 540, dueMonths: 18,
    note: "Major toddler booster visit · OPV booster till 5 y (UIP)",
    vaccines: [
      { code: "DTPB1", name: "DTwP / DTaP", dose: "Booster 1", protects: "Diphtheria, Tetanus, Pertussis", route: "IM 0.5 mL", site: "Anterolateral thigh", cat: "UIP + IAP" },
      { code: "HIBB", name: "Hib", dose: "Booster", protects: "H. influenzae type b", route: "IM", site: "Thigh", cat: "IAP" },
      { code: "IPVB1", name: "Inactivated Polio (IPV)", dose: "Booster 1", protects: "Poliomyelitis", route: "IM 0.5 mL", site: "Thigh / deltoid", cat: "UIP + IAP" },
      { code: "HEPA2", name: "Hepatitis A", dose: "Dose 2 (killed)", protects: "Hepatitis A", route: "IM", site: "Deltoid", cat: "IAP" },
    ]
  },
  {
    id: "y2", label: "2 Years", sub: "24 months", dueDays: 730, dueMonths: 24,
    note: "Annual influenza continues · TCV booster per product",
    vaccines: [
      { code: "TCVB", name: "Typhoid Conjugate", dose: "Booster", protects: "Typhoid fever", route: "IM 0.5 mL", site: "Deltoid", cat: "IAP" },
      { code: "FLU-Y2", name: "Influenza (IIV)", dose: "Annual", protects: "Seasonal influenza", route: "IM", site: "Deltoid", cat: "IAP" },
    ]
  },
  {
    id: "y5", label: "4–6 Years", sub: "School entry", dueDays: 1825, dueMonths: 60,
    note: "Pre-school boosters — due any time 4–6 y",
    vaccines: [
      { code: "DTPB2", name: "DTwP / DTaP", dose: "Booster 2", protects: "Diphtheria, Tetanus, Pertussis", route: "IM 0.5 mL", site: "Deltoid", cat: "UIP + IAP" },
      { code: "IPVB2", name: "Inactivated Polio (IPV)", dose: "Booster 2", protects: "Poliomyelitis", route: "IM 0.5 mL", site: "Deltoid", cat: "IAP" },
      { code: "MMR3", name: "MMR", dose: "Dose 3", protects: "Measles, Mumps, Rubella", route: "SC 0.5 mL", site: "Upper arm", cat: "IAP" },
      { code: "VAR2", name: "Varicella", dose: "Dose 2", protects: "Chickenpox", route: "SC 0.5 mL", site: "Upper arm", cat: "IAP" },
    ]
  },
  {
    id: "y10", label: "10–12 Years", sub: "Pre-adolescent", dueDays: 3650, dueMonths: 120,
    note: "Tdap once · HPV 9–14 y: 2 doses (0, 6 mo); ≥15 y or immunocompromised: 3 doses",
    vaccines: [
      { code: "TDAP", name: "Tdap", dose: "Single", protects: "Tetanus, diphtheria, pertussis", route: "IM 0.5 mL", site: "Deltoid", cat: "UIP(Td) + IAP" },
      { code: "HPV1", name: "HPV (Cervavac/Gardasil)", dose: "Dose 1 (9–14 y)", protects: "HPV / cervical cancer", route: "IM 0.5 mL", site: "Deltoid", cat: "IAP" },
      { code: "HPV2", name: "HPV", dose: "Dose 2 (6 mo later)", protects: "HPV / cervical cancer", route: "IM 0.5 mL", site: "Deltoid", cat: "IAP" },
    ]
  },
];

/* ==================== DEVELOPMENTAL MILESTONES (0–60 mo) ====================
   Domains: GM = Gross motor · FM = Fine motor · LG = Language/hearing
            SC = Social / adaptive / cognitive            */
const MILESTONES = [
  { band: "Birth – 1 month", min: 0, max: 1,
    items: [
      { d: "GM", t: "Lifts head briefly when prone" },
      { d: "GM", t: "Moves arms & legs symmetrically" },
      { d: "FM", t: "Hands mostly fisted, grasp reflex present" },
      { d: "LG", t: "Startles to loud sound · quiets to voice" },
      { d: "SC", t: "Regards faces, prefers human face" },
      { d: "SC", t: "Feeds well, consolable when held" },
    ],
    red: ["No Moro/startle response", "Poor suck or poor feeding", "Excessive sleepiness / floppiness", "Asymmetric limb movement"] },
  { band: "2 months", min: 1, max: 2.5,
    items: [
      { d: "GM", t: "Lifts chest & head 45° in prone" },
      { d: "GM", t: "Diminishing head lag on pull-to-sit" },
      { d: "FM", t: "Hands frequently open" },
      { d: "FM", t: "Tracks objects past midline" },
      { d: "LG", t: "Coos, gurgles, varied crying" },
      { d: "SC", t: "Social smile in response to people" },
    ],
    red: ["No social smile by 8 weeks", "Does not fix / follow with eyes", "Persistent fisting after 2 mo"] },
  { band: "3 – 4 months", min: 2.5, max: 4.5,
    items: [
      { d: "GM", t: "Pushes up on forearms in prone, head steady" },
      { d: "GM", t: "Rolls front → back" },
      { d: "GM", t: "Tripod sitting with support, no head lag" },
      { d: "FM", t: "Reaches for & bats at toys, hands to midline" },
      { d: "LG", t: "Laughs aloud, squeals, coos responsively" },
      { d: "SC", t: "Recognises mother, enjoys face-to-face play" },
    ],
    red: ["Head lag persists", "Not reaching for objects", "No cooing / vocalising"] },
  { band: "5 – 6 months", min: 4.5, max: 6.5,
    items: [
      { d: "GM", t: "Sits with support, then briefly alone (tripod)" },
      { d: "GM", t: "Rolls both ways (back ↔ tummy)" },
      { d: "GM", t: "Bears weight on legs when held standing" },
      { d: "FM", t: "Transfers objects hand-to-hand, mouths toys" },
      { d: "LG", t: "Babbles with consonants (ba, da, ma)" },
      { d: "SC", t: "Stranger awareness begins · reaches to be picked up" },
    ],
    red: ["Cannot sit even with support", "Not rolling either way", "No babbling", "Does not respond to name sounds"] },
  { band: "7 – 9 months", min: 6.5, max: 9.5,
    items: [
      { d: "GM", t: "Sits steadily without support" },
      { d: "GM", t: "Creeps / crawls, pulls to stand" },
      { d: "FM", t: "Raking → early pincer grasp · bangs cubes" },
      { d: "FM", t: "Looks for dropped / hidden object (permanence)" },
      { d: "LG", t: "“Mama/Dada” non-specific · understands “no”" },
      { d: "SC", t: "Peek-a-boo, stranger anxiety, waves bye" },
    ],
    red: ["Cannot sit unsupported by 9 mo", "No babbling with consonants", "Does not look for hidden toys", "Hand preference already fixed"] },
  { band: "10 – 12 months", min: 9.5, max: 12.5,
    items: [
      { d: "GM", t: "Cruises along furniture · first independent steps" },
      { d: "GM", t: "Sit ↔ stand transitions alone" },
      { d: "FM", t: "Mature pincer grasp · puts objects in container" },
      { d: "FM", t: "Releases on request, points with index finger" },
      { d: "LG", t: "First true words (mama/dada + 1–2)" },
      { d: "SC", t: "Follows 1-step command with gesture · imitates play" },
    ],
    red: ["Not pulling to stand", "No pincer grasp", "No true words or pointing by 12 mo", "No bye-bye / joint attention"] },
  { band: "13 – 15 months", min: 12.5, max: 15.5,
    items: [
      { d: "GM", t: "Walks independently (wide gait)" },
      { d: "GM", t: "Creeps upstairs · stoops to pick up toy" },
      { d: "FM", t: "Stacks 2 cubes · scribbles spontaneously" },
      { d: "LG", t: "3–6 words · follows 1-step command without gesture" },
      { d: "SC", t: "Drinks from cup · indicates wants (point/cry)" },
      { d: "SC", t: "Shows affection, separation protest" },
    ],
    red: ["Not walking by 15 mo — refer", "No words", "Does not point to needs", "Loss of previously acquired skills"] },
  { band: "16 – 18 months", min: 15.5, max: 18.5,
    items: [
      { d: "GM", t: "Walks backwards · runs stiffly · climbs on furniture" },
      { d: "GM", t: "Walks stairs with hand held" },
      { d: "FM", t: "Stacks 3–4 cubes · turns pages 2–3 at a time" },
      { d: "LG", t: "10–20 words · names 1–2 pictures · 50% intelligible to strangers: no" },
      { d: "SC", t: "Feeds self with spoon (messy) · symbolic play begins" },
      { d: "SC", t: "Points to 1 body part on request" },
    ],
    red: ["Not walking steadily", "Fewer than 6 words", "No pretend play", "Poor eye contact"] },
  { band: "19 – 24 months", min: 18.5, max: 24.5,
    items: [
      { d: "GM", t: "Runs well · kicks ball · walks stairs 2-feet/step alone" },
      { d: "GM", t: "Jumps in place · throws ball overhand" },
      { d: "FM", t: "Stacks 6 cubes · draws vertical line · removes clothes" },
      { d: "LG", t: "50+ words · 2-word phrases · follows 2-step commands" },
      { d: "SC", t: "Parallel play · knows “mine” · toilet interest begins" },
      { d: "SC", t: "Points to 3–4 body parts · sorts shapes" },
    ],
    red: ["No 2-word phrases by 24 mo — refer", "Cannot run / frequent falls", "No pretend play", "Speech <50% clear to family"] },
  { band: "2 – 2½ years", min: 24.5, max: 30.5,
    items: [
      { d: "GM", t: "Climbs stairs alternating feet (with rail) · jumps forward" },
      { d: "GM", t: "Pedals tricycle (by 30 mo) · stands on one foot briefly" },
      { d: "FM", t: "Draws circle · stacks 8 cubes · strings 2–4 beads" },
      { d: "LG", t: "200+ words · 3-word sentences · asks “what/where”" },
      { d: "SC", t: "Imaginative play · unbuttons · dry by day emerging" },
      { d: "SC", t: "Knows full name · counts to 3" },
    ],
    red: ["Speech mostly unintelligible", "Cannot follow 2-step commands", "No symbolic play", "Not combining words"] },
  { band: "2½ – 3 years", min: 30.5, max: 36.5,
    items: [
      { d: "GM", t: "Pedals tricycle smoothly · climbs well" },
      { d: "GM", t: "Hops on one foot 2–3 times · catches large ball" },
      { d: "FM", t: "Copies circle & cross · draws person (2–3 parts)" },
      { d: "LG", t: "3–4 word sentences · 75% intelligible · plurals & pronouns" },
      { d: "SC", t: "Takes turns · dresses with help · toilet trained mostly" },
      { d: "SC", t: "Knows age, gender · counts to 10" },
    ],
    red: ["Speech <75% intelligible to strangers", "Cannot pedal / climb stairs alternating", "No interactive play", "Persistent toe-walking / drooling"] },
  { band: "3 – 4 years", min: 36.5, max: 48.5,
    items: [
      { d: "GM", t: "Hops on one foot 5 sec · stairs unsupported alternating" },
      { d: "GM", t: "Throws overhand · catches bounced ball" },
      { d: "FM", t: "Copies square · draws person (4+ parts) · uses scissors" },
      { d: "LG", t: "Tells stories · 100% intelligible · asks “why” constantly" },
      { d: "SC", t: "Cooperative play · shares · follows 3-step commands" },
      { d: "SC", t: "Knows colours · counts to 20 · toilet independent" },
    ],
    red: ["Speech unclear / stammer persists >6 mo", "Cannot hop or use stairs alternating", "No group play · cannot follow rules", "Cannot draw a circle"] },
  { band: "4 – 5 years", min: 48.5, max: 61,
    items: [
      { d: "GM", t: "Skips · balances 1 foot 10 sec · somersault" },
      { d: "GM", t: "Climbs, swings independently · catches small ball" },
      { d: "FM", t: "Copies triangle · prints letters/numbers · colours within lines" },
      { d: "LG", t: "Narrates experiences · future tense · knows address" },
      { d: "SC", t: "Follows rules · dresses alone · hand preference set" },
      { d: "SC", t: "Counts to 20+ · identifies coins/letters · plays board games" },
    ],
    red: ["Cannot skip / balance 5 sec", "Cannot copy square", "Speech errors beyond r/l/s", "No friendships · extreme behaviour issues"] },
];

const DOMAIN_META = {
  GM: { label: "Gross Motor", color: "#0ea5e9", icon: "🏃" },
  FM: { label: "Fine Motor", color: "#8b5cf6", icon: "✋" },
  LG: { label: "Language & Hearing", color: "#f59e0b", icon: "🗣️" },
  SC: { label: "Social / Adaptive", color: "#10b981", icon: "🤝" },
};

/* ============ GROWTH REFERENCE (median M + dispersion S) ============
   0–5 y values track WHO MGRS 2006; 5–18 y track revised IAP 2015.
   Percentiles derived by LMS: X = M·(1+L·S·z)^(1/L).
   z: P3=-1.881, P10=-1.282, P25=-0.674, P50=0, P75=+0.674, P90=+1.282, P97=+1.881 */
const LMS_Z = { p3: -1.8808, p10: -1.2816, p25: -0.6745, p50: 0, p75: 0.6745, p90: 1.2816, p97: 1.8808 };
const LMS_L = { wt: -0.35, ht: 1.0, hc: 1.0, bmi: -1.4 };

/* anchor months shared by all series */
const G_AGES = [0,1,2,3,4,5,6,9,12,15,18,21,24,30,36,42,48,54,60,72,84,96,108,120,132,144,156,168,180,192,204,216];

const GROWTH_REF = {
  boy: {
    wtM: [3.3,4.5,5.6,6.4,7.0,7.5,7.9,8.9,9.6,10.3,10.9,11.5,12.2,13.3,14.3,15.3,16.3,17.3,18.3,20.7,23.1,25.4,28.2,31.0,34.5,39.0,44.5,51.0,56.5,60.0,62.5,64.0],
    wtS: [0.13,0.12,0.11,0.11,0.105,0.105,0.105,0.105,0.105,0.106,0.107,0.108,0.109,0.111,0.113,0.115,0.117,0.119,0.12,0.125,0.13,0.135,0.14,0.145,0.15,0.15,0.145,0.14,0.135,0.13,0.13,0.13],
    htM: [49.9,54.7,58.4,61.4,63.9,65.9,67.6,72.0,75.7,79.1,82.3,85.1,87.8,92.8,96.1,99.8,103.3,106.7,110.0,116.0,121.5,126.5,131.5,137.0,143.0,149.5,157.5,165.5,170.5,172.5,173.5,174.5],
    htS: [0.038,0.036,0.034,0.033,0.032,0.032,0.032,0.032,0.033,0.034,0.034,0.035,0.035,0.036,0.037,0.037,0.038,0.038,0.038,0.039,0.04,0.041,0.042,0.043,0.045,0.046,0.045,0.043,0.042,0.041,0.041,0.041],
    hcM: [34.5,37.3,39.1,40.5,41.6,42.6,43.3,45.2,46.1,46.8,47.4,47.9,48.3,48.9,49.6,50.0,50.5,50.9,51.2,51.9,52.4,52.8,53.1,53.4,53.7,54.0,54.3,54.6,54.8,55.0,55.0,55.0],
    hcS: [0.035,0.033,0.032,0.031,0.031,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031],
  },
  girl: {
    wtM: [3.2,4.2,5.1,5.8,6.4,6.9,7.3,8.2,8.9,9.6,10.2,10.9,11.5,12.7,13.9,14.9,15.9,16.9,17.9,20.2,22.9,25.5,28.5,31.9,35.5,40.0,45.0,49.0,51.5,53.5,54.8,55.5],
    wtS: [0.135,0.125,0.115,0.11,0.108,0.106,0.105,0.105,0.106,0.107,0.108,0.109,0.11,0.112,0.114,0.116,0.118,0.12,0.122,0.127,0.132,0.137,0.14,0.143,0.145,0.143,0.14,0.138,0.136,0.135,0.135,0.135],
    htM: [49.1,53.7,57.1,59.8,62.1,64.0,65.7,70.1,74.0,77.5,80.7,83.7,86.4,91.5,95.1,99.0,102.7,106.2,109.4,115.7,121.2,126.6,132.0,137.5,143.5,149.0,153.5,156.5,157.5,158.0,158.2,158.3],
    htS: [0.038,0.036,0.034,0.033,0.032,0.032,0.032,0.032,0.033,0.034,0.034,0.035,0.035,0.036,0.037,0.037,0.038,0.038,0.038,0.039,0.04,0.041,0.042,0.043,0.044,0.044,0.043,0.042,0.041,0.041,0.041,0.041],
    hcM: [33.9,36.6,38.3,39.5,40.6,41.5,42.2,44.0,44.9,45.6,46.2,46.7,47.2,47.8,48.5,48.9,49.3,49.7,50.1,50.8,51.3,51.7,52.0,52.3,52.6,52.9,53.1,53.3,53.4,53.5,53.5,53.5],
    hcS: [0.036,0.034,0.033,0.032,0.031,0.031,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.03,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031,0.031],
  }
};
/* BMI medians derived from wt/ht medians; S approximated */
const BMI_S = [0.085,0.085,0.085,0.084,0.083,0.082,0.082,0.08,0.08,0.08,0.08,0.08,0.08,0.08,0.082,0.084,0.086,0.088,0.09,0.095,0.10,0.105,0.11,0.115,0.12,0.12,0.118,0.115,0.113,0.112,0.112,0.112];

/* IAP 2015 adult-equivalent BMI cut lines (approx by age) — overweight ≈23, obesity ≈27 at 18y */
const IAP_BMI_LINES = {
  boy: {
    ages: [60,72,84,96,108,120,132,144,156,168,180,192,204,216],
    ov:   [16.0,16.2,16.5,17.0,17.6,18.3,19.0,19.8,20.6,21.4,22.0,22.5,22.8,23.0],
    ob:   [18.2,18.4,18.7,19.2,19.9,20.7,21.7,22.7,23.8,24.9,25.7,26.3,26.7,27.0],
    uw:   [13.6,13.5,13.4,13.4,13.5,13.8,14.2,14.8,15.4,16.0,16.5,16.8,17.0,17.0],
  },
  girl: {
    ages: [60,72,84,96,108,120,132,144,156,168,180,192,204,216],
    ov:   [16.0,16.3,16.7,17.2,17.9,18.6,19.3,20.1,20.8,21.5,22.0,22.4,22.7,23.0],
    ob:   [18.3,18.6,19.0,19.5,20.3,21.2,22.1,23.1,24.1,25.1,25.9,26.4,26.8,27.0],
    uw:   [13.4,13.3,13.2,13.2,13.3,13.6,14.0,14.6,15.2,15.7,16.0,16.3,16.5,16.5],
  }
};

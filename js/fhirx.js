/* NeoKid Care — client-side FHIR R4 Bundle export (Phase 8, per child).
   Pure builder over the local record: Patient + Immunization + growth/Hb
   Observations + Encounters + AllergyIntolerance + Consents. Complements the
   server read facade (api/fhir). National health-ID support removed 2026-10-27 (see F12). */
function fhirClean(o) {
  if (Array.isArray(o)) return o.map(fhirClean);
  if (o && typeof o === "object") {
    const n = {};
    for (const k of Object.keys(o)) {
      const v = fhirClean(o[k]);
      if (v !== null && v !== undefined && v !== "") n[k] = v;
    }
    return n;
  }
  return o;
}
function fhirPatient(c) {
  return fhirClean({
    resourceType: "Patient", id: String(c.id || ""),
    identifier: [{ system: "urn:kidgrow:mrn", value: c.mrn || c.id || "" }],
    name: [{ text: c.name || "" }],
    gender: c.sex === "boy" ? "male" : c.sex === "girl" ? "female" : "unknown",
    birthDate: c.dob || undefined,
    telecom: c.phone ? [{ system: "phone", value: c.phone }] : undefined,
    contact: [c.father ? { relationship: [{ text: "father" }], name: { text: c.father } } : null,
      c.mother ? { relationship: [{ text: "mother" }], name: { text: c.mother } } : null].filter(Boolean),
    extension: [
      c.gest ? { url: "urn:kidgrow:ga-weeks", valueDecimal: +c.gest } : null,
      c.birthWt ? { url: "urn:kidgrow:birth-weight-g", valueInteger: Math.round(+c.birthWt * 1000) } : null,
    ].filter(Boolean),
  });
}
function fhirImms(c) {
  const out = [];
  try {
    const sched = (typeof VACCINE_SCHEDULE !== "undefined") ? VACCINE_SCHEDULE : [];
    for (const v of sched) {
      for (const vx of (v.vaccines || [])) {
        const r = (c.vaccines || {})[vx.code];
        if (!r || !r.date) continue;
        out.push(fhirClean({
          resourceType: "Immunization", id: `imm-${vx.code}`,
          status: "completed",
          vaccineCode: { coding: [{ system: "urn:kidgrow:vax", code: vx.code, display: `${vx.name} ${vx.dose || ""}`.trim() }], text: `${vx.name} ${vx.dose || ""}`.trim() },
          patient: { reference: `Patient/${c.id}` },
          occurrenceDateTime: r.date,
          manufacturer: r.mfr ? { display: r.mfr } : undefined,
          lotNumber: r.batch || undefined,
        }));
      }
    }
  } catch (e) {}
  return out;
}
function fhirObs(c) {
  const out = [];
  try {
    for (const m of (c.measures || [])) {
      if (!m || !m.date) continue;
      const base = { resourceType: "Observation", status: "final", subject: { reference: `Patient/${c.id}` }, effectiveDateTime: m.date };
      if (+m.wt > 0) out.push(fhirClean({ ...base, id: `wt-${m.date}`, code: { coding: [{ system: "http://loinc.org", code: "29463-7", display: "Body weight" }] }, valueQuantity: { value: +m.wt, unit: "kg", system: "http://unitsofmeasure.org", code: "kg" } }));
      if (+m.ht > 0) out.push(fhirClean({ ...base, id: `ht-${m.date}`, code: { coding: [{ system: "http://loinc.org", code: "8302-2", display: "Body height" }] }, valueQuantity: { value: +m.ht, unit: "cm", system: "http://unitsofmeasure.org", code: "cm" } }));
      if (+m.hc > 0) out.push(fhirClean({ ...base, id: `hc-${m.date}`, code: { coding: [{ system: "http://loinc.org", code: "9843-4", display: "Head circumference" }] }, valueQuantity: { value: +m.hc, unit: "cm", system: "http://unitsofmeasure.org", code: "cm" } }));
    }
    for (const l of (c.labs || [])) {
      if (!l || !l.date || !(+l.hb > 0)) continue;
      out.push(fhirClean({ resourceType: "Observation", id: `hb-${l.date}`, status: "final", subject: { reference: `Patient/${c.id}` }, effectiveDateTime: l.date, code: { coding: [{ system: "http://loinc.org", code: "718-7", display: "Hemoglobin" }] }, valueQuantity: { value: +l.hb, unit: "g/dL", system: "http://unitsofmeasure.org", code: "g/dL" } }));
    }
  } catch (e) {}
  return out;
}
function fhirEncounters(c) {
  const out = [];
  try {
    for (const v of (c.visits || [])) {
      if (!v || !v.date) continue;
      out.push(fhirClean({
        resourceType: "Encounter", id: String(v.id || v.date), status: "finished",
        class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB", display: "ambulatory" },
        type: v.type ? [{ text: v.type }] : undefined,
        subject: { reference: `Patient/${c.id}` },
        period: { start: v.date },
        reasonCode: (v.icd || []).map((x) => ({ coding: [{ system: "http://hl7.org/fhir/sid/icd-10", code: (x && x.code) || x }] })),
      }));
    }
  } catch (e) {}
  return out;
}
function fhirAllergies(c) {
  const out = [];
  try {
    for (const a of (c.allergies || [])) {
      out.push(fhirClean({
        resourceType: "AllergyIntolerance", id: String(a.id || ""), type: "allergy",
        patient: { reference: `Patient/${c.id}` },
        code: { text: a.agent || "" },
        criticality: /anaphylaxis|severe/i.test(`${a.reaction || ""} ${a.severity || ""}`) ? "high" : "low",
        note: a.reaction ? [{ text: a.reaction }] : undefined,
      }));
    }
    if (c.allergy && !(c.allergies || []).length) {
      out.push(fhirClean({ resourceType: "AllergyIntolerance", type: "allergy", patient: { reference: `Patient/${c.id}` }, code: { text: c.allergy } }));
    }
  } catch (e) {}
  return out;
}
function fhirConsents(c) {
  const out = [];
  try {
    for (const x of (c.consents || [])) {
      out.push(fhirClean({
        resourceType: "Consent", id: String(x.id || ""), status: "active",
        scope: { text: "treatment" }, category: [{ text: x.type || "consent" }],
        patient: { reference: `Patient/${c.id}` },
        dateTime: x.date || undefined,
        performer: x.guardian ? [{ display: `${x.guardian} (${x.relation || "guardian"})` }] : undefined,
      }));
    }
  } catch (e) {}
  return out;
}
function fhirBundle(c) {
  const res = [fhirPatient(c)]
    .concat(fhirImms(c), fhirObs(c), fhirEncounters(c), fhirAllergies(c), fhirConsents(c));
  return {
    resourceType: "Bundle", type: "collection",
    timestamp: new Date().toISOString(),
    entry: res.map((r) => ({ fullUrl: `urn:kidgrow:${r.resourceType}/${r.id || "x"}`, resource: r })),
  };
}
var FhirX = { bundle: fhirBundle, patient: fhirPatient };
try { if (typeof window !== "undefined" && window) window.FhirX = FhirX; } catch (e) {}

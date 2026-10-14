// KidGrow Pro — M6 FHIR R4 read facade (GET-only) over Supabase PostgREST.
// Auth: caller's Supabase user JWT in Authorization (RLS enforced by Postgres).
// Tenant scoping: ?tenant=<uuid> is REQUIRED and always applied upstream.
// No service keys, no writes, no PHI in error messages. Mappers exported for tests.
"use strict";

const TABLES = {
  Patient: "patients",
  Encounter: "encounters",
  Observation: "growth_points",
  MedicationAdministration: "mar_entries",
  Consent: "consents"
};
const KIND_CLASS = { opd: "AMB", followup: "AMB", emergency: "EMER", admission: "IMP", nicu: "IMP", picu: "IMP" };

function clean(o) {
  if (Array.isArray(o)) return o.map(clean);
  if (o && typeof o === "object") {
    const n = {};
    for (const k of Object.keys(o)) {
      const v = clean(o[k]);
      if (v !== null && v !== undefined && v !== "") n[k] = v;
    }
    return n;
  }
  return o;
}
function fhirPatient(r) {
  return clean({
    resourceType: "Patient", id: r.local_id,
    identifier: [{ system: "urn:kidgrow:mrn", value: r.mrn }],
    name: [{ text: r.name || "" }],
    gender: ["male", "female", "other"].includes(r.sex) ? r.sex : "unknown",
    birthDate: r.dob || undefined,
    extension: [
      r.ga_at_birth_weeks != null ? { url: "urn:kidgrow:ga-weeks", valueDecimal: +r.ga_at_birth_weeks } : null,
      r.birth_weight_g != null ? { url: "urn:kidgrow:birth-weight-g", valueInteger: +r.birth_weight_g } : null
    ].filter(Boolean)
  });
}
function fhirEncounter(r) {
  return clean({
    resourceType: "Encounter", id: r.local_id,
    status: r.status === "open" ? "in-progress" : "finished",
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: KIND_CLASS[r.kind] || "AMB" },
    subject: { reference: "Patient/" + r.patient_local_id },
    period: { start: r.started_at || undefined }
  });
}
function fhirGrowthObs(r) {
  const out = [];
  const defs = [
    ["29463-7", "Body Weight", r.wt_kg, "kg"],
    ["8302-2", "Body Height", r.len_cm, "cm"],
    ["9843-4", "Head Occipital-frontal Circumference", r.hc_cm, "cm"]
  ];
  for (const [code, label, val, unit] of defs) {
    if (val === null || val === undefined || val === "") continue;
    out.push(clean({
      resourceType: "Observation", id: r.local_id + "-" + code,
      status: "final",
      category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }],
      code: { coding: [{ system: "http://loinc.org", code, display: label }], text: label },
      subject: { reference: "Patient/" + r.patient_local_id },
      effectiveDateTime: r.measured_at || undefined,
      valueQuantity: { value: +val, unit, system: "http://unitsofmeasure.org", code: unit }
    }));
  }
  return out;
}
function fhirMAR(r) {
  const st = r.status === "given" ? "completed" : r.status === "scheduled" ? "in-progress" : "not-done";
  return clean({
    resourceType: "MedicationAdministration", id: r.local_id, status: st,
    medicationCodeableConcept: { text: [r.drug, r.dose].filter(Boolean).join(" ") },
    subject: { reference: "Patient/" + r.patient_local_id },
    effectiveDateTime: r.given_at || r.scheduled_at || undefined,
    performer: r.given_by ? [{ actor: { display: r.given_by } }] : undefined,
    note: r.witness ? [{ text: "witness: " + r.witness }] : undefined
  });
}
function fhirConsent(r) {
  return clean({
    resourceType: "Consent", id: r.local_id,
    status: r.status === "granted" ? "active" : "inactive",
    scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "treatment" }] },
    category: [{ text: r.purpose || "care" }],
    patient: { reference: "Patient/" + r.patient_local_id }
  });
}
const MAPPERS = { Patient: (r) => [fhirPatient(r)], Encounter: (r) => [fhirEncounter(r)], Observation: fhirGrowthObs, MedicationAdministration: (r) => [fhirMAR(r)], Consent: (r) => [fhirConsent(r)] };

function metadata() {
  return {
    resourceType: "CapabilityStatement", status: "active", kind: "instance",
    date: new Date().toISOString().slice(0, 10), fhirVersion: "4.0.1", format: ["json"],
    rest: [{
      mode: "server", documentation: "KidGrow Pro read facade. ?tenant=<uuid> required; user JWT via Authorization; RLS enforced upstream.",
      resource: Object.keys(TABLES).map((t) => ({ type: t, interaction: [{ code: "read" }, { code: "search-type" }] }))
    }]
  };
}

async function handler(req, res) {
  if ((req.method || "GET") !== "GET") { res.status(405).json({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-supported", diagnostics: "FHIR facade is read-only" }] }); return; }
  let u;
  try { u = new URL(req.url || "/api/fhir/metadata", "http://x"); } catch (e) { res.status(400).json({ error: "bad request" }); return; }
  const parts = u.pathname.replace(/\/$/, "").split("/");
  const resource = parts[parts.length - 1] === "fhir" ? "metadata" : parts[parts.length - 1];
  if (resource === "metadata" || resource === "metadata.json") { res.status(200).json(metadata()); return; }
  if (!TABLES[resource]) { res.status(404).json({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "not-found", diagnostics: "unknown resource" }] }); return; }
  const tenant = u.searchParams.get("tenant") || "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenant)) { res.status(400).json({ error: "tenant query param (uuid) required" }); return; }
  const auth = (req.headers && (req.headers.authorization || req.headers.Authorization)) || "";
  if (!auth.startsWith("Bearer ") || auth.length < 20) { res.status(401).json({ error: "Authorization Bearer token required" }); return; }
  const base = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY || "";
  if (!base || !key) { res.status(500).json({ error: "server not configured" }); return; }
  const count = Math.min(100, Math.max(1, parseInt(u.searchParams.get("_count") || "50", 10) || 50));
  const q = new URLSearchParams({ tenant_id: "eq." + tenant, deleted_at: "is.null", select: "*", order: "client_rev.desc", limit: String(count) });
  const id = u.searchParams.get("id") || u.searchParams.get("_id");
  if (id) q.set("local_id", "eq." + id);
  const pat = u.searchParams.get("patient") || u.searchParams.get("subject");
  if (pat) q.set(resource === "Observation" || resource === "MedicationAdministration" || resource === "Consent" || resource === "Encounter" ? "patient_local_id" : "local_id", "eq." + pat.replace(/^Patient\//, ""));
  let rows;
  try {
    const r = await fetch(base + "/rest/v1/" + TABLES[resource] + "?" + q.toString(), {
      headers: { apikey: key, Authorization: auth, Accept: "application/json" }
    });
    if (!r.ok) throw new Error("upstream " + r.status);
    rows = await r.json();
  } catch (e) { res.status(502).json({ error: "upstream unavailable" }); return; }
  const entry = [];
  for (const row of rows || []) for (const m of MAPPERS[resource](row)) entry.push({ resource: m });
  res.status(200).json({ resourceType: "Bundle", type: "searchset", total: entry.length, entry });
}

module.exports = handler;
module.exports.mappers = { fhirPatient, fhirEncounter, fhirGrowthObs, fhirMAR, fhirConsent };
module.exports.TABLES = TABLES;

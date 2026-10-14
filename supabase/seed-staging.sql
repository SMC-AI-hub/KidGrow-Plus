-- =====================================================================
-- STAGING-ONLY synthetic fixtures for M7 UAT + manual staging tests.
-- NEVER run on production. All names are synthetic ("Synth ...").
-- Usage:
--   psql "$STAGING_DB" -v staging_ok='YES' -v owner_uid='<auth.users uuid>' -v doc_uid='<auth.users uuid>' -f supabase/seed-staging.sql
-- =====================================================================
\set ON_ERROR_STOP on
select case when :'staging_ok' = 'YES' then 'staging guard ok' else 1/0 end;

-- Demo tenant ---------------------------------------------------------
insert into tenants (id, name, status, plan) values
  ('11111111-1111-1111-1111-111111111111', 'Synth Demo Clinic', 'active', 'solo')
on conflict (id) do update set name = excluded.name;

insert into memberships (tenant_id, user_id, role, status) values
  ('11111111-1111-1111-1111-111111111111', :'owner_uid'::uuid, 'owner', 'active'),
  ('11111111-1111-1111-1111-111111111111', :'doc_uid'::uuid, 'doctor', 'active')
on conflict do nothing;

insert into tenant_settings (tenant_id, display_name, mrn_prefix) values
  ('11111111-1111-1111-1111-111111111111', 'Synth Demo Clinic', 'SYN-')
on conflict (tenant_id) do update set display_name = excluded.display_name;

-- Synthetic patients --------------------------------------------------
insert into patients (tenant_id, local_id, mrn, name, dob, sex, ga_at_birth_weeks, birth_weight_g, guardian, allergies, client_rev) values
  ('11111111-1111-1111-1111-111111111111', 'c_s1', 'SYN-0001', 'Synth Aarav', '2023-04-02', 'male', 39, 3100, '{"mother":"Synth Meera"}', '[]', '2026-10-01T10:00:00Z'),
  ('11111111-1111-1111-1111-111111111111', 'c_s2', 'SYN-0002', 'Synth Diya', '2024-11-15', 'female', 38, 2800, '{"mother":"Synth Priya"}', '["sulfa"]', '2026-10-01T10:00:00Z'),
  ('11111111-1111-1111-1111-111111111111', 'c_s3', 'SYN-0003', 'Synth Kabir', '2026-09-20', 'male', 36, 2400, '{"father":"Synth Rao"}', '[]', '2026-10-02T10:00:00Z'),
  ('11111111-1111-1111-1111-111111111111', 'c_s4', 'SYN-0004', 'Synth Anaya', '2026-10-01', 'female', 40, 3300, '{"mother":"Synth Lata"}', '[]', '2026-10-03T10:00:00Z')
on conflict (tenant_id, local_id) do nothing;

insert into encounters (tenant_id, local_id, patient_local_id, kind, status, started_at, client_rev) values
  ('11111111-1111-1111-1111-111111111111', 'e_s1', 'c_s1', 'opd', 'closed', '2026-10-05T09:00:00Z', '2026-10-05T09:00:00Z'),
  ('11111111-1111-1111-1111-111111111111', 'e_s2', 'c_s3', 'nicu', 'open', '2026-10-08T08:00:00Z', '2026-10-08T08:00:00Z')
on conflict (tenant_id, local_id) do nothing;

insert into consents (tenant_id, local_id, patient_local_id, purpose, status, granted_by, client_rev) values
  ('11111111-1111-1111-1111-111111111111', 'k_s1', 'c_s1', 'care', 'granted', 'Synth Meera', '2026-10-01T10:00:00Z')
on conflict (tenant_id, local_id) do nothing;

-- NICU + MAR + growth -------------------------------------------------
insert into nicu_admissions (tenant_id, local_id, patient_local_id, admitted_at, birth_weight_g, ga_weeks, status, indication, client_rev) values
  ('11111111-1111-1111-1111-111111111111', 'n_s1', 'c_s3', '2026-10-08T08:00:00Z', 2400, 36, 'admitted', 'RDS', '2026-10-08T08:00:00Z')
on conflict (tenant_id, local_id) do nothing;

insert into nicu_rounds (tenant_id, local_id, admission_local_id, round_date, weight_g, vitals, feeds, events, note, client_rev) values
  ('11111111-1111-1111-1111-111111111111', 'r_s1', 'n_s1', '2026-10-09', 2420, '{"spo2":94}', '{"totalMl":120}', '[]', 'stable', '2026-10-09T08:00:00Z')
on conflict (tenant_id, local_id) do nothing;

insert into mar_entries (tenant_id, local_id, patient_local_id, drug, dose, route, freq, controlled, status, scheduled_at, given_at, given_by, witness, client_rev) values
  ('11111111-1111-1111-1111-111111111111', 'm_s1', 'c_s3', 'Caffeine', '5 mg', 'PO', 'daily', false, 'given', '2026-10-09T08:00:00Z', '2026-10-09T08:05:00Z', 'Synth Nurse', '', '2026-10-09T08:05:00Z'),
  ('11111111-1111-1111-1111-111111111111', 'm_s2', 'c_s3', 'Morphine', '0.05 mg', 'IV', 'q4h', true, 'given', '2026-10-09T10:00:00Z', '2026-10-09T10:05:00Z', 'Synth Doctor', 'Synth Nurse', '2026-10-09T10:05:00Z')
on conflict (tenant_id, local_id) do nothing;

insert into growth_points (tenant_id, local_id, patient_local_id, measured_at, wt_kg, len_cm, hc_cm, source, client_rev) values
  ('11111111-1111-1111-1111-111111111111', 'g_s1', 'c_s1', '2026-10-01T09:00:00Z', 14.2, 95, 48.5, 'opd', '2026-10-01T09:00:00Z'),
  ('11111111-1111-1111-1111-111111111111', 'g_s2', 'c_s3', '2026-10-09T09:00:00Z', 2.42, 45, 32.5, 'nicu', '2026-10-09T09:00:00Z')
on conflict (tenant_id, local_id) do nothing;

select 'staging seed ok: ' || (select count(*) from patients where tenant_id = '11111111-1111-1111-1111-111111111111') || ' synthetic patients';

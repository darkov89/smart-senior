# Schema map — SeniorSmart

## Enums

- `app_role`: `superadmin`, `org_admin`, `nurse`, `family`, `iot_device`
- `log_type`: `voice_note`, `hardware_sensor`, `ai_report`

## Tables (tenant key)

| Table | Tenant column | Notes |
|-------|---------------|--------|
| `organizations` | `id` | `settings_json` |
| `profiles` | `organization_id` | PK = `auth.users.id` |
| `patients` | `organization_id` | `pesel_hash`, `last_name_initial` (1 char) |
| `daily_logs` | `organization_id` | `raw_data` / `processed_data` jsonb |
| `family_connections` | `organization_id` | unique `(profile_id, patient_id)` |
| `audit_logs` | `organization_id` | append via trigger; clients SELECT only |

## Family-safe surface

View `family_daily_reports`: `id`, `patient_id`, `organization_id`, `typ_logu`, `processed_data`, `created_at`  
Filter: `is_family()` AND `family_can_access_patient(patient_id)`.

## Audit

Trigger `audit_row_change` on UPDATE/DELETE for organizations, profiles, patients, daily_logs, family_connections.

# Supabase — EV Hub backend

Single source of truth shared by the mobile app and the admin dashboard.

## Layout
- `migrations/` — ordered SQL files that create/alter the schema (applied top to bottom, tracked in git)
- `seed.sql` — demo Bhutan stations & chargers (Session 2)

## Conventions
- Every table enables **RLS** with its policies written in the same migration file — self-contained and portable
- `status_source` (`seed` | `manual` | `ocpp`) records where a charger's status truth comes from; **OCPP always wins** over manual edits
- `charging_sessions` mirrors OCPP's transaction model — the **gateway converts OCPP's Wh readings to kWh** before writing; `ocpp_transaction_id` is unique and DB-generated (0007); cost = (stop − start) × `stations.tariff_nu_per_kwh`
- Drivers have an OCPP identity on `profiles.id_tag` (0007) — the gateway links sessions to users and auto-checks-in matching reservations
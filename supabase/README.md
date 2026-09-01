# Supabase — EV Hub backend

Single source of truth shared by the mobile app and the admin dashboard.

## Layout
- `migrations/` — ordered SQL files that create/alter the schema (applied top to bottom, tracked in git)
- `seed.sql` — demo Bhutan stations & chargers (Session 2)

## Conventions
- Every table enables **RLS** with its policies written in the same migration file — self-contained and portable
- `status_source` (`seed` | `manual` | `ocpp`) records where a charger's status truth comes from; **OCPP always wins** over manual edits
- `charging_sessions` is built to OCPP's transaction model (meter start/stop kWh) so the Phase 2 OCPP gateway is a pure add-on — no app or dashboard changes
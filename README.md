# ⚡ EV Hub — Bhutan's EV Charging Network

Find, reserve and navigate to EV charging stations across Bhutan — with a live admin dashboard for station operators.

> **Status:** Sessions 1–6 complete — app + shared backend + operator dashboard running.

## Products (one repo, three parts)

| Folder | Product | Stack |
|---|---|---|
| `mobile/` | Driver app: map, live charger status, reservations, navigation | React Native · Expo SDK 57 · TypeScript |
| `admin/` | Operator dashboard: live monitor, station & charger management, analytics | Next.js · Tailwind CSS · TypeScript |
| `supabase/` | Shared backend: schema migrations & seed data | PostgreSQL · PostGIS · Auth · Realtime |

## Architecture

```
┌─────────────────────┐         ┌──────────────────────────┐
│  📱 MOBILE APP       │         │  🖥️ ADMIN DASHBOARD       │
│  find · reserve ·   │         │  monitor · manage ·      │
│  navigate           │         │  analytics               │
└──────────┬──────────┘         └────────────┬─────────────┘
           │  same anon key, RLS-scoped       │
           └──────────► SUPABASE ◄───────────┘
                PostgreSQL+PostGIS · Auth · Realtime
                            ▲
        Phase 2 (BPC): OCPP gateway writes charger
        status & sessions into the same tables
```

## Getting started

**Prerequisites:** Node.js LTS, Expo Go on your phone, a free Supabase project.

```bash
# Mobile app
cd mobile
npm install
copy .env.example .env        # paste your Supabase URL + anon key
npx expo start                # scan the QR code with Expo Go

# Admin dashboard
cd admin
npm install
copy .env.example .env        # paste your Supabase URL + publishable key
npm run dev                   # http://localhost:3000 — sign in with an operator account

# First operator (one-time): sign up in the mobile app, then in Supabase →
# SQL Editor run the bootstrap snippet at the bottom of migration 0006
# (sets profiles.role = 'admin' for your email).
```

## Roadmap

- [x] **Session 1** — monorepo scaffold, EV Hub branding, mobile tab shell, admin shell
- [x] **Session 2** — Supabase schema (OCPP-ready) + RLS policies + demo Bhutan stations
- [x] **Session 3** — Auth (email sign-in) + EV profiles
- [x] **Session 4** — Map, nearest stations, live status via Realtime
- [x] **Session 5** — Reservations with database-level double-booking protection
- [x] **Session 6** — Admin dashboard: Stations · Users (live signups) · Reservations · Analytics
- [x] **Phase 2a** — OCPP 1.6 gateway: real charger status, transactions in Wh→kWh, Basic auth, offline watchdog, reservation check-in, energy analytics
- [ ] **Session 7** — OSRM routing, demo-mode fallback, showcase polish

## OCPP integration — how real chargers connect

The gateway (`supabase/ocpp-gateway/`) is live and speaks **OCPP 1.6** over WebSocket:

- **Status** — `StatusNotification` is tracked **per connector** and aggregated into the charger row (`connector_statuses`), so a dual-connector charge point reports truthfully
- **Units** — OCPP meters report **Wh**; the gateway converts to kWh before writing `meter_*_kwh`
- **Sessions** — `StartTransaction`/`MeterValues`/`StopTransaction` fill `charging_sessions`; cost = (stop − start) × `stations.tariff_nu_per_kwh` (default 5 Nu/kWh); transaction ids are unique and DB-generated
- **Drivers** — every profile gets an `id_tag` (shown on the mobile Profile screen); the gateway maps `StartTransaction.idTag` → user and **auto-checks-in a matching reservation** (confirmed → active, completed on stop)
- **Security** — OCPP 1.6J security profile 1: HTTP Basic auth on the WebSocket upgrade (`CHARGERS=id:password`, enforced when `DEMO_MODE=false`); serve `wss://` via the built-in TLS options or a reverse proxy
- **Reliability** — a watchdog marks OCPP chargers `offline` after 10 min without a heartbeat; `StopTransaction.reason` faults mark sessions `errored`

Charger statuses are **demo (seed) data** until a charger connects — then `status_source` flips to `ocpp` and hardware truth wins (the dashboard locks manual edits for those rows).

## Security

- `.env` files are **git-ignored**; only `.env.example` templates are committed
- The dashboard writes through the **signed-in operator's own token** — Row Level Security (`is_admin()`) is the gatekeeper; no secret key is used client-side
- The old demo status-flip policy from migration `0005` is **no longer used** by the dashboard — close it before production (the `drop`/`revoke` statements at the bottom of that file)
- Migration `0006` hardens the database: clients can no longer set `profiles.role` (privilege-escalation fix), `expire_stale_reservations()` is authenticated-only, and `profiles` + `stations` are published to Realtime so the Users/Stations dashboards update live (Realtime respects RLS — only admins receive other users' rows)
- Row Level Security policies make the database itself the bouncer — users can only touch their own data

## Database — how to apply (Session 2)

1. Create your local env file: `cd mobile` → `copy .env.example .env` → paste your Supabase **Project URL** and **publishable key** (Dashboard → Project Settings → API)
2. Open **Supabase Dashboard → SQL Editor** → for each file in order, paste the whole content and click **Run**:
   1. `supabase/migrations/20260902000001_init_schema.sql`
   2. `supabase/migrations/20260902000002_functions_triggers.sql`
   3. `supabase/migrations/20260902000003_rls_policies.sql`
   4. `supabase/seed.sql` (demo Bhutan stations)
   5. `supabase/verify.sql` (sanity checks — run and eyeball the results)
   6. `supabase/migrations/20260902000004_stations_map_view.sql` (map pins for the mobile Map tab)
   7. `supabase/migrations/20260902000005_demo_status_flip.sql` (optional, demo-only — status flips without a secret key; no longer used by the dashboard)
   8. `supabase/migrations/20260902000006_admin_realtime_and_hardening.sql` (required for the admin dashboard — realtime for profiles/stations + security hardening; includes the first-operator bootstrap snippet)
  9. `supabase/migrations/20260902000007_ocpp_gateway_hardening.sql` (required before running the OCPP gateway — unique transaction ids, heartbeats, per-connector state, station tariffs, driver idTags)
3. Fully restart Expo (stop + `npx expo start`) — Expo caches env vars at startup
4. Open the **Stations** tab on your phone: 12 demo stations, live from your database

All SQL is idempotent — re-running any file is safe.
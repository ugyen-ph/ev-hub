# ⚡ EV Hub — Bhutan's EV Charging Network

Find, reserve and navigate to EV charging stations across Bhutan — with a live admin dashboard for station operators.

> **Status:** Session 1 complete — monorepo scaffold, branding, and app shell running.

## Products (one repo, three parts)

| Folder | Product | Stack |
|---|---|---|
| `mobile/` | Driver app: map, live charger status, reservations, navigation | React Native · Expo SDK 54 · TypeScript |
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
copy .env.example .env.local  # paste Supabase keys (service_role stays here)
npm run dev                   # http://localhost:3000
```

## Roadmap

- [x] **Session 1** — monorepo scaffold, EV Hub branding, mobile tab shell, admin shell
- [ ] **Session 2** — Supabase schema (OCPP-ready) + RLS policies + demo Bhutan stations
- [ ] **Session 3** — Auth (email sign-in) + EV profiles
- [ ] **Session 4** — Map, nearest stations, live status via Realtime
- [ ] **Session 5** — Reservations with database-level double-booking protection
- [ ] **Session 6** — Admin Live Monitor + station/charger management
- [ ] **Session 7** — OSRM routing, demo-mode fallback, showcase polish

## Demo data & the BPC integration path

Charger statuses are **demo (seed) data** today. The schema is built for the real thing:

- `status_source` (`seed` | `manual` | `ocpp`) tracks where status truth comes from — OCPP always wins
- `charging_sessions` mirrors OCPP's transaction model (meter start/stop kWh)
- Phase 2 adds a small Node.js **OCPP gateway** that writes into the same tables — zero changes to the app or dashboard when BPC chargers connect

## Security

- `.env` files are **git-ignored**; only `.env.example` templates are committed
- The Supabase `service_role` key is **server-side only** (admin dashboard), never shipped in the mobile app
- Row Level Security policies make the database itself the bouncer — users can only touch their own data
- Demo concession: migration `0005` lets the dashboard flip charger status **without** a secret key. Safety rails: only the `status` + `status_source` columns are writable, only `seed`/`manual` rows can be touched, `ocpp` rows (real hardware) are untouchable, and signed-in mobile users are not covered. **Before production:** drop the `chargers_demo_flip` policy (statements at the bottom of the migration file)

## Database — how to apply (Session 2)

1. Create your local env file: `cd mobile` → `copy .env.example .env` → paste your Supabase **Project URL** and **publishable key** (Dashboard → Project Settings → API)
2. Open **Supabase Dashboard → SQL Editor** → for each file in order, paste the whole content and click **Run**:
   1. `supabase/migrations/20260902000001_init_schema.sql`
   2. `supabase/migrations/20260902000002_functions_triggers.sql`
   3. `supabase/migrations/20260902000003_rls_policies.sql`
   4. `supabase/seed.sql` (demo Bhutan stations)
   5. `supabase/verify.sql` (sanity checks — run and eyeball the results)
   6. `supabase/migrations/20260902000004_stations_map_view.sql` (map pins for the mobile Map tab)
   7. `supabase/migrations/20260902000005_demo_status_flip.sql` (optional, demo-only — dashboard status buttons work without a secret key)
3. Fully restart Expo (stop + `npx expo start`) — Expo caches env vars at startup
4. Open the **Stations** tab on your phone: 12 demo stations, live from your database

All SQL is idempotent — re-running any file is safe.
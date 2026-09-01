-- ============================================================
-- EV Hub · 0001 — extensions, enums, tables, indexes
-- Apply in: Supabase Dashboard → SQL Editor → paste → Run
-- Idempotent: safe to run twice.
-- ============================================================

-- ============ Extensions ============
create extension if not exists postgis;      -- location superpower (nearest stations)
create extension if not exists btree_gist;   -- exclusion constraints (no double-booking)
create extension if not exists pgcrypto;     -- gen_random_uuid()

-- ============ Enums (idempotent) ============
do $$ begin
  create type public.user_role as enum ('user', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.connector_type as enum ('type2', 'ccs2', 'chademo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.charger_status as enum ('available', 'reserved', 'busy', 'faulted', 'offline');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_source as enum ('seed', 'manual', 'ocpp');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reservation_status as enum ('confirmed', 'active', 'completed', 'cancelled', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.session_status as enum ('started', 'completed', 'errored');
exception when duplicate_object then null; end $$;

-- ============ Tables ============

-- One row per app user, 1:1 with auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null default '',
  phone      text,
  ev_model   text,
  role       public.user_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Charging locations (the map pins)
create table if not exists public.stations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  operator   text not null default 'Bhutan Power Corporation',
  district   text not null,
  address    text,
  location   geography (point, 4326) not null,
  amenities  text[] not null default '{}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual charging points inside a station
create table if not exists public.chargers (
  id                 uuid primary key default gen_random_uuid(),
  station_id         uuid not null references public.stations (id) on delete cascade,
  label              text not null,                        -- e.g. 'A1'
  connector_type     public.connector_type not null,
  power_kw           numeric(6, 2) not null check (power_kw > 0),
  status             public.charger_status not null default 'available',
  status_source      public.status_source not null default 'seed',  -- OCPP always wins (Phase 2)
  charge_point_id    text unique,                          -- OCPP identity, empty until BPC connects
  last_status_change timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (station_id, label)
);

-- Bookings — with THE double-booking killer constraint
create table if not exists public.reservations (
  id            uuid primary key default gen_random_uuid(),
  charger_id    uuid not null references public.chargers (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  slot          tstzrange not null,                        -- derived from starts/ends by trigger
  status        public.reservation_status not null default 'confirmed',
  grace_minutes int not null default 15,                   -- check-in grace window
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (ends_at > starts_at),
  -- No two active bookings may overlap in time on the same charger — enforced by the DB itself
  exclude using gist (
    charger_id with =,
    slot with &&
  ) where (status in ('confirmed', 'active'))
);

-- OCPP-ready session records (Phase 2 gateway writes here; also powers analytics)
create table if not exists public.charging_sessions (
  id                  uuid primary key default gen_random_uuid(),
  charger_id          uuid not null references public.chargers (id) on delete cascade,
  user_id             uuid references auth.users (id) on delete set null,
  reservation_id      uuid references public.reservations (id) on delete set null,
  ocpp_transaction_id bigint,                              -- StartTransaction id (Phase 2)
  meter_start_kwh     numeric(10, 3),
  meter_stop_kwh      numeric(10, 3),
  cost_nu             numeric(10, 2),
  status              public.session_status not null default 'started',
  started_at          timestamptz not null default now(),
  ended_at            timestamptz
);

-- ============ Indexes ============
create index if not exists stations_location_gix    on public.stations using gist (location);
create index if not exists stations_district_idx    on public.stations (district);
create index if not exists chargers_station_idx     on public.chargers (station_id);
create index if not exists chargers_status_idx      on public.chargers (status);
create index if not exists reservations_user_idx    on public.reservations (user_id);
create index if not exists reservations_charger_idx on public.reservations (charger_id);
create index if not exists sessions_charger_idx     on public.charging_sessions (charger_id);
create index if not exists sessions_user_idx        on public.charging_sessions (user_id);
create index if not exists sessions_started_idx     on public.charging_sessions (started_at desc);
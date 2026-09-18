-- ============================================================
-- EV Hub · 0007 — OCPP gateway hardening (Phase 2a)
-- Run AFTER 20260902000006_admin_realtime_and_hardening.sql
-- Idempotent: safe to run twice.
--
-- Required before starting the upgraded gateway (supabase/ocpp-gateway).
-- What this adds for real charger integration:
--   1. charging_sessions.ocpp_transaction_id → UNIQUE + DB-generated
--      default (sequence). The gateway previously made up IDs with
--      Math.random(); a collision made meter/stop updates hit the WRONG
--      session row. Uniqueness is now enforced by the database itself.
--   2. chargers.last_heartbeat — heartbeats no longer pretend to be status
--      changes; powers the gateway's offline watchdog.
--   3. chargers.connector_statuses (jsonb) — per-connector OCPP state kept
--      by the gateway, so a dual-connector charge point aggregates
--      correctly (one free connector ≠ available charger).
--   4. stations.tariff_nu_per_kwh — per-station price the gateway uses to
--      price sessions (cost is now (stop − start) × tariff, not the old
--      hardcoded meterStop × 5, which also charged the charger's lifetime
--      meter reading!).
--   5. profiles.id_tag (unique) — the driver's OCPP identity. The gateway
--      maps StartTransaction idTag → profile, so sessions belong to a
--      driver (RLS 'own or admin read' now works) and a matching
--      reservation is auto-checked-in (confirmed → active).
-- ============================================================

-- ---------- 1) charging_sessions: transaction identity ----------

-- a) de-duplicate any legacy test rows (keep the earliest per txn id)
with ranked as (
  select id,
         row_number() over (partition by ocpp_transaction_id order by started_at, id) as rn
    from public.charging_sessions
   where ocpp_transaction_id is not null
)
update public.charging_sessions s
   set ocpp_transaction_id = null
  from ranked r
 where s.id = r.id
   and r.rn > 1;

-- b) one row per OCPP transaction id, enforced by the DB
create unique index if not exists sessions_ocpp_txn_uidx
  on public.charging_sessions (ocpp_transaction_id);

-- c) sessions inserted without an explicit id draw one from a sequence
--    (the gateway omits the column and reads back what the DB assigned)
create sequence if not exists public.charging_session_txn_seq start 1;

alter table public.charging_sessions
  alter column ocpp_transaction_id
  set default nextval('public.charging_session_txn_seq');

-- ---------- 2) chargers: heartbeat + per-connector state ----------

-- The offline watchdog compares this against now(); boot + heartbeat refresh it.
alter table public.chargers
  add column if not exists last_heartbeat timestamptz not null default now();

-- {"1": "Available", "2": "Occupied"} — OCPP StatusNotification per connector
alter table public.chargers
  add column if not exists connector_statuses jsonb not null default '{}'::jsonb;

-- ---------- 3) stations: per-station tariff (NU per kWh) ----------

alter table public.stations
  add column if not exists tariff_nu_per_kwh numeric(6, 2) not null default 5.00;

-- ---------- 4) profiles: OCPP driver identity ----------

alter table public.profiles add column if not exists id_tag text;

-- Backfill existing users deterministically (12 hex chars = 48 bits of
-- entropy; the unique index below would catch a freak collision).
update public.profiles
   set id_tag = 'EV-' || upper(substring(md5(id::text) from 1 for 12))
 where id_tag is null;

-- NULLs stay allowed (never-connected users), multiples of NULL are fine.
create unique index if not exists profiles_id_tag_uidx
  on public.profiles (id_tag);

-- Users may SEE their own id_tag but never WRITE it — it is not in the
-- column grants from 0006 (full_name, phone, ev_model only), and RLS on
-- profiles was not touched. Nothing to revoke here; this comment documents it.

-- New signups get an id_tag automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, id_tag)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'EV-' || upper(substring(md5(new.id::text) from 1 for 12))
  )
  on conflict (id) do nothing;
  return new;
end $$;

-- ============================================================
-- Optional cron hardening (if pg_cron is enabled), mirrors the gateway's
-- in-process watchdog so a gateway outage alone can't freeze statuses:
--
--   select cron.schedule('evhub-mark-chargers-offline', '*/5 * * * *', $$
--     update public.chargers
--        set status = 'offline'
--      where status_source = 'ocpp'
--        and status <> 'offline'
--        and last_heartbeat < now() - interval '10 minutes';
--   $$);
-- ============================================================
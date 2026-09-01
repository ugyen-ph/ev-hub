-- ============================================================
-- EV Hub · 0003 — Row Level Security (the database is the bouncer)
-- Run AFTER 20260902000002_functions_triggers.sql
-- ============================================================

-- ============ profiles: users see/manage only their own; admins read all ============
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============ stations: public read; admin writes ============
alter table public.stations enable row level security;

drop policy if exists stations_read on public.stations;
create policy stations_read on public.stations
  for select using (true);

drop policy if exists stations_admin_insert on public.stations;
create policy stations_admin_insert on public.stations
  for insert with check (public.is_admin());

drop policy if exists stations_admin_update on public.stations;
create policy stations_admin_update on public.stations
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists stations_admin_delete on public.stations;
create policy stations_admin_delete on public.stations
  for delete using (public.is_admin());

-- ============ chargers: public read; admin writes (status flips) ============
alter table public.chargers enable row level security;

drop policy if exists chargers_read on public.chargers;
create policy chargers_read on public.chargers
  for select using (true);

drop policy if exists chargers_admin_insert on public.chargers;
create policy chargers_admin_insert on public.chargers
  for insert with check (public.is_admin());

drop policy if exists chargers_admin_update on public.chargers;
create policy chargers_admin_update on public.chargers
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists chargers_admin_delete on public.chargers;
create policy chargers_admin_delete on public.chargers
  for delete using (public.is_admin());

-- ============ reservations: strictly own rows (admins supervise) ============
alter table public.reservations enable row level security;

drop policy if exists reservations_select on public.reservations;
create policy reservations_select on public.reservations
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists reservations_insert on public.reservations;
create policy reservations_insert on public.reservations
  for insert with check (auth.uid() = user_id and status = 'confirmed');

drop policy if exists reservations_update on public.reservations;
create policy reservations_update on public.reservations
  for update using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

drop policy if exists reservations_delete on public.reservations;
create policy reservations_delete on public.reservations
  for delete using (auth.uid() = user_id);

-- ============ charging_sessions: own or admin read; writes come from the
-- OCPP gateway / admin via service key (bypasses RLS) ============
alter table public.charging_sessions enable row level security;

drop policy if exists sessions_select on public.charging_sessions;
create policy sessions_select on public.charging_sessions
  for select using (auth.uid() = user_id or public.is_admin());
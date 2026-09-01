-- ============================================================
-- EV Hub · 0002 — functions & triggers
-- Run AFTER 20260902000001_init_schema.sql
-- ============================================================

-- ---------- updated_at keeper ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists stations_set_updated_at on public.stations;
create trigger stations_set_updated_at before update on public.stations
  for each row execute function public.set_updated_at();

drop trigger if exists chargers_set_updated_at on public.chargers;
create trigger chargers_set_updated_at before update on public.chargers
  for each row execute function public.set_updated_at();

drop trigger if exists reservations_set_updated_at on public.reservations;
create trigger reservations_set_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

-- ---------- reservation slot derivation (starts/ends → range) ----------
create or replace function public.set_reservation_slot()
returns trigger language plpgsql as $$
begin
  new.slot := tstzrange(new.starts_at, new.ends_at, '[)');
  return new;
end $$;

drop trigger if exists reservations_set_slot on public.reservations;
create trigger reservations_set_slot
  before insert or update of starts_at, ends_at on public.reservations
  for each row execute function public.set_reservation_slot();

-- ---------- charger status change timestamp ----------
create or replace function public.set_charger_status_change()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.last_status_change := now();
  end if;
  return new;
end $$;

drop trigger if exists chargers_status_change on public.chargers;
create trigger chargers_status_change before update on public.chargers
  for each row execute function public.set_charger_status_change();

-- ---------- auto-create profile on signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- admin helper ----------
-- security definer = runs as table owner, bypasses RLS on profiles → no recursion
create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------- nearby stations (the PostGIS superpower) ----------
create or replace function public.nearby_stations(
  lat      double precision,
  lng      double precision,
  radius_m double precision default 10000
)
returns table (
  id                 uuid,
  name               text,
  operator           text,
  district           text,
  address            text,
  amenities          text[],
  distance_m         double precision,
  available_chargers integer,
  total_chargers     integer
)
language sql stable
as $$
  select
    s.id, s.name, s.operator, s.district, s.address, s.amenities,
    st_distance(s.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography) as distance_m,
    count(c.id) filter (where c.status = 'available')::integer as available_chargers,
    count(c.id)::integer as total_chargers
  from public.stations s
  left join public.chargers c
    on c.station_id = s.id and c.status <> 'offline'
  where s.is_active
    and st_dwithin(s.location, st_setsrid(st_makepoint(lng, lat), 4326)::geography, radius_m)
  group by s.id
  order by distance_m;
$$;

-- ---------- expire stale reservations (app calls via RPC; cron optional) ----------
create or replace function public.expire_stale_reservations()
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  affected integer;
begin
  update public.reservations
     set status = 'expired'
   where status = 'confirmed'
     and ends_at + (grace_minutes * interval '1 minute') < now();
  get diagnostics affected = row_count;
  return affected;
end $$;

-- ---------- Realtime: push charger + reservation changes to all clients ----------
do $$ begin
  alter publication supabase_realtime add table public.chargers;
exception when duplicate_object then null; when undefined_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.reservations;
exception when duplicate_object then null; when undefined_object then null; end $$;
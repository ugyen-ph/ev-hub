-- ============================================================
-- EV Hub · 0004 — stations_map view (lat/lng for the Map tab)
-- Run in SQL Editor AFTER 0001–0003 + seed. Idempotent.
-- ============================================================

create or replace view public.stations_map
with (security_invoker = true) as
select
  s.id,
  s.name,
  s.district,
  s.address,
  st_y(s.location::geometry) as lat,
  st_x(s.location::geometry) as lng,
  (select count(*) from public.chargers c
    where c.station_id = s.id and c.status <> 'offline') as total_chargers,
  (select count(*) from public.chargers c
    where c.station_id = s.id and c.status = 'available') as available_chargers
from public.stations s
where s.is_active;

grant select on public.stations_map to anon, authenticated;
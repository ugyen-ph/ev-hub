-- ============================================================
-- EV Hub · verify.sql — sanity checks after applying migrations + seed
-- Run in SQL Editor; all queries should return sensible rows.
-- ============================================================

-- 1. How many stations & chargers? (expect 12 stations, 27 chargers)
select (select count(*) from public.stations) as stations,
       (select count(*) from public.chargers) as chargers;

-- 2. Status distribution
select status, count(*) from public.chargers group by status order by 2 desc;

-- 3. The PostGIS superpower — nearest stations to central Thimphu
select name, district,
       round(distance_m::numeric, 0) as meters,
       available_chargers, total_chargers
from public.nearby_stations(27.4728, 89.6390, 300000)
limit 5;

-- 4. RLS is on for every table? (expect all rows = true)
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;

-- 5. Realtime publication includes our tables? (expect chargers + reservations)
select schemaname, tablename from pg_publication_tables
where pubname = 'supabase_realtime'
  and tablename in ('chargers', 'reservations');

-- 6. Profiles (empty until someone signs up — that's OK)
select count(*) as profiles from public.profiles;
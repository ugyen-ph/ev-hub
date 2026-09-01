-- ============================================================
-- EV Hub · seed.sql — DEMO stations across Bhutan 🇧🇹
-- Clearly labeled: status_source = 'seed' on every charger.
-- Idempotent: safe to run twice (on conflict do nothing).
-- ============================================================

-- ---------- stations ----------
insert into public.stations (name, operator, district, address, location, amenities) values
  ('Changlimithang Fast Charge', 'Bhutan Power Corporation', 'Thimphu',        'Near Changlimithang Stadium, Thimphu',        st_setsrid(st_makepoint(89.6390, 27.4728), 4326)::geography, array['restroom','cafe']),
  ('Norling Lam Hub',            'Bhutan Power Corporation', 'Thimphu',        'Norling Lam, Motithang, Thimphu',             st_setsrid(st_makepoint(89.6330, 27.4685), 4326)::geography, array['cafe','wifi']),
  ('Centenary Market Point',     'Bhutan Power Corporation', 'Thimphu',        'Centenary Farmers Market, Thimphu',           st_setsrid(st_makepoint(89.6410, 27.4760), 4326)::geography, array['restroom']),
  ('Paro Airport Charging',      'Bhutan Power Corporation', 'Paro',           'Paro International Airport, Paro',            st_setsrid(st_makepoint(89.4245, 27.4008), 4326)::geography, array['restroom','cafe','wifi']),
  ('Paro Town Point',            'Bhutan Power Corporation', 'Paro',           'Paro Town Main Street, Paro',                 st_setsrid(st_makepoint(89.4146, 27.4304), 4326)::geography, array['cafe']),
  ('Phuentsholing Gate Hub',     'Bhutan Power Corporation', 'Phuentsholing',  'Near Bhutan Gate, Phuentsholing',             st_setsrid(st_makepoint(89.3850, 26.8670), 4326)::geography, array['restroom','shop']),
  ('Wangdue Wayside',            'Bhutan Power Corporation', 'Wangdue Phodrang','Wangdue Town, Wangdue Phodrang',             st_setsrid(st_makepoint(89.8730, 27.5120), 4326)::geography, array['restroom']),
  ('Punakha Dzong Stop',         'Bhutan Power Corporation', 'Punakha',        'Near Punakha Dzong, Punakha',                 st_setsrid(st_makepoint(89.8680, 27.5914), 4326)::geography, array['restroom']),
  ('Jakar Central',              'Bhutan Power Corporation', 'Bumthang',       'Jakar Town, Bumthang',                        st_setsrid(st_makepoint(90.7460, 27.5525), 4326)::geography, array['cafe','restroom']),
  ('Gelephu Gateway',            'Bhutan Power Corporation', 'Sarpang',        'Gelephu Town, Sarpang',                       st_setsrid(st_makepoint(90.4860, 26.8720), 4326)::geography, array['restroom','shop']),
  ('Mongar East Stop',           'Bhutan Power Corporation', 'Mongar',         'Mongar Town, Mongar',                         st_setsrid(st_makepoint(91.5000, 27.2500), 4326)::geography, array['restroom']),
  ('Trashigang Terminal',        'Bhutan Power Corporation', 'Trashigang',     'Trashigang Town, Trashigang',                 st_setsrid(st_makepoint(91.7500, 27.2600), 4326)::geography, array['restroom'])
on conflict (name) do nothing;

-- ---------- chargers ----------
insert into public.chargers (station_id, label, connector_type, power_kw, status, status_source)
select
  s.id,
  v.label,
  v.connector::public.connector_type,
  v.power_kw::numeric(6,2),
  v.status::public.charger_status,
  'seed'::public.status_source
from public.stations s
join (
  values
    ('Changlimithang Fast Charge', 'A1', 'ccs2',    60.00,  'available'),
    ('Changlimithang Fast Charge', 'A2', 'ccs2',    60.00,  'available'),
    ('Changlimithang Fast Charge', 'A3', 'chademo', 50.00,  'busy'),
    ('Norling Lam Hub',            'A1', 'type2',   22.00,  'available'),
    ('Norling Lam Hub',            'A2', 'type2',   22.00,  'available'),
    ('Norling Lam Hub',            'B1', 'ccs2',    60.00,  'available'),
    ('Centenary Market Point',     'A1', 'type2',   22.00,  'available'),
    ('Centenary Market Point',     'A2', 'type2',   22.00,  'reserved'),
    ('Paro Airport Charging',      'A1', 'ccs2',    120.00, 'available'),
    ('Paro Airport Charging',      'A2', 'ccs2',    120.00, 'busy'),
    ('Paro Airport Charging',      'B1', 'chademo', 50.00,  'available'),
    ('Paro Town Point',            'A1', 'type2',   22.00,  'available'),
    ('Paro Town Point',            'A2', 'type2',   22.00,  'available'),
    ('Phuentsholing Gate Hub',     'A1', 'ccs2',    60.00,  'available'),
    ('Phuentsholing Gate Hub',     'A2', 'ccs2',    60.00,  'busy'),
    ('Phuentsholing Gate Hub',     'B1', 'type2',   22.00,  'available'),
    ('Wangdue Wayside',            'A1', 'ccs2',    60.00,  'available'),
    ('Wangdue Wayside',            'B1', 'type2',   22.00,  'offline'),
    ('Punakha Dzong Stop',         'A1', 'type2',   22.00,  'available'),
    ('Punakha Dzong Stop',         'A2', 'type2',   22.00,  'available'),
    ('Jakar Central',              'A1', 'ccs2',    60.00,  'available'),
    ('Jakar Central',              'B1', 'type2',   22.00,  'available'),
    ('Gelephu Gateway',            'A1', 'ccs2',    60.00,  'available'),
    ('Gelephu Gateway',            'A2', 'ccs2',    60.00,  'available'),
    ('Mongar East Stop',           'A1', 'ccs2',    60.00,  'available'),
    ('Mongar East Stop',           'B1', 'chademo', 50.00,  'busy'),
    ('Trashigang Terminal',        'A1', 'ccs2',    60.00,  'available')
) as v(station_name, label, connector, power_kw, status)
  on v.station_name = s.name
on conflict (station_id, label) do nothing;
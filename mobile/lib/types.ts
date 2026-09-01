// Shared types + demo location (GPS arrives in a later phase)

export type NearbyStation = {
  id: string;
  name: string;
  operator: string;
  district: string;
  address: string | null;
  amenities: string[];
  distance_m: number;
  available_chargers: number;
  total_chargers: number;
};

/** Row of the stations_map view (PostGIS coords exposed as lat/lng). */
export type MapStation = {
  id: string;
  name: string;
  district: string;
  address: string | null;
  lat: number;
  lng: number;
  available_chargers: number;
  total_chargers: number;
};

export type ChargerRow = {
  id: string;
  station_id: string;
  label: string;
  connector_type: 'type2' | 'ccs2' | 'chademo';
  power_kw: string; // numeric comes back as string from PostgREST
  status: 'available' | 'reserved' | 'busy' | 'faulted' | 'offline';
};

export type ReservationRow = {
  id: string;
  charger_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';
  created_at: string;
};

export type ProfileRow = {
  id: string;
  full_name: string;
  phone: string | null;
  ev_model: string | null;
  role: 'user' | 'admin';
};

/** Thimphu city centre — the "Demo Location" fallback for showcases & testing. */
export const DEMO_LOCATION = {
  lat: 27.4728,
  lng: 89.639,
  label: 'Thimphu (demo location)',
} as const;
// Row types mirroring the Supabase schema (supabase/migrations 0001–0007).
// PostgREST returns numeric columns (power_kw, cost_nu, …) as strings.

export type ChargerStatus = 'available' | 'reserved' | 'busy' | 'faulted' | 'offline';
export type ConnectorType = 'type2' | 'ccs2' | 'chademo';
export type StatusSource = 'seed' | 'manual' | 'ocpp';
export type ReservationStatus = 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';
export type UserRole = 'user' | 'admin';

export type Station = {
  id: string;
  name: string;
  operator: string;
  district: string;
  address: string | null;
  amenities: string[];
  is_active: boolean;
  /** NU per kWh (migration 0007) — used by the OCPP gateway to price sessions. */
  tariff_nu_per_kwh: string;
  /** geography(point,4326) — PostgREST returns it as WKT text: 'POINT(lng lat)'. */
  location: unknown;
  created_at: string;
  updated_at: string;
};

export type Charger = {
  id: string;
  station_id: string;
  label: string;
  connector_type: ConnectorType;
  power_kw: string;
  status: ChargerStatus;
  status_source: StatusSource;
  charge_point_id: string | null;
  last_status_change: string;
  /** migration 0007 — refreshed by charger boot/heartbeat, powers offline detection. */
  last_heartbeat: string;
  /** migration 0007 — { "1": "Available", "2": "Occupied" }, kept by the gateway. */
  connector_statuses: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  ev_model: string | null;
  /** migration 0007 — the driver's OCPP identity (charge point keypad / RFID tag). */
  id_tag: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: string;
  charger_id: string;
  user_id: string;
  starts_at: string;
  ends_at: string;
  status: ReservationStatus;
  grace_minutes: number;
  created_at: string;
  updated_at: string;
};

export type SessionStatus = 'started' | 'completed' | 'errored';

// Written by the OCPP gateway (service key) — meters are kWh after the
// gateway's Wh → kWh conversion.
export type ChargingSession = {
  id: string;
  charger_id: string;
  user_id: string | null;
  reservation_id: string | null;
  ocpp_transaction_id: number | null;
  meter_start_kwh: string | null;
  meter_stop_kwh: string | null;
  cost_nu: string | null;
  status: SessionStatus;
  started_at: string;
  ended_at: string | null;
};

// ---- PostgREST embeds used by the dashboards ----

export type ChargerWithStation = Charger & {
  station: { id: string; name: string; district: string } | null;
};

export type ReservationWithRelations = Reservation & {
  charger: {
    id: string;
    label: string;
    station: { id: string; name: string; district: string } | null;
  } | null;
};

// ---- Enums as ordered lists for dropdowns/filters ----

export const CHARGER_STATUSES: ChargerStatus[] = ['available', 'reserved', 'busy', 'faulted', 'offline'];
export const CONNECTOR_TYPES: ConnectorType[] = ['type2', 'ccs2', 'chademo'];
export const RESERVATION_STATUSES: ReservationStatus[] = ['confirmed', 'active', 'completed', 'cancelled', 'expired'];

// ---- geography helper ----

// PostgREST returns geography(point,4326) columns as WKT text ('POINT(lng lat)').
// parseStationLocation also accepts the GeoJSON object shape defensively.
export function parseStationLocation(
  location: unknown,
): { lat: string; lng: string } | null {
  if (typeof location === 'string') {
    const m = location.match(/POINT\s*\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s*\)/i);
    if (m) return { lng: m[1], lat: m[2] };
  } else if (location && typeof location === 'object') {
    const coords = (location as { coordinates?: unknown }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lng: String(coords[0]), lat: String(coords[1]) };
    }
  }
  return null;
}

// Row types mirroring the Supabase schema (supabase/migrations 0001–0005).
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
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  ev_model: string | null;
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

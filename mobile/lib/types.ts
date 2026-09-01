// Shared types for Supabase data + demo location (until GPS lands in Session 4)

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

/** Thimphu city centre — the "Demo Location" fallback for showcases & testing. */
export const DEMO_LOCATION = {
  lat: 27.4728,
  lng: 89.639,
  label: 'Thimphu (demo location)',
} as const;
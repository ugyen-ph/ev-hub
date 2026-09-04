// Geo helpers — distance math, OSRM road routing, drive-time formatting, and
// the Directions handoff to the device's real navigation app. This mirrors the
// pattern of the top EV charging apps (ChargePoint, EVgo, Electrify America):
// the in-app map handles discovery; driving is handed off to Google/Apple Maps.

import { Linking, Platform } from 'react-native';

export type LatLon = { lat: number; lng: number };
/** react-native-maps Polyline/Marker coordinate shape. */
export type MapCoord = { latitude: number; longitude: number };

/** Great-circle distance between two lat/lng points, in meters (haversine). */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6_371_000; // Earth's mean radius, meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** 850 → "850 m", 12300 → "12.3 km" — same format as the Stations list. */
export function formatKm(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

/** OSRM duration (seconds) → "12 min" / "1 h 05 min". */
export function formatDuration(s: number): string {
  const totalMin = Math.max(1, Math.round(s / 60));
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h} h ${String(m).padStart(2, '0')} min`;
}

/** A driving route returned by the OSRM server. */
export type RoadRoute = {
  /** Polyline-ready coordinates (`{latitude, longitude}` for react-native-maps). */
  coords: MapCoord[];
  distance_m: number;
  duration_s: number;
};

const OSRM_BASE = (
  process.env.EXPO_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org'
).replace(/\/+$/, '');

/** Minimal shape of the OSRM route response we consume. */
type OsrmRoute = {
  distance: number;
  duration: number;
  geometry?: { coordinates?: [number, number][] };
};

/**
 * Road route between two points via the free public OSRM server (no API key).
 * Used only for the in-app route PREVIEW line — actual navigation is handed
 * off to the device's maps app via openDrivingDirections().
 * Returns null when the server is unreachable or no road route exists.
 */
export async function fetchRoadRoute(origin: LatLon, dest: LatLon): Promise<RoadRoute | null> {
  const url =
    `${OSRM_BASE}/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}` +
    `?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = (await res.json()) as { code?: string; routes?: OsrmRoute[] };
    const r = json.routes?.[0];
    if (!r || json.code !== 'Ok' || !r.geometry?.coordinates) return null;
    const coords: MapCoord[] = r.geometry.coordinates.map(([lng, lat]) => ({
      latitude: lat,
      longitude: lng,
    }));
    if (coords.length === 0) return null;
    return { coords, distance_m: r.distance, duration_s: r.duration };
  } catch {
    return null;
  }
}

/**
 * Hand the drive off to the device's real navigation app — exactly what the
 * top EV charging apps do when you tap "Directions". Turn-by-turn guidance,
 * live traffic and voice are handled by the maps app itself, for free.
 *
 * Android → `google.navigation:` opens Google Maps straight into voice-guided
 * navigation mode. iOS → Apple Maps (`maps://`, always installed, no config).
 * Last resort everywhere: the universal Google Maps web link, which works even
 * with no maps app installed.
 *
 * Resolves true when something opened.
 */
export async function openDrivingDirections(lat: number, lng: number): Promise<boolean> {
  const web =
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` +
    `&travelmode=driving&dir_action=navigate`;
  const native =
    Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lng}&dirflg=d`
      : `google.navigation:q=${lat},${lng}&mode=d`;
  try {
    await Linking.openURL(native);
    return true;
  } catch {
    // No native maps handler on this device — fall back to the web link below.
  }
  try {
    await Linking.openURL(web);
    return true;
  } catch {
    return false;
  }
}
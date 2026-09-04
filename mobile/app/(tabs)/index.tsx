// The map screen, rebuilt the way the top EV charging apps (ChargePoint, EVgo,
// Electrify America) do it: a real Google map for DISCOVERY — availability-
// colored pins, tap a pin for a live station card with connector/power chips,
// filter chips, and a Directions button that hands off to the device's maps
// app for the actual drive. Search finds any place in Bhutan (keyless).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';

import { MapSearch } from '@/components/map-search';
import { StationMarker, StationSignView } from '@/components/station-marker';
import { StationCard } from '@/components/station-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';
import { StatusColors } from '@/constants/theme';
import { DEMO_LOCATION, type ChargerRow, type MapStation } from '@/lib/types';
import {
  fetchRoadRoute,
  formatDuration,
  formatKm,
  haversineMeters,
  openDrivingDirections,
  type RoadRoute,
} from '@/lib/geo';

/** Blue highlight pin for the selected station (route preview is drawn to it). */
const SELECTED_PIN = '#2563EB';
/** Red pin — live data says every charger at this station is out of action. */
const NONE_FREE_PIN = '#EF4444';

type ConnectorFilter = 'all' | 'type2' | 'ccs2' | 'chademo';
type Filters = { connector: ConnectorFilter; fastOnly: boolean; freeOnly: boolean };

/** Per-station rollup built once from the chargers table. */
type StationAgg = {
  type2: boolean;
  ccs2: boolean;
  chademo: boolean;
  maxKw: number;
  free: number;
  total: number;
};

type SelectedStation = MapStation & { distanceM: number | null };

/** Live free/total for a station — charger rows when present, else the view's counts. */
function stationCounts(s: MapStation, agg: Map<string, StationAgg>) {
  const a = agg.get(s.id);
  return a ? { free: a.free, total: a.total } : { free: s.available_chargers, total: s.total_chargers };
}

export default function MapScreen() {
  const [stations, setStations] = useState<MapStation[]>([]);
  const [chargers, setChargers] = useState<ChargerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [canShowUserLocation, setCanShowUserLocation] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    connector: 'all',
    fastOnly: false,
    freeOnly: false,
  });
  const [selected, setSelected] = useState<SelectedStation | null>(null);
  const [place, setPlace] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [route, setRoute] = useState<RoadRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [directionsBusy, setDirectionsBusy] = useState(false);
  const mapRef = useRef<MapView>(null);
  /** Last known user position — origin for distances + route previews. */
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const tint = useThemeColor({}, 'tint');
  const router = useRouter();


  const load = useCallback(async () => {
    setError(null);
    const [{ data: st, error: se }, { data: ch, error: ce }] = await Promise.all([
      supabase.from('stations_map').select('*').order('district'),
      supabase.from('chargers').select('id, station_id, label, connector_type, power_kw, status'),
    ]);
    if (se || ce) setError((se ?? ce)?.message ?? 'Could not load stations.');
    setStations((st as MapStation[]) ?? []);
    setChargers((ch as ChargerRow[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** station_id → connector/power/availability rollup, built once per fetch. */
  const aggByStation = useMemo(() => {
    const m = new Map<string, StationAgg>();
    for (const c of chargers) {
      const a =
        m.get(c.station_id) ??
        { type2: false, ccs2: false, chademo: false, maxKw: 0, free: 0, total: 0 };
      if (c.connector_type === 'type2') a.type2 = true;
      else if (c.connector_type === 'ccs2') a.ccs2 = true;
      else a.chademo = true;
      a.maxKw = Math.max(a.maxKw, Number(c.power_kw) || 0);
      a.total += 1;
      if (c.status === 'available') a.free += 1;
      m.set(c.station_id, a);
    }
    return m;
  }, [chargers]);

  /** ChargePoint-style filters: plug type, DC fast only, has-a-free-charger now. */
  const visibleStations = useMemo(() => {
    return stations.filter((s) => {
      const a = aggByStation.get(s.id);
      const free = a ? a.free : s.available_chargers;
      if (filters.freeOnly && free === 0) return false;
      if (filters.connector !== 'all' || filters.fastOnly) {
        // No charger rows → can't confirm plugs/power → hide while filtering on them.
        if (!a) return false;
        if (filters.connector !== 'all' && !a[filters.connector]) return false;
        if (filters.fastOnly && a.maxKw < 50) return false;
      }
      return true;
    });
  }, [stations, aggByStation, filters]);

  const applyUserPos = (p: { lat: number; lng: number }) => {
    userPosRef.current = p;
    setUserPos(p);
  };

  /**
   * Tap a pin (or the ⌖ nearest flow) → show the ChargePoint-style card, and
   * draw the OSRM road preview from the user when we know where they are.
   * Actual driving is handed off via the Directions button.
   */
  const selectStation = useCallback(async (s: MapStation) => {
    const origin = userPosRef.current;
    setSelected({
      ...s,
      distanceM: origin ? haversineMeters(origin, { lat: s.lat, lng: s.lng }) : null,
    });
    setPlace(null);
    if (!origin) {
      setRoute(null);
      mapRef.current?.animateCamera(
        { center: { latitude: s.lat, longitude: s.lng }, zoom: 14 },
        { duration: 400 },
      );
      return;
    }
    setRouteLoading(true);
    const road = await fetchRoadRoute(origin, { lat: s.lat, lng: s.lng });
    setRoute(road && road.distance_m > 0 ? road : null);
    setRouteLoading(false);
    if (road) {
      mapRef.current?.fitToCoordinates(
        [
          { latitude: origin.lat, longitude: origin.lng },
          { latitude: s.lat, longitude: s.lng },
        ],
        { edgePadding: { top: 170, right: 80, bottom: 320, left: 80 }, animated: true },
      );
    } else {
      mapRef.current?.animateCamera(
        { center: { latitude: s.lat, longitude: s.lng }, zoom: 14 },
        { duration: 400 },
      );
    }
  }, []);

  /** ⌖ → GPS (or demo fallback) → nearest visible station → card + preview. */
  const locateNearest = async () => {
    if (locating) return;
    setLocating(true);
    setNotice(null);
    if (stations.length === 0) {
      setNotice('No stations loaded yet — tap ↻ in the legend to refresh.');
      setLocating(false);
      return;
    }
    let position: { lat: number; lng: number } = { lat: DEMO_LOCATION.lat, lng: DEMO_LOCATION.lng };
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setNotice(`Location permission denied — using ${DEMO_LOCATION.label} instead.`);
      } else {
        // Guard against a hung GPS fix (location services off) with a 10s timeout.
        const fix = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('GPS timed out')), 10_000),
          ),
        ]);
        position = { lat: fix.coords.latitude, lng: fix.coords.longitude };
        setCanShowUserLocation(true);
      }
    } catch {
      setNotice(`Could not read your GPS position — using ${DEMO_LOCATION.label} instead.`);
    }
    applyUserPos(position);

    let best: MapStation | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const s of visibleStations) {
      const d = haversineMeters(position, { lat: s.lat, lng: s.lng });
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    if (best) await selectStation(best);
    else setNotice('No stations match the current filters — clear a chip and try again.');
    setLocating(false);
  };

  /** The top-app handoff: open Google Maps (Android) / Apple Maps (iOS) driving. */
  const openDirections = async () => {
    if (!selected || directionsBusy) return;
    setDirectionsBusy(true);
    const ok = await openDrivingDirections(selected.lat, selected.lng);
    if (!ok) setNotice('Could not open a Maps app on this device.');
    setDirectionsBusy(false);
  };

  /** Search result → drop a pin and move the camera (discovery, not navigation). */
  const onPlacePicked = (r: { name: string; lat: number; lng: number }) => {
    setPlace(r);
    setSelected(null);
    setRoute(null);
    mapRef.current?.animateCamera(
      { center: { latitude: r.lat, longitude: r.lng }, zoom: 14 },
      { duration: 500 },
    );
  };

  const toggleFilter = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <ThemedView style={styles.container}>
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={{
            latitude: 27.4728,
            longitude: 89.639,
            latitudeDelta: 0.09,
            longitudeDelta: 0.07,
          }}
          showsUserLocation={canShowUserLocation && userPos !== null}
          showsMyLocationButton={false}
          onPress={() => {
            setSelected(null);
            setRoute(null);
          }}>
          {visibleStations.map((s) => {
            const isSel = selected?.id === s.id;
            const { free, total } = stationCounts(s, aggByStation);
            const color = isSel ? SELECTED_PIN : free > 0 ? StatusColors.available : NONE_FREE_PIN;
            return (
              <StationMarker
                key={s.id}
                latitude={s.lat}
                longitude={s.lng}
                color={color}
                selected={isSel}
                blinking
                title={s.name}
                description={`${free} of ${total} free · tap for details & directions`}
                onPress={() => selectStation(s)}
              />
            );
          })}

          {place ? (
            <StationMarker
              latitude={place.lat}
              longitude={place.lng}
              color="#7C3AED"
              icon="map-marker"
              blinking
              title={place.name}
              description="Searched place"
            />
          ) : null}

          {route ? (
            <>
              {/* Google-navigation style: dark casing under a blue core line. */}
              <Polyline
                coordinates={route.coords}
                strokeWidth={11}
                strokeColor="#0D47A1"
                lineCap="round"
                lineJoin="round"
                zIndex={1}
              />
              <Polyline
                coordinates={route.coords}
                strokeWidth={7}
                strokeColor="#4285F4"
                lineCap="round"
                lineJoin="round"
                zIndex={2}
              />
            </>
          ) : null}
        </MapView>

        {/* ChargePoint-style filter chips — sit under the search, above the map. */}
        <View style={styles.filtersRow} pointerEvents="box-none">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}>
            {(['all', 'type2', 'ccs2', 'chademo'] as ConnectorFilter[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => toggleFilter({ connector: key })}
                style={[styles.fchip, filters.connector === key && styles.fchipOn]}>
                <ThemedText style={[styles.fchipText, filters.connector === key && styles.fchipTextOn]}>
                  {key === 'all' ? 'All plugs' : key === 'type2' ? 'Type 2' : key === 'ccs2' ? 'CCS2' : 'CHAdeMO'}
                </ThemedText>
              </Pressable>
            ))}
            <Pressable
              onPress={() => toggleFilter({ fastOnly: !filters.fastOnly })}
              style={[styles.fchip, filters.fastOnly && styles.fchipOn]}>
              <ThemedText style={[styles.fchipText, filters.fastOnly && styles.fchipTextOn]}>
                ⚡ 50 kW+
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => toggleFilter({ freeOnly: !filters.freeOnly })}
              style={[styles.fchip, filters.freeOnly && styles.fchipOn]}>
              <ThemedText style={[styles.fchipText, filters.freeOnly && styles.fchipTextOn]}>
                Free now
              </ThemedText>
            </Pressable>
          </ScrollView>
        </View>

        {/* In-app place search — keyless, scoped to Bhutan. */}
        <MapSearch onSelect={onPlacePicked} />

        {/* Banners — supabase errors (red) and gentle notices (amber). */}
        {error ? (
          <ThemedView style={[styles.banner, { backgroundColor: '#B91C1C' }]}>
            <ThemedText style={styles.bannerText}>{error}</ThemedText>
          </ThemedView>
        ) : notice ? (
          <ThemedView style={[styles.banner, { backgroundColor: '#B45309' }]}>
            <ThemedText style={styles.bannerText}>{notice}</ThemedText>
          </ThemedView>
        ) : null}

        {/* Floating locate button — GPS → nearest station */}
        <Pressable
          onPress={locateNearest}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Find the nearest charging station"
          style={({ pressed }) => [
            styles.locateBtn,
            { backgroundColor: tint },
            selected && { bottom: 340 },
            locating && { opacity: 0.7 },
            pressed && !locating && { opacity: 0.85 },
          ]}>
          {locating ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Ionicons name="locate" size={24} color="#FFFFFF" />
          )}
        </Pressable>

        {/* Bottom stack — drive-time pill + the ChargePoint-style station card. */}
        <View style={styles.bottomStack} pointerEvents="box-none">
          {selected && routeLoading ? (
            <View style={styles.routePill}>
              <ActivityIndicator size="small" color="#1A73E8" />
            </View>
          ) : selected && route ? (
            <View style={styles.routePill}>
              <Ionicons name="car-outline" size={14} color="#1A73E8" />
              <ThemedText style={styles.routePillText}>
                {formatKm(route.distance_m)} · {formatDuration(route.duration_s)} drive
              </ThemedText>
            </View>
          ) : null}

          {selected ? (() => {
            const { free, total } = stationCounts(selected, aggByStation);
            return (
              <StationCard
                name={selected.name}
                district={selected.district}
                address={selected.address}
                available={free}
                total={total}
                distanceM={selected.distanceM}
                chargers={chargers.filter((c) => c.station_id === selected.id)}
                directionsBusy={directionsBusy}
                onDirections={openDirections}
                onDetails={() => router.push(`/station/${selected.id}` as never)}
              />
            );
          })() : null}
        </View>

        {/* Legend — doubles as the refresh button. */}
        <ThemedView style={styles.legendRow}>
          <StationSignView color={StatusColors.available} width={14} />
          <ThemedText style={styles.legendText}>free</ThemedText>
          <StationSignView color={NONE_FREE_PIN} width={14} />
          <ThemedText style={styles.legendText}>all taken</ThemedText>
          <StationSignView color={SELECTED_PIN} width={14} />
          <ThemedText style={styles.legendText}>selected</ThemedText>
          <Pressable onPress={load} hitSlop={8}>
            <Ionicons name="refresh" size={16} color="#6B7280" />
          </Pressable>
        </ThemedView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  filtersRow: {
    position: 'absolute',
    top: 110,
    left: 16,
    right: 16,
  },
  filters: { flexDirection: 'row', gap: 8 },
  fchip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  fchipOn: { backgroundColor: '#0E9F6E', borderColor: '#0E9F6E' },
  fchipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  fchipTextOn: { color: '#FFFFFF' },
  banner: {
    position: 'absolute',
    top: 152,
    left: 16,
    right: 16,
    padding: 10,
    borderRadius: 10,
  },
  bannerText: { color: '#FFFFFF', fontSize: 12 },
  locateBtn: {
    position: 'absolute',
    right: 12,
    bottom: 72,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
  bottomStack: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 52,
    gap: 8,
  },
  routePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  routePillText: { fontSize: 12, fontWeight: '700', color: '#1A73E8' },
  legendRow: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendText: { fontSize: 11, opacity: 0.7, marginRight: 4 },
});
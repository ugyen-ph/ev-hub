import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { Marker } from 'react-native-maps';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';
import { StatusColors } from '@/constants/theme';

type MapStation = {
  id: string;
  name: string;
  district: string;
  lat: number;
  lng: number;
  available_chargers: number;
  total_chargers: number;
};

export default function MapScreen() {
  const [stations, setStations] = useState<MapStation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const tint = useThemeColor({}, 'tint');
  const router = useRouter();

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from('stations_map')
      .select('*')
      .order('district');
    if (err) setError(err.message);
    else setStations((data as MapStation[]) ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ThemedView style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 27.4728,
          longitude: 89.639,
          latitudeDelta: 0.09,
          longitudeDelta: 0.07,
        }}
        showsUserLocation={false}>
        {stations.map((s) => {
          const color = s.available_chargers > 0 ? StatusColors.available : StatusColors.busy;
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
              title={s.name}
              description={`${s.available_chargers}/${s.total_chargers} free · tap to book`}
              pinColor={color}
              onPress={() => router.push(`/station/${s.id}` as never)}
            />
          );
        })}
      </MapView>

      {error ? (
        <ThemedView style={styles.banner}>
          <ThemedText style={styles.bannerText}>{error}</ThemedText>
          <ThemedText style={styles.bannerHint}>
            Run supabase/migrations/20260902000004_stations_map_view.sql in the SQL Editor.
          </ThemedText>
        </ThemedView>
      ) : null}

      <View style={styles.legendRow}>
        <View style={[styles.legendDot, { backgroundColor: StatusColors.available }]} />
        <ThemedText style={styles.legendText}>has free chargers</ThemedText>
        <View style={[styles.legendDot, { backgroundColor: StatusColors.busy }]} />
        <ThemedText style={styles.legendText}>all busy</ThemedText>
        <Pressable onPress={load}>
          <ThemedText style={[styles.refresh, { color: tint }]}>↻</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  banner: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  bannerText: { fontSize: 12, fontWeight: '600' },
  bannerHint: { fontSize: 11, opacity: 0.7, marginTop: 4 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, opacity: 0.8 },
  refresh: { fontSize: 18, fontWeight: '700', marginLeft: 8 },
});
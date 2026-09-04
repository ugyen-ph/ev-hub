import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRealtimeStations } from '@/hooks/use-realtime-chargers';
import { supabase } from '@/lib/supabase';
import { DEMO_LOCATION, type NearbyStation } from '@/lib/types';
import { StatusColors } from '@/constants/theme';

function availability(total: number, available: number) {
  if (total === 0) return { label: 'offline', color: StatusColors.offline };
  if (available > 0) return { label: 'available', color: StatusColors.available };
  return { label: 'all busy', color: StatusColors.busy };
}

const km = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

export default function StationsScreen() {
  // Use real-time hook for automatic updates when charger statuses change
  const { stations, loading, error } = useRealtimeStations();
  const tint = useThemeColor({}, 'tint');
  const router = useRouter();

  // Manual refresh function for pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // The real-time hook handles automatic updates,
    // but we keep this for manual refresh capability
    const { error: err } = await supabase.rpc('nearby_stations', {
      lat: DEMO_LOCATION.lat,
      lng: DEMO_LOCATION.lng,
      radius_m: 300000,
    });
    if (err) console.error('Refresh error:', err.message);
    setRefreshing(false);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tint} colors={[tint]} />
        }>
        <ThemedText type="title">Stations</ThemedText>
        <ThemedText type="subtitle">Live from the database Â· {DEMO_LOCATION.label}</ThemedText>

        {error ? (
          <ThemedView style={styles.errorCard}>
            <ThemedText type="defaultSemiBold">Could not load stations</ThemedText>
            <ThemedText style={styles.hint}>{error}</ThemedText>
          </ThemedView>
        ) : null}

        {!error && loading
          ? [1, 2, 3].map((n) => <ThemedView key={n} style={[styles.card, styles.skeleton]} />)
          : null}

        {!error && !loading && stations.length === 0 ? (
          <ThemedView style={styles.errorCard}>
            <ThemedText type="defaultSemiBold">No stations found</ThemedText>
            <ThemedText style={styles.hint}>Apply the SQL files (see README â†’ Database).</ThemedText>
          </ThemedView>
        ) : null}

        {stations.map((s) => {
          const a = availability(s.total_chargers, s.available_chargers);
          return (
            <Pressable key={s.id} onPress={() => router.push(`/station/${s.id}` as never)}>
              <ThemedView style={styles.card}>
                <View style={[styles.dot, { backgroundColor: a.color }]} />
                <View style={styles.info}>
                  <ThemedText type="defaultSemiBold">{s.name}</ThemedText>
                  <ThemedText style={styles.meta}>
                    {s.district} Â· {km(s.distance_m)} Â· {s.available_chargers}/{s.total_chargers} free
                  </ThemedText>
                </View>
                <ThemedText style={[styles.status, { color: a.color }]}>{a.label}</ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}

        <ThemedText style={styles.footer}>Tap a station to book a charger âš¡</ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 12, paddingTop: 60 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  skeleton: { height: 72, opacity: 0.4 },
  errorCard: {
    gap: 6,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  info: { flex: 1, gap: 2 },
  meta: { opacity: 0.6, fontSize: 12 },
  status: { fontSize: 12, fontWeight: '600' },
  hint: { opacity: 0.6, fontSize: 12 },
  footer: { opacity: 0.6, fontSize: 12, textAlign: 'center', marginTop: 8 },
});

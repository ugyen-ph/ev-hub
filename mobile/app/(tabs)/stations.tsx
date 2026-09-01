import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatusColors, type ChargerStatus } from '@/constants/theme';

type DemoStation = {
  name: string;
  district: string;
  status: ChargerStatus;
  power: string;
};

const DEMO_STATIONS: DemoStation[] = [
  { name: 'Changlimithang Fast Charge', district: 'Thimphu', status: 'available', power: 'DC · 60 kW' },
  { name: 'Norling Lam Hub', district: 'Thimphu', status: 'busy', power: 'DC · 60 kW' },
  { name: 'Paro Airport Charging', district: 'Paro', status: 'available', power: 'DC · 120 kW' },
  { name: 'Phuentsholing Point', district: 'Phuentsholing', status: 'offline', power: 'AC · 22 kW' },
  { name: 'Wangdue Wayside', district: 'Wangdue', status: 'reserved', power: 'AC · 22 kW' },
];

export default function StationsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="title">Stations</ThemedText>
        <ThemedText type="subtitle">Demo stations across Bhutan</ThemedText>

        {DEMO_STATIONS.map((station) => (
          <ThemedView key={station.name} style={styles.card}>
            <View style={[styles.dot, { backgroundColor: StatusColors[station.status] }]} />
            <View style={styles.info}>
              <ThemedText type="defaultSemiBold">{station.name}</ThemedText>
              <ThemedText style={styles.meta}>
                {station.district} · {station.power}
              </ThemedText>
            </View>
            <ThemedText style={[styles.status, { color: StatusColors[station.status] }]}>
              {station.status}
            </ThemedText>
          </ThemedView>
        ))}

        <ThemedText style={styles.footer}>
          Static demo list today · Supabase + live status land in Sessions 2–4
        </ThemedText>
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
  dot: { width: 12, height: 12, borderRadius: 6 },
  info: { flex: 1, gap: 2 },
  meta: { opacity: 0.6, fontSize: 12 },
  status: { fontSize: 12, textTransform: 'capitalize', fontWeight: '600' },
  footer: { opacity: 0.6, fontSize: 12, textAlign: 'center', marginTop: 8 },
});
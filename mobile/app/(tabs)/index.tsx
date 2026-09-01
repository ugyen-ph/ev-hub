import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatusColors } from '@/constants/theme';

const LEGEND: Array<{ label: string; color: string }> = [
  { label: 'Available', color: StatusColors.available },
  { label: 'Reserved', color: StatusColors.reserved },
  { label: 'Busy / Charging', color: StatusColors.busy },
  { label: 'Offline', color: StatusColors.offline },
];

export default function MapScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="title">EV Hub ⚡</ThemedText>
        <ThemedText type="subtitle">Bhutan&apos;s EV Charging Network</ThemedText>

        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Live station map</ThemedText>
          <ThemedText>
            GPS, map pins and real-time charger status arrive in Session 4. This screen proves the
            tab shell, theme and navigation are wired correctly.
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Status legend</ThemedText>
          <View style={styles.legend}>
            {LEGEND.map(({ label, color }) => (
              <View key={label} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <ThemedText>{label}</ThemedText>
              </View>
            ))}
          </View>
        </ThemedView>

        <ThemedText style={styles.footer}>
          Demo data today · real stations arrive with the BPC partnership (OCPP-ready schema)
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16, paddingTop: 60 },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  legend: { gap: 8, marginTop: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  footer: { opacity: 0.6, fontSize: 12, textAlign: 'center' },
});

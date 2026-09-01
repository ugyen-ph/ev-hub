import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function ReservationsScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">My Reservations</ThemedText>
      <ThemedView style={styles.empty}>
        <ThemedText type="subtitle">No reservations yet</ThemedText>
        <ThemedText style={styles.hint}>
          Book a charger from a station screen and it will appear here. The reservation flow — with
          database-level double-booking protection — lands in Session 5.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, paddingTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  hint: { opacity: 0.6, textAlign: 'center' },
});
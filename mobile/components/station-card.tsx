// ChargePoint-style station card — the discovery pattern top EV charging apps
// use on their map: live availability at a glance, per-charger connector/power
// chips, a Directions button that hands off to the device's maps app, and a
// link into the full detail + booking screen.

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatusColors, type ChargerStatus } from '@/constants/theme';
import { formatKm } from '@/lib/geo';

export type CardCharger = {
  id: string;
  label: string;
  connector_type: 'type2' | 'ccs2' | 'chademo';
  power_kw: string | number;
  status: ChargerStatus;
};

const CONNECTOR_LABEL: Record<CardCharger['connector_type'], string> = {
  type2: 'Type 2',
  ccs2: 'CCS2',
  chademo: 'CHAdeMO',
};

export function StationCard({
  name,
  district,
  address,
  available,
  total,
  distanceM,
  chargers,
  directionsBusy,
  onDirections,
  onDetails,
}: {
  name: string;
  district: string;
  address: string | null;
  available: number;
  total: number;
  distanceM: number | null;
  chargers: CardCharger[];
  directionsBusy: boolean;
  onDirections: () => void;
  onDetails: () => void;
}) {
  const hasFree = total > 0 && available > 0;
  return (
    <ThemedView style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="defaultSemiBold" numberOfLines={1} style={styles.name}>
            {name}
          </ThemedText>
          <ThemedText style={styles.meta} numberOfLines={1}>
            {district}
            {address ? ` · ${address}` : ''}
          </ThemedText>
        </View>
        <View
          style={[
            styles.availPill,
            { backgroundColor: hasFree ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.12)' },
          ]}>
          <View
            style={[
              styles.availDot,
              { backgroundColor: hasFree ? StatusColors.available : '#EF4444' },
            ]}
          />
          <ThemedText style={[styles.availText, { color: hasFree ? '#0B7A56' : '#B91C1C' }]}>
            {total === 0 ? 'status unknown' : `${available} of ${total} free`}
          </ThemedText>
        </View>
      </View>

      {distanceM != null ? (
        <ThemedText style={styles.meta}>{formatKm(distanceM)} from you</ThemedText>
      ) : null}

      {chargers.length > 0 ? (
        <View style={styles.chips}>
          {chargers.slice(0, 4).map((c) => {
            const free = c.status === 'available';
            const dead = c.status === 'faulted' || c.status === 'offline';
            return (
              <View
                key={c.id}
                style={[styles.chip, free ? styles.chipFree : dead ? styles.chipDead : styles.chipBusy]}>
                <ThemedText style={styles.chipText}>
                  {CONNECTOR_LABEL[c.connector_type]} · {String(Number(c.power_kw))} kW
                </ThemedText>
              </View>
            );
          })}
          {chargers.length > 4 ? (
            <View style={styles.chip}>
              <ThemedText style={styles.chipText}>+{chargers.length - 4} more</ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onDirections}
          disabled={directionsBusy}
          accessibilityRole="button"
          accessibilityLabel="Open driving directions in the Maps app"
          style={({ pressed }) => [
            styles.directionsBtn,
            (directionsBusy || pressed) && { opacity: 0.8 },
          ]}>
          <Ionicons name="navigate" size={15} color="#FFFFFF" />
          <ThemedText style={styles.directionsText}>
            {directionsBusy ? 'Opening Maps…' : 'Directions'}
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={onDetails}
          accessibilityRole="button"
          accessibilityLabel="Open station details and booking"
          style={styles.detailsBtn}>
          <ThemedText style={styles.detailsText}>Details & booking</ThemedText>
          <Ionicons name="chevron-forward" size={14} color="#6B7280" />
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerText: { flex: 1, gap: 2 },
  name: { fontSize: 16 },
  meta: { fontSize: 12, opacity: 0.65 },
  availPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  availDot: { width: 7, height: 7, borderRadius: 4 },
  availText: { fontSize: 11, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipFree: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.4)' },
  chipBusy: { backgroundColor: 'rgba(59,130,246,0.10)', borderColor: 'rgba(59,130,246,0.35)' },
  chipDead: { backgroundColor: 'rgba(107,114,128,0.12)', borderColor: 'rgba(107,114,128,0.35)' },
  chipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A73E8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  directionsText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  detailsBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsText: { fontSize: 13, fontWeight: '600', color: '#374151' },
});
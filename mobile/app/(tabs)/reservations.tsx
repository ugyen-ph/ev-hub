import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';
import { StatusColors, type ChargerStatus } from '@/constants/theme';

type Row = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: 'confirmed' | 'active' | 'completed' | 'cancelled' | 'expired';
  charger: {
    label: string;
    power_kw: string | number;
    connector_type: string;
    station: { name: string; district: string };
  } | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function ReservationsScreen() {
  const [rows, setRows] = useState<Row[]>([]);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const tint = useThemeColor({}, 'tint');
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    setSignedIn(Boolean(u.user));
    if (!u.user) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('reservations')
      .select(
        'id, starts_at, ends_at, status, charger:chargers(label, power_kw, connector_type, station:stations(name, district))',
      )
      .order('starts_at', { ascending: false });
    if (!error) setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('reservations-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reservations' },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const cancel = (r: Row) => {
    Alert.alert('Cancel booking?', 'The slot will be freed for other drivers.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', r.id);
          load();
        },
      },
    ]);
  };

  if (signedIn === false) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Reservations</ThemedText>
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Sign in to see your bookings</ThemedText>
          <Pressable
            style={[styles.btn, { backgroundColor: tint }]}
            onPress={() => router.push('/(tabs)/account')}>
            <ThemedText style={styles.btnText}>Go to Account</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="title">Reservations</ThemedText>
        <ThemedText type="subtitle">Updates live · cancel anytime before your slot</ThemedText>

        {loading ? <ThemedText style={styles.meta}>Loading…</ThemedText> : null}
        {!loading && rows.length === 0 ? (
          <ThemedView style={styles.card}>
            <ThemedText type="defaultSemiBold">No bookings yet</ThemedText>
            <ThemedText style={styles.meta}>
              Book your first charger from the Stations tab ⚡
            </ThemedText>
          </ThemedView>
        ) : null}

        {rows.map((r) => (
          <ThemedView key={r.id} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.info}>
                <ThemedText type="defaultSemiBold">
                  {r.charger?.station.name ?? 'Station'} · {r.charger?.label}
                </ThemedText>
                <ThemedText style={styles.meta}>
                  {fmt(r.starts_at)} → {fmt(r.ends_at)} · {String(r.charger?.power_kw ?? '')} kW
                </ThemedText>
                <ThemedText style={[styles.pill, { color: StatusColors[r.status as ChargerStatus] ?? StatusColors.busy }]}>
                  {r.status}
                </ThemedText>
              </View>
              {r.status === 'confirmed' || r.status === 'active' ? (
                <Pressable style={styles.cancel} onPress={() => cancel(r)}>
                  <ThemedText style={styles.cancelText}>Cancel</ThemedText>
                </Pressable>
              ) : null}
            </View>
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 12, paddingTop: 60 },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { flex: 1, gap: 4 },
  meta: { opacity: 0.6, fontSize: 12 },
  pill: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  btn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 999, alignSelf: 'flex-start' },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  cancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  cancelText: { color: '#EF4444', fontWeight: '600', fontSize: 12 },
});
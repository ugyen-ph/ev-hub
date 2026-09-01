import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';
import { StatusColors, type ChargerStatus } from '@/constants/theme';

type Charger = {
  id: string;
  label: string;
  connector_type: 'type2' | 'ccs2' | 'chademo';
  power_kw: string | number;
  status: ChargerStatus;
};

const SLOT_HOURS = [1, 2, 3];

export default function StationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [stationName, setStationName] = useState('');
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slot, setSlot] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const tint = useThemeColor({}, 'tint');
  const router = useRouter();

  const load = useCallback(async () => {
    setError(null);
    const { data: s, error: se } = await supabase
      .from('stations')
      .select('name, district, address')
      .eq('id', id)
      .single();
    if (se) { setError(se.message); setLoading(false); return; }
    setStationName(s?.name ?? '');
    const { data: ch, error: ce } = await supabase
      .from('chargers')
      .select('id, label, connector_type, power_kw, status')
      .eq('station_id', id)
      .order('label');
    if (ce) setError(ce.message);
    else setChargers((ch as Charger[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const book = async (c: Charger) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      Alert.alert('Sign in first', 'Create an account or sign in to book a charger.', [
        { text: 'Go to Account', onPress: () => router.push('/(tabs)/account') },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    setBusyId(c.id);
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1); // next full hour
    const end = new Date(start.getTime() + slot * 3600_000);
    const { error: berr } = await supabase.from('reservations').insert({
      charger_id: c.id,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: 'confirmed',
    });
    setBusyId(null);
    if (berr) {
      const conflict = berr.code === '23P01';
      Alert.alert(
        conflict ? 'Already booked' : 'Booking failed',
        conflict
          ? 'Someone booked this charger for that time first. Pick another charger or time.'
          : berr.message,
      );
      if (conflict) load();
      return;
    }
    Alert.alert('Booked! ⚡', `${c.label} reserved for ${slot}h from ${start.getHours()}:00.`, [
      { text: 'View my reservations', onPress: () => router.push('/(tabs)/reservations') },
      { text: 'OK' },
    ]);
    load();
  };

  const badge = (s: ChargerStatus) => ({ color: StatusColors[s] });

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()}>
          <ThemedText style={[styles.back, { color: tint }]}>← Back</ThemedText>
        </Pressable>
        <ThemedText type="title">{stationName}</ThemedText>
        <ThemedText type="subtitle">Pick a charger · booking starts next full hour</ThemedText>

        <ThemedText type="defaultSemiBold">Duration</ThemedText>
        <View style={styles.slots}>
          {SLOT_HOURS.map((h) => (
            <Pressable key={h} onPress={() => setSlot(h)}>
              <ThemedView style={[styles.slot, slot === h && { backgroundColor: tint }]}>
                <ThemedText style={slot === h ? styles.slotOn : undefined}>{h}h</ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </View>

        {error ? <ThemedText style={styles.err}>{error}</ThemedText> : null}
        {loading ? <ActivityIndicator style={{ marginTop: 24 }} color={tint} /> : null}

        {chargers.map((c) => (
          <ThemedView key={c.id} style={styles.card}>
            <View style={styles.info}>
              <ThemedText type="defaultSemiBold">
                {c.label} · {String(c.power_kw)} kW · {c.connector_type.toUpperCase()}
              </ThemedText>
              <ThemedText style={[styles.status, badge(c.status)]}>{c.status}</ThemedText>
            </View>
            {c.status === 'available' ? (
              <Pressable
                disabled={busyId === c.id}
                onPress={() => book(c)}
                style={[styles.btn, { backgroundColor: tint }, busyId === c.id && { opacity: 0.5 }]}>
                <ThemedText style={styles.btnText}>{busyId === c.id ? '…' : 'Book'}</ThemedText>
              </Pressable>
            ) : null}
          </ThemedView>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 12, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 14, fontWeight: '600' },
  slots: { flexDirection: 'row', gap: 8 },
  slot: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.4)',
  },
  slotOn: { color: '#FFFFFF', fontWeight: '700' },
  err: { color: '#EF4444', fontSize: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  info: { flex: 1, gap: 2 },
  status: { fontSize: 12, fontWeight: '600' },
  btn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
});

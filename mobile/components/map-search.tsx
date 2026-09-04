// In-app destination search — free, keyless geocoding scoped to Bhutan.
// Photon (OSM-powered) is the primary geocoder and Nominatim the fallback;
// both are free public services, consistent with the app's keyless OSRM routing.

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

export type SearchResult = {
  name: string;
  detail: string;
  lat: number;
  lng: number;
};

/** Bhutan bounding box (minLon,minLat,maxLon,maxLat) — keeps results on-topic. */
const BHUTAN_BBOX = '88.45,26.60,92.15,28.40';

type PhotonProps = {
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  country?: string;
};
type PhotonFeature = { properties?: PhotonProps; geometry?: { coordinates?: [number, number] } };
type NominatimHit = { display_name?: string; lat?: string; lon?: string };

async function geocode(query: string): Promise<SearchResult[]> {
  // 1) Photon — free, no key, built for autocomplete-style search.
  try {
    const res = await fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&bbox=${BHUTAN_BBOX}`,
    );
    if (res.ok) {
      const json = (await res.json()) as { features?: PhotonFeature[] };
      const results = (json.features ?? [])
        .map((f) => {
          const p = f.properties ?? {};
          const lat = f.geometry?.coordinates?.[1];
          const lng = f.geometry?.coordinates?.[0];
          if (typeof lat !== 'number' || typeof lng !== 'number') return null;
          const name = p.name || p.street || 'Unnamed place';
          const detail = [p.city, p.state].filter(Boolean).join(', ') || p.country || 'Bhutan';
          return { name, detail, lat, lng };
        })
        .filter((r): r is SearchResult => r !== null);
      if (results.length > 0) return results;
    }
  } catch {
    // fall through to Nominatim
  }
  // 2) Nominatim — also free; scoped to Bhutan with countrycodes.
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=bt&q=${encodeURIComponent(query)}`,
  );
  if (!res.ok) return [];
  const hits = (await res.json()) as NominatimHit[];
  return hits
    .map((h) => {
      const lat = Number(h.lat);
      const lng = Number(h.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const parts = (h.display_name ?? '').split(',').map((s) => s.trim());
      const name = parts[0] || 'Unnamed place';
      const detail = parts.slice(1, 3).join(', ');
      return { name, detail, lat, lng };
    })
    .filter((r): r is SearchResult => r !== null);
}

export function MapSearch({ onSelect }: { onSelect: (result: SearchResult) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textColor = useThemeColor({}, 'text');

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(() => {
      geocode(q)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  const pick = useCallback(
    (result: SearchResult) => {
      Keyboard.dismiss();
      setQuery('');
      setResults([]);
      onSelect(result);
    },
    [onSelect],
  );

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <ThemedView style={styles.box}>
        <Ionicons name="search" size={18} color="#6B7280" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a destination in Bhutan…"
          placeholderTextColor="#9CA3AF"
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.input, { color: textColor }]}
        />
        {searching ? (
          <ActivityIndicator size="small" color="#6B7280" />
        ) : query.length > 0 ? (
          <Pressable
            onPress={() => {
              setQuery('');
              setResults([]);
            }}
            hitSlop={8}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </ThemedView>

      {results.length > 0 ? (
        <ThemedView style={styles.results}>
          {results.map((r, i) => (
            <Pressable
              key={`${r.lat},${r.lng},${i}`}
              style={({ pressed }) => [
                styles.result,
                pressed && { opacity: 0.7 },
                i > 0 && styles.resultBorder,
              ]}
              onPress={() => pick(r)}>
              <Ionicons name="location-outline" size={18} color="#0E9F6E" />
              <View style={styles.resultText}>
                <ThemedText type="defaultSemiBold" numberOfLines={1}>
                  {r.name}
                </ThemedText>
                <ThemedText style={styles.resultDetail} numberOfLines={1}>
                  {r.detail}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </ThemedView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 54, left: 16, right: 16 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  input: { flex: 1, fontSize: 14, padding: 0 },
  results: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  resultBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.08)' },
  resultText: { flex: 1 },
  resultDetail: { fontSize: 12, opacity: 0.6 },
});
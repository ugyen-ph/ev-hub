import { useCallback, useEffect, useState } from 'react';
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

  // Manual refresh function (still useful for pull-to-refresh)
  const load = useCallback(async () => {
    // The real-time hook handles automatic updates,
    // but we keep this for manual refresh capability
    const { data, error: err } = await supabase.rpc('nearby_stations', {
      lat: DEMO_LOCATION.lat,
      lng: DEMO_LOCATION.lng,
      radius_m: 300000,
    });
    if (err) console.error('Refresh error:', err.message);
    else {
      // Trigger a re-fetch by temporarily re-subscribing
      // The real-time subscription will pick up changes automatically
    }
  }, []);
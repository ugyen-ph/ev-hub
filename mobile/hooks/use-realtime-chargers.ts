import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ChargerRow } from '@/lib/types';

/**
 * Custom hook that provides real-time charger data for a specific station.
 * Automatically updates when charger statuses change in the database.
 * 
 * @param stationId - The UUID of the station to watch
 * @returns Object containing chargers array, loading state, and error
 */
export function useRealtimeChargers(stationId: string | undefined) {
  const [chargers, setChargers] = useState<ChargerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!stationId) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // Initial fetch of chargers
    const fetchChargers = async () => {
      setLoading(true);
      setError(null);
      
      const { data, error: fetchError } = await supabase
        .from('chargers')
        .select('id, station_id, label, connector_type, power_kw, status')
        .eq('station_id', stationId)
        .order('label');

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setChargers((data as ChargerRow[]) ?? []);
      }
      setLoading(false);
    };

    fetchChargers();

    // Clean up previous subscription if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create a unique channel name for this station
    const channelName = `chargers-station-${stationId}-${Date.now()}`;
    
    // Subscribe to real-time changes on the chargers table
    channelRef.current = supabase
      .channel(channelName)
      .on<ChargerRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chargers',
          filter: `station_id=eq.${stationId}`,
        },
        (payload) => {
          console.log('[Realtime] Charger change received:', payload.eventType, payload.new);
          
          if (!isMounted) return;

          if (payload.eventType === 'INSERT') {
            setChargers((prev) => {
              // Avoid duplicates
              if (prev.some(c => c.id === payload.new.id)) return prev;
              return [...prev, payload.new as ChargerRow];
            });
          } else if (payload.eventType === 'UPDATE') {
            setChargers((prev) =>
              prev.map((c) =>
                c.id === payload.new.id ? (payload.new as ChargerRow) : c
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setChargers((prev) =>
              prev.filter((c) => c.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Channel ${channelName} status:`, status);
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to charger changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error - check RLS policies');
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] Channel timed out');
        }
      });

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [stationId]);

  return { chargers, loading, error };
}

/**
 * Custom hook that provides real-time station availability data.
 * Automatically updates when any charger status changes.
 */
export function useRealtimeStations() {
  const [stations, setStations] = useState<Array<{
    id: string;
    name: string;
    operator: string;
    district: string;
    address: string | null;
    amenities: string[];
    distance_m: number;
    available_chargers: number;
    total_chargers: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Initial fetch of stations
    const fetchStations = async () => {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc('nearby_stations', {
        lat: 27.4728, // DEMO_LOCATION.lat
        lng: 89.639,  // DEMO_LOCATION.lng
        radius_m: 300000,
      });

      if (!isMounted) return;

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setStations((data as typeof stations) ?? []);
      }
      setLoading(false);
    };

    fetchStations();

    // Clean up previous subscription if exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to real-time changes on the chargers table
    const channelName = `stations-availability-${Date.now()}`;
    
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chargers',
        },
        () => {
          console.log('[Realtime] Station availability change detected, refetching...');
          if (isMounted) {
            fetchStations();
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Channel ${channelName} status:`, status);
      });

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  return { stations, loading, error };
}

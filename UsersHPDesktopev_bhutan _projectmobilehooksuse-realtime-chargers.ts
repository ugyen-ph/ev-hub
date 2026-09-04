import { useEffect, useState } from 'react';
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

    // Subscribe to real-time changes on the chargers table
    const channel = supabase
      .channel(`chargers-station-${stationId}`)
      .on<ChargerRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chargers',
          filter: `station_id=eq.${stationId}`,
        },
        (payload) => {
          if (!isMounted) return;

          if (payload.eventType === 'INSERT') {
            // Add new charger to the list
            setChargers((prev) => [...prev, payload.new as ChargerRow]);
          } else if (payload.eventType === 'UPDATE') {
            // Update existing charger in the list
            setChargers((prev) =>
              prev.map((c) =>
                c.id === payload.new.id ? (payload.new as ChargerRow) : c
              )
            );
          } else if (payload.eventType === 'DELETE') {
            // Remove deleted charger from the list
            setChargers((prev) =>
              prev.filter((c) => c.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [stationId]);

  return { chargers, loading, error };
}

/**
 * Custom hook that provides real-time station availability data.
 * Automatically updates when any charger status changes.
 * 
 * @returns Object containing stations array, loading state, and error
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

    // Subscribe to real-time changes on the chargers table
    // This will trigger when any charger status changes
    const channel = supabase
      .channel('stations-availability')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chargers',
        },
        () => {
          // When any charger changes, refetch stations to get updated counts
          // We refetch because the availability is computed via RPC
          if (isMounted) {
            fetchStations();
          }
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { stations, loading, error };
}

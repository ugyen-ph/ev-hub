'use client';

// Register a newly built charging station. The location becomes the map pin
// drivers see — enter coordinates or use the browser's GPS.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { StationForm, type StationFormValues } from '@/components/station-form';
import { getSupabase } from '@/lib/supabase';

export default function NewStationPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(values: StationFormValues) {
    const supabase = getSupabase();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('stations')
      .insert({
        name: values.name,
        operator: values.operator,
        district: values.district,
        address: values.address || null,
        amenities: values.amenities,
        is_active: values.is_active,
        // geography(point,4326) accepts WKT — longitude first.
        location: `POINT(${values.lng} ${values.lat})`,
      })
      .select('id')
      .single();
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    // Straight to the detail page to add its chargers.
    router.push(`/stations/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">New station</h1>
      <p className="mb-6 mt-1 text-sm text-neutral-400">
        Register a newly built charging station. Drop the pin by entering coordinates or using your
        current location — drivers navigate to this exact point.
      </p>
      <StationForm submitLabel="Create station" busy={busy} error={error} onSubmit={create} />
    </div>
  );
}

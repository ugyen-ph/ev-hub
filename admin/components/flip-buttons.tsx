'use client';

// Status flip buttons for a charger. Writes go through the signed-in
// admin's own JWT — the chargers_admin_update RLS policy authorizes them.
// Hardware-managed (status_source = 'ocpp') rows are disabled in the UI:
// once BPC chargers stream real status, hardware truth wins.

import { useState } from 'react';

import { getSupabase } from '@/lib/supabase';
import { CHARGER_STATUSES, type Charger, type ChargerStatus } from '@/lib/types';

export function FlipButtons({ charger, onChanged }: { charger: Charger; onChanged: () => void }) {
  const [pending, setPending] = useState<ChargerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function flip(status: ChargerStatus) {
    const supabase = getSupabase();
    if (!supabase || charger.status === status) return;
    setPending(status);
    setError(null);
    const { error: err } = await supabase
      .from('chargers')
      .update({ status, status_source: 'manual' })
      .eq('id', charger.id);
    setPending(null);
    if (err) setError(err.message);
    onChanged();
  }

  const locked = charger.status_source === 'ocpp';

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1">
        {CHARGER_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={locked || pending !== null || charger.status === s}
            onClick={() => void flip(s)}
            title={
              locked
                ? 'Hardware-managed (OCPP) — status comes from the charger itself'
                : `Set ${s}`
            }
            className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition first:rounded-l-lg hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-30"
          >
            {s.slice(0, 4)}
          </button>
        ))}
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

'use client';

// Dashboard 3 — Reservations. Bookings made by drivers, with their time
// windows. `reservations` is already in the realtime publication (migration
// 0002), so this list moves as drivers book and as slots resolve.
//
// Note: reservations.user_id references auth.users (not profiles), so
// PostgREST cannot embed driver names — profiles are fetched separately
// and joined client-side.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { StatusBadge } from '@/components/status-badge';
import { getSupabase } from '@/lib/supabase';
import {
  RESERVATION_STATUSES,
  type Profile,
  type ReservationStatus,
  type ReservationWithRelations,
} from '@/lib/types';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ReservationsPage() {
  const [rows, setRows] = useState<ReservationWithRelations[]>([]);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [status, setStatus] = useState<'all' | ReservationStatus>('all');

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return; // env problems are surfaced by the dashboard shell
    const [res, prof] = await Promise.all([
      supabase
        .from('reservations')
        .select('*, charger:chargers(label, station:stations(name, district))')
        .order('starts_at', { ascending: false })
        .limit(300),
      supabase.from('profiles').select('id, full_name'),
    ]);
    if (res.error || prof.error) {
      setDataError(res.error?.message ?? prof.error?.message ?? 'Unknown error');
    } else {
      setDataError(null);
      setRows(res.data as unknown as ReservationWithRelations[]);
      const map = new Map<string, string>();
      for (const p of prof.data as Pick<Profile, 'id' | 'full_name'>[]) {
        map.set(p.id, p.full_name);
      }
      setNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Deferred to a macrotask so the effect body performs no synchronous
    // state updates (react-hooks/set-state-in-effect).
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel('admin-reservations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const filtered = useMemo(
    () => (status === 'all' ? rows : rows.filter((r) => r.status === status)),
    [rows, status],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  async function cancelReservation(id: string) {
    const ok = window.confirm('Cancel this reservation? The driver loses the slot.');
    if (!ok) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setNotice(null);
    const { error } = await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      setDataError(error.message);
      return;
    }
    void load();
  }

  async function expireStale() {
    const supabase = getSupabase();
    if (!supabase) return;
    setNotice(null);
    const { data, error } = await supabase.rpc('expire_stale_reservations');
    if (error) {
      setDataError(error.message);
      return;
    }
    setNotice(`Expired ${data ?? 0} stale reservation(s).`);
    void load();
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reservations</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {rows.length} bookings shown (latest 300) — live via Realtime
          </p>
        </div>
        <button
          type="button"
          onClick={() => void expireStale()}
          className="rounded-lg border border-amber-500/50 px-4 py-2 text-sm text-amber-400 transition hover:bg-amber-500/10"
          title="Marks confirmed bookings whose window + grace period has passed as expired"
        >
          Expire stale
        </button>
      </header>

      {dataError ? (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {dataError}
        </div>
      ) : null}
      {notice ? (
        <div className="mb-6 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {notice}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-1">
        {(['all', ...RESERVATION_STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-lg border px-3 py-2 text-xs capitalize transition ${
              status === s
                ? 'border-emerald-500/50 bg-emerald-500/15 font-semibold text-emerald-400'
                : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {s}
            {s !== 'all' && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="p-6 text-sm text-neutral-400">Loading reservations…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
          No reservations in this view — they appear here the moment a driver books.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="grid min-w-3xl grid-cols-[1.6fr_1.3fr_1fr_auto_1fr_auto] gap-3 border-b border-neutral-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <span>Window</span>
            <span>Charger</span>
            <span>Driver</span>
            <span>Status</span>
            <span>Booked</span>
            <span />
          </div>
          <ul className="divide-y divide-neutral-800">
            {filtered.map((r) => {
              const cancellable = r.status === 'confirmed' || r.status === 'active';
              return (
                <li
                  key={r.id}
                  className="grid min-w-3xl grid-cols-[1.6fr_1.3fr_1fr_auto_1fr_auto] items-center gap-3 px-4 py-3 text-sm"
                >
                  <span className="text-neutral-200">
                    {fmt(r.starts_at)} → {fmt(r.ends_at)}
                  </span>
                  <span className="truncate text-neutral-300">
                    {r.charger?.label ?? '—'}
                    <span className="block truncate text-xs text-neutral-500">
                      {r.charger?.station?.name ?? 'station removed'}
                    </span>
                  </span>
                  <span className="truncate text-neutral-300">
                    {names.get(r.user_id) || '(unknown)'}
                  </span>
                  <StatusBadge status={r.status} kind="reservation" />
                  <span className="text-xs text-neutral-500">{fmt(r.created_at)}</span>
                  <span>
                    {cancellable ? (
                      <button
                        type="button"
                        onClick={() => void cancelReservation(r.id)}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-red-500/60 hover:text-red-400"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

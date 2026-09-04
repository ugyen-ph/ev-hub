'use client';

// Dashboard 1 — Stations. Every station with live availability, streamed
// via Realtime (stations + chargers are both in the supabase_realtime
// publication). From here: create stations, toggle active, delete.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { getSupabase } from '@/lib/supabase';
import { CHARGER_STATUSES, type Charger, type Station } from '@/lib/types';

const VIEWS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Has free chargers' },
  { key: 'full', label: 'Full right now' },
  { key: 'inactive', label: 'Inactive' },
] as const;

type View = (typeof VIEWS)[number]['key'];

const STATUS_DOT: Record<Charger['status'], string> = {
  available: 'bg-green-500',
  reserved: 'bg-amber-500',
  busy: 'bg-blue-500',
  faulted: 'bg-red-500',
  offline: 'bg-neutral-500',
};

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('all');
  const [view, setView] = useState<View>('all');

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return; // env problems are surfaced by the dashboard shell
    const [st, ch] = await Promise.all([
      supabase.from('stations').select('*').order('name'),
      supabase.from('chargers').select('*').order('label'),
    ]);
    if (st.error || ch.error) {
      setDataError(st.error?.message ?? ch.error?.message ?? 'Unknown error');
    } else {
      setDataError(null);
      setStations(st.data as Station[]);
      setChargers(ch.data as Charger[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Deferred to a macrotask so the effect body performs no synchronous
    // state updates (react-hooks/set-state-in-effect).
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  // Live: any change to stations or chargers re-pulls both (small tables —
  // simpler and always consistent vs. patching rows in place).
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel('admin-stations-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chargers' }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  const districts = useMemo(
    () => Array.from(new Set(stations.map((s) => s.district))).sort(),
    [stations],
  );

  const rows = useMemo(() => {
    const byStation = new Map<string, Charger[]>();
    for (const c of chargers) {
      const list = byStation.get(c.station_id) ?? [];
      list.push(c);
      byStation.set(c.station_id, list);
    }
    const q = query.trim().toLowerCase();
    return stations
      .map((s) => ({ ...s, chargers: byStation.get(s.id) ?? [] }))
      .filter((s) => {
        if (district !== 'all' && s.district !== district) return false;
        if (q && !`${s.name} ${s.address ?? ''}`.toLowerCase().includes(q)) return false;
        if (view === 'inactive') return !s.is_active;
        if (!s.is_active) return false;
        const free = s.chargers.filter((c) => c.status === 'available').length;
        if (view === 'available') return free > 0;
        if (view === 'full') return s.chargers.length > 0 && free === 0;
        return true;
      });
  }, [stations, chargers, district, query, view]);

  async function toggleActive(s: Station) {
    const supabase = getSupabase();
    if (!supabase) return;
    setActionError(null);
    const { error } = await supabase
      .from('stations')
      .update({ is_active: !s.is_active })
      .eq('id', s.id);
    if (error) setActionError(error.message);
  }

  async function deleteStation(s: Station) {
    const ok = window.confirm(
      `Delete "${s.name}"? Its chargers and their reservations are deleted too (database cascade). This cannot be undone.`,
    );
    if (!ok) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setActionError(null);
    const { error } = await supabase.from('stations').delete().eq('id', s.id);
    if (error) setActionError(error.message);
  }


  const totalFree = chargers.filter((c) => c.status === 'available').length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Stations</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {stations.filter((s) => s.is_active).length} active · {totalFree}/{chargers.length} chargers
            free — live, updates stream in automatically
          </p>
        </div>
        <Link
          href="/stations/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          + New station
        </Link>
      </header>

      {dataError ? (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {dataError}
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
          ⚠️ {actionError}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or address…"
          className="w-56 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <select
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        >
          <option value="all">All districts</option>
          {districts.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`rounded-lg border px-3 py-2 text-xs transition ${
                view === v.key
                  ? 'border-emerald-500/50 bg-emerald-500/15 font-semibold text-emerald-400'
                  : 'border-neutral-700 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-neutral-400">Loading stations…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
          No stations match. Create one with “+ New station”.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((s) => {
            const free = s.chargers.filter((c) => c.status === 'available').length;
            return (
              <li key={s.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-56 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/stations/${s.id}`} className="font-semibold hover:text-emerald-400">
                        {s.name}
                      </Link>
                      {!s.is_active ? (
                        <span className="rounded-full border border-neutral-600 px-2 py-0.5 text-[10px] uppercase text-neutral-400">
                          inactive
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-400">
                      {s.district} · {s.operator}
                      {s.address ? ` · ${s.address}` : ''}
                    </p>
                  </div>

                  <div
                    className="flex items-center gap-2"
                    title={s.chargers.map((c) => `${c.label}: ${c.status}`).join(', ')}
                  >
                    {s.chargers.length === 0 ? (
                      <span className="text-xs text-neutral-500">no chargers yet</span>
                    ) : (
                      <>
                        <span className={`text-sm font-bold ${free > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {free}/{s.chargers.length}
                        </span>
                        <span className="flex gap-1">
                          {s.chargers.map((c) => (
                            <span
                              key={c.id}
                              className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[c.status]}`}
                              title={`${c.label}: ${c.status}`}
                            />
                          ))}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleActive(s)}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-400"
                    >
                      {s.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <Link
                      href={`/stations/${s.id}`}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-400"
                    >
                      Manage →
                    </Link>
                    <button
                      type="button"
                      onClick={() => void deleteStation(s)}
                      className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-500 transition hover:border-red-500/60 hover:text-red-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}

        </ul>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span>Charger status:</span>
        {CHARGER_STATUSES.map((s) => (
          <span key={s} className="flex items-center gap-1 capitalize">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${STATUS_DOT[s]}`} />
            {s}
          </span>
        ))}
      </div>

    </div>
  );
}

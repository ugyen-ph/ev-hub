'use client';

// EV Hub — Admin Dashboard (the "manager's office")
// Reads live charger status from Supabase and can flip it via /api/status.

import { useCallback, useEffect, useState } from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STATUS = ['available', 'reserved', 'busy', 'faulted', 'offline'] as const;
type Status = (typeof STATUS)[number];

const PILL: Record<Status, string> = {
  available: 'bg-green-500/15 text-green-400 border-green-500/40',
  reserved: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  busy: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  faulted: 'bg-red-500/15 text-red-400 border-red-500/40',
  offline: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/40',
};

type ChargerRow = {
  id: string;
  label: string;
  status: Status;
  power_kw: string | number;
  connector_type: string;
  station: { name: string; district: string } | null;
};

export default function Home() {
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [rows, setRows] = useState<ChargerRow[]>([]);
  const [envError, setEnvError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setEnvError('admin/.env is missing — copy admin/.env.example, paste your keys, restart npm run dev');
      return;
    }
    setClient(createClient(url, key));
  }, []);

  const load = useCallback(async () => {
    if (!client) return;
    const { data } = await client
      .from('chargers')
      .select('id, label, status, power_kw, connector_type, station:stations(name, district)')
      .order('label');
    setRows((data as unknown as ChargerRow[]) ?? []);
  }, [client]);

  useEffect(() => {
    if (!client) return;
    load();
    const channel = client
      .channel('admin-chargers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chargers' }, () => load())
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [client, load]);

  async function setStatus(chargerId: string, status: Status) {
    setPending(chargerId);
    setActionError(null);
    try {
      const res = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chargerId, status }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        setActionError(payload?.error ?? `Status flip failed (HTTP ${res.status})`);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setPending(null);
      load();
    }
  }

  const stats = Object.fromEntries(
    STATUS.map((s) => [s, rows.filter((r) => r.status === s).length]),
  ) as Record<Status, number>;

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <main className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">
            ⚡ EV Hub · Station Control{' '}
            <span className="text-sm font-normal text-neutral-400">— Kingdom of Bhutan 🇧🇹</span>
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Live status · tap a button to flip a charger · updates stream in real time
          </p>
        </header>

        {envError ? (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {envError}
          </div>
        ) : null}

        {actionError ? (
          <div className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
            ⚠️ {actionError}
          </div>
        ) : null}

        <section className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
          {STATUS.map((s) => (
            <div key={s} className={`rounded-xl border p-4 ${PILL[s]}`}>
              <p className="text-2xl font-bold">{stats[s]}</p>
              <p className="text-xs capitalize opacity-80">{s}</p>
            </div>
          ))}
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-4">
            <p className="text-2xl font-bold">{rows.length}</p>
            <p className="text-xs text-neutral-400">total chargers</p>
          </div>
        </section>

        <section className="divide-y divide-neutral-800 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          {rows.length === 0 && !envError ? (
            <p className="p-6 text-sm text-neutral-400">
              {pending ? 'Working…' : 'No chargers yet — apply the SQL files (README → Database).'}
            </p>
          ) : null}
          {rows.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-56 flex-1">
                <p className="font-semibold">
                  {c.station?.name ?? 'Station'} · {c.label}
                </p>
                <p className="text-xs text-neutral-400">
                  {String(c.power_kw)} kW · {c.connector_type.toUpperCase()} · {c.station?.district}
                </p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${PILL[c.status]}`}>
                {c.status}
              </span>
              <div className="flex gap-1">
                {STATUS.map((s) => (
                  <button
                    key={s}
                    disabled={pending === c.id || c.status === s}
                    onClick={() => setStatus(c.id, s)}
                    className="rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-30">
                    {s.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <footer className="mt-8 text-xs text-neutral-500">
          Manual control writes <code className="text-neutral-400">status_source: manual</code> — when BPC
          chargers stream OCPP data, hardware truth overrides these automatically.
        </footer>
      </main>
    </div>
  );
}
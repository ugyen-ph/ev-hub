'use client';

// Dashboard 2 — Users. Every registered profile, newest first, updated LIVE:
// migration 0006 published `profiles` to supabase_realtime, so the moment a
// driver signs up in the mobile app (trigger → profile row), this dashboard
// announces it without a refresh.

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getSupabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type Toast = { name: string; at: number };

export default function UsersPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return; // env problems are surfaced by the dashboard shell
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setDataError(error.message);
    } else {
      setDataError(null);
      setProfiles(data as Profile[]);
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
      .channel('admin-users-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as { full_name?: string };
          setToast({ name: row.full_name?.trim() || 'A new driver', at: Date.now() });
        }
        void load();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  // auto-dismiss the signup toast after 8 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      `${p.full_name} ${p.phone ?? ''} ${p.ev_model ?? ''}`.toLowerCase().includes(q),
    );
  }, [profiles, query]);

  const evOwners = profiles.filter((p) => p.ev_model).length;
  const admins = profiles.filter((p) => p.role === 'admin').length;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {profiles.length} registered drivers — new signups from the app appear here instantly
        </p>
      </header>

      {dataError ? (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {dataError}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-2xl font-bold">{profiles.length}</p>
          <p className="text-xs text-neutral-400">registered users</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-2xl font-bold">{evOwners}</p>
          <p className="text-xs text-neutral-400">with an EV model set</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-2xl font-bold">{admins}</p>
          <p className="text-xs text-neutral-400">operators (admin role)</p>
        </div>
      </section>

      <div className="mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone or EV model…"
          className="w-64 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      {loading ? (
        <p className="p-6 text-sm text-neutral-400">Loading users…</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-6 text-sm text-neutral-400">
          No users yet — signups from the mobile app land here automatically.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto_auto] gap-3 border-b border-neutral-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <span>Name</span>
            <span>Phone</span>
            <span>EV model</span>
            <span>Role</span>
            <span>Joined</span>
          </div>
          <ul className="divide-y divide-neutral-800">
            {filtered.map((p) => (
              <li
                key={p.id}
                className="grid grid-cols-[2fr_1fr_1fr_auto_auto] items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="truncate font-medium">{p.full_name || '(no name yet)'}</span>
                <span className="truncate text-neutral-400">{p.phone ?? '—'}</span>
                <span className="truncate text-neutral-400">{p.ev_model ?? '—'}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    p.role === 'admin'
                      ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                      : 'border-neutral-600 text-neutral-400'
                  }`}
                >
                  {p.role}
                </span>
                <span className="text-xs text-neutral-500">
                  {new Date(p.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-neutral-500">
        Roles can only be changed server-side (Dashboard → SQL or the bootstrap snippet in migration
        0006) — by design, clients cannot promote accounts.
      </p>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-300 shadow-lg backdrop-blur">
          🎉 New signup — {toast.name} just created an account
        </div>
      ) : null}
    </div>
  );
}

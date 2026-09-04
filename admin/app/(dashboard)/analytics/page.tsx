'use client';

// Dashboard 4 — Analytics for the station network, computed client-side from
// the four tables (stations, chargers, reservations, profiles). Energy/kWh
// analytics activate in Phase 2 when the OCPP gateway fills charging_sessions.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { BarChart, Donut, HBars } from '@/components/charts';
import { getSupabase } from '@/lib/supabase';
import { CHARGER_STATUSES, type Charger, type Profile, type Reservation, type Station } from '@/lib/types';

const DAY = 86_400_000;
const WEEK = 7 * DAY;

const STATUS_COLOR: Record<Charger['status'], string> = {
  available: '#22c55e',
  reserved: '#f59e0b',
  busy: '#3b82f6',
  faulted: '#ef4444',
  offline: '#737373',
};

const DAY_LABEL = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });

export default function AnalyticsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  // "Now" is captured after mount (deferred) — keeps the render pure for the
  // React Compiler's rules while giving the day/week buckets a stable anchor.
  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setNowMs(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return; // env problems are surfaced by the dashboard shell
    const [st, ch, res, prof] = await Promise.all([
      supabase.from('stations').select('*'),
      supabase.from('chargers').select('*'),
      supabase
        .from('reservations')
        .select('id, charger_id, user_id, starts_at, ends_at, status, created_at')
        .order('created_at', { ascending: false })
        .limit(2000),
      supabase.from('profiles').select('*'),
    ]);
    if (st.error || ch.error || res.error || prof.error) {
      setDataError(
        st.error?.message ?? ch.error?.message ?? res.error?.message ?? prof.error?.message ?? 'Unknown error',
      );
    } else {
      setDataError(null);
      setStations(st.data as Station[]);
      setChargers(ch.data as Charger[]);
      setReservations(res.data as Reservation[]);
      setProfiles(prof.data as Profile[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // Deferred to a macrotask so the effect body performs no synchronous
    // state updates (react-hooks/set-state-in-effect).
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const stats = useMemo(() => {
    const now = nowMs ?? 0;

    // charger status split
    const chargerStatus = Object.fromEntries(
      CHARGER_STATUSES.map((s) => [s, chargers.filter((c) => c.status === s).length]),
    ) as Record<Charger['status'], number>;

    // bookings per day (by created_at), last 14 days
    const byDay: { label: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now - i * DAY);
      const key = day.toDateString();
      byDay.push({
        label: DAY_LABEL(day),
        value: reservations.filter((r) => new Date(r.created_at).toDateString() === key).length,
      });
    }

    // bookings by hour of day (0–23, local time)
    const hourCounts = new Array(24).fill(0) as number[];
    for (const r of reservations) hourCounts[new Date(r.created_at).getHours()]++;
    const byHour = hourCounts.map((v, h) => ({ label: String(h), value: v }));
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // top stations by bookings (charger → station)
    const stationOfCharger = new Map(chargers.map((c) => [c.id, c.station_id]));
    const stationName = new Map(stations.map((s) => [s.id, s.name]));
    const perStation = new Map<string, number>();
    for (const r of reservations) {
      const sid = stationOfCharger.get(r.charger_id);
      if (!sid) continue;
      perStation.set(sid, (perStation.get(sid) ?? 0) + 1);
    }
    const topStations = [...perStation.entries()]
      .map(([sid, count]) => ({ label: stationName.get(sid) ?? 'Removed station', value: count }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

    // new users per week, last 6 weeks
    const byWeek: { label: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = now - (i + 1) * WEEK;
      const end = now - i * WEEK;
      byWeek.push({
        label: DAY_LABEL(new Date(end)),
        value: profiles.filter((p) => {
          const t = new Date(p.created_at).getTime();
          return t > start && t <= end;
        }).length,
      });
    }

    // stations per district
    const perDistrict = new Map<string, number>();
    for (const s of stations) perDistrict.set(s.district, (perDistrict.get(s.district) ?? 0) + 1);
    const districts = [...perDistrict.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    return { chargerStatus, byDay, byHour, peakHour, topStations, byWeek, districts };
  }, [stations, chargers, reservations, profiles, nowMs]);

  const reservationCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of reservations) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [reservations]);

  const activeStations = stations.filter((s) => s.is_active).length;
  const freeChargers = stats.chargerStatus.available;

  if (loading || nowMs === null) {
    return <p className="text-sm text-neutral-400">Crunching the numbers…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Network overview — stations, chargers, bookings and driver growth
        </p>
      </header>

      {dataError ? (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          {dataError}
        </div>
      ) : null}

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-2xl font-bold">
            {activeStations}
            <span className="text-sm font-normal text-neutral-500">/{stations.length}</span>
          </p>
          <p className="text-xs text-neutral-400">active stations</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-2xl font-bold">
            {freeChargers}
            <span className="text-sm font-normal text-neutral-500">/{chargers.length}</span>
          </p>
          <p className="text-xs text-neutral-400">chargers free right now</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-2xl font-bold">{reservations.length}</p>
          <p className="text-xs text-neutral-400">bookings total</p>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <p className="text-2xl font-bold">{profiles.length}</p>
          <p className="text-xs text-neutral-400">registered drivers</p>
        </div>
      </section>

      <section className="mb-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Bookings per day (last 14 days)">
          <BarChart data={stats.byDay} />
        </Panel>
        <Panel title="Bookings by hour of day">
          <BarChart data={stats.byHour} height={110} />
          <p className="mt-2 text-xs text-neutral-500">
            Peak hour: <span className="text-neutral-300">{stats.peakHour}:00</span> — plan
            maintenance outside it.
          </p>
        </Panel>
        <Panel title="Busiest stations (by bookings)">
          {stats.topStations.length === 0 ? (
            <Empty text="No bookings yet." />
          ) : (
            <HBars data={stats.topStations} />
          )}
        </Panel>
        <Panel title="Charger status right now">
          <Donut
            segments={CHARGER_STATUSES.map((s) => ({
              label: s,
              value: stats.chargerStatus[s],
              color: STATUS_COLOR[s],
            }))}
          />
        </Panel>
        <Panel title="New drivers per week (last 6 weeks)">
          <BarChart data={stats.byWeek} barColor="bg-sky-500" height={110} />
        </Panel>
        <Panel title="Stations per district">
          <HBars data={stats.districts} barColor="bg-emerald-600" />
        </Panel>
      </section>

      <section className="mb-6 flex flex-wrap gap-3 text-xs">
        {RESERVATION_SUMMARY.map((s) => (
          <span
            key={s}
            className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1.5 capitalize text-neutral-400"
          >
            {s}: <span className="font-semibold text-neutral-200">{reservationCounts[s] ?? 0}</span>
          </span>
        ))}
      </section>

      <p className="rounded-xl border border-dashed border-neutral-700 bg-neutral-900/50 p-4 text-xs text-neutral-500">
        Energy analytics (kWh delivered, cost per session) arrive in Phase 2 — the OCPP gateway will
        write real transactions into <code>charging_sessions</code>, and this dashboard picks them up
        with zero schema changes.
      </p>
    </div>
  );
}

const RESERVATION_SUMMARY = ['confirmed', 'active', 'completed', 'cancelled', 'expired'] as const;

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-300">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-neutral-500">{text}</p>;
}

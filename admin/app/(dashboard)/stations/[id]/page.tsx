'use client';

// One station: edit its details/location and manage its chargers
// (add, edit, delete, flip live status). Everything is a direct
// RLS-authorized write as the signed-in admin.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

import { FlipButtons } from '@/components/flip-buttons';
import { StatusBadge } from '@/components/status-badge';
import { StationForm, type StationFormValues } from '@/components/station-form';
import { getSupabase } from '@/lib/supabase';
import {
  CONNECTOR_TYPES,
  parseStationLocation,
  type Charger,
  type ConnectorType,
  type Station,
} from '@/lib/types';

const INPUT =
  'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm outline-none focus:border-emerald-500';

export default function StationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();

  const [station, setStation] = useState<Station | null>(null);
  const [chargers, setChargers] = useState<Charger[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingCharger, setEditingCharger] = useState<string | null>(null);

  // add-charger form
  const [newLabel, setNewLabel] = useState('');
  const [newConnector, setNewConnector] = useState<ConnectorType>('type2');
  const [newKw, setNewKw] = useState('22');
  const [newChargePointId, setNewChargePointId] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const supabase = getSupabase();
    if (!supabase) return; // env problems are surfaced by the dashboard shell
    const [st, ch] = await Promise.all([
      supabase.from('stations').select('*').eq('id', id).maybeSingle(),
      supabase.from('chargers').select('*').eq('station_id', id).order('label'),
    ]);
    if (st.error || ch.error) {
      setDataError(st.error?.message ?? ch.error?.message ?? 'Unknown error');
    } else {
      setDataError(null);
      setStation((st.data as Station | null) ?? null);
      setNotFound(!st.data);
      setChargers(ch.data as Charger[]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // Deferred to a macrotask so the effect body performs no synchronous
    // state updates (react-hooks/set-state-in-effect).
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!id) return;
    const supabase = getSupabase();
    if (!supabase) return;
    const channel = supabase
      .channel(`admin-station-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chargers', filter: `station_id=eq.${id}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, load]);

  async function saveStation(values: StationFormValues) {
    const supabase = getSupabase();
    if (!supabase || !id) return;
    setFormBusy(true);
    setFormError(null);
    const { error } = await supabase
      .from('stations')
      .update({
        name: values.name,
        operator: values.operator,
        district: values.district,
        address: values.address || null,
        amenities: values.amenities,
        is_active: values.is_active,
        location: `POINT(${values.lng} ${values.lat})`,
      })
      .eq('id', id);
    setFormBusy(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    void load();
  }

  async function deleteStation() {
    if (!station) return;
    const ok = window.confirm(
      `Delete "${station.name}"? Its chargers and their reservations are deleted too (database cascade). This cannot be undone.`,
    );
    if (!ok) return;
    const supabase = getSupabase();
    if (!supabase || !id) return;
    setActionError(null);
    const { error } = await supabase.from('stations').delete().eq('id', id);
    if (error) {
      setActionError(error.message);
      return;
    }
    router.push('/stations');
  }

  async function addCharger() {
    const supabase = getSupabase();
    if (!supabase || !id) return;
    if (!newLabel.trim()) {
      setActionError('Give the charger a label (e.g. A1).');
      return;
    }
    setActionError(null);
    const { error } = await supabase.from('chargers').insert({
      station_id: id,
      label: newLabel.trim(),
      connector_type: newConnector,
      power_kw: Number(newKw),
      charge_point_id: newChargePointId.trim() || null,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    setNewLabel('');
    setNewChargePointId('');
    void load();
  }

  async function deleteCharger(c: Charger) {
    const ok = window.confirm(
      `Delete charger ${c.label}? Its reservations are deleted too (database cascade).`,
    );
    if (!ok) return;
    const supabase = getSupabase();
    if (!supabase) return;
    setActionError(null);
    const { error } = await supabase.from('chargers').delete().eq('id', c.id);
    if (error) setActionError(error.message);
    void load();
  }


  if (loading) {
    return <p className="text-sm text-neutral-400">Loading station…</p>;
  }
  if (notFound || !station) {
    return (
      <div className="text-sm text-neutral-400">
        Station not found.{' '}
        <Link href="/stations" className="text-emerald-400 underline">
          Back to stations
        </Link>
      </div>
    );
  }

  // PostgREST returns geography(point) as WKT text ('POINT(lng lat)') — parse
  // it (GeoJSON shape handled too) to prefill the form's lat/lng fields.
  const initialLatLng = parseStationLocation(station.location);
  const free = chargers.filter((c) => c.status === 'available').length;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/stations" className="text-xs text-neutral-500 hover:text-emerald-400">
        ← All stations
      </Link>
      <header className="mb-6 mt-2">
        <h1 className="text-2xl font-bold">{station.name}</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {station.district} · {station.operator} · {free}/{chargers.length} chargers free
        </p>
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

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Chargers <span className="text-sm font-normal text-neutral-500">({chargers.length})</span>
        </h2>
        {chargers.length === 0 ? (
          <p className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">
            No chargers yet — add the first one below.
          </p>
        ) : (
          <ul className="space-y-2">
            {chargers.map((c) => (
              <li key={c.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                {editingCharger === c.id ? (
                  <ChargerEditForm
                    charger={c}
                    onDone={() => {
                      setEditingCharger(null);
                      void load();
                    }}
                    onError={(m) => setActionError(m)}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-40 flex-1">
                      <p className="font-semibold">
                        {c.label}{' '}
                        <span className="ml-1 text-xs font-normal text-neutral-500">
                          {String(c.power_kw)} kW · {c.connector_type.toUpperCase()}
                          {c.charge_point_id ? ` · OCPP: ${c.charge_point_id}` : ''}
                        </span>
                      </p>
                      <p className="text-xs text-neutral-500">
                        source: {c.status_source} · last change:{' '}
                        {new Date(c.last_status_change).toLocaleString()}
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                    <FlipButtons charger={c} onChanged={() => void load()} />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCharger(c.id)}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-400"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteCharger(c)}
                        className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-500 transition hover:border-red-500/60 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-neutral-700 bg-neutral-900/50 p-4">
          <p className="mb-3 text-sm font-semibold text-neutral-300">Add a charger</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-neutral-500" htmlFor="ch-label">Label</label>
              <input id="ch-label" className={`${INPUT} mt-1 w-24`} value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)} placeholder="A1" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500" htmlFor="ch-conn">Connector</label>
              <select id="ch-conn" className={`${INPUT} mt-1 w-32`} value={newConnector}
                onChange={(e) => setNewConnector(e.target.value as ConnectorType)}>
                {CONNECTOR_TYPES.map((t) => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500" htmlFor="ch-kw">Power (kW)</label>
              <input id="ch-kw" className={`${INPUT} mt-1 w-24`} type="number" step="0.1" min="0.1"
                value={newKw} onChange={(e) => setNewKw(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500" htmlFor="ch-cpid">Charge point ID (OCPP, optional)</label>
              <input id="ch-cpid" className={`${INPUT} mt-1 w-56`} value={newChargePointId}
                onChange={(e) => setNewChargePointId(e.target.value)} placeholder="BPC-CP-001" />
            </div>
            <button type="button" onClick={() => void addCharger()}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500">
              + Add charger
            </button>
          </div>
        </div>
      </section>


      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Station details</h2>
        <StationForm
          key={station.updated_at}
          initial={station}
          initialLatLng={initialLatLng}
          busy={formBusy}
          error={formError}
          submitLabel="Save changes"
          onSubmit={saveStation}
        />
      </section>

      <section className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
        <p className="text-sm font-semibold text-red-300">Danger zone</p>
        <p className="mt-1 text-xs text-neutral-400">
          Deleting the station removes its chargers and all their reservations (database cascade).
        </p>
        <button
          type="button"
          onClick={() => void deleteStation()}
          className="mt-3 rounded-lg border border-red-500/50 px-4 py-2 text-sm text-red-400 transition hover:bg-red-500/10"
        >
          Delete station
        </button>
      </section>
    </div>
  );
}

// Inline edit form for one charger (replaces its row while active).
function ChargerEditForm({
  charger,
  onDone,
  onError,
}: {
  charger: Charger;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [label, setLabel] = useState(charger.label);
  const [connector, setConnector] = useState<ConnectorType>(charger.connector_type);
  const [kw, setKw] = useState(charger.power_kw);
  const [cpid, setCpid] = useState(charger.charge_point_id ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    const supabase = getSupabase();
    if (!supabase) return;
    if (!label.trim()) {
      onError('Label is required.');
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from('chargers')
      .update({
        label: label.trim(),
        connector_type: connector,
        power_kw: Number(kw),
        charge_point_id: cpid.trim() || null,
      })
      .eq('id', charger.id);
    setBusy(false);
    if (error) {
      onError(error.message);
      return;
    }
    onDone();
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-xs text-neutral-500" htmlFor="ed-label">Label</label>
        <input id="ed-label" className={`${INPUT} mt-1 w-24`} value={label}
          onChange={(e) => setLabel(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500" htmlFor="ed-conn">Connector</label>
        <select id="ed-conn" className={`${INPUT} mt-1 w-32`} value={connector}
          onChange={(e) => setConnector(e.target.value as ConnectorType)}>
          {CONNECTOR_TYPES.map((t) => (
            <option key={t} value={t}>{t.toUpperCase()}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500" htmlFor="ed-kw">Power (kW)</label>
        <input id="ed-kw" className={`${INPUT} mt-1 w-24`} type="number" step="0.1" min="0.1"
          value={kw} onChange={(e) => setKw(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-neutral-500" htmlFor="ed-cpid">Charge point ID (OCPP)</label>
        <input id="ed-cpid" className={`${INPUT} mt-1 w-56`} value={cpid}
          onChange={(e) => setCpid(e.target.value)} placeholder="empty = not OCPP-connected" />
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void save()}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onDone}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:text-neutral-100">
          Cancel
        </button>
      </div>
    </div>
  );
}

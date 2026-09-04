'use client';

// Shared station create/edit form. The location is a geography(point) column —
// clients insert it as WKT text: 'POINT(lng lat)' (note: lng first).

import { useState, type FormEvent } from 'react';

import type { Station } from '@/lib/types';

export type StationFormValues = {
  name: string;
  operator: string;
  district: string;
  address: string;
  amenities: string[];
  is_active: boolean;
  lat: string;
  lng: string;
};

const DISTRICTS = [
  'Thimphu',
  'Paro',
  'Phuentsholing',
  'Wangdue Phodrang',
  'Punakha',
  'Bumthang',
  'Sarpang',
  'Mongar',
  'Trashigang',
];

const INPUT =
  'w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-emerald-500';
const LABEL = 'block text-xs font-semibold uppercase tracking-wide text-neutral-400';

export function StationForm({
  initial,
  initialLatLng,
  busy,
  error,
  submitLabel,
  onSubmit,
}: {
  initial?: Station | null;
  initialLatLng?: { lat: string; lng: string } | null;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (values: StationFormValues) => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [operator, setOperator] = useState(initial?.operator ?? 'Bhutan Power Corporation');
  const [district, setDistrict] = useState(initial?.district ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [amenitiesText, setAmenitiesText] = useState(initial?.amenities.join(', ') ?? '');
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [lat, setLat] = useState(initialLatLng?.lat ?? '');
  const [lng, setLng] = useState(initialLatLng?.lng ?? '');
  const [validation, setValidation] = useState<string | null>(null);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setValidation('This browser has no geolocation support — enter coordinates manually.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setValidation(null);
      },
      () => setValidation('Location permission denied — enter coordinates manually.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setValidation('Give the station a name.');
    if (!district.trim()) return setValidation('Which district is it in?');
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!lat.trim() || !lng.trim() || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return setValidation('Enter valid coordinates (or use your current location).');
    }
    if (latNum < -90 || latNum > 90) return setValidation('Latitude must be between -90 and 90.');
    if (lngNum < -180 || lngNum > 180) return setValidation('Longitude must be between -180 and 180.');
    setValidation(null);
    void onSubmit({
      name: name.trim(),
      operator: operator.trim() || 'Bhutan Power Corporation',
      district: district.trim(),
      address: address.trim(),
      amenities: amenitiesText
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      is_active: isActive,
      lat: lat.trim(),
      lng: lng.trim(),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
      <div>
        <label className={LABEL} htmlFor="st-name">Station name *</label>
        <input id="st-name" className={INPUT} value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Olakha Depot Charge" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="st-operator">Operator</label>
          <input id="st-operator" className={INPUT} value={operator} onChange={(e) => setOperator(e.target.value)} />
        </div>
        <div>
          <label className={LABEL} htmlFor="st-district">District *</label>
          <input id="st-district" className={INPUT} list="districts" value={district}
            onChange={(e) => setDistrict(e.target.value)} placeholder="Thimphu" />
          <datalist id="districts">
            {DISTRICTS.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="st-address">Address</label>
        <input id="st-address" className={INPUT} value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="Landmark / street" />
      </div>

      <div>
        <label className={LABEL} htmlFor="st-amenities">Amenities (comma-separated)</label>
        <input id="st-amenities" className={INPUT} value={amenitiesText}
          onChange={(e) => setAmenitiesText(e.target.value)} placeholder="cafe, restroom, wifi" />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className={LABEL} htmlFor="st-lat">Latitude *</label>
          <input id="st-lat" className={INPUT} type="number" step="0.000001" value={lat}
            onChange={(e) => setLat(e.target.value)} placeholder="27.472800" />
        </div>
        <div>
          <label className={LABEL} htmlFor="st-lng">Longitude *</label>
          <input id="st-lng" className={INPUT} type="number" step="0.000001" value={lng}
            onChange={(e) => setLng(e.target.value)} placeholder="89.639000" />
        </div>
        <button type="button" onClick={useMyLocation}
          className="rounded-lg border border-emerald-500/50 px-3 py-2 text-sm text-emerald-400 transition hover:bg-emerald-500/10">
          📍 Use my location
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-300">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Active (visible on the driver app map)
      </label>

      {validation ? <p className="text-sm text-amber-400">{validation}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <button type="submit" disabled={busy}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50">
        {busy ? 'Saving…' : submitLabel}
      </button>

    </form>
  );
}

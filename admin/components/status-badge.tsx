// Shared status pills — one color language across every dashboard.

import type { ChargerStatus, ReservationStatus } from '@/lib/types';

export const STATUS_PILL: Record<ChargerStatus, string> = {
  available: 'bg-green-500/15 text-green-400 border-green-500/40',
  reserved: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  busy: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  faulted: 'bg-red-500/15 text-red-400 border-red-500/40',
  offline: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/40',
};

export const RESERVATION_PILL: Record<ReservationStatus, string> = {
  confirmed: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  active: 'bg-green-500/15 text-green-400 border-green-500/40',
  completed: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/40',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/40',
  expired: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
};

export function StatusBadge({
  status,
  kind = 'charger',
}: {
  status: ChargerStatus | ReservationStatus;
  kind?: 'charger' | 'reservation';
}) {
  const pill =
    kind === 'reservation'
      ? RESERVATION_PILL[status as ReservationStatus]
      : STATUS_PILL[status as ChargerStatus];
  return (
    <span className={`inline-block rounded-full border px-3 py-1 text-xs font-semibold capitalize ${pill}`}>
      {status}
    </span>
  );
}

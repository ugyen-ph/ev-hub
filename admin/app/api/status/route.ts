// Server-side API route — the ONLY place the secret key is ever used.
// POST { chargerId, status } → updates the charger in Supabase.
//
// TWO MODES (tried in order):
//   1. TRUSTED (production) — SUPABASE_SECRET_KEY in admin/.env is valid:
//      service client bypasses Row Level Security.
//   2. DEMO FALLBACK — secret missing or dead: retry with the publishable
//      key. That only works because migration 0005 opened a tightly-guarded
//      public path (only `status` + `status_source` columns, never on
//      OCPP-managed rows). See supabase/migrations/20260902000005_demo_status_flip.sql

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED = ['available', 'reserved', 'busy', 'faulted', 'offline'] as const;
type Status = (typeof ALLOWED)[number];

type FlipError = { message: string; code?: string | null } | undefined;

// One attempt = one Supabase client + one guarded UPDATE.
// `.select('id')` matters: RLS row-filters silently match 0 rows, so we
// return the affected rows and can tell "worked" from "was blocked".
async function flip(
  url: string,
  key: string,
  chargerId: string,
  status: Status,
): Promise<{ updated: { id: string }[]; error?: FlipError }> {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client
    .from('chargers')
    .update({ status, status_source: 'manual' })
    .eq('id', chargerId)
    .select('id');
  return {
    updated: (data as { id: string }[] | null) ?? [],
    error: error ? { message: error.message, code: error.code } : undefined,
  };
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || (!secret && !publishable)) {
    return NextResponse.json(
      {
        error:
          'admin/.env is missing NEXT_PUBLIC_SUPABASE_URL and a usable key (SUPABASE_SECRET_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)',
      },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    chargerId?: string;
    status?: Status;
  } | null;

  if (!body?.chargerId || !body.status || !ALLOWED.includes(body.status)) {
    return NextResponse.json(
      { error: 'chargerId and a valid status (available|reserved|busy|faulted|offline) required' },
      { status: 400 },
    );
  }

  // Try the secret first (trusted). If it's missing/dead, fall back to the
  // publishable key + the guarded demo policy from migration 0005.
  const attempts: { key: string; mode: 'service' | 'demo' }[] = [];
  if (secret) attempts.push({ key: secret, mode: 'service' });
  if (publishable) attempts.push({ key: publishable, mode: 'demo' });

  let lastError: FlipError = undefined;
  let updatedCount = 0;

  for (const attempt of attempts) {
    const { updated, error } = await flip(url, attempt.key, body.chargerId, body.status);
    lastError = error;
    updatedCount = updated.length;

    if (!error) break; // request itself succeeded (may still be 0 rows)

    // A dead/invalid secret is recoverable — fall through to the demo path.
    const msg = error.message.toLowerCase();
    const badKey =
      msg.includes('invalid api key') ||
      msg.includes('api key') ||
      msg.includes('unauthorized') ||
      msg.includes('credentials');
    if (badKey && attempt.mode === 'service') continue;

    // Anything else is a real failure — surface it.
    if (error.code === '42501') {
      return NextResponse.json(
        {
          error:
            'Blocked by database safety rules (RLS). If migration 0005 (demo_status_flip.sql) has not been applied yet, run it in Supabase → SQL Editor. Detail: ' +
            error.message,
        },
        { status: 403 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!lastError && updatedCount > 0) {
    return NextResponse.json({ ok: true });
  }

  // 0 rows updated — diagnose WHY: wrong id, or an OCPP-protected charger?
  const lookup = createClient(url, publishable || secret!, { auth: { persistSession: false } });
  const { data: row } = await lookup
    .from('chargers')
    .select('id, status_source')
    .eq('id', body.chargerId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: 'Charger id not found' }, { status: 404 });
  }
  if (row.status_source === 'ocpp') {
    return NextResponse.json(
      { error: 'This charger is hardware-managed (OCPP) — its status can only come from the charger itself. Manual flips are blocked on purpose.' },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { error: 'Update matched the charger but was not applied — check the RLS policy in migration 0005.' },
    { status: 500 },
  );
}
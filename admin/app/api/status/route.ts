// Server-side API route — the ONLY place the secret key is ever used.
// POST { chargerId, status } → updates the charger in Supabase.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED = ['available', 'reserved', 'busy', 'faulted', 'offline'] as const;
type Status = (typeof ALLOWED)[number];

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secret) {
    return NextResponse.json(
      { error: 'admin/.env is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY' },
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

  // service key bypasses RLS — this is the trusted admin path
  const admin = createClient(url, secret, { auth: { persistSession: false } });

  const { error } = await admin
    .from('chargers')
    .update({ status: body.status, status_source: 'manual' })
    .eq('id', body.chargerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
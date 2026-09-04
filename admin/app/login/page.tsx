'use client';

// Operator sign-in. Same auth as the mobile app — an account becomes an
// operator when the bootstrap SQL in migration 0006 (or another admin)
// sets profiles.role = 'admin'.

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { getSupabase, getSupabaseEnvError } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const envError = getSupabaseEnvError();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = getSupabase();
    if (!supabase) {
      setError(envError ?? 'Supabase is not configured.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    router.replace('/stations');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <main className="w-full max-w-sm">
        <h1 className="text-2xl font-bold">⚡ EV Hub · Admin</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Operator dashboard — Kingdom of Bhutan 🇧🇹
        </p>

        <form
          onSubmit={submit}
          className="mt-8 space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6"
        >
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="operator@example.com"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wide text-neutral-400"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {envError ? <p className="text-xs text-amber-400">{envError}</p> : null}
        </form>
      </main>
    </div>
  );
}

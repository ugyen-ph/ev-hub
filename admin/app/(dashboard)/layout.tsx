'use client';

// Dashboard shell: sidebar navigation + operator header + the admin gate.
// Child pages assume an authenticated admin — this layout bounces anyone
// else to /login before rendering them.

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { AuthProvider, useAuth } from '@/components/auth-context';
import { getSupabase } from '@/lib/supabase';

const NAV = [
  { href: '/stations', label: 'Stations', icon: '🔌' },
  { href: '/users', label: 'Users', icon: '👥' },
  { href: '/reservations', label: 'Reservations', icon: '📅' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
] as const;

function Center({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="max-w-md text-center">{children}</div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-300">
      {children}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { user, profile, loading, envError, profileError } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
  }, [loading, user, router]);

  async function signOut() {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    router.replace('/login');
  }

  if (envError) {
    return (
      <Center>
        <Notice>{envError}</Notice>
      </Center>
    );
  }
  if (loading || !user) {
    return (
      <Center>
        <p className="text-sm text-neutral-400">Checking session…</p>
      </Center>
    );
  }
  if (profileError) {
    return (
      <Center>
        <Notice>
          {profileError}{' '}
          <button type="button" onClick={signOut} className="underline">
            Sign out
          </button>
        </Notice>
      </Center>
    );
  }
  if (!profile) {
    return (
      <Center>
        <p className="text-sm text-neutral-400">Loading profile…</p>
      </Center>
    );
  }
  if (profile.role !== 'admin') {
    return (
      <Center>
        <Notice>
          Signed in as {profile.full_name || user.email} — this account is not an operator. Ask an
          existing admin to set <code className="text-amber-200">role = &apos;admin&apos;</code>, or
          run the bootstrap SQL in migration 0006.{' '}
          <button type="button" onClick={signOut} className="underline">
            Sign out
          </button>
        </Notice>
      </Center>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100 md:flex-row">
      <aside className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 p-4 md:w-56 md:flex-col md:items-stretch md:border-b-0 md:border-r">
        <div className="mr-auto md:mr-0 md:mb-6">
          <p className="font-bold">⚡ EV Hub</p>
          <p className="text-xs text-neutral-500">Operator dashboard</p>
        </div>
        <nav className="flex gap-1 md:flex-col">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-emerald-500/15 font-semibold text-emerald-400'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden md:mt-auto md:block">
          <p className="truncate text-xs text-neutral-500" title={user.email ?? ''}>
            {profile.full_name || user.email}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-2 w-full rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition hover:border-red-500/50 hover:text-red-400"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Shell>{children}</Shell>
    </AuthProvider>
  );
}

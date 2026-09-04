'use client';

// Admin auth: the same Supabase auth as the mobile app. A signed-in operator
// is a real user row — the dashboard only unlocks when profiles.role = 'admin'
// (the database enforces the identical rule inside every admin RLS policy).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '@supabase/supabase-js';

import { getSupabase, getSupabaseEnvError } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type AuthState = {
  user: User | null;
  profile: Profile | null;
  /** true until the first session + profile check has finished */
  loading: boolean;
  /** missing .env vars */
  envError: string | null;
  /** the profile row could not be read (RLS blocked, missing row, network…) */
  profileError: string | null;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // If env vars are missing there is nothing to wait for — start settled.
  const [loading, setLoading] = useState(() => !!getSupabase());
  const [envError] = useState<string | null>(() => getSupabaseEnvError());
  const [profileError, setProfileError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (!u) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.id)
      .maybeSingle();
    if (error) {
      setProfileError(`Could not load your profile: ${error.message}`);
      setProfile(null);
    } else if (!data) {
      setProfileError(
        'No profile row exists for this account. New signups get one automatically (trigger in migration 0002) — accounts created by hand need the bootstrap SQL in migration 0006.',
      );
      setProfile(null);
    } else {
      setProfileError(null);
      setProfile(data as Profile);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return; // env error is surfaced via `envError` above

    void (async () => {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      setUser(u ?? null);
      if (u) await refreshProfile();
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return; // already handled by the block above
      setUser(session?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setProfileError(null);
      } else if (session?.user) {
        void refreshProfile();
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [refreshProfile]);

  const value = useMemo(
    () => ({ user, profile, loading, envError, profileError, refreshProfile }),
    [user, profile, loading, envError, profileError, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

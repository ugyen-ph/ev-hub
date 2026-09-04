import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '[EV Hub] Missing Supabase env vars. Copy mobile/.env.example to mobile/.env, '
      + 'paste your Project URL + publishable key, then fully restart Expo.'
  );
}

// The publishable key is safe in the client: Row Level Security is the real gatekeeper.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseKey ?? 'placeholder-publishable-key',
  {
    auth: {
      // Sessions live in memory only: every app launch / QR scan starts at the
      // login screen, and signing in opens the app via the gate in app/_layout.tsx.
      autoRefreshToken: true,
      persistSession: false,
      detectSessionInUrl: false,
    },
    realtime: {
      // Explicit real-time config for React Native
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

// React Native has no browser visibility events, so supabase-js never starts its
// background refresh ticker by itself - start it explicitly. The ticker refreshes
// the in-memory access token before it expires (default JWT lifetime is 1 hour).
void supabase.auth.startAutoRefresh();

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  // Fail loudly in development — copy mobile/.env.example -> mobile/.env,
  // paste your Project URL + publishable key, then fully restart Expo.
  console.warn(
    '[EV Hub] Missing Supabase env vars — the app will run but data calls will fail. ' +
      'Copy mobile/.env.example to mobile/.env, paste your keys, restart Expo.'
  );
}

// The publishable key is safe for the client: Row Level Security is the real gatekeeper.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabasePublishableKey ?? 'placeholder-publishable-key'
);

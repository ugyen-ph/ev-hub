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
  supabaseKey ?? 'placeholder-publishable-key'
);

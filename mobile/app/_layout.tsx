import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors, Brand } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

const EvHubLight: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Brand.primary,
    background: Colors.light.background,
    card: '#FFFFFF',
    text: Colors.light.text,
    border: '#E2ECE8',
  },
};

const EvHubDark: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Brand.primaryLight,
    background: Colors.dark.background,
    card: '#12201B',
    text: Colors.dark.text,
    border: '#1E2C27',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

/**
 * Auth gate (Protected routes — Expo Router v6):
 *  - while auth state is checked on launch, render nothing → the splash screen
 *    stays up and nothing flashes;
 *  - signed in  → only the (tabs) group exists;
 *  - signed out → only the (auth) group exists (login / sign-up).
 * Flipping the guard mid-session (sign-in / sign-out) redirects automatically,
 * and deep links into protected screens bounce to the available group.
 */
function RootNavigator() {
  const { session, initializing } = useAuth();

  if (initializing) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? EvHubDark : EvHubLight}>
        <RootNavigator />
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}

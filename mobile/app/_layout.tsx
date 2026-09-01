import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { Colors, Brand } from '@/constants/theme';
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

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? EvHubDark : EvHubLight}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

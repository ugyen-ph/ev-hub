import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * Normalized to 'light' | 'dark'. React Native 0.86 widened the underlying
 * hook's return to include null / 'unspecified', which callers here never
 * need to handle — treat anything non-dark as light.
 */
export function useColorScheme(): 'light' | 'dark' {
  return useRNColorScheme() === 'dark' ? 'dark' : 'light';
}

import { Stack } from 'expo-router';

/**
 * Auth screens (login / sign-up) live in their own stack. The root layout only
 * mounts this whole group while the user is signed out (see Stack.Protected
 * in app/_layout.tsx).
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

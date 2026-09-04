import { Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Sign-in / sign-up live behind the auth gate (app/(auth)) now. This screen
 * just shows the signed-in user and lets them sign out — the root gate then
 * bounces them to the login screen.
 */
export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const tint = useThemeColor({}, 'tint');

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Account</ThemedText>
      <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">Signed in ✅</ThemedText>
        <ThemedText style={styles.meta}>{user?.email ?? '—'}</ThemedText>
        <ThemedText style={styles.meta}>
          You can now book chargers — try the Stations tab.
        </ThemedText>
        <Pressable style={[styles.btn, { backgroundColor: tint }]} onPress={confirmSignOut}>
          <ThemedText style={styles.btnText}>Sign out</ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  meta: { opacity: 0.65, fontSize: 13 },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
});

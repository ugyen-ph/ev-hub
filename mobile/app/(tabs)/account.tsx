import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function AccountScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Account</ThemedText>
      <ThemedView style={styles.empty}>
        <ThemedText type="subtitle">Sign in coming soon</ThemedText>
        <ThemedText style={styles.hint}>
          Email sign-in via Supabase Auth lands in Session 3, together with your EV profile.
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16, paddingTop: 60 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  hint: { opacity: 0.6, textAlign: 'center' },
});
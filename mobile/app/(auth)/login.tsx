import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tint = useThemeColor({}, 'tint');
  const insets = useSafeAreaInsets();

  const signIn = async () => {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    // On success the auth gate in app/_layout.tsx swaps to the app automatically.
    if (err) setError(err.message);
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title">⚡ EV Hub</ThemedText>
            <ThemedText style={styles.tagline}>
              Find and reserve EV chargers across Bhutan.
            </ThemedText>
          </View>

          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Welcome back</ThemedText>
            <ThemedText style={styles.hint}>Sign in to book a charger.</ThemedText>

            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <Pressable
              style={[styles.btn, { backgroundColor: tint }, busy && styles.busy]}
              disabled={busy}
              onPress={() => void signIn()}>
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.btnText}>Sign in</ThemedText>
              )}
            </Pressable>

            <Link href="/(auth)/sign-up" style={styles.switchLink}>
              <ThemedText style={[styles.switchText, { color: tint }]}>
                New here? Create an account
              </ThemedText>
            </Link>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  header: { gap: 8, marginBottom: 24 },
  tagline: { opacity: 0.65, fontSize: 15 },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  hint: { opacity: 0.65, fontSize: 13 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,120,120,0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  error: { fontSize: 13, color: '#DC2626' },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  busy: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  switchLink: { alignSelf: 'center', marginTop: 4 },
  switchText: { fontSize: 13, fontWeight: '600' },
});

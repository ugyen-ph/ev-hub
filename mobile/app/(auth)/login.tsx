import { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
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
  const textColor = useThemeColor({}, 'text');
  const insets = useSafeAreaInsets();

  // Animated value for EV HUB glow/blink effect
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slow blinking glow animation
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: false,
        }),
      ])
    );
    glow.start();
    return () => glow.stop(); // stop the loop when the screen unmounts
  }, [glowAnim]);

  // Interpolate glow color and opacity
  const glowColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(52, 211, 153, 0.6)', 'rgba(14, 159, 110, 1)'],
  });

  const textOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1],
  });

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
            {
              paddingTop: insets.top + 24,
              paddingBottom: insets.bottom + 24,
              justifyContent: 'center',
              flexGrow: 1,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <View style={styles.header}>
              <Animated.Text
                style={[
                  styles.logoText,
                  {
                    color: textColor, // theme-aware (was hardcoded light-mode green)
                    opacity: textOpacity,
                    textShadowColor: glowColor,
                    textShadowOffset: { width: 0, height: 0 },
                    textShadowRadius: 30,
                  },
                ]}>
                ⚡ EV HUB
              </Animated.Text>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24 },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: { gap: 12, marginBottom: 32, alignItems: 'center' },
  logoText: {
    fontSize: 42,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 2,
  },
  tagline: { opacity: 0.65, fontSize: 15, textAlign: 'center' },
  card: {
    gap: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.3)',
  },
  hint: { opacity: 0.65, fontSize: 13 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,120,120,0.4)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { fontSize: 13, color: '#DC2626' },
  btn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  busy: { opacity: 0.6 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  switchLink: { alignSelf: 'center', marginTop: 8 },
  switchText: { fontSize: 14, fontWeight: '600' },
});

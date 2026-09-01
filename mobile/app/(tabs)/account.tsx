import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [formEmail, setFormEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tint = useThemeColor({}, 'tint');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user.email ?? null);
      setChecking(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: formEmail,
        password,
        options: { data: { full_name: fullName } },
      });
      setBusy(false);
      setMsg(
        error
          ? error.message
          : 'Account created 🎉 If email confirmation is on, confirm via the inbox link, then sign in.',
      );
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: formEmail,
        password,
      });
      setBusy(false);
      if (error) setMsg(error.message);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (checking) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={tint} />
      </ThemedView>
    );
  }

  if (email) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title">Account</ThemedText>
        <ThemedView style={styles.card}>
          <ThemedText type="defaultSemiBold">Signed in ✅</ThemedText>
          <ThemedText style={styles.meta}>{email}</ThemedText>
          <ThemedText style={styles.meta}>
            You can now book chargers — try the Stations tab.
          </ThemedText>
          <Pressable style={[styles.btn, { backgroundColor: tint }]} onPress={signOut}>
            <ThemedText style={styles.btnText}>Sign out</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Account</ThemedText>
      <ThemedText type="subtitle">
        {mode === 'signup' ? 'Create your EV Hub account' : 'Welcome back'}
      </ThemedText>

      <ThemedView style={styles.card}>
        {mode === 'signup' ? (
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor="#888"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
          />
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={formEmail}
          onChangeText={setFormEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password (6+ characters)"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {msg ? <ThemedText style={styles.msg}>{msg}</ThemedText> : null}
        <Pressable
          style={[styles.btn, { backgroundColor: tint }, busy && { opacity: 0.5 }]}
          disabled={busy}
          onPress={submit}>
          <ThemedText style={styles.btnText}>
            {busy ? '…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          <ThemedText style={[styles.switch, { color: tint }]}>
            {mode === 'signup'
              ? 'Already have an account? Sign in'
              : 'New here? Create an account'}
          </ThemedText>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    gap: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,120,120,0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  msg: { fontSize: 12, opacity: 0.75 },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  switch: { textAlign: 'center', fontSize: 13, fontWeight: '600' },
  meta: { opacity: 0.65, fontSize: 13 },
});

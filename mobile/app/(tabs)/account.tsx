import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/auth';
import { useThemeColor } from '@/hooks/use-theme-color';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const tint = useThemeColor({}, 'tint');

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [evModel, setEvModel] = useState('');
  const [idTag, setIdTag] = useState<string | null>(null);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (data) {
      setFullName(data.full_name ?? '');
      setPhone(data.phone ?? '');
      setEvModel(data.ev_model ?? '');
      setIdTag(data.id_tag ?? null);
    }
    setIsLoading(false);
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        ev_model: evModel.trim() || null,
      })
      .eq('id', user.id);
    setIsSaving(false);
    if (error) {
      Alert.alert('Error', 'Could not save profile. Please try again.');
      return;
    }
    setIsEditing(false);
    Alert.alert('Saved', 'Your profile has been updated.');
  };

  const cancelEdit = () => {
    loadProfile(); // Reset to original values
    setIsEditing(false);
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <ThemedText type="title">PROFILE</ThemedText>
        <ThemedView style={styles.card}>
        <ThemedText type="defaultSemiBold">Signed in ✅</ThemedText>
        <ThemedText style={styles.email}>{user?.email ?? '—'}</ThemedText>

        <View style={styles.divider} />

        {isLoading ? (
          <ThemedText style={styles.meta}>Loading profile...</ThemedText>
        ) : isEditing ? (
          <>
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Full Name</ThemedText>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your name"
                placeholderTextColor="#888"
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>Phone</ThemedText>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Enter your phone"
                placeholderTextColor="#888"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.fieldGroup}>
              <ThemedText style={styles.label}>EV Model</ThemedText>
              <TextInput
                style={styles.input}
                value={evModel}
                onChangeText={setEvModel}
                placeholder="e.g. Tesla Model 3"
                placeholderTextColor="#888"
              />
            </View>
            <View style={styles.editActions}>
              <Pressable style={styles.cancelBtn} onPress={cancelEdit}>
                <ThemedText style={styles.cancelBtnText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.saveBtn, { backgroundColor: tint }, isSaving && styles.busy]}
                onPress={saveProfile}
                disabled={isSaving}>
                <ThemedText style={styles.btnText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <View style={styles.fieldRow}>
              <ThemedText style={styles.label}>Full Name</ThemedText>
              <ThemedText style={styles.value}>{fullName || '—'}</ThemedText>
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={styles.label}>Phone</ThemedText>
              <ThemedText style={styles.value}>{phone || '—'}</ThemedText>
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={styles.label}>EV Model</ThemedText>
              <ThemedText style={styles.value}>{evModel || '—'}</ThemedText>
            </View>
            <View style={styles.fieldRow}>
              <ThemedText style={styles.label}>Charging card (OCPP)</ThemedText>
              <ThemedText style={[styles.value, { fontFamily: 'monospace' }]}>
                {idTag || '—'}
              </ThemedText>
            </View>
            <ThemedText style={styles.meta}>
              Present this ID at an OCPP charger (keypad or RFID) to identify yourself.
            </ThemedText>
            <Pressable style={styles.editBtn} onPress={() => setIsEditing(true)}>
              <ThemedText style={[styles.editBtnText, { color: tint }]}>Edit Profile</ThemedText>
            </Pressable>
          </>
        )}

        <View style={styles.divider} />

        <Pressable style={[styles.signOutBtn, { backgroundColor: tint }]} onPress={confirmSignOut}>
          <ThemedText style={styles.btnText}>Sign out</ThemedText>
        </Pressable>
      </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    padding: 20,
    gap: 12,
    paddingTop: 60,
    paddingBottom: 32,
  },
  card: {
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(14,159,110,0.25)',
  },
  email: { opacity: 0.7, fontSize: 14, marginBottom: 4 },
  meta: { opacity: 0.65, fontSize: 13 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(14,159,110,0.2)',
    marginVertical: 4,
  },
  fieldGroup: { gap: 6 },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: { fontSize: 13, opacity: 0.65 },
  value: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(120,120,120,0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(120,120,120,0.4)',
  },
  cancelBtnText: { fontWeight: '600', opacity: 0.7 },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  busy: { opacity: 0.6 },
  editBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  editBtnText: { fontWeight: '600', fontSize: 14 },
  signOutBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
});

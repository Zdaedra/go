// Email sign-in: request a 6-digit code, then verify it.
// Without a configured backend (EXPO_PUBLIC_API_URL empty) the screen
// offers a local guest session so the app stays usable in development.

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../state/AuthContext';
import { useT } from '../i18n';
import { hasBackend } from '../api/client';
import MistBackground from '../components/MistBackground';
import PrimaryButton from '../components/PrimaryButton';

export default function AuthScreen() {
  const auth = useAuth();
  const t = useT();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t('err_email'));
      return;
    }
    if (!hasBackend()) {
      setError(t('err_no_backend'));
      return;
    }
    setBusy(true);
    try {
      await auth.requestCode(email);
      setStep('code');
    } catch {
      setError(t('err_send'));
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async () => {
    setError(null);
    setBusy(true);
    try {
      await auth.verify(email, code);
    } catch {
      setError(t('err_code'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <MistBackground />
      <Text style={styles.title}>{t('app_subtitle')}</Text>
      <Text style={styles.subtitle}>{t('auth_subtitle')}</Text>

      {step === 'email' ? (
        <View style={styles.form}>
          <Text style={styles.label}>{t('email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#7E7B75"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <PrimaryButton
            label={busy ? t('sending') : t('get_code')}
            onPress={submitEmail} disabled={busy}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>{t('code_label', { email })}</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor="#7E7B75"
            keyboardType="number-pad"
            maxLength={6}
          />
          <PrimaryButton
            label={busy ? t('verifying') : t('sign_in')}
            onPress={submitCode} disabled={busy}
          />
          <Pressable onPress={() => { setStep('email'); setCode(''); }}>
            <Text style={styles.link}>{t('other_email')}</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={auth.continueAsGuest} style={styles.guest}>
        <Text style={styles.link}>{t('continue_guest')}</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    // centered with a slight upward bias (~21% of screen height above)
    flex: 1, justifyContent: 'flex-start', paddingTop: 190,
    padding: 24, gap: 12,
    backgroundColor: '#121213',
  },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#F2EFEA', fontFamily: 'Playfair' },
  subtitle: { fontSize: 15, color: '#8E8B85', textAlign: 'center', marginBottom: 12 },
  form: { gap: 10 },
  label: {
    fontSize: 10.5, fontWeight: '600', color: '#8E8B85',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#F2EFEA',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 22 },
  link: { color: 'rgba(196,189,255,0.75)', fontSize: 14, textAlign: 'center', padding: 6 },
  error: { color: '#C96F5A', fontSize: 14, textAlign: 'center' },
  guest: { marginTop: 16 },
});

// Email sign-in: request a 6-digit code, then verify it.
// Without a configured backend (EXPO_PUBLIC_API_URL empty) the screen
// offers a local guest session so the app stays usable in development.

import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useAuth } from '../state/AuthContext';
import { hasBackend } from '../api/client';

export default function AuthScreen() {
  const auth = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async () => {
    setError(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Похоже, это не email. Проверь адрес.');
      return;
    }
    if (!hasBackend()) {
      setError('Сервер не настроен. Войди как гость (режим разработки).');
      return;
    }
    setBusy(true);
    try {
      await auth.requestCode(email);
      setStep('code');
    } catch {
      setError('Не удалось отправить код. Проверь сеть и попробуй ещё раз.');
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
      setError('Код не подошёл. Проверь письмо и попробуй ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.page}
    >
      <Text style={styles.title}>Дебюты Го 9×9</Text>
      <Text style={styles.subtitle}>
        Ставь камни — приложение назовёт дебют, ветку и покажет продолжения.
      </Text>

      {step === 'email' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Pressable style={styles.primary} onPress={submitEmail} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Отправляем…' : 'Получить код'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.label}>Код из письма ({email})</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
          <Pressable style={styles.primary} onPress={submitCode} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? 'Проверяем…' : 'Войти'}</Text>
          </Pressable>
          <Pressable onPress={() => { setStep('email'); setCode(''); }}>
            <Text style={styles.link}>Другой email</Text>
          </Pressable>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable onPress={auth.continueAsGuest} style={styles.guest}>
        <Text style={styles.link}>
          Продолжить без аккаунта{hasBackend() ? '' : ' (режим разработки)'}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1, justifyContent: 'center', padding: 24, gap: 12,
    backgroundColor: '#100E0D',
  },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#F2EFEA', fontFamily: 'Playfair' },
  subtitle: { fontSize: 15, color: '#8E8B85', textAlign: 'center', marginBottom: 12 },
  form: { gap: 10 },
  label: { fontSize: 13, fontWeight: '600', color: '#8E8B85' },
  input: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14, fontSize: 16, color: '#F2EFEA',
    backgroundColor: '#FFFFFF',
  },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 22 },
  primary: {
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
    backgroundColor: '#1A1720', borderWidth: 1.5, borderColor: '#8B7CF6',
    shadowColor: '#8B7CF6', shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  link: { color: '#8B7CF6', fontSize: 14, textAlign: 'center', padding: 6 },
  error: { color: '#8B7CF6', fontSize: 14, textAlign: 'center' },
  guest: { marginTop: 16 },
});

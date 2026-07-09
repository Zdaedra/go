import React, {
  createContext, useContext, useEffect, useMemo, useState, useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, hasBackend } from '../api/client';

export type Plan = 'free' | 'pro';

interface AuthState {
  ready: boolean;
  /** null = signed out; 'guest' sessions have no token. */
  email: string | null;
  token: string | null;
  guest: boolean;
  plan: Plan;
  signedIn: boolean;
  requestCode: (email: string) => Promise<void>;
  verify: (email: string, code: string) => Promise<void>;
  continueAsGuest: () => void;
  signOut: () => void;
  setPlan: (plan: Plan) => void;
}

const KEY = 'auth.v1';
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [guest, setGuest] = useState(false);
  const [plan, setPlanState] = useState<Plan>('free');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) {
          const saved = JSON.parse(raw);
          setEmail(saved.email ?? null);
          setToken(saved.token ?? null);
          setGuest(!!saved.guest);
          setPlanState(saved.plan === 'pro' ? 'pro' : 'free');
        }
      })
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback(
    (next: { email: string | null; token: string | null; guest: boolean; plan: Plan }) => {
      setEmail(next.email);
      setToken(next.token);
      setGuest(next.guest);
      setPlanState(next.plan);
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    },
    []
  );

  useEffect(() => {
    // Refresh plan/limits from the server when we have a token.
    if (!token || !hasBackend()) return;
    api
      .me(token)
      .then((me) => persist({ email: me.email, token, guest: false, plan: me.plan }))
      .catch(() => {});
  }, [token, persist]);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      email,
      token,
      guest,
      plan,
      signedIn: !!token || guest,
      requestCode: async (addr: string) => {
        await api.requestCode(addr.trim().toLowerCase());
      },
      verify: async (addr: string, code: string) => {
        const res = await api.verify(addr.trim().toLowerCase(), code.trim());
        persist({ email: addr.trim().toLowerCase(), token: res.token, guest: false, plan });
      },
      continueAsGuest: () => persist({ email: null, token: null, guest: true, plan: 'free' }),
      signOut: () => persist({ email: null, token: null, guest: false, plan: 'free' }),
      setPlan: (p: Plan) => persist({ email, token, guest, plan: p }),
    }),
    [ready, email, token, guest, plan, persist]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

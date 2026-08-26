// Minimal API client for the mobile backend (apps/mobile-backend).
// Base URL comes from EXPO_PUBLIC_API_URL; when it is not set the app
// runs fully offline (auth screens allow a guest session, limits are
// tracked locally).

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

export const hasBackend = () => BASE_URL.length > 0;

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {}
): Promise<T> {
  const res = await fetch(BASE_URL + path, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body != null ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${detail || path}`);
  }
  return res.json() as Promise<T>;
}

export interface MeResponse {
  email: string;
  plan: 'free' | 'pro';
  daily_used: number;
  daily_limit: number;
}

export interface UsageResponse {
  allowed: boolean;
  daily_used: number;
  daily_limit: number;
}

export const api = {
  requestCode: (email: string) =>
    request<{ ok: boolean }>('/auth/request-code', { method: 'POST', body: { email } }),
  verify: (email: string, code: string) =>
    request<{ token: string }>('/auth/verify', { method: 'POST', body: { email, code } }),
  me: (token: string) => request<MeResponse>('/me', { token }),
  openingIdentified: (token: string, openingId: string) =>
    request<UsageResponse>('/usage/opening-identified', {
      method: 'POST',
      body: { opening_id: openingId },
      token,
    }),
};

// Daily identification limit for the free plan.
// Counted per DISTINCT opening per local day; repeating the same opening
// on the same day is free (per spec). Tracked locally in AsyncStorage and
// mirrored to the backend when a token is available.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, hasBackend } from '../api/client';
import { TRIAL_DAYS } from './plans';

export const FREE_DAILY_LIMIT = 3;

const KEY = 'usage.v1';
const TRIAL_KEY = 'trial.v1';

interface UsageDay {
  date: string; // YYYY-MM-DD local
  openings: string[];
}

function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

async function load(): Promise<UsageDay> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as UsageDay;
      if (saved.date === today()) return saved;
    }
  } catch {
    // fall through to a fresh day
  }
  return { date: today(), openings: [] };
}

export interface TrialInfo {
  /** Trial is running: free features are available. */
  active: boolean;
  daysLeft: number;
}

/**
 * The 7-day free window starts on first launch (or first sign-in) and is
 * persisted on the device. After it ends, the free plan gets NOTHING:
 * no identifications, no hints, no opening cards — paywall only.
 */
export async function getTrialInfo(): Promise<TrialInfo> {
  let startedAt: number | null = null;
  try {
    const raw = await AsyncStorage.getItem(TRIAL_KEY);
    if (raw) startedAt = JSON.parse(raw).startedAt ?? null;
  } catch {
    startedAt = null;
  }
  if (!startedAt) {
    startedAt = Date.now();
    await AsyncStorage.setItem(TRIAL_KEY, JSON.stringify({ startedAt })).catch(() => {});
  }
  const elapsedDays = (Date.now() - startedAt) / 86_400_000;
  const daysLeft = Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));
  return { active: elapsedDays < TRIAL_DAYS, daysLeft };
}

export interface UsageResult {
  allowed: boolean;
  used: number;
  limit: number;
  /** true when this call consumed a new slot. */
  counted: boolean;
}

/**
 * Record that an opening was identified. `openingId` is `family/opening`.
 * Pro users are always allowed. Returns the current day's usage.
 */
export async function recordOpeningIdentified(
  openingId: string,
  opts: { plan: 'free' | 'pro'; token: string | null }
): Promise<UsageResult> {
  if (opts.plan === 'pro') {
    return { allowed: true, used: 0, limit: Infinity, counted: false };
  }
  const trial = await getTrialInfo();
  if (!trial.active) {
    return { allowed: false, used: 0, limit: 0, counted: false };
  }
  const day = await load();
  const already = day.openings.includes(openingId);
  if (already) {
    return {
      allowed: true,
      used: day.openings.length,
      limit: FREE_DAILY_LIMIT,
      counted: false,
    };
  }
  if (day.openings.length >= FREE_DAILY_LIMIT) {
    return {
      allowed: false,
      used: day.openings.length,
      limit: FREE_DAILY_LIMIT,
      counted: false,
    };
  }
  day.openings.push(openingId);
  await AsyncStorage.setItem(KEY, JSON.stringify(day)).catch(() => {});
  if (opts.token && hasBackend()) {
    api.openingIdentified(opts.token, openingId).catch(() => {});
  }
  return {
    allowed: true,
    used: day.openings.length,
    limit: FREE_DAILY_LIMIT,
    counted: true,
  };
}

export async function usageToday(plan: 'free' | 'pro'): Promise<UsageResult> {
  if (plan === 'pro') return { allowed: true, used: 0, limit: Infinity, counted: false };
  const day = await load();
  return {
    allowed: day.openings.length < FREE_DAILY_LIMIT,
    used: day.openings.length,
    limit: FREE_DAILY_LIMIT,
    counted: false,
  };
}

// Access is time-based only: the first 7 days are a free trial with every
// feature unlocked, after which a subscription is required. There is no
// per-day opening quota — a user places as many openings as they like.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TRIAL_DAYS } from './plans';

const TRIAL_KEY = 'trial.v1';

export interface TrialInfo {
  /** Trial is running: free features are available. */
  active: boolean;
  daysLeft: number;
}

/**
 * The 7-day free window starts on first launch (or first sign-in) and is
 * persisted on the device. After it ends, the free plan gets nothing but
 * the paywall.
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

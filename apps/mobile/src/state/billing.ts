// Subscription / billing layer.
//
// On iOS, digital subscriptions MUST go through Apple In-App Purchase
// (App Store Review Guideline 3.1.1) — a third-party card form (Stripe,
// etc.) for unlocking app content is rejected. So the user chooses a plan
// here and Apple charges their Apple ID (card / Apple Pay) through the
// system purchase sheet. RevenueCat wraps StoreKit and gives us receipt
// validation, entitlement state and cross-platform restore.
//
// ── Integration status ────────────────────────────────────────────────
// This module is RevenueCat-READY but currently runs in a local/dev mode
// so the app keeps working over Metro without a native rebuild. Wiring the
// real SDK is a localized change (see the TODO blocks): once you
//   1. add `react-native-purchases` and rebuild the native app in Xcode,
//   2. create the two products (go9x9_pro_monthly / _yearly) in
//      App Store Connect and sign the Paid Apps agreement,
//   3. put the RevenueCat public SDK key in EXPO_PUBLIC_RC_KEY,
// swap the stub bodies below for the commented Purchases.* calls.

import { useEffect, useState, useCallback } from 'react';
import { Linking } from 'react-native';
import { getTrialInfo, TrialInfo } from './usage';
import { useAuth } from './AuthContext';
import { PLANS } from './plans';

export type SubStatus = 'pro' | 'trial' | 'expired';

export interface Subscription {
  /** Coarse state used for copy + gating. */
  status: SubStatus;
  /** Features are unlocked (pro, or trial still running). */
  active: boolean;
  /** Days left in the free trial (0 when not on trial). */
  daysLeft: number;
  /** Which recurring plan is active, if known (RevenueCat fills this). */
  planId: 'monthly' | 'yearly' | null;
  ready: boolean;
}

// Apple's system screen for managing/cancelling subscriptions.
const MANAGE_URL = 'https://apps.apple.com/account/subscriptions';
// Public-facing legal pages (replace with the real hosted URLs).
export const TERMS_URL = 'https://kai-go.com/terms';
export const PRIVACY_URL = 'https://kai-go.com/privacy';

/** Opens the App Store subscription-management screen. */
export function openManageSubscriptions(): void {
  Linking.openURL(MANAGE_URL).catch(() => {});
}

/**
 * Buy a plan. Returns true when the entitlement becomes active.
 * DEV: no real charge — resolves false so the caller shows the paywall
 * placeholder. Wire RevenueCat here:
 *
 *   const offerings = await Purchases.getOfferings();
 *   const pkg = offerings.current?.availablePackages
 *     .find((p) => p.product.identifier === productId);
 *   const { customerInfo } = await Purchases.purchasePackage(pkg);
 *   return !!customerInfo.entitlements.active['pro'];
 */
export async function purchase(_planId: 'monthly' | 'yearly'): Promise<boolean> {
  return false;
}

/**
 * Restore previous purchases (App Store requirement; also recovers a sub
 * after reinstall / new device).
 *
 *   const info = await Purchases.restorePurchases();
 *   return !!info.entitlements.active['pro'];
 */
export async function restore(): Promise<boolean> {
  return false;
}

/**
 * Derived subscription state for the UI. Pro users always pass; free users
 * pass while the 7-day trial is running, then land in `expired`.
 * When RevenueCat is live, `planId` and expiry come from CustomerInfo
 * instead of local auth state.
 */
export function useSubscription(): Subscription {
  const auth = useAuth();
  const [trial, setTrial] = useState<TrialInfo | null>(null);

  useEffect(() => {
    let alive = true;
    getTrialInfo().then((t) => { if (alive) setTrial(t); });
    return () => { alive = false; };
  }, [auth.plan]);

  const pro = auth.plan === 'pro';
  const status: SubStatus = pro ? 'pro' : trial?.active ? 'trial' : 'expired';
  return {
    status,
    active: pro || (trial?.active ?? true),
    daysLeft: trial?.daysLeft ?? 0,
    // In production RevenueCat's CustomerInfo tells us monthly vs yearly;
    // in dev we only know "pro", so the UI shows a generic Pro label.
    planId: null,
    ready: trial != null,
  };
}

/** Display price for a plan id, from the single source of truth. */
export function priceOf(planId: 'monthly' | 'yearly'): string {
  return PLANS.find((p) => p.id === planId)?.price ?? '';
}

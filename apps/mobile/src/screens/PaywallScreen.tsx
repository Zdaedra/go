// Paywall: shown when the 7-day free trial has ended. Recurring plans only;
// purchase flow is a placeholder until RevenueCat keys are configured.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { useT } from '../i18n';
import { PLANS, TRIAL_DAYS, CONTENT } from '../state/plans';
import MistBackground from '../components/MistBackground';
import PrimaryButton from '../components/PrimaryButton';

export default function PaywallScreen({ navigation }: { navigation: any }) {
  const auth = useAuth();
  const t = useT();
  const [planId, setPlanId] = useState(PLANS[0].id);
  const plan = PLANS.find((p) => p.id === planId)!;
  const priceLabel = (p: { id: string; price: string }) =>
    `${p.price} / ${t(p.id === 'yearly' ? 'per_year' : 'per_month')}`;
  const planTitle = (id: string) => t(id === 'yearly' ? 'plan_year' : 'plan_month');

  const purchase = () => {
    // TODO: RevenueCat purchase flow (Purchases.purchasePackage(plan.productId)).
    Alert.alert(t('soon_title'), t('soon_body', { price: priceLabel(plan) }));
  };

  const restore = () => {
    // TODO: Purchases.restorePurchases()
    Alert.alert(t('restore_title'), t('restore_body'));
  };

  return (
    <View style={styles.page}>
      <MistBackground />
      <Text style={styles.title}>{t('paywall_title')}</Text>
      <Text style={styles.body}>
        {t('paywall_body', {
          days: TRIAL_DAYS,
          openings: CONTENT.openings,
          branches: CONTENT.branches,
          tsumego: CONTENT.tsumego,
        })}
      </Text>

      <View style={styles.plans}>
        {PLANS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPlanId(p.id)}
            style={[styles.plan, planId === p.id && styles.planActive]}
          >
            <Text style={styles.planTitle}>{planTitle(p.id)}</Text>
            <Text style={styles.planPrice}>{priceLabel(p)}</Text>
            {p.id === 'yearly' && <Text style={styles.planNote}>{t('year_note')}</Text>}
          </Pressable>
        ))}
      </View>

      <PrimaryButton
        label={t('purchase', { price: priceLabel(plan) })}
        onPress={purchase}
        textStyle={{ fontSize: 17 }}
      />
      <Pressable onPress={restore}>
        <Text style={styles.link}>{t('restore')}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={[styles.link, { color: '#8E8B85' }]}>{t('not_now')}</Text>
      </Pressable>

      {__DEV__ && (
        <Pressable
          style={styles.devBtn}
          onPress={() => { auth.setPlan('pro'); navigation.goBack(); }}
        >
          <Text style={styles.devBtnText}>{t('dev_unlock')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1, justifyContent: 'center', padding: 24, gap: 14,
    backgroundColor: '#121213',
  },
  title: { fontSize: 26, fontWeight: '500', textAlign: 'center', color: '#EFECE7', fontFamily: 'Playfair' },
  body: { fontSize: 15, color: '#F2EFEA', textAlign: 'center', lineHeight: 22 },
  plans: { gap: 8, marginTop: 6 },
  plan: {
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8,
  },
  planActive: { borderColor: '#8B7CF6', backgroundColor: 'rgba(139,124,246,0.10)' },
  planTitle: { fontSize: 16, fontWeight: '700', minWidth: 84, color: '#F2EFEA' },
  planPrice: { fontSize: 17, color: '#E8E6E3', fontFamily: 'Playfair' },
  planNote: { fontSize: 12.5, color: '#F0A878', width: '100%' },
  link: { color: 'rgba(196,189,255,0.75)', fontSize: 14, textAlign: 'center', padding: 6 },
  devBtn: {
    marginTop: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  devBtnText: { fontSize: 13, color: '#8E8B85' },
});

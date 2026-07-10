// Paywall: shown when the free daily limit is spent or the 7-day trial
// has ended. Three plans; purchase flow is a placeholder until
// RevenueCat keys are configured.

import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { FREE_DAILY_LIMIT } from '../state/usage';
import { PLANS, TRIAL_DAYS } from '../state/plans';

export default function PaywallScreen({ navigation }: { navigation: any }) {
  const auth = useAuth();
  const [planId, setPlanId] = useState(PLANS[0].id);
  const plan = PLANS.find((p) => p.id === planId)!;

  const purchase = () => {
    // TODO: RevenueCat purchase flow (Purchases.purchasePackage(plan.productId)).
    Alert.alert(
      'Скоро',
      `Оплата (${plan.price}) подключается через RevenueCat. В тестовой сборке подписку можно включить кнопкой ниже.`,
    );
  };

  const restore = () => {
    // TODO: Purchases.restorePurchases()
    Alert.alert('Восстановление', 'Покупок не найдено.');
  };

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Полная база дебютов</Text>
      <Text style={styles.body}>
        Первые {TRIAL_DAYS} дней — бесплатно ({FREE_DAILY_LIMIT} дебюта в день).
        Дальше нужна подписка: 46 дебютов, 259 веток с названиями, буквы-продолжения
        и проигрывание всех линий — без ограничений.
      </Text>

      <View style={styles.plans}>
        {PLANS.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => setPlanId(p.id)}
            style={[styles.plan, planId === p.id && styles.planActive]}
          >
            <Text style={styles.planTitle}>{p.title}</Text>
            <Text style={styles.planPrice}>{p.price}</Text>
            {p.note && <Text style={styles.planNote}>{p.note}</Text>}
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primary} onPress={purchase}>
        <Text style={styles.primaryText}>
          {plan.id === 'lifetime' ? `Купить навсегда — ${plan.price}` : `Оформить — ${plan.price}`}
        </Text>
      </Pressable>
      <Pressable onPress={restore}>
        <Text style={styles.link}>Восстановить покупку</Text>
      </Pressable>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Не сейчас</Text>
      </Pressable>

      {__DEV__ && (
        <Pressable
          style={styles.devBtn}
          onPress={() => { auth.setPlan('pro'); navigation.goBack(); }}
        >
          <Text style={styles.devBtnText}>DEV: включить подписку локально</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1, justifyContent: 'center', padding: 24, gap: 14,
    backgroundColor: '#100E0D',
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
  planPrice: { fontSize: 16, color: '#E8E6E3' },
  planNote: { fontSize: 12.5, color: '#F0A878', width: '100%' },
  primary: {
    borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10,
    backgroundColor: '#1A1720', borderWidth: 1.5, borderColor: '#8B7CF6',
    shadowColor: '#8B7CF6', shadowOpacity: 0.5, shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  link: { color: '#8B7CF6', fontSize: 14, textAlign: 'center', padding: 6 },
  devBtn: {
    marginTop: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  devBtnText: { fontSize: 13, color: '#8E8B85' },
});

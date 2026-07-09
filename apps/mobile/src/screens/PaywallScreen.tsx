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
    backgroundColor: '#FBF8F1',
  },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  body: { fontSize: 15, color: '#2A2118', textAlign: 'center', lineHeight: 22 },
  plans: { gap: 8, marginTop: 6 },
  plan: {
    borderWidth: 1.5, borderColor: '#C8BFA9', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8,
  },
  planActive: { borderColor: '#B23A2B', backgroundColor: '#F6EBE0' },
  planTitle: { fontSize: 16, fontWeight: '700', minWidth: 84 },
  planPrice: { fontSize: 16 },
  planNote: { fontSize: 12.5, color: '#8A5A2B', width: '100%' },
  primary: {
    backgroundColor: '#B23A2B', borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginTop: 10,
  },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  link: { color: '#B23A2B', fontSize: 14, textAlign: 'center', padding: 6 },
  devBtn: {
    marginTop: 18, borderWidth: 1, borderColor: '#C8BFA9', borderRadius: 8,
    paddingVertical: 8, alignItems: 'center',
  },
  devBtnText: { fontSize: 13, color: '#6E6152' },
});

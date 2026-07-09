// Paywall: shown when the free daily limit (3 identified openings) is
// spent. Purchase flow is wired to a placeholder until RevenueCat keys
// are configured.

import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../state/AuthContext';
import { FREE_DAILY_LIMIT } from '../state/usage';

export default function PaywallScreen({ navigation }: { navigation: any }) {
  const auth = useAuth();

  const purchase = () => {
    // TODO: RevenueCat purchase flow (Purchases.purchasePackage).
    Alert.alert(
      'Скоро',
      'Оплата подключается через RevenueCat. В тестовой сборке подписку можно включить кнопкой ниже.',
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
        Бесплатно приложение опознаёт {FREE_DAILY_LIMIT} дебюта в день.
      </Text>
      <Text style={styles.body}>
        Подписка открывает всё и сразу: 46 дебютов, 259 вариантов с названиями
        веток, буквы-продолжения на каждой позиции и проигрывание всех линий —
        без дневных ограничений.
      </Text>

      <Pressable style={styles.primary} onPress={purchase}>
        <Text style={styles.primaryText}>Оформить — $5 в месяц</Text>
      </Pressable>
      <Pressable onPress={restore}>
        <Text style={styles.link}>Восстановить покупку</Text>
      </Pressable>
      <Pressable onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Напомнить завтра</Text>
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

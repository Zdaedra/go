// Личный кабинет — the account hub: profile, subscription, progress,
// appearance, language and account actions in one scroll. Replaces the old
// bare Settings tab (appearance + language moved here).

import React from 'react';
import {
  ScrollView, View, Text, Pressable, StyleSheet, Linking, Alert, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../state/AuthContext';
import {
  useSubscription, restore, openManageSubscriptions, TERMS_URL, PRIVACY_URL,
} from '../state/billing';
import { CONTENT } from '../state/plans';
import { useI18n, LANGS, LANG_LABELS, Lang } from '../i18n';
import { useTheme } from '../theme/ThemeContext';
import { boardThemes } from '../theme/boardThemes';
import { stoneThemes } from '../theme/stoneThemes';
import {
  useTrainingProfile, domainStats, trainingPool, wipeTrainingProfile,
} from '../state/trainingStats';
import { levelLabel, DEFAULT_RATING as START_RATING } from '../state/trainingStats';
import MistBackground from '../components/MistBackground';
import PrimaryButton from '../components/PrimaryButton';

const APP_VERSION =
  (() => {
    try { return require('../../app.json').expo.version as string; }
    catch { return '1.0.0'; }
  })();

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const auth = useAuth();
  const sub = useSubscription();
  const { t, override, setLang } = useI18n();
  const { board, stones, setBoardTheme, setStoneTheme } = useTheme();
  const profile = useTrainingProfile();

  const pool = React.useMemo(() => trainingPool(), []);
  const stats = profile ? domainStats(profile) : [];
  const solvedCount = profile
    ? Object.values(profile.problems as Record<string, any>).filter((p: any) => p.solved).length
    : 0;
  const points = profile?.points ?? 0;
  // Overall level = mean Elo across domains that have been practised.
  const practised = stats.filter((s) => s.attempts > 0);
  const overall = practised.length
    ? Math.round(practised.reduce((a, s) => a + s.rating, 0) / practised.length)
    : START_RATING;

  const displayName = auth.email ?? t('guest_name');
  const initial = (auth.email?.[0] ?? t('guest_name')[0]).toUpperCase();

  const badge =
    sub.status === 'pro' ? t('badge_pro')
    : sub.status === 'trial' ? t('badge_trial', { n: sub.daysLeft })
    : t('badge_expired');
  const badgeColor =
    sub.status === 'pro' ? '#8B7CF6'
    : sub.status === 'trial' ? '#5FB98C'
    : '#C96F5A';

  const onRestore = async () => {
    const ok = await restore();
    Alert.alert(t('restore_title'), ok ? t('restore_ok') : t('restore_body'));
  };

  const openLink = (url: string) => Linking.openURL(url).catch(() => {});

  const confirmDelete = () => {
    Alert.alert(t('delete_confirm_title'), t('delete_confirm_body'), [
      { text: t('delete_cancel'), style: 'cancel' },
      {
        text: t('delete_account'),
        style: 'destructive',
        onPress: async () => {
          // Local-only for now: clears device data + signs out. Real server
          // account deletion lands with the backend. Профиль тренировки — через
          // wipeTrainingProfile (актуальный ключ + сброс in-memory cache).
          await wipeTrainingProfile();
          await AsyncStorage.multiRemove([
            'tsumegoProgress.v1', 'trial.v1',
          ]).catch(() => {});
          auth.signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <MistBackground />
      <ScrollView contentContainerStyle={styles.page}>
        {/* ── Профиль-хиро ─────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { borderColor: badgeColor }]}>
                <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
              </View>
              <Text style={styles.level}>
                {t('level_prefix', { level: t(levelLabel(overall)) })}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Подписка ─────────────────────────────────── */}
        <Text style={styles.section}>{t('sec_subscription')}</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {sub.status === 'pro' ? t('sub_pro_active')
              : sub.status === 'trial' ? t('sub_trial_active', { n: sub.daysLeft })
              : t('sub_expired')}
          </Text>
          <Text style={styles.cardBody}>
            {sub.status === 'pro' ? t('sub_pro_hint') : t('sub_trial_hint')}
          </Text>

          {sub.status === 'pro' ? (
            <>
              <Pressable style={styles.rowBtn} onPress={openManageSubscriptions}>
                <Text style={styles.rowBtnText}>{t('manage_sub')}</Text>
              </Pressable>
              <Pressable style={styles.rowBtn} onPress={onRestore}>
                <Text style={styles.rowBtnText}>{t('restore')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <PrimaryButton
                label={t('subscribe_cta')}
                onPress={() => navigation.navigate('Paywall')}
                textStyle={{ fontSize: 16 }}
              />
              <Pressable style={styles.linkCenter} onPress={onRestore}>
                <Text style={styles.link}>{t('restore')}</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* ── Прогресс ─────────────────────────────────── */}
        <Text style={styles.section}>{t('sec_progress')}</Text>
        <View style={styles.statRow}>
          <Stat value={String(solvedCount)} label={t('progress_solved')} />
          <Stat value={String(points)} label={t('progress_points')} />
          <Stat value={String(pool.length)} label={t('progress_tsumego')} />
        </View>
        <View style={styles.statRow}>
          <Stat value={String(CONTENT.openings)} label={t('progress_openings')} />
          <Stat value={String(CONTENT.branches)} label={t('progress_branches')} />
          <Stat value={t(levelLabel(overall))} label={t('level_word')} />
        </View>

        {practised.length > 0 && (
          <>
            <Text style={styles.subheading}>{t('domains_heading')}</Text>
            {stats.map((s) => {
              const pct = Math.round((s.solved / Math.max(1, s.total)) * 100);
              return (
                <View key={s.domain} style={styles.domainRow}>
                  <View style={styles.domainHead}>
                    {/* label/level — i18n-ключи из domainStats, обязателен t() */}
                    <Text style={styles.domainLabel}>{t(s.label as any)}</Text>
                    <Text style={styles.domainMeta}>
                      {s.rating} · {t(s.level as any)}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.domainCount}>{s.solved}/{s.total}</Text>
                </View>
              );
            })}
          </>
        )}
        {practised.length === 0 && (
          <Text style={styles.note}>{t('progress_empty')}</Text>
        )}

        {/* ── Оформление ───────────────────────────────── */}
        <Text style={styles.section}>{t('section_board')}</Text>
        <View style={styles.row}>
          {Object.values(boardThemes).map((th) => (
            <Pressable
              key={th.id}
              onPress={() => setBoardTheme(th.id)}
              style={[styles.opt, board.id === th.id && styles.optActive]}
            >
              <View style={[styles.swatch, { backgroundColor: th.wood[1] }]} />
              <Text style={styles.optText}>{t(th.nameKey)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.section}>{t('section_stones')}</Text>
        <View style={styles.row}>
          {Object.values(stoneThemes).map((th) => (
            <Pressable
              key={th.id}
              onPress={() => setStoneTheme(th.id)}
              style={[styles.opt, stones.id === th.id && styles.optActive]}
            >
              <View style={styles.stonePair}>
                <View style={[styles.stone, { backgroundColor: th.black.fill[1] }]} />
                <View style={[
                  styles.stone,
                  { backgroundColor: th.white.fill[1], borderWidth: 1, borderColor: '#A9A28E' },
                ]} />
              </View>
              <Text style={styles.optText}>{t(th.nameKey)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>{t('themes_note')}</Text>

        {/* ── Язык ─────────────────────────────────────── */}
        <Text style={styles.section}>{t('section_language')}</Text>
        <View style={styles.row}>
          <Pressable
            style={[styles.opt, override === null && styles.optActive]}
            onPress={() => setLang(null)}
          >
            <Text style={styles.optText}>Auto</Text>
          </Pressable>
          {LANGS.map((l: Lang) => (
            <Pressable
              key={l}
              style={[styles.opt, override === l && styles.optActive]}
              onPress={() => setLang(l)}
            >
              <Text style={styles.optText}>{LANG_LABELS[l]}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── Аккаунт ──────────────────────────────────── */}
        <Text style={styles.section}>{t('section_account')}</Text>
        {auth.guest && (
          <Pressable style={styles.rowBtn} onPress={auth.signOut}>
            <Text style={[styles.rowBtnText, { color: '#C4BDFF' }]}>{t('sign_in_cta')}</Text>
          </Pressable>
        )}
        {!auth.guest && (
          <Pressable style={styles.rowBtn} onPress={auth.signOut}>
            <Text style={styles.rowBtnText}>{t('sign_out')}</Text>
          </Pressable>
        )}
        <Pressable style={styles.rowBtn} onPress={() => openLink(TERMS_URL)}>
          <Text style={styles.rowBtnText}>{t('terms')}</Text>
        </Pressable>
        <Pressable style={styles.rowBtn} onPress={() => openLink(PRIVACY_URL)}>
          <Text style={styles.rowBtnText}>{t('privacy')}</Text>
        </Pressable>
        <Pressable style={styles.rowBtn} onPress={confirmDelete}>
          <Text style={[styles.rowBtnText, { color: '#C96F5A' }]}>{t('delete_account')}</Text>
        </Pressable>
        <Text style={styles.version}>{t('version', { v: APP_VERSION })}</Text>

        {/* ── DEV ──────────────────────────────────────── */}
        {__DEV__ && (
          <>
            <Text style={styles.section}>{t('section_dev')}</Text>
            <View style={[styles.row, { marginBottom: 8 }]}>
              <Pressable
                style={[styles.opt, auth.plan === 'pro' && styles.optActive]}
                onPress={() => auth.setPlan('pro')}
              >
                <Text style={styles.optText}>{t('unlimited')}</Text>
              </Pressable>
              <Pressable
                style={[styles.opt, auth.plan === 'free' && styles.optActive]}
                onPress={() => auth.setPlan('free')}
              >
                <Text style={styles.optText}>{t('trial_paywall')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 16, gap: 10, paddingBottom: 100 },

  hero: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 8, marginBottom: 4,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(139,124,246,0.18)',
    borderWidth: 1.5, borderColor: '#8B7CF6',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, color: '#EFECE7', fontFamily: 'Playfair' },
  name: { fontSize: 20, color: '#F2EFEA', fontFamily: 'Playfair' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 5, flexWrap: 'wrap' },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontSize: 12.5, fontWeight: '700' },
  level: { fontSize: 13, color: '#8E8B85' },

  section: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#8E8B85', marginTop: 14,
  },
  subheading: { fontSize: 13.5, color: '#B9B4C9', marginTop: 12, marginBottom: 2 },

  card: {
    borderWidth: 1, borderColor: 'rgba(139,124,246,0.28)', borderRadius: 14,
    backgroundColor: 'rgba(139,124,246,0.06)', padding: 14, gap: 10,
  },
  cardTitle: { fontSize: 17, color: '#F2EFEA', fontWeight: '600' },
  cardBody: { fontSize: 14, color: '#C7C3BC', lineHeight: 20 },

  rowBtn: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 10,
    paddingVertical: 11, paddingHorizontal: 14,
  },
  rowBtnText: { fontSize: 15, color: '#F2EFEA' },
  linkCenter: { alignItems: 'center', paddingVertical: 2 },
  link: { color: 'rgba(196,189,255,0.8)', fontSize: 14, padding: 4 },

  statRow: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 3,
  },
  statValue: { fontSize: 20, color: '#EFECE7', fontFamily: 'Playfair' },
  statLabel: { fontSize: 11.5, color: '#8E8B85', textAlign: 'center' },

  domainRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  domainHead: { width: 128 },
  domainLabel: { fontSize: 13.5, color: '#F2EFEA' },
  domainMeta: { fontSize: 11, color: '#8E8B85' },
  barTrack: {
    flex: 1, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden',
  },
  barFill: { height: 6, borderRadius: 3, backgroundColor: '#8B7CF6' },
  domainCount: { fontSize: 11.5, color: '#8E8B85', width: 44, textAlign: 'right' },

  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  opt: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  optActive: { backgroundColor: 'rgba(139,124,246,0.14)', borderColor: '#8B7CF6' },
  optText: { fontSize: 14, color: '#F2EFEA' },
  swatch: { width: 22, height: 22, borderRadius: 5 },
  stonePair: { flexDirection: 'row', gap: 2 },
  stone: { width: 18, height: 18, borderRadius: 9 },

  note: { fontSize: 13, color: '#8E8B85', marginTop: 8 },
  version: { fontSize: 12, color: '#6E6B66', marginTop: 12, textAlign: 'center' },
});

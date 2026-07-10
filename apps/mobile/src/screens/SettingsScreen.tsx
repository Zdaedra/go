// Settings: board theme and stone theme are chosen independently.

import React from 'react';
import { ScrollView, Text, Pressable, StyleSheet, View } from 'react-native';
import { boardThemes } from '../theme/boardThemes';
import { stoneThemes } from '../theme/stoneThemes';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../state/AuthContext';
import { useI18n, LANGS, LANG_LABELS, Lang } from '../i18n';
import Goban from '../components/Goban';
import { EMPTY_BOARD, play, sgfToIdx } from '../engine/board';
import MistBackground from '../components/MistBackground';

function previewPosition(): string {
  let board = EMPTY_BOARD;
  for (const [coord, color] of [
    ['ee', 'b'], ['cf', 'w'], ['fc', 'b'], ['gf', 'w'], ['cd', 'b'],
  ] as const) {
    const r = play(board, sgfToIdx(coord), color);
    if (r) board = r.board;
  }
  return board;
}

export default function SettingsScreen() {
  const { board, stones, setBoardTheme, setStoneTheme } = useTheme();
  const auth = useAuth();
  const { t, override, setLang } = useI18n();
  const preview = React.useMemo(previewPosition, []);

  return (
    <View style={styles.screen}>
    <MistBackground />
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.preview}>
        <Goban position={preview} />
      </View>

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

      <Text style={styles.section}>{t('section_board')}</Text>
      <View style={styles.row}>
        {Object.values(boardThemes).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setBoardTheme(t.id)}
            style={[styles.opt, board.id === t.id && styles.optActive]}
          >
            <View style={[styles.swatch, { backgroundColor: t.wood[1] }]} />
            <Text style={styles.optText}>{t.nameRu}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.section}>{t('section_stones')}</Text>
      <View style={styles.row}>
        {Object.values(stoneThemes).map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setStoneTheme(t.id)}
            style={[styles.opt, stones.id === t.id && styles.optActive]}
          >
            <View style={styles.stonePair}>
              <View style={[styles.stone, { backgroundColor: t.black.fill[1] }]} />
              <View
                style={[
                  styles.stone,
                  { backgroundColor: t.white.fill[1], borderWidth: 1, borderColor: '#A9A28E' },
                ]}
              />
            </View>
            <Text style={styles.optText}>{t.nameRu}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>{t('themes_note')}</Text>

      <Text style={styles.section}>{t('section_account')}</Text>
      <Text style={styles.accountText}>
        {auth.email ?? t('guest_mode')} · {t('plan_label')}: {auth.plan === 'pro' ? t('plan_pro') : t('plan_free')}
      </Text>
      <View style={[styles.row, { marginBottom: 24 }]}>
        <Pressable style={styles.opt} onPress={auth.signOut}>
          <Text style={styles.optText}>{t('sign_out')}</Text>
        </Pressable>
      </View>

      {__DEV__ && (
        <>
          <Text style={styles.section}>{t('section_dev')}</Text>
          <View style={[styles.row, { marginBottom: 24 }]}>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 16, gap: 12, paddingBottom: 90 },
  preview: { width: '76%', alignSelf: 'center' },
  section: {
    fontSize: 12, fontWeight: '700', letterSpacing: 1.2,
    textTransform: 'uppercase', color: '#8E8B85', marginTop: 8,
  },
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
  note: { fontSize: 13, color: '#8E8B85', marginTop: 12 },
  accountText: { fontSize: 14, color: '#F2EFEA' },
});

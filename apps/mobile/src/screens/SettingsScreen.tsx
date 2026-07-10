// Settings: board theme and stone theme are chosen independently.

import React from 'react';
import { ScrollView, Text, Pressable, StyleSheet, View } from 'react-native';
import { boardThemes } from '../theme/boardThemes';
import { stoneThemes } from '../theme/stoneThemes';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../state/AuthContext';
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
  const preview = React.useMemo(previewPosition, []);

  return (
    <View style={styles.screen}>
    <MistBackground />
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.preview}>
        <Goban position={preview} />
      </View>

      <Text style={styles.section}>Доска</Text>
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

      <Text style={styles.section}>Камни</Text>
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

      <Text style={styles.note}>Темы доски и камней независимы.</Text>

      <Text style={styles.section}>Аккаунт</Text>
      <Text style={styles.accountText}>
        {auth.email ?? 'Гостевой режим'} · тариф: {auth.plan === 'pro' ? 'подписка' : 'бесплатный'}
      </Text>
      <View style={[styles.row, { marginBottom: 24 }]}>
        <Pressable style={styles.opt} onPress={auth.signOut}>
          <Text style={styles.optText}>Выйти</Text>
        </Pressable>
      </View>
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

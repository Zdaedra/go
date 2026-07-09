// Game ("live") mode: the user places stones for both sides, the app
// identifies the opening/branch in real time and shows continuation
// hints from the database.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Goban, { GobanMark, GhostStone } from '../components/Goban';
import { EMPTY_BOARD, play } from '../engine/board';
import {
  identify, suggestions, continuationMarks, currentBranch,
} from '../engine/identify';
import { openingDisplayName } from '../data/names';
import { useTheme } from '../theme/ThemeContext';

interface HistoryItem {
  board: string;
  at: number;
  color: 'b' | 'w';
}

export default function PlayScreen() {
  const { board: boardTheme } = useTheme();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [myColor, setMyColor] = useState<'b' | 'w'>('b');
  const [showHints, setShowHints] = useState(true);

  const position = history.length ? history[history.length - 1].board : EMPTY_BOARD;
  const toMove: 'b' | 'w' =
    history.length === 0 ? 'b' : history[history.length - 1].color === 'b' ? 'w' : 'b';

  const result = useMemo(() => identify(position), [position]);
  const branch = useMemo(() => currentBranch(result), [result]);

  const marks: GobanMark[] = useMemo(
    () => continuationMarks(result).map((m) => ({ at: m.at, label: m.label, kind: m.kind })),
    [result]
  );
  const ghosts: GhostStone[] = useMemo(() => {
    if (!showHints || result.status === 'unknown' || marks.length > 0) return [];
    return suggestions(result, 3)
      .filter((s) => s.color === toMove)
      .map((s) => ({ at: s.at, color: s.color, label: s.label }));
  }, [showHints, result, marks, toMove]);

  const placeStone = (at: number) => {
    const next = play(position, at, toMove);
    if (!next) return; // occupied or suicide
    setHistory([...history, { board: next.board, at, color: toMove }]);
  };

  const status = (() => {
    switch (result.status) {
      case 'empty':
        return `Поставь первый камень. Ты играешь за ${myColor === 'b' ? 'чёрных' : 'белых'}.`;
      case 'unknown':
        return 'Такого дебюта в базе нет.';
      case 'identified': {
        const o = result.opening!;
        const name = openingDisplayName(o.family, o.opening, o.name);
        return branch
          ? `Дебют: ${name} — ветка ${branch.branch.branch_no}`
          : `Дебют: ${name}`;
      }
      case 'candidates': {
        const names = result.openings
          .slice(0, 3)
          .map((o) => openingDisplayName(o.family, o.opening, o.name));
        return `Возможные дебюты: ${names.join(', ')}${result.openings.length > 3 ? '…' : ''}`;
      }
    }
  })();

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.colorRow}>
        <Text style={styles.colorLabel}>Я играю за:</Text>
        {(['b', 'w'] as const).map((c) => (
          <Pressable
            key={c}
            onPress={() => setMyColor(c)}
            style={[styles.colorBtn, myColor === c && styles.colorBtnActive]}
          >
            <Text style={styles.colorBtnText}>{c === 'b' ? '⚫ чёрных' : '⚪ белых'}</Text>
          </Pressable>
        ))}
      </View>

      <Goban
        position={position}
        lastMove={history.length ? history[history.length - 1].at : null}
        marks={marks}
        ghosts={ghosts}
        onPoint={placeStone}
      />

      <View style={styles.status}>
        <Text
          style={[
            styles.statusText,
            result.status === 'unknown' && { color: boardTheme.letter },
          ]}
        >
          {status}
        </Text>
        {marks.length > 0 && (
          <Text style={styles.statusSub}>
            Буквы на доске — варианты продолжений из базы.
          </Text>
        )}
        <Text style={styles.statusSub}>
          Ход: {toMove === 'b' ? 'чёрные ⚫' : 'белые ⚪'}
        </Text>
      </View>

      <View style={styles.controls}>
        <Pressable
          style={styles.btn}
          onPress={() => setHistory(history.slice(0, -1))}
          disabled={!history.length}
        >
          <Text style={styles.btnText}>← Ход назад</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setHistory([])}>
          <Text style={styles.btnText}>Сбросить</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, showHints && styles.btnActive]}
          onPress={() => setShowHints(!showHints)}
        >
          <Text style={styles.btnText}>{showHints ? 'Подсказки: вкл' : 'Подсказки: выкл'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorLabel: { fontSize: 15, fontWeight: '600' },
  colorBtn: {
    paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8,
    borderWidth: 1, borderColor: '#C8BFA9',
  },
  colorBtnActive: { backgroundColor: '#EDE4CF', borderColor: '#8A7B65' },
  colorBtnText: { fontSize: 14 },
  status: { gap: 4, minHeight: 64 },
  statusText: { fontSize: 17, fontWeight: '700' },
  statusSub: { fontSize: 13, color: '#6E6152' },
  controls: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#C8BFA9',
  },
  btnActive: { backgroundColor: '#EDE4CF' },
  btnText: { fontSize: 14 },
});

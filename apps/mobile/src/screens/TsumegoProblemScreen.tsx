// One problem: interactive solving on the goban with progress recording.
// Problems with a marked solution tree are auto-checked; problems without
// one (most classical collection positions) run in free-solve mode where
// the user plays both sides and self-marks the result.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Goban, { GhostStone } from '../components/Goban';
import {
  startSession, playUserMove, undoFreeMove, clearWrong, hintMove, viewRect,
} from '../engine/tsumego';
import { recordAttempt } from '../state/tsumegoProgress';
import { soundForMove } from '../sound/stones';
import { visibleProblems } from './TsumegoSectionsScreen';

const STATUS_TEXT: Record<string, string> = {
  playing: 'Найди лучший ход.',
  wrong: 'Мимо — такого хода нет в решении. Попробуй ещё.',
  refuted: 'Не получилось: соперник опровергает этот ход.',
  solved: 'Решено! ✓',
};

export default function TsumegoProblemScreen({ route, navigation }: { route: any; navigation: any }) {
  const { problemId, index, categoryId, sectionId, title } = route.params;
  const problems = useMemo(
    () => visibleProblems().filter(
      (p) => p.category === categoryId && p.section === sectionId
    ),
    [categoryId, sectionId]
  );
  const pos = problems.findIndex((p) => p.id === problemId);
  const problem = problems[pos];

  const [session, setSession] = useState<any>(() => startSession(problem));
  const [showHint, setShowHint] = useState(false);
  const recorded = useRef(false);
  const view = useMemo(() => viewRect(problem), [problem]);

  useEffect(() => {
    setSession(startSession(problem));
    setShowHint(false);
    recorded.current = false;
  }, [problem]);

  useEffect(() => {
    if (recorded.current) return;
    if (session.status === 'solved' || session.status === 'refuted') {
      recorded.current = true;
      recordAttempt(problem.id, session.status === 'solved');
    }
  }, [session.status, problem.id]);

  // Transient "wrong" flash resets back to playing.
  useEffect(() => {
    if (session.status !== 'wrong') return;
    const t = setTimeout(() => setSession((s: any) => clearWrong(s)), 900);
    return () => clearTimeout(t);
  }, [session.status]);

  const ghosts: GhostStone[] = useMemo(() => {
    if (!showHint || session.free || session.status !== 'playing' || session.moves.length > 0) {
      return [];
    }
    const at = hintMove(problem);
    return at == null ? [] : [{ at, color: problem.to_move }];
  }, [showHint, session, problem]);

  const markSelfSolved = () => {
    if (recorded.current) return;
    recorded.current = true;
    recordAttempt(problem.id, true);
    setSession((s: any) => ({ ...s, status: 'solved' }));
  };

  const statusText = session.free && session.status === 'playing'
    ? 'Режим самопроверки: разыграй решение за обе стороны.'
    : STATUS_TEXT[session.status];

  const last = session.moves.length ? session.moves[session.moves.length - 1].at : null;
  const next = pos + 1 < problems.length ? problems[pos + 1] : null;

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>
        {title} · №{(index ?? pos) + 1} — {problem.title}
      </Text>
      <Text style={styles.meta}>
        Ход {problem.to_move === 'b' ? 'чёрных ⚫' : 'белых ⚪'}
        {session.free ? ` · сейчас ходят ${session.toMove === 'b' ? '⚫' : '⚪'}` : ''}
      </Text>

      <Goban
        position={session.board}
        size={session.size}
        view={view}
        lastMove={last}
        ghosts={ghosts}
        onPoint={(at) => setSession((s: any) => {
          const n = playUserMove(s, at);
          if (n.board !== s.board) {
            soundForMove(s.board, n.board, n.moves.length - s.moves.length);
          }
          return n;
        })}
        disabled={session.status === 'solved' || session.status === 'refuted'}
      />

      <Text
        style={[
          styles.status,
          session.status === 'solved' && styles.ok,
          (session.status === 'wrong' || session.status === 'refuted') && styles.bad,
        ]}
      >
        {statusText}
      </Text>

      <View style={styles.controls}>
        <Pressable
          style={styles.btn}
          onPress={() => { setSession(startSession(problem)); setShowHint(false); recorded.current = false; }}
        >
          <Text style={styles.btnText}>Заново</Text>
        </Pressable>
        {session.free && session.status === 'playing' && (
          <>
            <Pressable style={styles.btn} onPress={() => setSession((s: any) => undoFreeMove(s))}>
              <Text style={styles.btnText}>← Ход назад</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={markSelfSolved}>
              <Text style={[styles.btnText, styles.btnPrimaryText]}>Отметить решённой ✓</Text>
            </Pressable>
          </>
        )}
        {!session.free && session.status === 'playing' && problem.hint && (
          <Pressable style={styles.btn} onPress={() => setShowHint(true)}>
            <Text style={styles.btnText}>Подсказка</Text>
          </Pressable>
        )}
        {session.status === 'solved' && next && (
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() =>
              navigation.setParams({ problemId: next.id, index: pos + 1 })
            }
          >
            <Text style={[styles.btnText, styles.btnPrimaryText]}>Следующая →</Text>
          </Pressable>
        )}
      </View>

      {showHint && problem.hint && session.status === 'playing' && (
        <Text style={styles.hint}>{problem.hint}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#F2EFEA' },
  meta: { fontSize: 13, color: '#8E8B85' },
  status: { fontSize: 17, fontFamily: 'Playfair', minHeight: 24, color: '#EFECE7' },
  ok: { color: '#C5BBF0' },
  bad: { color: '#C96F5A' },
  controls: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  btnPrimary: { backgroundColor: '#1A1720', borderColor: '#8B7CF6', borderWidth: 1.5 },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700' },
  btnText: { fontSize: 14, color: '#F2EFEA' },
  hint: { fontSize: 14, color: '#F0A878' },
});

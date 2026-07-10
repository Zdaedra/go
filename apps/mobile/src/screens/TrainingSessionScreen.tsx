// Adaptive training session: the trainer serves one problem after
// another — solve it, get instant feedback and points, tap "next".

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Goban from '../components/Goban';
import {
  startSession, playUserMove, clearWrong, hintMove, viewRect,
} from '../engine/tsumego';
import { nextProblem, recordResult, domainLabels } from '../state/trainingStats';
import { recordAttempt } from '../state/tsumegoProgress';

const STATUS_TEXT: Record<string, string> = {
  playing: 'Найди лучший ход.',
  wrong: 'Мимо — такого хода нет в решении. Попробуй ещё.',
  refuted: 'Не получилось: соперник опровергает этот ход.',
  solved: 'Решено! ✓',
};

export default function TrainingSessionScreen({ navigation }: { navigation: any }) {
  const [problem, setProblem] = useState<any | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sessionSolved, setSessionSolved] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);
  const hadMistake = useRef(false);
  const recorded = useRef(false);

  const serveNext = useCallback(async () => {
    const p = await nextProblem();
    if (!p) {
      setExhausted(true);
      setProblem(null);
      return;
    }
    hadMistake.current = false;
    recorded.current = false;
    setFeedback(null);
    setProblem(p);
    setSession(startSession(p));
  }, []);

  useEffect(() => { serveNext(); }, [serveNext]);

  // Wrong-move flash: counts as a mistake, then lets the user retry.
  useEffect(() => {
    if (!session || session.status !== 'wrong') return;
    hadMistake.current = true;
    const t = setTimeout(() => setSession((s: any) => clearWrong(s)), 900);
    return () => clearTimeout(t);
  }, [session]);

  // Terminal state: record into the adaptive profile once.
  useEffect(() => {
    if (!session || !problem || recorded.current) return;
    if (session.status !== 'solved' && session.status !== 'refuted') return;
    recorded.current = true;
    const solved = session.status === 'solved';
    const firstTry = solved && !hadMistake.current;
    recordAttempt(problem.id, solved);
    recordResult(problem, solved, firstTry).then((res) => {
      if (solved) {
        setSessionSolved((n) => n + 1);
        setSessionPoints((n) => n + res.pointsGained);
      }
      const sign = res.ratingDelta >= 0 ? '+' : '';
      const domain = domainLabels[problem.domain] ?? problem.domain;
      setFeedback(
        solved
          ? `+${res.pointsGained} очков · ${domain}: ${sign}${res.ratingDelta} → ${res.newRating}`
          : `${domain}: ${sign}${res.ratingDelta} → ${res.newRating}. Задача вернётся позже.`
      );
    });
  }, [session, problem]);

  const view = useMemo(() => (problem ? viewRect(problem) : null), [problem]);

  if (exhausted) {
    return (
      <View style={styles.donePage}>
        <Text style={styles.doneTitle}>Все задачи пройдены 🎉</Text>
        <Text style={styles.doneText}>
          Ты прошёл всю доступную базу. Новые задачи появятся с обновлением
          разметки.
        </Text>
        <Pressable style={styles.nextBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.nextText}>К статистике</Text>
        </Pressable>
      </View>
    );
  }

  if (!problem || !session) return null;

  const last = session.moves.length ? session.moves[session.moves.length - 1].at : null;
  const terminal = session.status === 'solved' || session.status === 'refuted';

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.topRow}>
        <Text style={styles.domainChip}>{domainLabels[problem.domain] ?? problem.domain}</Text>
        <Text style={styles.sessionMeta}>
          решено {sessionSolved} · +{sessionPoints} очков
        </Text>
      </View>
      <Text style={styles.meta}>
        Ход {problem.to_move === 'b' ? 'чёрных ⚫' : 'белых ⚪'}
      </Text>

      <Goban
        position={session.board}
        size={session.size}
        view={view ?? undefined}
        lastMove={last}
        onPoint={(at) => setSession((s: any) => playUserMove(s, at))}
        disabled={terminal}
      />

      <View style={styles.turnCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.turnEyebrow}>Твой ход</Text>
          <Text
            style={[
              styles.status,
              session.status === 'solved' && styles.ok,
              (session.status === 'wrong' || session.status === 'refuted') && styles.bad,
            ]}
          >
            {STATUS_TEXT[session.status]}
          </Text>
          {feedback && <Text style={styles.feedback}>{feedback}</Text>}
        </View>
        {!terminal && problem.hint && (
          <Pressable
            style={styles.hintBtn}
            onPress={() => {
              hadMistake.current = true;
              const at = hintMove(problem);
              if (at != null) setFeedback(`Подсказка: ${problem.hint}`);
            }}
          >
            <Text style={styles.hintText}>💡 Подсказка</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.spacer} />
      <View style={styles.controls}>
        {terminal ? (
          <Pressable style={styles.nextBtn} onPress={serveNext}>
            <Text style={styles.nextText}>Следующая →</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={styles.btn}
              onPress={() => { hadMistake.current = true; setSession(startSession(problem)); }}
            >
              <Text style={styles.btnText}>Заново</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
              <Text style={styles.btnText}>Завершить</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 12, flexGrow: 1 },
  spacer: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  domainChip: {
    fontSize: 12.5, fontWeight: '600', color: '#F2EFEA',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', borderRadius: 999,
    paddingVertical: 4, paddingHorizontal: 12, overflow: 'hidden',
  },
  sessionMeta: { fontSize: 13, color: '#8E8B85', fontVariant: ['tabular-nums'] },
  meta: { fontSize: 13, color: '#8E8B85' },
  status: { fontSize: 17, fontFamily: 'Playfair', minHeight: 24, color: '#EFECE7', marginTop: 6 },
  turnCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(6,6,7,0.66)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14,
  },
  turnEyebrow: {
    fontSize: 10, fontWeight: '600', letterSpacing: 2.2,
    textTransform: 'uppercase', color: '#9D8CFF',
  },
  hintBtn: {
    paddingVertical: 12, paddingHorizontal: 15, borderRadius: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  hintText: { color: '#A79AF5', fontSize: 14 },
  ok: { color: '#C5BBF0' },
  bad: { color: '#C96F5A' },
  feedback: { fontSize: 14, color: '#F0A878', fontWeight: '600' },
  controls: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  btnText: { fontSize: 14, color: '#F2EFEA' },
  nextBtn: {
    borderRadius: 10, paddingVertical: 12, paddingHorizontal: 22,
    alignItems: 'center',
    backgroundColor: '#1A1720', borderWidth: 1.5, borderColor: '#7C6EE0',
    shadowColor: '#7C6EE0', shadowOpacity: 0.28, shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  nextText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  donePage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  doneTitle: { fontSize: 22, fontWeight: '500', textAlign: 'center', color: '#EFECE7', fontFamily: 'Playfair' },
  doneText: { fontSize: 15, color: '#8E8B85', textAlign: 'center', lineHeight: 22 },
});

// Game ("live") mode, laid out after the reference design: profile
// header, opening card (name / difficulty dots / best outcome), the
// board, a "your turn" card with Hint, and round bottom controls.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Goban, { GobanMark, GhostStone } from '../components/Goban';
import { EMPTY_BOARD, play, sgfToIdx } from '../engine/board';
import {
  identify, suggestions, continuationMarks, currentBranch,
} from '../engine/identify';
import { openingDisplayName, familyNamesRu } from '../data/names';
import { allBranches } from '../engine/identify';
import { useAuth } from '../state/AuthContext';
import { recordOpeningIdentified, FREE_DAILY_LIMIT } from '../state/usage';
import { useAccess } from '../state/useTrial';
import { useTrainingProfile } from '../state/trainingStats';
import { ui, eyebrow, eyebrowAccent, cardStyle } from '../theme/uiTheme';

interface HistoryItem {
  board: string;
  at: number;
  color: 'b' | 'w';
}

const TRIAL_NOTICE_DAYS = 3;

const RESULT_RU: Record<string, string> = {
  even: 'Ровная игра',
  'B+': 'Чёрные ведут',
  'W+': 'Белые ведут',
};

function difficultyMeta(family: string, opening: string) {
  // Star rating comes from the branch data (1..3), mapped to dots + word.
  const b = allBranches().find((x) => x.family === family && x.opening === opening);
  return null; // difficulty per opening lives in openings.json; dots default 2
}

export default function PlayScreen({ navigation }: { navigation: any }) {
  const auth = useAuth();
  const access = useAccess();
  const profile = useTrainingProfile();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [myColor, setMyColor] = useState<'b' | 'w'>('b');
  const [showHints, setShowHints] = useState(false);
  const [limitLocked, setLimitLocked] = useState(false);
  const [usedToday, setUsedToday] = useState(0);
  const countedOpenings = useRef(new Set<string>());
  const locked = limitLocked || !access.open;
  const [path, setPath] = useState<{ key: string; label: string }[]>([]);

  const position = history.length ? history[history.length - 1].board : EMPTY_BOARD;
  const toMove: 'b' | 'w' =
    history.length === 0 ? 'b' : history[history.length - 1].color === 'b' ? 'w' : 'b';

  const result = useMemo(() => identify(position), [position]);
  const branch = useMemo(() => currentBranch(result), [result]);

  const fullMarks = useMemo(() => continuationMarks(result), [result]);
  const marks: GobanMark[] = useMemo(
    () => (locked ? [] : fullMarks.map((m) => ({ at: m.at, label: m.label, kind: m.kind }))),
    [fullMarks, locked]
  );
  const nextSuggestion = useMemo(() => {
    if (locked || result.status === 'unknown') return null;
    if (fullMarks.length) {
      const own = fullMarks.find((m) => m.by === toMove) ?? fullMarks[0];
      return own ? { at: own.at, color: (own.by ?? toMove) as 'b' | 'w' } : null;
    }
    const sug = suggestions(result, 3).filter((s) => s.color === toMove);
    return sug.length ? { at: sug[0].at, color: sug[0].color as 'b' | 'w' } : null;
  }, [locked, result, fullMarks, toMove]);

  const ghosts: GhostStone[] = useMemo(() => {
    if (locked || !showHints || result.status === 'unknown' || marks.length > 0) return [];
    return suggestions(result, 3)
      .filter((s) => s.color === toMove)
      .map((s) => ({ at: s.at, color: s.color, label: s.label }));
  }, [locked, showHints, result, marks, toMove]);

  const placeStone = (at: number) => {
    const mark = fullMarks.find((m) => m.at === at);
    const color = mark?.by === 'b' || mark?.by === 'w' ? mark.by : toMove;
    const next = play(position, at, color);
    if (!next) return;
    setHistory([...history, { board: next.board, at, color }]);
  };

  const playNextMove = () => {
    if (nextSuggestion) placeStone(nextSuggestion.at);
  };

  useEffect(() => {
    if (result.status !== 'identified' || auth.plan === 'pro' || !access.open) {
      if (result.status !== 'identified') setLimitLocked(false);
      return;
    }
    const o = result.opening!;
    const key = `${o.family}/${o.opening}`;
    if (countedOpenings.current.has(key)) return;
    recordOpeningIdentified(key, { plan: auth.plan, token: auth.token }).then((usage) => {
      setUsedToday(usage.used);
      if (usage.allowed) {
        countedOpenings.current.add(key);
        setLimitLocked(false);
      } else {
        setLimitLocked(true);
        navigation.navigate('Paywall');
      }
    });
  }, [result, auth.plan, auth.token, access.open, navigation]);

  useEffect(() => {
    if (locked || !branch) {
      if (history.length === 0 && path.length) setPath([]);
      return;
    }
    const o = result.opening;
    const name = o ? openingDisplayName(o.family, o.opening, o.name) : branch.branch.opening_name;
    const key = branch.branch.branch_id;
    const label = `${name} · в.${branch.branch.branch_no}`;
    setPath((prev) => (prev.some((p) => p.key === key) ? prev : [...prev, { key, label }]));
  }, [branch, result, locked, history.length, path.length]);

  // ---- header data ----
  const displayName = auth.email ? auth.email.split('@')[0] : 'Гость';
  const points = profile?.points ?? 0;
  const level = Math.floor(points / 100) + 1;
  const levelFrac = (points % 100) / 100;

  // ---- opening card data ----
  const openingName = locked
    ? 'Скрыто 🔒'
    : result.status === 'identified'
      ? openingDisplayName(result.opening!.family, result.opening!.opening, result.opening!.name)
      : result.status === 'candidates'
        ? openingDisplayName(result.openings[0].family, result.openings[0].opening, result.openings[0].name) +
          (result.openings.length > 1 ? '…' : '')
        : result.status === 'unknown'
          ? 'Вне базы'
          : 'Новая партия';
  const family = result.opening ? familyNamesRu[result.opening.family] : null;
  const branchResult = branch?.branch.result as string | null;

  // ---- your turn card ----
  const turnText = (() => {
    if (!access.open) return 'Бесплатная неделя закончилась — подписка откроет базу.';
    if (limitLocked) return `Дневной лимит: ${FREE_DAILY_LIMIT} дебюта. Название скрыто.`;
    switch (result.status) {
      case 'empty': return 'Поставь первый камень.';
      case 'unknown': return 'Такого дебюта в базе нет.';
      case 'identified': return branch
        ? `Продолжай: ${openingName} — ветка ${branch.branch.branch_no}.`
        : `Продолжай дебют ${openingName}.`;
      case 'candidates': return `Возможные дебюты: ${result.openings
        .slice(0, 3)
        .map((o) => openingDisplayName(o.family, o.opening, o.name))
        .join(', ')}${result.openings.length > 3 ? '…' : ''}`;
    }
  })();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.page}>
      {/* profile header */}
      <View style={[styles.card, styles.header]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{displayName[0]?.toUpperCase() ?? 'G'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{displayName}</Text>
          <View style={styles.lvlRow}>
            <Text style={styles.lvlText}>Уровень {level}</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${Math.max(4, levelFrac * 100)}%` }]} />
            </View>
          </View>
        </View>
        <Pressable
          style={styles.iconBtn}
          onPress={() => setMyColor(myColor === 'b' ? 'w' : 'b')}
        >
          <Text style={styles.iconText}>{myColor === 'b' ? '⚫' : '⚪'}</Text>
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.iconText}>⚙︎</Text>
        </Pressable>
      </View>

      {/* opening card */}
      <View style={[styles.card, styles.opening]}>
        <View style={styles.openingLeft}>
          <Text style={eyebrowAccent}>Дебют</Text>
          <Text style={styles.openingTitle} numberOfLines={1}>{openingName}</Text>
          <Text style={styles.openingDesc} numberOfLines={2}>
            {path.length > 0 && !locked
              ? `Путь: ${path.map((p) => p.label).join(' → ')}`
              : family
                ? `Семейство: ${family}.`
                : 'Ставь камни — база опознает дебют и ветку.'}
          </Text>
        </View>
        <View style={styles.openingRight}>
          <Text style={eyebrow}>Ход</Text>
          <View style={styles.diffRow}>
            <View style={[styles.dot, toMove === 'b' ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.diffText}>{toMove === 'b' ? 'Чёрные' : 'Белые'}</Text>
          </View>
          <Text style={[eyebrow, { marginTop: 12 }]}>Оценка</Text>
          <View style={styles.outcomeRow}>
            <View style={[styles.miniStone,
              branchResult === 'W+' ? styles.miniStoneWhite : null]} />
            <Text style={styles.outcomeText}>
              {branchResult ? RESULT_RU[branchResult] ?? branchResult : '—'}
            </Text>
          </View>
        </View>
      </View>

      <Goban
        position={position}
        lastMove={history.length ? history[history.length - 1].at : null}
        marks={marks}
        ghosts={ghosts}
        onPoint={placeStone}
      />

      {/* your turn card */}
      <View style={[styles.card, styles.turn]}>
        <View style={{ flex: 1 }}>
          <Text style={eyebrowAccent}>
            {toMove === myColor ? 'Твой ход' : 'Ход соперника'}
          </Text>
          <Text style={styles.turnText} numberOfLines={2}>{turnText}</Text>
          {access.open && !access.pro && access.trial && access.trial.daysLeft <= TRIAL_NOTICE_DAYS && (
            <Text style={styles.turnSub}>Бесплатных дней: {access.trial.daysLeft}</Text>
          )}
          {auth.plan === 'free' && usedToday > 0 && (
            <Text style={styles.turnSub}>Дебютов сегодня: {usedToday}/{FREE_DAILY_LIMIT}</Text>
          )}
          {locked && (
            <Pressable onPress={() => navigation.navigate('Paywall')}>
              <Text style={[styles.turnSub, { color: ui.peach }]}>Снять лимит — подписка →</Text>
            </Pressable>
          )}
        </View>
        <Pressable
          style={[styles.hintBtn, showHints && styles.hintBtnOn]}
          onPress={() => setShowHints(!showHints)}
        >
          <Text style={styles.hintText}>💡 Hint</Text>
        </Pressable>
      </View>

      {/* bottom controls */}
      <View style={styles.controls}>
        <View style={styles.ctrl}>
          <Pressable style={styles.sideBtn} onPress={() => setHistory([])}>
            <Text style={styles.sideIcon}>↺</Text>
          </Pressable>
          <Text style={styles.ctrlLabel}>Заново</Text>
        </View>
        <View style={styles.ctrl}>
          <Pressable
            style={[styles.bigBtn, !nextSuggestion && styles.bigBtnOff]}
            onPress={playNextMove}
            disabled={!nextSuggestion}
          >
            <View style={styles.bigRing} />
            <Text style={styles.bigIcon}>›</Text>
          </Pressable>
          <Text style={styles.ctrlLabel}>Ход базы</Text>
        </View>
        <View style={styles.ctrl}>
          <Pressable
            style={styles.sideBtn}
            onPress={() => setHistory(history.slice(0, -1))}
            disabled={!history.length}
          >
            <Text style={styles.sideIcon}>‹</Text>
          </Pressable>
          <Text style={styles.ctrlLabel}>Назад</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ui.bg },
  page: { padding: ui.pad, gap: 12, paddingBottom: 36 },
  card: { ...cardStyle, padding: 14 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#3B3833', borderWidth: 1, borderColor: ui.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: ui.serif, fontSize: 20, color: ui.ink },
  name: { fontFamily: ui.serif, fontSize: 20, color: ui.ink },
  lvlRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 3 },
  lvlText: { fontSize: 12, color: ui.muted },
  barTrack: { width: 84, height: 3, borderRadius: 2, backgroundColor: '#383838' },
  barFill: { height: 3, borderRadius: 2, backgroundColor: ui.accent },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11,
    borderWidth: 1, borderColor: ui.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 15, color: '#C9C6C0' },

  opening: { flexDirection: 'row' },
  openingLeft: { flex: 1.4, paddingRight: 14 },
  openingTitle: { fontFamily: ui.serif, fontSize: 28, color: '#EFECE7', marginTop: 6 },
  openingDesc: { marginTop: 7, fontSize: 12.5, lineHeight: 18, color: ui.muted },
  openingRight: {
    flex: 1, borderLeftWidth: 1, borderLeftColor: ui.hairline,
    paddingLeft: 14, paddingTop: 2,
  },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  dotOn: { backgroundColor: '#1C1917', borderWidth: 1, borderColor: '#6B6B6B' },
  dotOff: { backgroundColor: '#F2F0EC' },
  diffText: { fontSize: 13, color: ui.lavender },
  outcomeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  miniStone: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#121212',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  miniStoneWhite: { backgroundColor: '#F2F0EC', borderColor: '#8A8578' },
  outcomeText: { fontSize: 14, color: ui.inkSoft },

  turn: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  turnText: { marginTop: 6, fontSize: 14.5, color: ui.inkSoft, lineHeight: 20 },
  turnSub: { marginTop: 4, fontSize: 12.5, color: ui.muted },
  hintBtn: {
    paddingVertical: 13, paddingHorizontal: 16, borderRadius: 13,
    borderWidth: 1, borderColor: ui.hairlineStrong,
  },
  hintBtnOn: { borderColor: ui.accent, backgroundColor: 'rgba(139,124,246,0.10)' },
  hintText: { color: '#A79AF5', fontSize: 14.5 },

  controls: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start',
    gap: 46, marginTop: 8,
  },
  ctrl: { alignItems: 'center', gap: 9 },
  sideBtn: {
    width: 54, height: 54, borderRadius: 27, marginTop: 14,
    backgroundColor: '#191817', borderWidth: 1, borderColor: ui.hairline,
    alignItems: 'center', justifyContent: 'center',
  },
  sideIcon: { fontSize: 22, color: '#C9C6C0', marginTop: -2 },
  bigBtn: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: '#161514',
    alignItems: 'center', justifyContent: 'center',
  },
  bigBtnOff: { opacity: 0.55 },
  bigRing: {
    position: 'absolute', width: 82, height: 82, borderRadius: 41,
    borderWidth: 1.5, borderColor: ui.accent,
    shadowColor: ui.accent, shadowOpacity: 0.6, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  bigIcon: { fontSize: 34, color: ui.ink, marginTop: -4 },
  ctrlLabel: {
    fontSize: 10, letterSpacing: 2.2, color: ui.label,
    fontWeight: '600', textTransform: 'uppercase',
  },
});

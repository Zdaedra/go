// Game ("live") mode, laid out after the reference design: profile
// header, opening card (name / difficulty dots / best outcome), the
// board, a "your turn" card with Hint, and round bottom controls.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import MistBackground from '../components/MistBackground';
import HintBulb from '../components/HintBulb';
import Svg, {
  Circle, Defs, LinearGradient, RadialGradient, Stop, Path, Ellipse,
} from 'react-native-svg';

/** Glossy mini-stone (info values, color toggle) — matches the mockup's
    specular black stone next to BEST OUTCOME. */
function MiniStone({ color, size = 16 }: { color: 'b' | 'w'; size?: number }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Defs>
        <RadialGradient id={`ms-${id}`} cx="0.35" cy="0.3" r="0.9">
          <Stop offset="0" stopColor={color === 'b' ? '#5A5A5A' : '#FFFFFF'} />
          <Stop offset="0.5" stopColor={color === 'b' ? '#1B1B1B' : '#E9E7E1'} />
          <Stop offset="1" stopColor={color === 'b' ? '#0B0B0B' : '#C9C7C2'} />
        </RadialGradient>
      </Defs>
      <Circle
        cx={11} cy={11} r={10} fill={`url(#ms-${id})`}
        stroke="rgba(255,255,255,0.30)" strokeWidth={0.9}
      />
      <Ellipse cx={7.5} cy={6.5} rx={3.4} ry={1.6} fill="#FFFFFF" opacity={color === 'b' ? 0.35 : 0.7} />
    </Svg>
  );
}

/** Thin-stroked cog (Feather "settings"), as in the mockup's header. */
function GearIcon() {
  return (
    <Svg width={19} height={19} viewBox="0 0 24 24" fill="none"
      stroke="#C9C7C4" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={3} />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  );
}

interface HistoryItem {
  board: string;
  at: number;
  color: 'b' | 'w';
  // Set when the move was a book continuation played from a recognized
  // position: if the resulting position falls off the diagram index, that
  // means the opening was COMPLETED, not that the player left the book.
  viaBook?: boolean;
  openingName?: string;
  openingResult?: string | null;
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
  const insets = useSafeAreaInsets();
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
  // Every book move from the current position, used both for the on-board
  // dots and to pick the right stone color when the user taps one.
  const bookMoves = useMemo(
    () => (result.status === 'unknown' || result.status === 'empty'
      ? []
      : suggestions(result, 99)),
    [result]
  );
  const marks: GobanMark[] = useMemo(() => {
    if (locked) return [];
    if (fullMarks.length) {
      return fullMarks.map((m) => ({ at: m.at, label: m.label, kind: m.kind }));
    }
    // Mid-branch positions have no diagram letters; without these dots the
    // board looks dead even though the base knows the continuations.
    return bookMoves.map((s) => ({ at: s.at, kind: 'dot' }));
  }, [fullMarks, bookMoves, locked]);
  // Opening completed — a firmly different state from "not in the base":
  // either the last book move led off the diagrams (the book simply stops
  // there), or we sit on a final diagram that offers nothing further.
  const lastMove = history.length ? history[history.length - 1] : null;
  const completed = useMemo(() => {
    if (locked) return null;
    if (result.status === 'unknown' && lastMove?.viaBook) {
      return { name: lastMove.openingName ?? null, result: lastMove.openingResult ?? null };
    }
    if ((result.status === 'identified' || result.status === 'candidates') &&
        branch && !fullMarks.length && !bookMoves.length) {
      const name = result.opening
        ? openingDisplayName(result.opening.family, result.opening.opening, result.opening.name)
        : openingDisplayName(branch.branch.family, branch.branch.opening, branch.branch.opening_name);
      return { name, result: (branch.branch.result as string | null) ?? null };
    }
    return null;
  }, [locked, result, lastMove, branch, fullMarks, bookMoves]);

  const nextSuggestion = useMemo(() => {
    if (locked || result.status === 'unknown') return null;
    if (fullMarks.length) {
      const own = fullMarks.find((m) => m.by === toMove) ?? fullMarks[0];
      return own ? { at: own.at, color: (own.by ?? toMove) as 'b' | 'w' } : null;
    }
    const sug = bookMoves.filter((s) => s.color === toMove);
    return sug.length ? { at: sug[0].at, color: sug[0].color as 'b' | 'w' } : null;
  }, [locked, result, fullMarks, bookMoves, toMove]);

  const ghosts: GhostStone[] = useMemo(() => {
    // Hint previews full ghost stones; dots don't block it, letters do.
    if (locked || !showHints || result.status === 'unknown' || fullMarks.length > 0) return [];
    return bookMoves
      .filter((s) => s.color === toMove)
      .map((s) => ({ at: s.at, color: s.color, label: s.label }));
  }, [locked, showHints, result, fullMarks, bookMoves, toMove]);

  const placeStone = (at: number) => {
    const mark = fullMarks.find((m) => m.at === at);
    const book = bookMoves.find((s) => s.at === at);
    const color =
      mark?.by === 'b' || mark?.by === 'w' ? mark.by
      : book ? (book.color as 'b' | 'w')
      : toMove;
    const next = play(position, at, color);
    if (!next) return;
    // Snapshot the opening we were in, so that a book move leading off the
    // diagram index reads as "opening completed", not "not in the base".
    const viaBook = Boolean(mark || book);
    const snapName = branch
      ? openingDisplayName(branch.branch.family, branch.branch.opening, branch.branch.opening_name)
      : result.openings.length
        ? openingDisplayName(result.openings[0].family, result.openings[0].opening, result.openings[0].name)
        : undefined;
    setHistory([...history, {
      board: next.board, at, color,
      viaBook,
      openingName: viaBook ? snapName : undefined,
      openingResult: viaBook ? (branch?.branch.result as string | null) ?? null : undefined,
    }]);
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
    // Breadcrumb only grows once the position is unambiguous — with 15
    // candidates on the board, "Путь: Sword · в.1" would be a guess.
    if (locked || !branch || result.status !== 'identified') {
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
    : completed?.name
      ? completed.name
      : result.status === 'identified'
      ? openingDisplayName(result.opening!.family, result.opening!.opening, result.opening!.name)
      : result.status === 'candidates'
        ? (() => {
            // Ambiguous position: name the family and the live count instead
            // of a single misleading name ("Sword…" read as "only Sword").
            const fams = [...new Set(result.openings.map((o) => o.family))];
            const fam = fams.length === 1 ? familyNamesRu[fams[0]] : null;
            return fam
              ? `${fam} · ${result.openings.length}`
              : `Вариантов: ${result.openings.length}`;
          })()
        : result.status === 'unknown'
          ? 'Вне базы'
          : 'Новая партия';
  const family = result.opening ? familyNamesRu[result.opening.family] : null;
  const branchResult = completed?.result ?? (branch?.branch.result as string | null);

  // ---- your turn card ----
  const turnText = (() => {
    if (!access.open) return 'Бесплатная неделя закончилась — подписка откроет базу.';
    if (limitLocked) return `Дневной лимит: ${FREE_DAILY_LIMIT} дебюта. Название скрыто.`;
    if (completed) {
      const verdict = completed.result
        ? ` Оценка: ${RESULT_RU[completed.result] ?? completed.result}.`
        : '';
      return `Дебют пройден полностью${completed.name ? ` — ${completed.name}` : ''}.${verdict}`;
    }
    switch (result.status) {
      case 'empty': return 'Поставь первый камень.';
      case 'unknown': return 'Такого дебюта в базе нет. «Назад» вернёт в книжную линию.';
      case 'identified': return branch
        ? `Продолжай: ${openingName} — ветка ${branch.branch.branch_no}.`
        : `Продолжай дебют ${openingName}.`;
      case 'candidates': {
        const names = result.openings
          .map((o) => openingDisplayName(o.family, o.opening, o.name));
        const shown = names.slice(0, 6);
        const rest = names.length - shown.length;
        return `Возможных дебютов: ${names.length} — ${shown.join(', ')}${
          rest > 0 ? ` и ещё ${rest}` : ''}.`;
      }
    }
  })();

  return (
    <View style={styles.root}>
    <MistBackground />
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 8 }]}
    >
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
          <MiniStone color={myColor} size={17} />
        </Pressable>
        <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
          <GearIcon />
        </Pressable>
      </View>

      {/* opening card */}
      <View style={[styles.card, styles.opening]}>
        <View style={styles.openingLeft}>
          <Text style={eyebrowAccent}>Дебют</Text>
          <Text
            style={styles.openingTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.55}
          >{openingName}</Text>
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
            <MiniStone color={toMove} size={14} />
            <Text style={styles.diffText}>{toMove === 'b' ? 'Чёрные' : 'Белые'}</Text>
          </View>
          <Text style={[eyebrow, { marginTop: 12 }]}>Оценка</Text>
          <View style={styles.outcomeRow}>
            <MiniStone color={branchResult === 'W+' ? 'w' : 'b'} size={14} />
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
          <Text style={[eyebrowAccent, completed ? { color: ui.success } : null]}>
            {completed ? 'Дебют завершён ✓' : toMove === myColor ? 'Твой ход' : 'Ход соперника'}
          </Text>
          <Text style={styles.turnText} numberOfLines={3}>{turnText}</Text>
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
          <HintBulb />
          <Text style={styles.hintText}>Hint</Text>
        </Pressable>
      </View>

      {/* bottom controls under the violet dome glow */}
      <View style={styles.controlsWrap}>
      <Svg
        pointerEvents="none" style={styles.dome}
        width="100%" height={230} viewBox="0 0 427 230"
      >
        <Defs>
          <RadialGradient id="dome-play" cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor="#7A63F1" stopOpacity="0.22" />
            <Stop offset="0.5" stopColor="#7A63F1" stopOpacity="0.09" />
            <Stop offset="1" stopColor="#7A63F1" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="domearc-play" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#6D6FB2" stopOpacity="0" />
            <Stop offset="0.25" stopColor="#6D6FB2" stopOpacity="0.9" />
            <Stop offset="0.5" stopColor="#8B84D6" stopOpacity="1" />
            <Stop offset="0.75" stopColor="#6D6FB2" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#6D6FB2" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        {/* ambient lives in the upper dome only — neutral below the button */}
        <Circle cx={213.5} cy={84} r={120} fill="url(#dome-play)" />
        {/* wide flat arc above the crown, brighter periwinkle shoulders */}
        <Circle
          cx={213.5} cy={125} r={100} fill="none"
          stroke="url(#domearc-play)" strokeWidth={1.6}
          strokeDasharray="220 408" strokeLinecap="round"
          rotation={207} originX={213.5} originY={125}
        />
      </Svg>
      <View style={styles.controls}>
        <View style={styles.ctrl}>
          <Pressable style={styles.sideBtn} onPress={() => setHistory([])}>
            <Text style={styles.sideIcon}>↻</Text>
          </Pressable>
          <Text style={styles.ctrlLabel}>Заново</Text>
        </View>
        <View style={styles.ctrl}>
          <Pressable
            style={[styles.bigBtn, !nextSuggestion && styles.bigBtnOff]}
            onPress={playNextMove}
            disabled={!nextSuggestion}
          >
            {/* ring bias per the mockup sweep: salmon peak on the left,
                copper right, violet dimmed at top, bottom fading out */}
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 82 82">
              <Defs>
                <LinearGradient id="bigring-play" x1="1" y1="0.75" x2="0" y2="0.25">
                  <Stop offset="0" stopColor="#8A614C" />
                  <Stop offset="0.55" stopColor="#C58A6A" />
                  <Stop offset="1" stopColor="#EEAB94" />
                </LinearGradient>
              </Defs>
              <Circle
                cx={41} cy={41} r={40} fill="none"
                stroke="url(#bigring-play)" strokeWidth={1.6}
              />
              {/* bottom quadrant fades toward the field */}
              <Circle
                cx={41} cy={41} r={40} fill="none"
                stroke="rgba(18,18,19,0.62)" strokeWidth={2.4}
                strokeDasharray="63 189" strokeLinecap="round"
                rotation={45} originX={41} originY={41}
              />
              {/* the ring's own crown is rose — the violet lives only in the
                  separate dome arc above */}
              <Circle
                cx={41} cy={41} r={40} fill="none"
                stroke="rgba(206,134,160,0.8)" strokeWidth={1.7}
                strokeDasharray="60 191" strokeLinecap="round"
                rotation={227} originX={41} originY={41}
              />
              {/* bottom quadrant dies into the field completely */}
              <Circle
                cx={41} cy={41} r={40} fill="none"
                stroke="rgba(18,18,19,0.85)" strokeWidth={2.6}
                strokeDasharray="55 196" strokeLinecap="round"
                rotation={50} originX={41} originY={41}
              />
              <Path
                d="M 36 27 L 49 41 L 36 55"
                stroke="#E8E8E8" strokeWidth={2.4} fill="none"
              />
            </Svg>
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
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  screen: { backgroundColor: 'transparent' },
  page: { padding: ui.pad, gap: 12, paddingBottom: 24, paddingTop: 14 },
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
  barTrack: { width: 66, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)' },
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
  diffText: { fontSize: 13, color: '#B0B1E0' },
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
    flexDirection: 'row', alignItems: 'center', gap: 7,
  },
  hintBtnOn: { borderColor: ui.accent, backgroundColor: 'rgba(139,124,246,0.10)' },
  hintText: { color: '#A79AF5', fontSize: 14.5 },

  controlsWrap: { marginTop: 8 },
  dome: { position: 'absolute', left: -16, right: -16, top: -76 },
  controls: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start',
    gap: 46,
  },
  ctrl: { alignItems: 'center', gap: 9 },
  sideBtn: {
    width: 54, height: 54, borderRadius: 27, marginTop: 14,
    backgroundColor: '#1C1C1E',
    alignItems: 'center', justifyContent: 'center',
  },
  sideIcon: { fontSize: 22, color: '#C9C6C0', marginTop: -2 },
  bigBtn: {
    width: 82, height: 82, borderRadius: 41,
    backgroundColor: '#161514',
    alignItems: 'center', justifyContent: 'center',
  },
  bigBtnOff: { opacity: 0.82 },
  bigIcon: { fontSize: 34, color: ui.ink, marginTop: -4 },
  ctrlLabel: {
    fontSize: 10, letterSpacing: 2.2, color: '#8A8A8A',
    fontWeight: '600', textTransform: 'uppercase',
  },
});

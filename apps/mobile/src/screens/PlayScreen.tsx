// Game ("live") mode, laid out after the reference design: profile
// header, opening card (name / difficulty dots / best outcome), the
// board, a "your turn" card with Hint, and round bottom controls.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Goban, { GobanMark, GhostStone } from '../components/Goban';
import { EMPTY_BOARD, play, sgfToIdx } from '../engine/board';
import { stabilizer, orbit } from '../engine/symmetry';
import {
  identify, suggestions, continuationMarks, currentBranch,
} from '../engine/identify';
import { evalFor } from '../engine/evals';
import { soundForMove, playStone } from '../sound/stones';
import { openingDisplayName } from '../data/names';
import branchDescriptions from '../data/descriptions.json';
import { useT } from '../i18n';
import { useAuth } from '../state/AuthContext';
import { useAccess } from '../state/useTrial';
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

const RESULT_KEY: Record<string, string> = {
  even: 'result_even',
  'B+': 'result_black',
  'W+': 'result_white',
};

export default function PlayScreen({ navigation }: { navigation: any }) {
  const insets = useSafeAreaInsets();
  const t = useT();
  const resultRu = (r: string | null | undefined) =>
    r ? (RESULT_KEY[r] ? t(RESULT_KEY[r]) : r) : '';
  const auth = useAuth();
  const access = useAccess();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [myColor, setMyColor] = useState<'b' | 'w'>('b');
  const [showHints, setShowHints] = useState(false);
  // Access is trial/subscription only — no per-day opening quota.
  const locked = !access.open;
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
    const base: GobanMark[] = fullMarks.length
      ? fullMarks.map((m) => ({ at: m.at, label: m.label, kind: m.kind }))
      // Mid-branch positions have no diagram letters; without these dots the
      // board looks dead even though the base knows the continuations.
      : bookMoves.map((s) => ({ at: s.at, kind: 'dot' }));

    // When the position is symmetric (e.g. a lone centre stone), each book
    // continuation exists identically in every mirrored/rotated direction.
    // Show them all as triangles so the openings read "in all directions" —
    // playing a mirrored point just yields the mirrored opening.
    const stab = stabilizer(position);
    if (stab.length <= 1) return base;
    const seen = new Set<number>();
    const out: GobanMark[] = [];
    for (const mk of base) {
      for (const at of orbit(mk.at, stab)) {
        if (seen.has(at)) continue;
        seen.add(at);
        out.push({ at, kind: 'triangle' });
      }
    }
    return out;
  }, [fullMarks, bookMoves, locked, position]);
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

  // Offline KataGo evaluation of the current book position (null when the
  // position isn't in the evaluated set, e.g. off the book).
  const kataEval = useMemo(
    () => (locked || result.status === 'unknown' || result.status === 'empty'
      ? null
      : evalFor(position, toMove)),
    [locked, result.status, position, toMove]
  );

  const nextSuggestion = useMemo(() => {
    if (locked || result.status === 'unknown') return null;
    // KataGo's best move, when the position has been scored.
    if (kataEval) {
      return { at: kataEval.best[0].at, color: toMove };
    }
    if (fullMarks.length) {
      const own = fullMarks.find((m) => m.by === toMove) ?? fullMarks[0];
      return own ? { at: own.at, color: (own.by ?? toMove) as 'b' | 'w' } : null;
    }
    const sug = bookMoves.filter((s) => s.color === toMove);
    return sug.length ? { at: sug[0].at, color: sug[0].color as 'b' | 'w' } : null;
  }, [locked, result, kataEval, fullMarks, bookMoves, toMove]);

  const ghosts: GhostStone[] = useMemo(() => {
    // The "best move" hint highlights the single recommended reply as a
    // ghost stone. Until KataGo scores the position, "best" is the book's
    // primary continuation for the side to move (nextSuggestion).
    if (locked || !showHints || !nextSuggestion) return [];
    return [{ at: nextSuggestion.at, color: nextSuggestion.color, label: '★' }];
  }, [locked, showHints, nextSuggestion]);

  const placeStone = (at: number) => {
    const mark = fullMarks.find((m) => m.at === at);
    const book = bookMoves.find((s) => s.at === at);
    const color =
      mark?.by === 'b' || mark?.by === 'w' ? mark.by
      : book ? (book.color as 'b' | 'w')
      : toMove;
    const next = play(position, at, color);
    if (!next) return;
    soundForMove(position, next.board, 1);
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

  // Tap a candidate opening → play its line forward onto the board, in the
  // user's current orientation, so the position resolves to that opening and
  // its shape/description appear. Picks the fullest matched branch.
  const showOpening = (op: { family: string; opening: string }) => {
    const cands = (result.matches as any[]).filter(
      (m) => m.branch.opening !== 'preamble'
        && m.branch.family === op.family && m.branch.opening === op.opening
    );
    if (!cands.length) return;
    const m = cands.reduce((a: any, b: any) =>
      (b.branch.moves.length > a.branch.moves.length ? b : a));
    const name = openingDisplayName(op.family, op.opening, m.branch.opening_name);
    let board = position;
    const added: HistoryItem[] = [];
    for (let i = m.ply; i < m.branch.moves.length; i++) {
      const mv = m.branch.moves[i];
      const at = m.mapIdx(sgfToIdx(mv.coord));
      const next = play(board, at, mv.color as 'b' | 'w');
      if (!next) break;
      board = next.board;
      added.push({
        board, at, color: mv.color as 'b' | 'w',
        viaBook: true, openingName: name,
        openingResult: (m.branch.result as string | null) ?? null,
      });
    }
    if (added.length) {
      // A quick cascade of clacks as the line plays onto the board.
      for (let i = 0; i < Math.min(added.length, 6); i++) playStone(i * 90);
      setHistory([...history, ...added]);
    }
  };

  // Trial ended (and not subscribed): send the user to the paywall once
  // they engage with the board, instead of silently hiding everything.
  const paywallShown = useRef(false);
  useEffect(() => {
    if (access.pro || access.open) { paywallShown.current = false; return; }
    if (result.status !== 'empty' && !paywallShown.current) {
      paywallShown.current = true;
      navigation.navigate('Paywall');
    }
  }, [access.pro, access.open, result.status, navigation]);

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

  // ---- opening card data ----
  const openingName = locked
    ? t('opening_hidden')
    : completed?.name
      ? completed.name
      : result.status === 'identified'
      ? openingDisplayName(result.opening!.family, result.opening!.opening, result.opening!.name)
      : result.status === 'candidates'
        // Position is ambiguous — don't commit to a name (nor a family +
        // count, which read like a title). Prompt for more stones instead.
        ? t('opening_undetermined')
        : result.status === 'unknown'
          ? t('out_of_base')
          : t('new_game');
  // The verdict is honest only when the line is pinned down: with many
  // candidate openings the deepest match's result would be a guess.
  const branchResult = completed?.result
    ?? (result.status === 'identified' ? (branch?.branch.result as string | null) : null);

  // ---- your turn card ----
  // Label above the explanation card, and the explanation body itself.
  // Candidates are rendered as a list (one opening per row) rather than a
  // comma sentence, so the box grows cleanly with however many there are.
  const identifiedDesc =
    !locked && result.status === 'identified' && branch
      ? (branchDescriptions as Record<string, string>)[branch.branch.branch_id]
      : null;

  const candidateOpenings =
    !locked && result.status === 'candidates'
      ? result.openings.map((o) => ({
          family: o.family,
          opening: o.opening,
          name: openingDisplayName(o.family, o.opening, o.name),
        }))
      : null;

  const explainLabel = (() => {
    if (!access.open) return t('title_opening');
    if (completed) return t('opening_done');
    if (result.status === 'candidates') return t('candidates_label', { n: result.openings.length });
    if (result.status === 'unknown') return t('out_of_base');
    if (result.status === 'empty') return t('start');
    return toMove === myColor ? t('your_move') : t('opponent_move');
  })();

  const explainText = (() => {
    if (!access.open) return t('trial_over');
    if (completed) {
      const verdict = completed.result ? t('eval_suffix', { v: resultRu(completed.result) }) : '';
      return t('completed_full', { name: completed.name ?? '' }) + verdict;
    }
    switch (result.status) {
      case 'empty': return t('place_first');
      case 'unknown': return t('not_in_base');
      case 'identified':
        return identifiedDesc
          ?? (branch
            ? t('continue_line', { name: openingName, n: branch.branch.branch_no })
            : t('continue_opening', { name: openingName }));
      case 'candidates':
        return null; // rendered as a list below
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
          <Text style={styles.nameSub}>{t('app_subtitle')}</Text>
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

      {/* opening name card — name + whose move + verdict, no prose here */}
      <View style={[styles.card, styles.opening]}>
        <View style={styles.openingLeft}>
          <Text style={eyebrowAccent}>{t('title_opening')}</Text>
          <Text
            style={styles.openingTitle}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >{openingName}</Text>
        </View>
        <View style={styles.openingRight}>
          <Text style={eyebrow}>{t('move')}</Text>
          <View style={styles.diffRow}>
            <MiniStone color={toMove} size={14} />
            <Text style={styles.diffText}>{toMove === 'b' ? t('black') : t('white')}</Text>
          </View>
          <Text style={[eyebrow, { marginTop: 12 }]}>{t('eval')}</Text>
          <View style={styles.outcomeRow}>
            <MiniStone color={branchResult === 'W+' ? 'w' : 'b'} size={14} />
            <Text style={styles.outcomeText}>
              {branchResult ? resultRu(branchResult) : '—'}
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

      {/* game controls, directly under the board */}
      <View style={styles.controls}>
        <View style={styles.ctrl}>
          <Pressable style={styles.sideBtn} onPress={() => setHistory([])}>
            <Text style={styles.sideIcon}>↻</Text>
          </Pressable>
          <Text style={styles.ctrlLabel}>{t('restart')}</Text>
        </View>
        <View style={styles.ctrl}>
          <Pressable
            style={[styles.bigBtn, showHints && styles.bigBtnOn, !nextSuggestion && styles.bigBtnOff]}
            onPress={() => setShowHints((v) => !v)}
            disabled={!nextSuggestion}
          >
            <HintBulb size={24} color={showHints ? '#EEAB94' : '#C9C6C0'} />
          </Pressable>
          <Text style={styles.ctrlLabel}>{showHints ? t('hide') : t('best_move')}</Text>
        </View>
        <View style={styles.ctrl}>
          <Pressable
            style={styles.sideBtn}
            onPress={() => setHistory(history.slice(0, -1))}
            disabled={!history.length}
          >
            <Text style={styles.sideIcon}>‹</Text>
          </Pressable>
          <Text style={styles.ctrlLabel}>{t('back')}</Text>
        </View>
      </View>

      {/* explanation zone — the app's main readout. Height follows content:
          a single blurb, or one row per candidate opening. */}
      <View style={[styles.card, styles.explain]}>
        <Text style={[eyebrowAccent, completed ? { color: ui.success } : null]}>
          {explainLabel}
        </Text>

        {candidateOpenings ? (
          <View style={styles.candList}>
            <Text style={styles.candHint}>{t('candidates_hint')}</Text>
            {candidateOpenings.map((o, i) => (
              <Pressable
                key={`${o.family}/${o.opening}-${i}`}
                style={styles.candRow}
                onPress={() => showOpening(o)}
              >
                <View style={styles.candDot} />
                <Text style={styles.candName}>{o.name}</Text>
                <Text style={styles.candChevron}>›</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Text style={styles.explainText}>{explainText}</Text>
        )}

        {showHints && nextSuggestion && !completed && (
          <Text style={[styles.turnSub, { color: ui.peach }]}>
            {kataEval
              ? t('best_move_eval', {
                  side: toMove === 'b' ? t('black') : t('white'),
                  p: Math.round(kataEval.best[0].winrate * 100),
                  lead: `${kataEval.best[0].scoreLead >= 0 ? '+' : ''}${kataEval.best[0].scoreLead.toFixed(1)}`,
                })
              : t('best_move_note')}
          </Text>
        )}
        {access.open && !access.pro && access.trial && access.trial.daysLeft <= TRIAL_NOTICE_DAYS && (
          <Text style={styles.turnSub}>{t('trial_days_left', { n: access.trial.daysLeft })}</Text>
        )}
        {locked && (
          <Pressable onPress={() => navigation.navigate('Paywall')}>
            <Text style={[styles.turnSub, { color: ui.peach }]}>{t('subscribe_cta')}</Text>
          </Pressable>
        )}
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
  nameSub: { fontSize: 12.5, color: ui.muted, marginTop: 2 },
  iconBtn: {
    width: 34, height: 34, borderRadius: 11,
    borderWidth: 1, borderColor: ui.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  iconText: { fontSize: 15, color: '#C9C6C0' },

  opening: { flexDirection: 'row', alignItems: 'center' },
  openingLeft: { flex: 1.4, paddingRight: 14, justifyContent: 'center' },
  openingTitle: { fontFamily: ui.serif, fontSize: 27, color: '#EFECE7', marginTop: 6 },
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

  // explanation zone — the big readout under the controls
  explain: { paddingVertical: 18, paddingHorizontal: 16 },
  explainText: { marginTop: 10, fontSize: 16.5, color: ui.inkSoft, lineHeight: 24 },
  turnSub: { marginTop: 8, fontSize: 12.5, color: ui.muted },

  candList: { marginTop: 10, gap: 4 },
  candHint: { fontSize: 13.5, lineHeight: 19, color: ui.muted, marginBottom: 6 },
  candRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 9, paddingHorizontal: 10, marginHorizontal: -10, borderRadius: 10,
  },
  candDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ui.accent },
  candName: { flex: 1, fontSize: 16.5, color: ui.inkSoft },
  candChevron: { fontSize: 20, color: ui.dim, marginTop: -2 },

  controls: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start',
    gap: 46, marginTop: 4,
  },
  ctrl: { alignItems: 'center', gap: 9 },
  sideBtn: {
    width: 54, height: 54, borderRadius: 27, marginTop: 12,
    backgroundColor: '#1C1C1E',
    alignItems: 'center', justifyContent: 'center',
  },
  sideIcon: { fontSize: 22, color: '#C9C6C0', marginTop: -2 },
  bigBtn: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: '#161514',
    borderWidth: 1, borderColor: ui.hairlineStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  bigBtnOn: { borderColor: 'rgba(238,171,148,0.7)', backgroundColor: 'rgba(238,171,148,0.08)' },
  bigBtnOff: { opacity: 0.5 },
  ctrlLabel: {
    fontSize: 10, letterSpacing: 2.2, color: '#8A8A8A',
    fontWeight: '600', textTransform: 'uppercase',
  },
});

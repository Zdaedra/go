// Opening card: branch list with replay on the board.

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import Goban, { GobanMark } from '../components/Goban';
import { EMPTY_BOARD, play, sgfToIdx } from '../engine/board';
import { allBranches } from '../engine/identify';
import { openingDisplayName, familyNameKeys } from '../data/names';
import branchDescriptions from '../data/descriptions.json';
import { useAccess } from '../state/useTrial';
import MistBackground from '../components/MistBackground';
import PrimaryButton from '../components/PrimaryButton';
import { useI18n } from '../i18n';

const RESULT_KEY: Record<string, string> = {
  even: 'res_even_short',
  'B+': 'res_black_adv',
  'W+': 'res_white_adv',
};

export default function OpeningScreen({ route, navigation }: { route: any; navigation: any }) {
  const { t, lang } = useI18n();
  const { family, opening } = route.params;
  const access = useAccess();
  const branches = useMemo(
    () => allBranches().filter((b) => b.family === family && b.opening === opening),
    [family, opening]
  );
  const [branchIdx, setBranchIdx] = useState(0);
  const branch = branches[branchIdx];

  // Board states for the selected branch: prefer the full line from the
  // empty board; otherwise replay from the diagram's setup stones.
  const states = useMemo(() => {
    const moves = branch.line ?? branch.moves;
    let board = EMPTY_BOARD;
    if (!branch.line) {
      const cells = board.split('');
      for (const c of branch.setup_black) cells[sgfToIdx(c)] = 'b';
      for (const c of branch.setup_white) cells[sgfToIdx(c)] = 'w';
      board = cells.join('');
    }
    const out: { board: string; at: number | null }[] = [{ board, at: null }];
    for (const mv of moves) {
      const at = sgfToIdx(mv.coord);
      const next = play(board, at, mv.color);
      if (!next) break;
      board = next.board;
      out.push({ board, at });
    }
    return out;
  }, [branch]);

  const [ply, setPly] = useState(states.length - 1);
  const shown = Math.min(ply, states.length - 1);
  const atEnd = shown === states.length - 1;

  const marks: GobanMark[] = useMemo(() => {
    if (!atEnd) return [];
    return branch.continuations
      .filter((c: any) => c.on === 'empty')
      .map((c: any) => ({ at: sgfToIdx(c.coord), label: c.label, kind: c.kind }));
  }, [branch, atEnd]);

  const name = openingDisplayName(family, opening, branch.opening_name, lang);

  // Hard lock after the free week: the card shows nothing but the paywall.
  if (!access.open) {
    return (
      <View style={styles.lockPage}>
        <MistBackground />
        <Text style={styles.lockTitle}>{name}</Text>
        <Text style={styles.lockText}>{t('openings_locked')}</Text>
        <PrimaryButton
          label={t('open_subscription')}
          onPress={() => navigation.getParent()?.navigate('Paywall')}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
    <MistBackground />
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.meta}>
        {t(familyNameKeys[family] ?? family)} · {t('branches_abbr', { n: branches.length })}
      </Text>

      <View style={styles.branchRow}>
        {branches.map((b, i) => (
          <Pressable
            key={b.branch_id}
            onPress={() => { setBranchIdx(i); setPly(Number.MAX_SAFE_INTEGER); }}
            style={[styles.branchBtn, i === branchIdx && styles.branchBtnActive]}
          >
            <Text style={styles.branchBtnText}>{t('branch_n', { n: b.branch_no })}</Text>
          </Pressable>
        ))}
      </View>

      <Goban
        position={states[shown].board}
        lastMove={states[shown].at}
        marks={marks}
      />

      <View style={styles.replay}>
        <Pressable style={styles.btn} onPress={() => setPly(0)}>
          <Text style={styles.btnText}>⏮</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setPly(Math.max(0, shown - 1))}>
          <Text style={styles.btnText}>‹</Text>
        </Pressable>
        <Text style={styles.plyText}>
          {shown}/{states.length - 1}
        </Text>
        <Pressable
          style={styles.btn}
          onPress={() => setPly(Math.min(states.length - 1, shown + 1))}
        >
          <Text style={styles.btnText}>›</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={() => setPly(states.length - 1)}>
          <Text style={styles.btnText}>⏭</Text>
        </Pressable>
      </View>

      <View style={styles.info}>
        {(branchDescriptions as Record<string, string>)[branch.branch_id] && (
          <Text style={styles.infoDesc}>
            {(branchDescriptions as Record<string, string>)[branch.branch_id]}
          </Text>
        )}
        <Text style={styles.infoText}>{branch.caption}</Text>
        {branch.result && (
          <Text style={styles.infoText}>
            {t('eval')}: {branch.result in RESULT_KEY ? t(RESULT_KEY[branch.result]) : branch.result}
          </Text>
        )}
        {!branch.line && (
          <Text style={styles.infoNote}>
            {t('opening_branch_note')}
          </Text>
        )}
        {atEnd && marks.length > 0 && (
          <Text style={styles.infoNote}>
            {t('opening_marks_note')}
          </Text>
        )}
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 16, gap: 12 },
  title: { fontSize: 24, fontWeight: '500', color: '#EFECE7', fontFamily: 'Playfair' },
  meta: { fontSize: 13, color: '#8E8B85' },
  branchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  branchBtn: {
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  branchBtnActive: { backgroundColor: '#262036', borderColor: '#7E7B75' },
  branchBtnText: { fontSize: 13, color: '#F2EFEA' },
  replay: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  btn: {
    paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  btnText: { fontSize: 16, color: '#F2EFEA' },
  plyText: { fontSize: 14, minWidth: 48, textAlign: 'center', color: '#F2EFEA' },
  info: { gap: 4 },
  infoDesc: { fontSize: 14.5, lineHeight: 20, color: '#E8E6E3', marginBottom: 2 },
  infoText: { fontSize: 15, color: '#8E8B85' },
  infoNote: { fontSize: 13, color: '#8E8B85' },
  lockPage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  lockTitle: { fontSize: 22, fontWeight: '500', textAlign: 'center', color: '#EFECE7', fontFamily: 'Playfair' },
  lockText: { fontSize: 15, color: '#8E8B85', textAlign: 'center', lineHeight: 22 },
});

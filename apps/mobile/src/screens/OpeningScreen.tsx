// Opening card: branch list with replay on the board.

import React, { useEffect, useMemo, useState } from 'react';
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

  // #8: воспроизведение линии по памяти. Игрок сам ставит ходы за обе
  // стороны; корректность = совпадение с line[cursor] (S6). Переиспользуем
  // states: доска после cursor ходов = states[cursor], ожидаемый ход —
  // states[cursor+1].at. Короткая фикс-длина.
  const REPRO_MAX = 8;
  const reproMoves = branch.line ?? branch.moves;
  const reproTarget = Math.min(reproMoves.length, REPRO_MAX);
  const canReproduce = reproTarget >= 2;

  const [mode, setMode] = useState<'watch' | 'repro'>('watch');
  const [cursor, setCursor] = useState(0);       // сколько ходов уже воспроизведено
  const [wrongAt, setWrongAt] = useState<number | null>(null);
  const [wrongCount, setWrongCount] = useState(0); // подряд ошибок на текущем ходе

  // Вспышка ошибки: показать ~0.9с и убрать. Неверный камень НЕ ставим (S6).
  useEffect(() => {
    if (wrongAt == null) return;
    const id = setTimeout(() => setWrongAt(null), 900);
    return () => clearTimeout(id);
  }, [wrongAt]);

  const reproDone = mode === 'repro' && cursor >= reproTarget;
  const startRepro = () => { setMode('repro'); setCursor(0); setWrongCount(0); setWrongAt(null); };
  const stopRepro = () => { setMode('watch'); setWrongAt(null); };
  // «Показать ход» после 2 ошибок: продвигаем на один верный ход (S6).
  const showNextMove = () => { setWrongCount(0); setWrongAt(null); setCursor((c) => Math.min(reproTarget, c + 1)); };
  const handleReproTap = (at: number) => {
    if (cursor >= reproTarget) return;
    if (at === states[cursor + 1]?.at) {
      setWrongCount(0); setWrongAt(null); setCursor((c) => c + 1); // верно — прогресс сохраняется
    } else {
      setWrongAt(at); setWrongCount((w) => w + 1);                 // ошибка — cursor НЕ двигаем
    }
  };

  const name = openingDisplayName(family, opening, branch.opening_name, lang);

  // Описание ветки локализовано (волна 2): descriptions.json — вложенный
  // {branch_id: {ru,en,es,fr,de,ko}}. Берём язык интерфейса, откат на ru,
  // чтобы недостающий перевод не оставлял пустой блок.
  const descEntry = (branchDescriptions as Record<string, Record<string, string>>)[branch.branch_id];
  const descText = descEntry ? (descEntry[lang] || descEntry.ru || '') : '';

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
            onPress={() => {
              setBranchIdx(i); setPly(Number.MAX_SAFE_INTEGER);
              setMode('watch'); setCursor(0); setWrongAt(null); setWrongCount(0); // #8
            }}
            style={[styles.branchBtn, i === branchIdx && styles.branchBtnActive]}
          >
            <Text style={styles.branchBtnText}>{t('branch_n', { n: b.branch_no })}</Text>
          </Pressable>
        ))}
      </View>

      <Goban
        position={mode === 'repro' ? states[Math.min(cursor, states.length - 1)].board : states[shown].board}
        lastMove={mode === 'repro' ? (cursor > 0 ? states[cursor].at : null) : states[shown].at}
        marks={mode === 'repro'
          ? (wrongAt != null ? [{ at: wrongAt, label: '✕', kind: 'bad' }] : [])
          : marks}
        onPoint={mode === 'repro' ? handleReproTap : undefined}
      />

      {mode === 'watch' ? (
        <>
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
          {canReproduce && (
            <Pressable style={styles.reproToggle} onPress={startRepro}>
              <Text style={styles.reproToggleText}>{t('reproduce_line')}</Text>
            </Pressable>
          )}
        </>
      ) : (
        <View style={styles.reproPanel}>
          <Text style={[
            styles.reproStatus,
            wrongAt != null && styles.reproStatusBad,
            reproDone && styles.reproStatusOk,
          ]}>
            {reproDone
              ? t('reproduce_done')
              : wrongAt != null
                ? t('reproduce_wrong')
                : t('reproduce_your_move', { done: cursor, total: reproTarget })}
          </Text>
          <View style={styles.reproControls}>
            {reproDone ? (
              <Pressable style={styles.btn} onPress={startRepro}>
                <Text style={styles.btnText}>{t('reproduce_again')}</Text>
              </Pressable>
            ) : wrongCount >= 2 ? (
              <Pressable style={styles.btn} onPress={showNextMove}>
                <Text style={styles.btnText}>{t('reproduce_show_next')}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.btn} onPress={stopRepro}>
              <Text style={styles.btnText}>{t('reproduce_watch')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.info}>
        {descText !== '' && (
          <Text style={styles.infoDesc}>{descText}</Text>
        )}
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
  reproToggle: {
    alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(154,120,255,0.45)', backgroundColor: 'rgba(122,92,255,0.12)',
  },
  reproToggleText: { fontSize: 14, color: '#C5BBF0', fontWeight: '600' },
  reproPanel: { gap: 10, alignItems: 'center' },
  reproStatus: { fontSize: 16, fontFamily: 'Playfair', color: '#EFECE7' },
  reproStatusBad: { color: '#C96F5A' },
  reproStatusOk: { color: '#8FBF9E' },
  reproControls: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  info: { gap: 4 },
  infoDesc: { fontSize: 14.5, lineHeight: 20, color: '#E8E6E3', marginBottom: 2 },
  infoText: { fontSize: 15, color: '#8E8B85' },
  infoNote: { fontSize: 13, color: '#8E8B85' },
  lockPage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  lockTitle: { fontSize: 22, fontWeight: '500', textAlign: 'center', color: '#EFECE7', fontFamily: 'Playfair' },
  lockText: { fontSize: 15, color: '#8E8B85', textAlign: 'center', lineHeight: 22 },
});

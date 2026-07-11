// Адаптивная сессия v2 (ТЗ v3.2): лестница подсказок H0–H4 по текущему
// узлу, лог ошибок с весами, «Не могу» -> активный разбор -> обязательное
// воспроизведение, placement-калибровка первых 8 эпизодов.
// Эпизод записывается РОВНО один раз: решил сам / пропустил / посмотрел
// решение (после попытки воспроизведения).

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import Goban, { GhostStone, ViewRect } from '../components/Goban';
import {
  startSession, playUserMove, clearWrong, viewRect,
  weightedWrongCount, hintMoveAt, hintStructure, hintCandidates,
} from '../engine/tsumego';
import { play as boardPlay, sgfToIdx } from '../engine/board';
import { relativeLabel } from '../engine/adaptive2';
import {
  nextEpisode, recordEpisode, domainLabels, useTrainingProfile,
  placementState, EpisodeOutcome, problemById, sectionProblems,
} from '../state/trainingStats';
import { recordAttempt } from '../state/tsumegoProgress';
import { soundForMove, playStone } from '../sound/stones';
import MistBackground from '../components/MistBackground';
import PrimaryButton from '../components/PrimaryButton';
import HintBulb from '../components/HintBulb';
import hintTemplates from '../data/hintTemplates.json';
import { useI18n, Lang } from '../i18n';
import { categoryKey, sectionKey } from '../data/catalog';

const GOAL_KEY: Record<string, string> = {
  capture: 'goal_capture',
  'ld-live': 'goal_ld_live',
  'ld-kill': 'goal_ld_kill',
  ko: 'goal_ko',
  race: 'goal_race',
  connect: 'goal_connect',
};

// Подпись кнопки «Намёк»: ТИП следующей ступени — сохраняет чувство
// контроля (игрок знает, что именно раскроет).
const RUNG_BUTTON_KEY: string[] = [
  'rung_h0', 'rung_h1', 'rung_h2', 'rung_h3', 'rung_h4',
];

type Walkthrough = { boards: string[]; step: number } | null;

// Шаблоны домена, спроецированные на язык: каждый текст в JSON —
// объект {ru,en,es,fr,de,ko}.
function domainTemplates(domain: string, lang: Lang) {
  const d = (hintTemplates as any).domains;
  const raw = d[domain] ?? d['ld-live'];
  const L = (v: any) => (typeof v === 'string' ? v : v[lang] ?? v.en ?? v.ru);
  return {
    h0: raw.h0.map((x: any) => ({ text: L(x.text), cap: x.cap })),
    h1Fallback: L(raw.h1Fallback),
    h2: raw.h2.map((x: any) => ({ text: L(x.text), slots: x.slots })),
    h4Reason: raw.h4Reason.map(L),
    h4RefutePrefix: L(raw.h4RefutePrefix),
  };
}

/** Стабильный «случайный» индекс по id задачи. */
function hashPick(id: string, len: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h) % Math.max(1, len);
}

/** Доски главной линии для разбора (позиция после каждого хода). */
function mainLineBoards(problem: any): string[] {
  const size = problem.size || 9;
  let node = (problem.tree || []).find((n: any) => n.tag !== 'wrong') || null;
  const boards = [problem.board];
  let b = problem.board;
  while (node) {
    const r = boardPlay(b, sgfToIdx(node.at, size), node.by);
    if (!r) break;
    b = r.board;
    boards.push(b);
    node = (node.children || [])[0] || null;
  }
  return boards;
}

export default function TrainingSessionScreen(
  { navigation, route }: { navigation: any; route?: any }
) {
  const { t, lang } = useI18n();
  // Игрок мог выбрать конкретную тему на радаре/в прогрессе — тогда сессия
  // подаёт задачи только этого домена (под его уровень), запись общая.
  const pickedDomain: string | null = route?.params?.domain ?? null;
  // Каталог (Д11/Д12): та же логика эпизода, но задачи берутся из выбранного
  // раздела по порядку, а не подбором. Первая встреча тоже rated (§2).
  const catalogMode: boolean = route?.params?.source === 'catalog';
  const catCat: string | null = route?.params?.categoryId ?? null;
  const catSec: string | null = route?.params?.sectionId ?? null;
  const catStartId: string | null = route?.params?.problemId ?? null;
  const catalogList = useMemo(
    () => (catalogMode && catCat && catSec ? sectionProblems(catCat, catSec) : []),
    [catalogMode, catCat, catSec]
  );
  const catIdx = useRef(0);
  const profile = useTrainingProfile();
  const placement = placementState(profile);

  const [problem, setProblem] = useState<any | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [rung, setRung] = useState<number | null>(null); // макс. открытая ступень
  const [hintText, setHintText] = useState<string | null>(null);
  const [h3Missing, setH3Missing] = useState(false);
  const [cantChoice, setCantChoice] = useState(false);   // «Не могу»: выбор
  const [walk, setWalk] = useState<Walkthrough>(null);
  const [reproducing, setReproducing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sessionSolved, setSessionSolved] = useState(0);
  const [sessionPoints, setSessionPoints] = useState(0);

  const h0CapUsed = useRef<number | undefined>(undefined);
  const sawSolutionRef = useRef(false);
  const recorded = useRef(false);

  // Сброс per-episode состояния + загрузка конкретной задачи.
  const loadProblem = useCallback((p: any) => {
    recorded.current = false;
    sawSolutionRef.current = false;
    h0CapUsed.current = undefined;
    setRung(null); setHintText(null); setH3Missing(false);
    setCantChoice(false); setWalk(null); setReproducing(false);
    setFeedback(null); setExhausted(false);
    setProblem(p);
    setSession(startSession(p));
  }, []);

  // Тренажёр: следующую задачу выбирает движок (с учётом выбранной темы).
  const serveTrainer = useCallback(async () => {
    const p = await nextEpisode(pickedDomain);
    if (!p) { setExhausted(true); setProblem(null); return; }
    loadProblem(p);
  }, [pickedDomain, loadProblem]);

  // Каталог: идём по разделу подряд от выбранной задачи (Д11).
  const advanceCatalog = useCallback((idx: number) => {
    const p = catalogList[idx];
    if (!p) { setExhausted(true); setProblem(null); return; }
    catIdx.current = idx;
    loadProblem(p);
  }, [catalogList, loadProblem]);

  // Единый переход «дальше» — знает про режим (тренажёр / каталог).
  const goNext = useCallback(() => {
    if (catalogMode) advanceCatalog(catIdx.current + 1);
    else serveTrainer();
  }, [catalogMode, advanceCatalog, serveTrainer]);

  // Инициализация / переинициализация при смене темы или каталожной задачи.
  useEffect(() => {
    if (catalogMode) {
      const i = Math.max(0, catalogList.findIndex((p) => p.id === catStartId));
      advanceCatalog(i);
    } else {
      serveTrainer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogMode, catStartId, pickedDomain]);

  // Каталожная шапка: раздел вместо родового «Тренировка».
  useEffect(() => {
    if (catalogMode && catCat && catSec) {
      navigation.setOptions({
        title: `${t(categoryKey(catCat))} · ${t(sectionKey(catCat, catSec))}`,
      });
    }
  }, [catalogMode, catCat, catSec, navigation, t]);

  const tpl = useMemo(
    () => (problem ? domainTemplates(problem.domain, lang) : null),
    [problem, lang]
  );

  /** Открыть ступень лестницы. auto=true — бесплатный авто-H0. */
  const applyRung = useCallback((target: number, auto = false) => {
    if (!problem || !tpl) return;
    if (target === 0) {
      const pick = tpl.h0[hashPick(problem.id, tpl.h0.length)];
      setHintText(pick.text);
      if (pick.cap < 1) h0CapUsed.current = pick.cap;
      setRung((r) => (r == null ? 0 : r));
      return;
    }
    if (target === 1) {
      const s = hintStructure(problem);
      setHintText(s ? t('hint_zone') : tpl.h1Fallback);
      setRung(1);
      return;
    }
    if (target === 2) {
      const noSlot = tpl.h2.find((h: any) => !h.slots?.length) ?? tpl.h2[0];
      setHintText(noSlot.text);
      setRung(2);
      return;
    }
    if (target === 3) {
      setSession((s: any) => {
        const cands = s ? hintCandidates(s) : null;
        if (!cands) {
          // Деградация (Д3): кандидатов нет — направляющий вопрос;
          // ступень H3 не тратится, потолок остаётся H2.
          setH3Missing(true);
          const alt = tpl.h0[(hashPick(problem.id, tpl.h0.length) + 1) % tpl.h0.length];
          setHintText(t('hint_no_candidates', { q: alt.text }));
        } else {
          setHintText(t('hint_candidates'));
          setRung(3);
        }
        return s;
      });
      return;
    }
    setHintText(
      tpl.h4Reason[hashPick(problem.id, tpl.h4Reason.length)]
        .replace('{move}', t('hint_move_label'))
    );
    setRung(4);
  }, [problem, tpl, t]);

  // Вспышка ошибки -> откат; после ПЕРВОЙ содержательной ошибки — авто-H0
  // (бесплатный диагностический вопрос, §2.1/§5).
  useEffect(() => {
    if (!session || session.status !== 'wrong') return;
    const auto = rung == null && weightedWrongCount(session) > 0;
    const t = setTimeout(() => {
      setSession((s: any) => clearWrong(s));
      if (auto) applyRung(0, true);
    }, 900);
    return () => clearTimeout(t);
  }, [session, rung, applyRung]);

  const finishEpisode = useCallback(async (outcome: EpisodeOutcome) => {
    if (!problem || recorded.current) return null;
    recorded.current = true;
    recordAttempt(problem.id, outcome.solved || Boolean(outcome.reproduced));
    const res = await recordEpisode(problem, {
      ...outcome, source: catalogMode ? 'catalog' : 'trainer',
    });
    if (outcome.solved) setSessionSolved((n) => n + 1);
    if (res.pointsGained) setSessionPoints((n) => n + res.pointsGained);
    const rate = placement.active
      ? t('fb_calibration', { step: Math.min(placement.step + 1, placement.total), total: placement.total })
      : res.ratingDelta
        ? t('fb_rating_delta', { delta: `${res.ratingDelta > 0 ? '+' : ''}${res.ratingDelta}`, rating: res.auser })
        : t('fb_rating', { rating: res.auser });
    setFeedback(
      outcome.solved
        ? t('fb_solved', { points: res.pointsGained, rate })
        : outcome.reproduced
          ? t('fb_reproduced', { points: res.pointsGained })
          : t('fb_failed', { rate })
    );
    return res;
  }, [problem, placement, catalogMode, t]);

  // Терминал обычного решения: записать эпизод один раз.
  useEffect(() => {
    if (!session || !problem || recorded.current || walk) return;
    if (session.status !== 'solved') return;
    if (reproducing) {
      finishEpisode({
        solved: false, // сам не решил (Q=0), но разбор воспроизведён
        weightedWrongCount: weightedWrongCount(session),
        hintRung: rung, sawSolution: true, reproduced: true,
      });
    } else {
      finishEpisode({
        solved: true,
        weightedWrongCount: weightedWrongCount(session),
        hintRung: rung,
        h0Cap: h0CapUsed.current,
        sawSolution: sawSolutionRef.current,
      });
    }
  }, [session, problem, walk, reproducing, rung, finishEpisode]);

  const view = useMemo(() => (problem ? viewRect(problem) : null), [problem]);

  // --- разбор решения (worked example) ---
  const startWalkthrough = () => {
    if (!problem) return;
    sawSolutionRef.current = true;
    setCantChoice(false);
    setHintText(null);
    setWalk({ boards: mainLineBoards(problem), step: 0 });
  };
  const walkNext = () => {
    setWalk((w) => {
      if (!w) return w;
      if (w.step + 1 < w.boards.length) {
        playStone(0);
        return { ...w, step: w.step + 1 };
      }
      return w;
    });
  };
  const startReproduce = () => {
    setWalk(null);
    setReproducing(true);
    setRung(null);
    setHintText(null);
    setSession(startSession(problem));
  };
  const giveUpAfterWalk = async () => {
    await finishEpisode({
      solved: false,
      weightedWrongCount: session ? weightedWrongCount(session) : 0,
      hintRung: rung, sawSolution: true, reproduced: false,
    });
    goNext();
  };

  const skipProblem = async () => {
    await finishEpisode({
      solved: false,
      weightedWrongCount: session ? weightedWrongCount(session) : 0,
      hintRung: rung,
      sawSolution: sawSolutionRef.current,
    });
    goNext();
  };

  // «Ещё раз»: тот же эпизод, лог ошибок сохраняется (§6).
  const retrySameEpisode = () => {
    if (!problem) return;
    const prevLog = session?.wrongLog ?? [];
    const s: any = startSession(problem);
    s.wrongLog = prevLog;
    setSession(s);
  };

  const nextRungTarget = (): number => {
    if (rung == null) return 0;
    if (rung === 2 && h3Missing) return 4;
    return Math.min(4, rung + 1);
  };

  // Слои подсказок на доске (до раннего return — хуки выше условий).
  const zone: ViewRect | null =
    problem && !walk && rung != null && rung >= 1
      ? (hintStructure(problem)?.zone ?? null)
      : null;
  const ghosts: GhostStone[] = useMemo(() => {
    if (!problem || !session || walk || session.status !== 'playing') return [];
    if (rung === 3) {
      const cands = hintCandidates(session);
      if (cands) {
        const pts = [...cands.correctAts.slice(0, 1), ...cands.decoyAts];
        const rot = hashPick(problem.id, pts.length);
        const shuffled = [...pts.slice(rot), ...pts.slice(0, rot)];
        return shuffled.map((at) => ({ at, color: problem.to_move, label: '?' }));
      }
    }
    if (rung === 4) {
      const at = hintMoveAt(session);
      if (at != null) return [{ at, color: problem.to_move, label: '★' }];
    }
    return [];
  }, [problem, session, walk, rung]);

  if (exhausted) {
    const doneText = catalogMode
      ? t('catalog_section_done')
      : pickedDomain
        ? t('training_done_domain', { domain: t(domainLabels[pickedDomain] ?? pickedDomain) })
        : t('training_done');
    return (
      <View style={styles.donePage}>
        <MistBackground />
        <Text style={styles.doneTitle}>{doneText}</Text>
        <PrimaryButton
          label={catalogMode ? t('btn_back_catalog') : t('to_stats')}
          dome={false}
          onPress={() => navigation.goBack()}
        />
      </View>
    );
  }
  if (!problem || !session) return null;

  const terminal = session.status === 'solved' || session.status === 'refuted';
  const solvedNow = session.status === 'solved';
  const board = walk ? walk.boards[walk.step] : session.board;
  const last = walk
    ? null
    : session.wrongAt != null
      ? session.wrongAt
      : session.moves.length ? session.moves[session.moves.length - 1].at : null;

  const goalText = t(GOAL_KEY[problem.domain] ?? 'goal_default');
  const statusText = walk
    ? walk.step === 0
      ? t('walk_intro', { goal: goalText })
      : walk.step + 1 >= walk.boards.length
        ? t('walk_done')
        : t('walk_step', { n: walk.step, m: walk.boards.length - 1 })
    : session.status === 'wrong'
      ? t('status_wrong')
      : session.status === 'refuted'
        ? t('status_refuted')
        : solvedNow
          ? reproducing ? t('status_reproduced') : t('status_solved')
          : reproducing
            ? t('status_reproduce')
            : `${t(problem.to_move === 'b' ? 'to_move_black' : 'to_move_white')} ${goalText}`;

  return (
    <View style={styles.screen}>
      <MistBackground />
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topRow}>
          <Text style={[styles.domainChip, pickedDomain ? styles.domainChipFocused : null]}>
            {pickedDomain ? '◆ ' : ''}{t(domainLabels[problem.domain] ?? problem.domain)}
          </Text>
          {placement.active ? (
            <Text style={styles.placementChip}>
              {t('chip_calibration', { step: Math.min(placement.step + 1, placement.total), total: placement.total })}
            </Text>
          ) : (
            <Text style={styles.sessionMeta}>
              {profile ? `${t(relativeLabel(profile, problem))} · ` : ''}{t('meta_solved', { n: sessionSolved, p: sessionPoints })}
            </Text>
          )}
        </View>

        <Goban
          position={board}
          size={session.size}
          view={view ?? undefined}
          lastMove={last}
          zone={zone}
          ghosts={ghosts}
          onPoint={(at) => {
            if (walk) { walkNext(); return; }
            setSession((s: any) => {
              const n = playUserMove(s, at);
              if (n.board !== s.board) {
                soundForMove(s.board, n.board, n.moves.length - s.moves.length);
              }
              return n;
            });
          }}
          disabled={terminal && !walk}
        />

        <View style={styles.turnCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.turnEyebrow}>
              {walk ? t('eyebrow_walk') : reproducing ? t('eyebrow_reproduce') : t('your_move')}
            </Text>
            <Text style={[
              styles.status,
              solvedNow && styles.ok,
              (session.status === 'wrong' || session.status === 'refuted') && !walk && styles.bad,
            ]}>
              {statusText}
            </Text>
            {hintText && !walk && session.status === 'playing' && (
              <Text style={styles.hintText}>{hintText}</Text>
            )}
            {feedback && <Text style={styles.feedback}>{feedback}</Text>}
            {placement.active && !walk && session.status === 'playing' && (
              <Text style={styles.warn}>{t('placement_hint_warn')}</Text>
            )}
          </View>
          {!walk && !terminal && !cantChoice && rung !== 4 && session.status === 'playing' && (
            <Pressable style={styles.hintBtn} onPress={() => applyRung(nextRungTarget())}>
              <HintBulb />
              <Text style={styles.hintBtnText}>{t(RUNG_BUTTON_KEY[nextRungTarget()])}</Text>
            </Pressable>
          )}
        </View>

        {cantChoice && !walk && (
          <View style={styles.cantRow}>
            <Pressable style={styles.btn} onPress={() => { setCantChoice(false); applyRung(nextRungTarget()); }}>
              <Text style={styles.btnText}>{t('btn_more_hint')}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnAccent]} onPress={startWalkthrough}>
              <Text style={styles.btnText}>{t('btn_walkthrough')}</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.spacer} />
        <View style={styles.controls}>
          {walk ? (
            walk.step + 1 >= walk.boards.length ? (
              <>
                <PrimaryButton label={t('btn_reproduce_now')} dome={false} onPress={startReproduce} style={styles.nextBtn} />
                <Pressable style={styles.btn} onPress={giveUpAfterWalk}>
                  <Text style={styles.btnText}>{t('btn_onward')}</Text>
                </Pressable>
              </>
            ) : (
              <PrimaryButton label={t('btn_next_move')} dome={false} onPress={walkNext} style={styles.nextBtn} />
            )
          ) : terminal && recorded.current ? (
            <PrimaryButton label={t('btn_next_problem')} dome={false} onPress={goNext} style={styles.nextBtn} />
          ) : session.status === 'refuted' ? (
            <>
              <Pressable style={styles.btn} onPress={retrySameEpisode}>
                <Text style={styles.btnText}>{t('btn_retry')}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => setCantChoice(true)}>
                <Text style={styles.btnText}>{t('btn_cant')}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={skipProblem}>
                <Text style={styles.btnText}>{t('btn_skip')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable style={styles.btn} onPress={retrySameEpisode}>
                <Text style={styles.btnText}>{t('btn_again')}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => setCantChoice(true)}>
                <Text style={styles.btnText}>{t('btn_cant')}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={skipProblem}>
                <Text style={styles.btnText}>{t('btn_skip')}</Text>
              </Pressable>
              <Pressable style={styles.btn} onPress={() => navigation.goBack()}>
                <Text style={styles.btnText}>{t('btn_finish')}</Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { padding: 16, gap: 12, flexGrow: 1 },
  spacer: { flex: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  domainChip: {
    fontSize: 11, fontWeight: '600', color: '#F2EFEA',
    letterSpacing: 1.4, textTransform: 'uppercase',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)', borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 13, overflow: 'hidden',
  },
  domainChipFocused: {
    color: '#F1EDF9', backgroundColor: 'rgba(122,92,255,0.20)',
    borderColor: 'rgba(154,120,255,0.55)',
  },
  placementChip: {
    fontSize: 11, fontWeight: '700', color: '#0F0E12',
    letterSpacing: 1.2, textTransform: 'uppercase',
    backgroundColor: '#C5BBF0', borderRadius: 999,
    paddingVertical: 5, paddingHorizontal: 13, overflow: 'hidden',
  },
  sessionMeta: { fontSize: 13, color: '#8E8B85', fontVariant: ['tabular-nums'] },
  turnCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(6,6,7,0.40)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 16, padding: 14,
  },
  turnEyebrow: {
    fontSize: 10, fontWeight: '600', letterSpacing: 2.2,
    textTransform: 'uppercase', color: '#A3A0F0',
  },
  status: { fontSize: 17, fontFamily: 'Playfair', minHeight: 24, color: '#EFECE7', marginTop: 6 },
  ok: { color: '#C5BBF0' },
  bad: { color: '#C96F5A' },
  hintText: { marginTop: 8, fontSize: 14.5, lineHeight: 20, color: '#F0A878' },
  feedback: { marginTop: 8, fontSize: 14, color: '#C5BBF0', fontWeight: '600' },
  warn: { marginTop: 6, fontSize: 12, color: '#C96F5A' },
  hintBtn: {
    paddingVertical: 12, paddingHorizontal: 15, borderRadius: 13,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center', gap: 5, minWidth: 86,
  },
  hintBtnText: { color: '#A79AF5', fontSize: 12.5, textAlign: 'center' },
  cantRow: { flexDirection: 'row', gap: 8 },
  controls: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  btn: {
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  btnAccent: { borderColor: '#8B7CF6', backgroundColor: 'rgba(139,124,246,0.08)' },
  btnText: { fontSize: 14, color: '#F2EFEA' },
  nextBtn: { paddingVertical: 12, paddingHorizontal: 22, marginTop: 0 },
  donePage: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  doneTitle: { fontSize: 22, fontWeight: '500', textAlign: 'center', color: '#EFECE7', fontFamily: 'Playfair' },
});

// Persistent adaptive-training profile — v2, два контура (ТЗ v3.2).
// Тонкая AsyncStorage-обёртка вокруг engine/adaptive2.js с live-хуком.
// Сессия: холодный старт приложения или пауза >= 30 минут (§7).

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  newProfile, startSession as startSessionCore, recordEpisode as recordCore,
  pickNext, levelLabel, relativeLabel, ptargetEff, DEFAULT_RATING,
  PLACEMENT_EPISODES,
} from '../engine/adaptive2';
import db from '../data/tsumego.json';

// v3: старт «с самого низа» без placement — профили v2 (середина шкалы +
// калибровка) сознательно не мигрируем, чистый старт новичком.
const KEY = 'training.v3';
const SESSION_GAP_MS = 30 * 60 * 1000;

export interface EpisodeOutcome {
  solved: boolean;
  weightedWrongCount: number;
  hintRung: number | null; // 0..4 = H0..H4
  h0Cap?: number;          // 0.9 для сужающих H0-шаблонов
  sawSolution?: boolean;
  reproduced?: boolean;
  source?: 'trainer' | 'catalog' | 'placement'; // Д11: откуда эпизод
}

export interface EpisodeResult {
  qR: number | null;
  qL: number;
  ratingDelta: number;
  pointsGained: number;
  auser: number;
}

// Профиль v2 — форма из adaptive2.newProfile() + lastActiveAt + стрик дней.
export type TrainingProfile = ReturnType<typeof newProfile> & {
  lastActiveAt?: number;
  streakDays?: number;   // подряд дней с >=1 эпизодом
  streakStamp?: string;  // YYYY-MM-DD последнего дня с эпизодом
};

function dayStamp(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bumpStreak(profile: TrainingProfile) {
  const today = dayStamp();
  if (profile.streakStamp === today) return;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  profile.streakDays = profile.streakStamp === dayStamp(y) ? (profile.streakDays ?? 0) + 1 : 1;
  profile.streakStamp = today;
}

let cache: TrainingProfile | null = null;
const listeners = new Set<() => void>();

export const trainingPool = () =>
  (db.problems as any[]).filter((p) => p.tree && p.tree.length > 0);

/** Конкретная задача по id (только из проверяемого пула). Каталог (Д11)
    открывает её тем же экраном эпизода, что и тренажёр. */
export const problemById = (id: string): any | null =>
  trainingPool().find((p) => p.id === id) ?? null;

/** Задачи одного раздела каталога (для перехода «дальше» внутри раздела). */
export const sectionProblems = (categoryId: string, sectionId: string): any[] =>
  trainingPool().filter((p) => p.category === categoryId && p.section === sectionId);

// Домены — i18n-ключи (переводы в strings.json); русские имена из db.domains
// больше не используются напрямую.
export const domainLabels: Record<string, string> = {
  capture: 'domain_capture',
  'ld-live': 'domain_ld_live',
  'ld-kill': 'domain_ld_kill',
  ko: 'domain_ko',
  race: 'domain_race',
  connect: 'domain_connect',
};

function touchSession(profile: TrainingProfile): TrainingProfile {
  const now = Date.now();
  if (!profile.lastActiveAt || now - profile.lastActiveAt > SESSION_GAP_MS) {
    startSessionCore(profile); // сбрасывает лимит повторов на сессию
  }
  profile.lastActiveAt = now;
  return profile;
}

async function load(): Promise<TrainingProfile> {
  if (cache) return touchSession(cache);
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as TrainingProfile) : (newProfile() as TrainingProfile);
  } catch {
    cache = newProfile() as TrainingProfile;
  }
  return touchSession(cache);
}

async function save(): Promise<void> {
  if (!cache) return;
  listeners.forEach((fn) => fn());
  await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
}

export async function getProfile(): Promise<TrainingProfile> {
  return load();
}

/** Подать следующую задачу (гейт повторов -> utility).
    domain — если игрок сам выбрал область на радаре/в прогрессе, подаём
    только задачи этого домена под его уровень; запись в профиль общая. */
export async function nextEpisode(domain?: string | null): Promise<any | null> {
  const profile = await load();
  const p = pickNext(profile, trainingPool(), (domain ?? null) as any);
  await save();
  return p;
}

/** Записать завершённый эпизод (один раз на задачу-эпизод). */
export async function recordEpisode(
  problem: any,
  outcome: EpisodeOutcome
): Promise<EpisodeResult> {
  const profile = await load();
  const res = recordCore(profile, problem, outcome);
  bumpStreak(profile);
  await save();
  return res as EpisodeResult;
}

/** Дней подряд с занятиями; 0, если стрик прерван (вчера и сегодня пусто). */
export function streakDays(profile: TrainingProfile | null): number {
  if (!profile?.streakDays || !profile.streakStamp) return 0;
  const today = dayStamp();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return profile.streakStamp === today || profile.streakStamp === dayStamp(y)
    ? profile.streakDays
    : 0;
}

/** Placement ещё идёт? Номер эпизода калибровки. */
export function placementState(profile: TrainingProfile | null) {
  if (!profile) return { active: false, step: 0, total: PLACEMENT_EPISODES };
  return {
    active: !profile.placement.done,
    step: profile.placement.step,
    total: PLACEMENT_EPISODES,
  };
}

export { levelLabel, relativeLabel, ptargetEff, DEFAULT_RATING };

export interface DomainStat {
  domain: string;
  label: string;
  rating: number;   // v1: ability = Auser (domainOffset ≡ 0) — общий рейтинг
  level: string;
  attempts: number;
  solved: number;
  total: number;
  mastery: number;  // EWMA Q_learning — аналитика контура 2
}

export function domainStats(profile: TrainingProfile): DomainStat[] {
  const pool = trainingPool();
  const domains = [...new Set(pool.map((p) => p.domain ?? 'ld-live'))];
  const rating = Math.round((profile as any).auser ?? DEFAULT_RATING);
  return domains.map((d) => {
    const ids = pool.filter((p) => (p.domain ?? 'ld-live') === d).map((p) => p.id);
    const recs = ids
      .map((id) => (profile.problems as any)[id])
      .filter(Boolean);
    const solved = recs.filter((r: any) => r.solved).length;
    return {
      domain: d,
      label: domainLabels[d] ?? d,
      rating,
      level: levelLabel(rating),
      attempts: recs.reduce((a: number, r: any) => a + (r.tries || 0), 0),
      solved,
      total: ids.length,
      mastery: (profile.skillM as any)[d] ?? 0.6,
    };
  }).sort((a, b) => a.mastery - b.mastery);
}

/** Live profile for dashboards; re-renders after every recordEpisode. */
export function useTrainingProfile(): TrainingProfile | null {
  const [state, setState] = useState<TrainingProfile | null>(cache);
  const refresh = useCallback(() => setState(cache ? { ...cache } : null), []);
  useEffect(() => {
    let alive = true;
    load().then(() => { if (alive) refresh(); });
    listeners.add(refresh);
    return () => { alive = false; listeners.delete(refresh); };
  }, [refresh]);
  return state;
}

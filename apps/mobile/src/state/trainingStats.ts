// Persistent adaptive-training profile (ratings, points, schedule).
// Thin AsyncStorage wrapper around src/engine/adaptive.js with a live hook.

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  initialProfile, applyResult, pickNext, ratingOf, levelLabel,
} from '../engine/adaptive';
import db from '../data/tsumego.json';

const KEY = 'training.v1';

export interface TrainingProfile {
  ratings: Record<string, number>;
  domainAttempts: Record<string, number>;
  problems: Record<string, { tries: number; fails: number; solved: boolean; dueAt: number | null }>;
  counter: number;
  points: number;
  solved: number;
  failed: number;
  lastDomains: string[];
}

let cache: TrainingProfile | null = null;
const listeners = new Set<() => void>();

export const trainingPool = () =>
  (db.problems as any[]).filter((p) => p.tree && p.tree.length > 0);

export const domainLabels: Record<string, string> = (db as any).domains ?? {};

async function load(): Promise<TrainingProfile> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as TrainingProfile) : (initialProfile() as TrainingProfile);
  } catch {
    cache = initialProfile() as TrainingProfile;
  }
  return cache;
}

async function save(): Promise<void> {
  if (!cache) return;
  listeners.forEach((fn) => fn());
  await AsyncStorage.setItem(KEY, JSON.stringify(cache)).catch(() => {});
}

export async function getProfile(): Promise<TrainingProfile> {
  return load();
}

export async function nextProblem(): Promise<any | null> {
  const profile = await load();
  const p = pickNext(profile, trainingPool());
  await save();
  return p;
}

export async function recordResult(
  problem: any,
  solved: boolean,
  firstTry: boolean
): Promise<{ ratingDelta: number; pointsGained: number; newRating: number }> {
  const profile = await load();
  const res = applyResult(profile, problem, solved, firstTry);
  await save();
  return res;
}

export interface DomainStat {
  domain: string;
  label: string;
  rating: number;
  level: string;
  attempts: number;
  solved: number;
  total: number;
}

export function domainStats(profile: TrainingProfile): DomainStat[] {
  const pool = trainingPool();
  const domains = [...new Set(pool.map((p) => p.domain ?? 'ld-live'))];
  return domains.map((d) => {
    const ids = pool.filter((p) => (p.domain ?? 'ld-live') === d).map((p) => p.id);
    const solved = ids.filter((id) => profile.problems[id]?.solved).length;
    const rating = ratingOf(profile, d);
    return {
      domain: d,
      label: domainLabels[d] ?? d,
      rating,
      level: levelLabel(rating),
      attempts: profile.domainAttempts[d] ?? 0,
      solved,
      total: ids.length,
    };
  }).sort((a, b) => a.rating - b.rating);
}

/** Live profile for dashboards; re-renders after every recordResult. */
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

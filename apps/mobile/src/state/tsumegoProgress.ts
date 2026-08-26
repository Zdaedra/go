// Per-problem progress, persisted on the device. Ready to sync through
// the backend /progress endpoint later (same JSON shape).

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tsumegoProgress.v1';

export interface ProblemProgress {
  solved: boolean;
  attempts: number;
}

export type ProgressMap = Record<string, ProblemProgress>;

let cache: ProgressMap | null = null;
const listeners = new Set<() => void>();

async function load(): Promise<ProgressMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as ProgressMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function save(next: ProgressMap): Promise<void> {
  cache = next;
  listeners.forEach((fn) => fn());
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}

export async function recordAttempt(problemId: string, solved: boolean): Promise<void> {
  const map = { ...(await load()) };
  const cur = map[problemId] ?? { solved: false, attempts: 0 };
  map[problemId] = { solved: cur.solved || solved, attempts: cur.attempts + 1 };
  await save(map);
}

/** Live progress map for screens; re-renders on every recordAttempt. */
export function useProgress(): ProgressMap {
  const [state, setState] = useState<ProgressMap>(cache ?? {});
  const refresh = useCallback(() => setState({ ...(cache ?? {}) }), []);
  useEffect(() => {
    let alive = true;
    load().then((m) => { if (alive) setState({ ...m }); });
    listeners.add(refresh);
    return () => { alive = false; listeners.delete(refresh); };
  }, [refresh]);
  return state;
}

export function sectionStats(
  progress: ProgressMap,
  problemIds: string[]
): { solved: number; total: number } {
  let solved = 0;
  for (const id of problemIds) if (progress[id]?.solved) solved++;
  return { solved, total: problemIds.length };
}

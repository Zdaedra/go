import { useEffect, useState } from 'react';
import { getTrialInfo, TrialInfo } from './usage';
import { useAuth } from './AuthContext';

export interface Access {
  /** Free features are usable: pro plan, or trial still running. */
  open: boolean;
  trial: TrialInfo | null;
  pro: boolean;
}

/** Access gate: pro users always pass; free users pass while the 7-day
 *  trial is active. Re-evaluated when the screen using it re-mounts. */
export function useAccess(): Access {
  const auth = useAuth();
  const [trial, setTrial] = useState<TrialInfo | null>(null);
  useEffect(() => {
    let alive = true;
    getTrialInfo().then((t) => { if (alive) setTrial(t); });
    return () => { alive = false; };
  }, []);
  const pro = auth.plan === 'pro';
  return { pro, trial, open: pro || (trial?.active ?? true) };
}

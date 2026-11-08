import type { Attempt } from '../types';

export function moduleScore(attempts: Attempt[]): { correct: number; total: number; pct: number } {
  const total = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  return { correct, total, pct: total ? Math.round((correct / total) * 100) : 0 };
}

export type Outcome = 'right' | 'wrong' | 'skipped';

/** Skipped = left blank (often time ran out). Both wrong and skipped come back in later modules. */
export function outcome(a: Pick<Attempt, 'correct' | 'chosen'>): Outcome {
  if (a.correct) return 'right';
  return a.chosen === null ? 'skipped' : 'wrong';
}

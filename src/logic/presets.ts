import type { Difficulty, DomainGrid } from '../types';
import { DOMAINS } from '../parse/skills';

/**
 * Rough SAT-like mixes of easy/medium/hard per domain (27 questions each).
 * College Board doesn't publish exact numbers, so these are estimates.
 */
type Row = [easy: number, medium: number, hard: number];

function grid(rows: Row[]): DomainGrid {
  return Object.fromEntries(DOMAINS.map((d, i) => [d, { easy: rows[i][0], medium: rows[i][1], hard: rows[i][2] }]));
}

export interface Preset { id: string; label: string; grid: DomainGrid }

// Rows follow DOMAINS: Craft and Structure, Information and Ideas, Standard English Conventions, Expression of Ideas.
export const PRESETS: Preset[] = [
  { id: 'm1', label: 'Module 1', grid: grid([[2, 3, 2], [2, 3, 2], [2, 3, 2], [1, 3, 2]]) },
  { id: 'm2-hard', label: 'Module 2 (harder)', grid: grid([[1, 2, 4], [1, 3, 3], [1, 2, 4], [0, 3, 3]]) },
  { id: 'm2-easy', label: 'Module 2 (easier)', grid: grid([[4, 2, 1], [4, 2, 1], [4, 2, 1], [3, 2, 1]]) },
];

export const PRESET_TIMER_MIN = 32;

export function gridTotal(g: DomainGrid): number {
  return DOMAINS.reduce((n, d) => n + (['easy', 'medium', 'hard'] as Difficulty[]).reduce((m, x) => m + Math.max(0, g[d]?.[x] ?? 0), 0), 0);
}

export function sameGrid(a: DomainGrid, b: DomainGrid): boolean {
  return DOMAINS.every((d) => (['easy', 'medium', 'hard'] as Difficulty[]).every((x) => (a[d]?.[x] ?? 0) === (b[d]?.[x] ?? 0)));
}

/** Fill in missing domains/difficulties (older saves) with the given defaults. */
export function mergeGrid(saved: Partial<DomainGrid> | undefined, base: DomainGrid): DomainGrid {
  return Object.fromEntries(DOMAINS.map((d) => [d, { ...base[d], ...(saved?.[d] ?? {}) }]));
}

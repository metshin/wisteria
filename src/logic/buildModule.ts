import { DIFFICULTIES, type AppData, type Difficulty, type Module, type Question } from '../types';
import { isUsable } from '../store/actions';
import { outcome } from './stats';
import { skillOf } from '../parse/skills';

/** A difficulty bucket in the builder; `none` holds questions saved without a difficulty. */
export type Level = Difficulty | 'none';
export const LEVELS: Level[] = [...DIFFICULTIES, 'none'];
export const levelOf = (q: Question): Level => q.difficulty ?? 'none';

export interface BuildOptions {
  /** `none` (optional) = questions without a difficulty. */
  counts: Record<Difficulty, number> & { none?: number };
  /** Empty = all skills. Use NO_SKILL to pick questions without a skill. */
  skills: string[];
  timerMin: number;
  /** How many wrong-answer questions may come back in this module. */
  reviewMax: number;
  /** Build even if there aren't enough unseen questions (gives fewer). */
  allowShort?: boolean;
}

export type BuildResult =
  | { ok: true; questionIds: string[]; reviewIds: string[]; short: string[] }
  | { ok: false; short: string[] };

/** Bluebook orders Reading & Writing questions by domain. */
const DOMAIN_ORDER = ['Craft and Structure', 'Information and Ideas', 'Standard English Conventions', 'Expression of Ideas'];

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function domainRank(q: Question): number {
  const i = DOMAIN_ORDER.indexOf(q.domain ?? '');
  return i < 0 ? DOMAIN_ORDER.length : i;
}

/**
 * Pick questions for a new module:
 * 1. wrong answers waiting to be retried (up to reviewMax; these repeat on purpose),
 * 2. then unseen questions matching the skill filter, per difficulty.
 * Seen questions never come back otherwise (retests copy a module instead).
 */
export function buildModule(data: AppData, opts: BuildOptions, rng: () => number = Math.random): BuildResult {
  const matches = (q: Question) => isUsable(q) && (!opts.skills.length || opts.skills.includes(skillOf(q)));
  const total = LEVELS.reduce((n, d) => n + Math.max(0, opts.counts[d] ?? 0), 0);
  if (total === 0) return { ok: false, short: ['Choose at least one question.'] };

  const review = data.wrongQueue
    .map((id) => data.questions[id])
    .filter((q): q is Question => !!q && matches(q))
    .slice(0, Math.min(opts.reviewMax, total));

  // Review questions use up slots of their own difficulty first, then the biggest remaining bucket.
  const need: Record<Level, number> = { hard: opts.counts.hard, medium: opts.counts.medium, easy: opts.counts.easy, none: opts.counts.none ?? 0 };
  for (const q of review) {
    const d = need[levelOf(q)] > 0 ? levelOf(q) : LEVELS.reduce((a, b) => (need[b] > need[a] ? b : a));
    need[d] = Math.max(0, need[d] - 1);
  }

  const seen = new Set(data.seen);
  const queued = new Set(data.wrongQueue);
  const picked: Question[] = [];
  const short: string[] = [];
  const skillText = opts.skills.length ? ` for ${opts.skills.join(', ')}` : '';
  for (const d of LEVELS) {
    if (need[d] <= 0) continue;
    const pool = Object.values(data.questions).filter((q) => levelOf(q) === d && matches(q) && !seen.has(q.id) && !queued.has(q.id));
    if (pool.length < need[d]) short.push(`Only ${pool.length} unseen ${d === 'none' ? 'no-level' : d} question${pool.length === 1 ? '' : 's'} left${skillText} (you asked for ${need[d]}).`);
    picked.push(...shuffle(pool, rng).slice(0, need[d]));
  }
  if (short.length && !opts.allowShort) return { ok: false, short };

  const all = [...review, ...picked];
  if (!all.length) return { ok: false, short: short.length ? short : ['No questions match.'] };
  // Random order inside each domain, domains in Bluebook order.
  const ordered = shuffle(all, rng).sort((a, b) => domainRank(a) - domainRank(b));
  return { ok: true, questionIds: ordered.map((q) => q.id), reviewIds: review.map((q) => q.id), short };
}

export function newModule(id: string, questionIds: string[], timerSec: number, retestOf?: Module): Module {
  const n = new Date();
  const when = n.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return {
    id,
    title: retestOf ? `Retest: ${retestOf.title}` : `Module · ${when}, ${n.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
    questionIds,
    timerSec,
    startedAt: Date.now(),
    isRetest: !!retestOf,
    retestOf: retestOf?.id,
  };
}

export type RetestScope = 'wrong' | 'skipped' | 'missed' | 'review' | 'all';

/**
 * Questions for a retest of a finished module: answered wrong, left blank (skipped), both ("missed"),
 * missed plus anything flagged or marked confused, or everything. Deleted questions are left out;
 * order stays as in the module.
 */
export function retestQuestions(data: AppData, moduleId: string, scope: RetestScope): string[] {
  const m = data.modules[moduleId];
  if (!m) return [];
  const byQ = new Map(data.attempts.filter((a) => a.moduleId === moduleId).map((a) => [a.questionId, a]));
  return m.questionIds.filter((id) => {
    if (!data.questions[id]) return false;
    const a = byQ.get(id);
    if (scope === 'all') return true;
    if (!a) return false;
    const o = outcome(a);
    if (scope === 'wrong') return o === 'wrong';
    if (scope === 'skipped') return o === 'skipped';
    return o !== 'right' || (scope === 'review' && (a.flagged || a.confused));
  });
}

/** Minutes for n questions at real SAT pace (27 questions in 32 minutes ≈ 71 s each). */
export function satPaceMinutes(n: number): number {
  return Math.max(1, Math.round((n * 32) / 27));
}

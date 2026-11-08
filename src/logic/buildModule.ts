import { DIFFICULTIES, type AppData, type Difficulty, type DomainGrid, type Module, type Question } from '../types';
import { isUsable } from '../store/actions';
import { outcome } from './stats';
import { DOMAINS, domainOf, skillOf } from '../parse/skills';

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
  /** SAT-pattern mode: how many per domain × difficulty. When given, `counts` is ignored. */
  grid?: DomainGrid;
}

export type BuildResult =
  | { ok: true; questionIds: string[]; reviewIds: string[]; short: string[] }
  | { ok: false; short: string[] };

/** Easier → harder inside a domain, like Bluebook. Questions without a difficulty sit in the middle. */
const DIFF_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };
const diffRank = (q: Question) => (q.difficulty ? DIFF_RANK[q.difficulty] : 1);

/** A question's domain: the one saved with it, or the domain its skill belongs to. */
export function questionDomain(q: Question): string | undefined {
  return q.domain || domainOf(q.skill);
}

export function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function domainRank(q: Question): number {
  const i = DOMAINS.indexOf(questionDomain(q) ?? '');
  return i < 0 ? DOMAINS.length : i;
}

/**
 * Pick questions for a new module:
 * 1. wrong answers waiting to be retried (up to reviewMax; these repeat on purpose),
 * 2. then unseen questions matching the skill filter, per difficulty.
 * Seen questions never come back otherwise (retests copy a module instead).
 */
export function buildModule(data: AppData, opts: BuildOptions, rng: () => number = Math.random): BuildResult {
  if (opts.grid) return buildByDomain(data, opts, opts.grid, rng);
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

/** Unseen, usable questions for one domain × difficulty cell (not already waiting on the retry list). */
export function cellPool(data: AppData, domain: string, d: Difficulty, skills: string[]): Question[] {
  const seen = new Set(data.seen);
  const queued = new Set(data.wrongQueue);
  return Object.values(data.questions).filter((q) =>
    q.difficulty === d && questionDomain(q) === domain && isUsable(q) && (!skills.length || skills.includes(skillOf(q))) &&
    !seen.has(q.id) && !queued.has(q.id));
}

/**
 * SAT-pattern module: a set number of questions per domain and difficulty.
 * Retry questions take a slot in their own domain (same difficulty first, else that domain's fullest slot).
 * Order: domains as in Bluebook, easier → harder within each.
 */
function buildByDomain(data: AppData, opts: BuildOptions, grid: DomainGrid, rng: () => number): BuildResult {
  const need: DomainGrid = Object.fromEntries(DOMAINS.map((dm) => [dm, { ...{ easy: 0, medium: 0, hard: 0 }, ...grid[dm] }]));
  const total = DOMAINS.reduce((n, dm) => n + DIFFICULTIES.reduce((m, d) => m + Math.max(0, need[dm][d]), 0), 0);
  if (total === 0) return { ok: false, short: ['Choose at least one question.'] };

  const matches = (q: Question) => isUsable(q) && (!opts.skills.length || opts.skills.includes(skillOf(q)));
  const review: Question[] = [];
  for (const id of data.wrongQueue) {
    if (review.length >= Math.min(opts.reviewMax, total)) break;
    const q = data.questions[id];
    const dm = q && questionDomain(q);
    if (!q || !dm || !need[dm] || !matches(q)) continue;
    const row = need[dm];
    const d = q.difficulty && row[q.difficulty] > 0 ? q.difficulty : DIFFICULTIES.reduce((a, b) => (row[b] > row[a] ? b : a));
    if (row[d] <= 0) continue; // no room left in its domain
    row[d]--;
    review.push(q);
  }

  const picked: Question[] = [];
  const short: string[] = [];
  const skillText = opts.skills.length ? ` for ${opts.skills.join(', ')}` : '';
  for (const dm of DOMAINS) {
    for (const d of [...DIFFICULTIES].sort((a, b) => DIFF_RANK[a] - DIFF_RANK[b])) {
      const n = need[dm][d];
      if (n <= 0) continue;
      const pool = cellPool(data, dm, d, opts.skills);
      if (pool.length < n) short.push(`Only ${pool.length} unseen ${d} ${dm} question${pool.length === 1 ? '' : 's'} left${skillText} (you asked for ${n}).`);
      picked.push(...shuffle(pool, rng).slice(0, n));
    }
  }
  if (short.length && !opts.allowShort) return { ok: false, short };

  const all = [...review, ...picked];
  if (!all.length) return { ok: false, short: short.length ? short : ['No questions match.'] };
  const ordered = shuffle(all, rng).sort((a, b) => domainRank(a) - domainRank(b) || diffRank(a) - diffRank(b));
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

export type QueueScope = 'skipped' | 'wrong' | 'missed';

/**
 * Questions on the retry list (not yet answered right), across all modules, split by how they went last time:
 * left blank ("skipped") or answered wrong. "missed" = both. Questions that can't be used right now are left out.
 */
export function queueQuestions(data: AppData, scope: QueueScope): string[] {
  const last = new Map<string, ReturnType<typeof outcome>>();
  for (const a of data.attempts) last.set(a.questionId, outcome(a));
  return data.wrongQueue.filter((id) => {
    const q = data.questions[id];
    if (!q || !isUsable(q)) return false;
    return scope === 'missed' || (last.get(id) ?? 'wrong') === scope;
  });
}

/** Minutes for n questions at real SAT pace (27 questions in 32 minutes ≈ 71 s each). */
export function satPaceMinutes(n: number): number {
  return Math.max(1, Math.round((n * 32) / 27));
}

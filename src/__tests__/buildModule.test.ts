import { describe, expect, it } from 'vitest';
import { buildModule, queueQuestions, retestQuestions, satPaceMinutes } from '../logic/buildModule';
import { emptyData } from '../store/db';
import { PRESETS, gridTotal } from '../logic/presets';
import type { AppData, Difficulty, Question } from '../types';

function q(id: string, difficulty: Difficulty, skill = 'Inferences', domain = 'Information and Ideas', extra: Partial<Question> = {}): Question {
  return {
    id, source: 'cb-pdf', passage: 'p', question: `q ${id}`, choices: { A: 'a', B: 'b', C: 'c', D: 'd' }, answer: 'A',
    rationale: '', difficulty, skill, domain, issues: [], verified: true, createdAt: 0, ...extra,
  };
}

function data(qs: Question[], patch: Partial<AppData> = {}): AppData {
  return { ...emptyData(), questions: Object.fromEntries(qs.map((x) => [x.id, x])), ...patch };
}

const base = { counts: { hard: 2, medium: 0, easy: 0 }, skills: [], timerMin: 10, reviewMax: 5 };
let seed = 1;
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

describe('buildModule', () => {
  it('only picks unseen questions of the requested difficulty', () => {
    const d = data([q('h1', 'hard'), q('h2', 'hard'), q('h3', 'hard'), q('m1', 'medium')], { seen: ['h1'] });
    const r = buildModule(d, base, rng);
    expect(r.ok && [...r.questionIds].sort()).toEqual(['h2', 'h3']);
  });

  it('refuses with a clear message when there are not enough, unless told to go ahead', () => {
    const d = data([q('h1', 'hard'), q('h2', 'hard', 'Transitions', 'Expression of Ideas')]);
    const r = buildModule(d, { ...base, skills: ['Inferences'] }, rng);
    expect(r).toEqual({ ok: false, short: ['Only 1 unseen hard question left for Inferences (you asked for 2).'] });
    const r2 = buildModule(d, { ...base, skills: ['Inferences'], allowShort: true }, rng);
    expect(r2.ok && r2.questionIds).toEqual(['h1']);
  });

  it('brings wrong answers back first, counting them toward the total', () => {
    const d = data([q('h1', 'hard'), q('h2', 'hard'), q('h3', 'hard'), q('w1', 'hard')], { seen: ['w1'], wrongQueue: ['w1'] });
    const r = buildModule(d, base, rng);
    expect(r.ok && r.questionIds).toHaveLength(2);
    expect(r.ok && r.reviewIds).toEqual(['w1']);
    expect(r.ok && r.questionIds).toContain('w1');
  });

  it('respects the review limit and skips broken or reported questions', () => {
    const d = data([
      q('h1', 'hard'), q('h2', 'hard'), q('w1', 'hard'), q('w2', 'hard'),
      q('bad', 'hard', 'Inferences', 'Information and Ideas', { issues: ['Missing answer (A–D)'] }),
      q('rep', 'hard', 'Inferences', 'Information and Ideas', { excluded: true }),
    ], { wrongQueue: ['w1', 'w2'] });
    const r = buildModule(d, { ...base, reviewMax: 1 }, rng);
    expect(r.ok && r.reviewIds).toEqual(['w1']);
    expect(r.ok && r.questionIds.some((id) => id === 'bad' || id === 'rep' || id === 'w2')).toBe(false);
  });

  it('orders questions by domain like Bluebook', () => {
    const d = data([
      q('e1', 'hard', 'Transitions', 'Expression of Ideas'),
      q('i1', 'hard', 'Inferences', 'Information and Ideas'),
      q('c1', 'hard', 'Words in Context', 'Craft and Structure'),
    ]);
    const r = buildModule(d, { ...base, counts: { hard: 3, medium: 0, easy: 0 } }, rng);
    expect(r.ok && r.questionIds).toEqual(['c1', 'i1', 'e1']);
  });

  it('a wrong medium question still comes back in an all-hard module', () => {
    const d = data([q('h1', 'hard'), q('h2', 'hard'), q('m1', 'medium')], { wrongQueue: ['m1'] });
    const r = buildModule(d, base, rng);
    expect(r.ok && r.questionIds).toHaveLength(2);
    expect(r.ok && r.questionIds).toContain('m1');
  });
});

describe('retestQuestions', () => {
  const qs = ['a', 'b', 'c', 'd'].map((id) => q(id, 'hard'));
  const att = (questionId: string, correct: boolean, extra = {}) =>
    ({ questionId, moduleId: 'm', chosen: 'A' as const, correct, timeMs: 0, flagged: false, confused: false, crossedOut: [], ...extra });
  const d = data(qs, {
    modules: { m: { id: 'm', title: 'M', questionIds: ['a', 'b', 'c', 'd'], timerSec: 600, startedAt: 0, submittedAt: 1, isRetest: false } },
    // a right, b wrong, c right but confused, d left blank (skipped) and flagged
    attempts: [att('a', true), att('b', false), att('c', true, { confused: true }), att('d', false, { flagged: true, chosen: null })],
  });
  it('separates wrong from skipped, and can combine them', () => {
    expect(retestQuestions(d, 'm', 'wrong')).toEqual(['b']);
    expect(retestQuestions(d, 'm', 'skipped')).toEqual(['d']);
    expect(retestQuestions(d, 'm', 'missed')).toEqual(['b', 'd']);
    expect(retestQuestions(d, 'm', 'review')).toEqual(['b', 'c', 'd']);
    expect(retestQuestions(d, 'm', 'all')).toEqual(['a', 'b', 'c', 'd']);
  });
  it('suggests time at SAT pace', () => {
    expect(satPaceMinutes(27)).toBe(32);
    expect(satPaceMinutes(5)).toBe(6);
    expect(satPaceMinutes(0)).toBe(1);
  });
});

describe('questions without skill or difficulty', () => {
  it('fills the "no level" bucket and the NO_SKILL filter from untagged questions', () => {
    const d = data([q('h1', 'hard'), q('t1', null as never, ''), q('t2', null as never, '')]);
    const r = buildModule(d, { ...base, counts: { hard: 0, medium: 0, easy: 0, none: 2 } }, rng);
    expect(r.ok && [...r.questionIds].sort()).toEqual(['t1', 't2']);
    const r2 = buildModule(d, { ...base, counts: { hard: 1, medium: 0, easy: 0, none: 2 }, skills: ['No skill'], allowShort: true }, rng);
    expect(r2.ok && [...r2.questionIds].sort()).toEqual(['t1', 't2']);
  });
});

describe('queueQuestions', () => {
  it('splits the retry list by how each question went last time', () => {
    const att = (questionId: string, chosen: 'A' | 'B' | null) =>
      ({ questionId, moduleId: 'm', chosen, correct: chosen === 'A', timeMs: 1, flagged: false, confused: false, crossedOut: [] });
    const d = data([q('s1', 'hard'), q('w1', 'hard'), q('x', 'hard')], {
      wrongQueue: ['s1', 'w1', 'x'],
      attempts: [att('s1', null), att('w1', 'B'), att('x', null), att('x', 'B')],
    });
    expect(queueQuestions(d, 'skipped')).toEqual(['s1']);
    expect(queueQuestions(d, 'wrong')).toEqual(['w1', 'x']);
    expect(queueQuestions(d, 'missed')).toEqual(['s1', 'w1', 'x']);
  });
});

describe('buildModule by domain (SAT pattern)', () => {
  const D = ['Craft and Structure', 'Information and Ideas', 'Standard English Conventions', 'Expression of Ideas'];
  const SK: Record<string, string> = {
    'Craft and Structure': 'Words in Context', 'Information and Ideas': 'Inferences',
    'Standard English Conventions': 'Boundaries', 'Expression of Ideas': 'Transitions',
  };
  /** n questions in every domain × difficulty; ids like "C&S-hard-0". Odd ones have no saved domain (found via the skill). */
  function bank(n: number): Question[] {
    const out: Question[] = [];
    for (const dm of D) for (const d of ['easy', 'medium', 'hard'] as Difficulty[]) for (let i = 0; i < n; i++) {
      out.push(q(`${dm}|${d}|${i}`, d, SK[dm], i % 2 ? '' : dm));
    }
    return out;
  }
  const zero = () => Object.fromEntries(D.map((dm) => [dm, { easy: 0, medium: 0, hard: 0 }]));
  const cell = (id: string) => id.split('|').slice(0, 2).join('|');

  it('picks exactly the asked number per domain × difficulty, using the skill when no domain is saved', () => {
    const grid = zero();
    grid['Information and Ideas'] = { easy: 1, medium: 0, hard: 2 };
    grid['Expression of Ideas'] = { easy: 0, medium: 3, hard: 0 };
    const r = buildModule(data(bank(4)), { ...base, grid }, rng);
    expect(r.ok).toBe(true);
    const counts: Record<string, number> = {};
    if (r.ok) r.questionIds.forEach((id) => (counts[cell(id)] = (counts[cell(id)] ?? 0) + 1));
    expect(counts).toEqual({ 'Information and Ideas|easy': 1, 'Information and Ideas|hard': 2, 'Expression of Ideas|medium': 3 });
  });

  it('orders like Bluebook: by domain, then easier → harder', () => {
    const r = buildModule(data(bank(4)), { ...base, grid: PRESETS[0].grid }, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const key = (id: string) => { const [dm, d] = id.split('|'); return D.indexOf(dm) * 10 + ['easy', 'medium', 'hard'].indexOf(d); };
    const keys = r.questionIds.map(key);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(r.questionIds).toHaveLength(27);
  });

  it('names the exact cell that is short, and can build with what there is', () => {
    const qs = bank(2).filter((x) => !x.id.startsWith('Information and Ideas|hard|1'));
    const grid = zero();
    grid['Information and Ideas'] = { easy: 0, medium: 0, hard: 2 };
    expect(buildModule(data(qs), { ...base, grid }, rng)).toEqual({
      ok: false, short: ['Only 1 unseen hard Information and Ideas question left (you asked for 2).'],
    });
    const r = buildModule(data(qs), { ...base, grid, allowShort: true }, rng);
    expect(r.ok && r.questionIds).toEqual(['Information and Ideas|hard|0']);
  });

  it('puts retry questions in a slot of their own domain and counts them toward the total', () => {
    const qs = bank(3);
    const grid = zero();
    grid['Craft and Structure'] = { easy: 1, medium: 0, hard: 1 };
    // A medium C&S question waiting to be retried: no medium slot, so it takes the fullest C&S slot.
    // A Boundaries question: its domain has no slots, so it stays out.
    const d = data(qs, {
      seen: ['Craft and Structure|medium|0', 'Standard English Conventions|hard|0'],
      wrongQueue: ['Craft and Structure|medium|0', 'Standard English Conventions|hard|0'],
    });
    const r = buildModule(d, { ...base, grid }, rng);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reviewIds).toEqual(['Craft and Structure|medium|0']);
    expect(r.questionIds).toHaveLength(2);
    expect(r.questionIds.filter((id) => id.startsWith('Craft and Structure|')).length).toBe(2);
  });

  it('every preset adds up to 27', () => {
    for (const p of PRESETS) expect(gridTotal(p.grid)).toBe(27);
  });
});

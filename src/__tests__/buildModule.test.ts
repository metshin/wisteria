import { describe, expect, it } from 'vitest';
import { buildModule, retestQuestions, satPaceMinutes } from '../logic/buildModule';
import { emptyData } from '../store/db';
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

import { describe, expect, it } from 'vitest';
import { buildReport } from '../logic/report';
import { emptyData } from '../store/db';
import type { AppData, Attempt, Question } from '../types';

const q = (id: string, skill: string): Question => ({
  id, source: 'cb-pdf', passage: 'p', question: `Which choice best ${id}?`, choices: { A: 'alpha', B: 'bravo', C: 'charlie', D: 'delta' },
  answer: 'B', rationale: '', difficulty: 'hard', skill, issues: [], verified: true, createdAt: 0,
});
const att = (questionId: string, moduleId: string, chosen: Attempt['chosen'], timeMs: number, extra: Partial<Attempt> = {}): Attempt => ({
  questionId, moduleId, chosen, correct: chosen === 'B', timeMs, flagged: false, confused: false, crossedOut: [], ...extra,
});

describe('buildReport', () => {
  it('summarises accuracy, wrong vs skipped, timing, repeat misses and notes', () => {
    const d: AppData = {
      ...emptyData(),
      questions: { q1: q('q1', 'Transitions'), q2: q('q2', 'Inferences'), q3: q('q3', 'Inferences') },
      modules: {
        m1: { id: 'm1', title: 'M1', questionIds: ['q1', 'q2', 'q3'], timerSec: 600, startedAt: 0, submittedAt: Date.UTC(2026, 9, 20), isRetest: false },
        m2: { id: 'm2', title: 'M2', questionIds: ['q2'], timerSec: 60, startedAt: 0, submittedAt: Date.UTC(2026, 9, 22), isRetest: true, autoSubmitted: true },
      },
      attempts: [
        att('q1', 'm1', 'B', 50_000),
        att('q2', 'm1', 'C', 150_000, { noteTags: ['trap answer'], note: 'fell for the extreme claim' }),
        att('q3', 'm1', null, 0),
        att('q2', 'm2', null, 0, { noteTags: ['ran out of time'] }),
      ],
      wrongQueue: ['q2', 'q3'],
    };
    const r = buildReport(d, Date.UTC(2026, 9, 24, 12));
    expect(r).toContain('Questions answered: 4 — right 1 (25%), wrong 1, skipped 2');
    expect(r).toMatch(/\| Inferences \| 3 \| 0% \| 1 \| 2 \|/); // weakest first
    expect(r).toContain('Questions over 2 minutes: 1 (of which wrong: 1, skipped: 0)');
    expect(r).toContain('Modules that ran out of time: 1 of 2');
    expect(r).toContain('trap answer ×1 · ran out of time ×1');
    expect(r).toContain('×2 · Inferences · hard — “Which choice best q2?”');
    expect(r).toContain('My pick: “charlie” · Correct: “bravo”');
    expect(r).toContain('My note: [trap answer] fell for the extreme claim');
  });

  it('works with no finished modules', () => {
    expect(buildReport(emptyData())).toContain('No finished modules yet.');
  });
});

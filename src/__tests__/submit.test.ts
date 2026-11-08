import { describe, expect, it } from 'vitest';
import { deleteModule, discardTest, submitTest } from '../logic/submit';
import { startModule } from '../store/actions';
import { newModule } from '../logic/buildModule';
import { emptyData } from '../store/db';
import type { AppData, Letter, Question } from '../types';

const q = (id: string, answer: Letter): Question => ({
  id, source: 'cb-pdf', passage: '', question: id, choices: { A: 'a', B: 'b', C: 'c', D: 'd' }, answer,
  rationale: '', difficulty: 'hard', skill: 'Inferences', issues: [], verified: true, createdAt: 0,
});

function setup(wrongQueue: string[] = []): AppData {
  const d: AppData = { ...emptyData(), questions: { q1: q('q1', 'A'), q2: q('q2', 'B'), q3: q('q3', 'C') }, wrongQueue };
  return startModule(d, newModule('m1', ['q1', 'q2', 'q3'], 600));
}

describe('submitTest', () => {
  it('scores answers, marks everything seen and queues wrong and blank ones', () => {
    let d = setup();
    const answers = d.activeTest!.answers;
    answers[0] = { ...answers[0], chosen: 'A', timeMs: 1000, flagged: true };
    answers[1] = { ...answers[1], chosen: 'C', confused: true, crossedOut: ['A'] };
    d = submitTest(d, true, 123);
    expect(d.activeTest).toBeNull();
    expect(d.modules.m1).toMatchObject({ submittedAt: 123, autoSubmitted: true });
    expect(d.attempts.map((a) => [a.questionId, a.correct, a.flagged, a.confused])).toEqual([
      ['q1', true, true, false],
      ['q2', false, false, true],
      ['q3', false, false, false],
    ]);
    expect(d.seen.sort()).toEqual(['q1', 'q2', 'q3']);
    expect(d.wrongQueue).toEqual(['q2', 'q3']);
  });

  it('removes a retried question from the queue once it is answered correctly', () => {
    let d = setup(['q1', 'q2']);
    d.activeTest!.answers[0].chosen = 'A'; // right now
    d.activeTest!.answers[1].chosen = 'D'; // still wrong
    d.activeTest!.answers[2].chosen = 'C';
    d = submitTest(d, false);
    expect(d.wrongQueue).toEqual(['q2']);
  });
});

describe('deleteModule', () => {
  it('undoes a practice module: questions unseen again and its misses leave the retry queue', () => {
    let d = setup();
    d.activeTest!.answers[0].chosen = 'A'; // right
    d.activeTest!.answers[1].chosen = 'D'; // wrong
    d = submitTest(d, false, 100);
    // a second, real module that also contains q1 (wrong this time)
    d = startModule(d, newModule('m2', ['q1'], 600));
    d.activeTest!.answers[0].chosen = 'B';
    d = submitTest(d, false, 200);
    expect(d.wrongQueue).toEqual(['q2', 'q3', 'q1']);

    d = deleteModule(d, 'm1');
    expect(d.modules.m1).toBeUndefined();
    expect(d.attempts.every((a) => a.moduleId === 'm2')).toBe(true);
    expect(d.seen).toEqual(['q1']);
    expect(d.wrongQueue).toEqual(['q1']);
  });

  it('discards a paused test without results', () => {
    const d = discardTest(setup());
    expect(d.activeTest).toBeNull();
    expect(d.modules).toEqual({});
    expect(d.attempts).toEqual([]);
  });
});

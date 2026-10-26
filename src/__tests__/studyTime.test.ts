import { describe, expect, it } from 'vitest';
import { growthLevel, msByDay, studyRows } from '../logic/studyTime';
import { startModule } from '../store/actions';
import { newModule } from '../logic/buildModule';
import { submitTest } from '../logic/submit';
import { finishSession, startSession } from '../logic/session';
import { emptyData } from '../store/db';
import type { AppData } from '../types';

const MIN = 60_000;
const T0 = new Date(2026, 9, 21, 9, 0).getTime();

function withQuestion(): AppData {
  return {
    ...emptyData(),
    questions: { q1: { id: 'q1', source: 'cb-pdf', passage: '', question: 'q', choices: { A: 'a', B: 'b', C: 'c', D: 'd' }, answer: 'A', rationale: '', difficulty: 'hard', skill: 'Inferences', issues: [], verified: true, createdAt: 0 } },
  };
}

function takeModule(d: AppData, id: string, ms: number, at: number): AppData {
  let x = startModule(d, newModule(id, ['q1'], 600));
  x.activeTest!.answers[0] = { ...x.activeTest!.answers[0], chosen: 'A', timeMs: ms };
  x = submitTest(x, false, at);
  return x;
}

describe('study time', () => {
  it('a test taken during a running session counts once, inside the session', () => {
    let d = withQuestion();
    d = { ...d, studySession: startSession('s1', d.settings.pomodoro, T0) };
    d = takeModule(d, 'm1', 30 * MIN, T0 + 40 * MIN);
    expect(d.modules.m1.sessionId).toBe('s1');

    // while the session is still running
    let rows = studyRows(d, T0 + 60 * MIN);
    expect(rows.find((r) => r.live)?.ms).toBe(60 * MIN);
    expect(rows.find((r) => r.moduleId === 'm1')?.insideSession).toBe(true);
    expect([...msByDay(rows).values()]).toEqual([60 * MIN]);

    // after the session is logged
    const entry = finishSession(d.studySession!, T0 + 90 * MIN, 'log1');
    d = { ...d, studySession: null, studyLog: [entry] };
    rows = studyRows(d, T0 + 100 * MIN);
    expect([...msByDay(rows).values()]).toEqual([90 * MIN]);
  });

  it('a test taken without a session counts on its own', () => {
    const d = takeModule(withQuestion(), 'm1', 25 * MIN, T0 + 30 * MIN);
    expect(d.modules.m1.sessionId).toBeUndefined();
    expect([...msByDay(studyRows(d, T0 + 40 * MIN)).values()]).toEqual([25 * MIN]);
  });

  it('grows from sprout to bouquet by hours studied', () => {
    expect([0, 10 * MIN, 60 * MIN, 125 * MIN, 190 * MIN].map(growthLevel)).toEqual([0, 1, 2, 3, 4]);
  });
});

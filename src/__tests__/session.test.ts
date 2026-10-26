import { describe, expect, it } from 'vitest';
import {
  breaksLeft, finishSession, focusElapsed, isComplete, pause, resume, setTestOpen, startSession, takeBreak, tick,
} from '../logic/session';

const MIN = 60_000;
const settings = { fruit: 'tomato' as const, targetMin: 120, breaks: 2, breakMin: 5, breathingPrompt: false };

describe('study session', () => {
  it('counts focus time only while studying, and breaks can be taken any time', () => {
    let s = startSession('s1', settings, 0);
    expect(focusElapsed(s, 30 * MIN)).toBe(30 * MIN);
    s = takeBreak(s, 30 * MIN);
    expect(s.phase).toBe('break');
    expect(breaksLeft(s)).toBe(1);
    expect(focusElapsed(s, 33 * MIN)).toBe(30 * MIN); // break time isn't study time
    s = resume(s, 33 * MIN); // ended the break early
    expect(focusElapsed(s, 43 * MIN)).toBe(40 * MIN);
  });

  it('a finished break waits for you instead of counting time', () => {
    let s = takeBreak(startSession('s1', settings, 0), 10 * MIN);
    s = tick(s, 16 * MIN);
    expect(s).toMatchObject({ phase: 'paused', breakOver: true });
    expect(focusElapsed(s, 60 * MIN)).toBe(10 * MIN);
    s = resume(s, 60 * MIN);
    expect(focusElapsed(s, 70 * MIN)).toBe(20 * MIN);
  });

  it('stops offering breaks once the planned number is used', () => {
    let s = startSession('s1', settings, 0);
    s = resume(takeBreak(s, MIN), 2 * MIN);
    s = resume(takeBreak(s, 3 * MIN), 4 * MIN);
    expect(breaksLeft(s)).toBe(0);
    expect(takeBreak(s, 5 * MIN)).toBe(s);
  });

  it('pauses for a test and resumes afterwards only if you were studying', () => {
    let s = startSession('s1', settings, 0);
    s = setTestOpen(s, true, 10 * MIN);
    expect(focusElapsed(s, 40 * MIN)).toBe(10 * MIN);
    s = setTestOpen(s, false, 40 * MIN);
    expect(s.phase).toBe('focus');
    expect(focusElapsed(s, 45 * MIN)).toBe(15 * MIN);

    let p = pause(startSession('s2', settings, 0), 5 * MIN);
    p = setTestOpen(setTestOpen(p, true, 6 * MIN), false, 30 * MIN);
    expect(p.phase).toBe('paused');
  });

  it('logs the time actually studied, capped at the plan', () => {
    let s = startSession('s1', settings, 1000);
    s = takeBreak(s, 1000 + 50 * MIN);
    const early = finishSession(s, 1000 + 53 * MIN, 'l1');
    expect(early).toMatchObject({ focusMs: 50 * MIN, breaksTaken: 1, completed: false, targetMin: 120 });

    const full = startSession('s2', settings, 0);
    expect(isComplete(full, 120 * MIN)).toBe(true);
    expect(finishSession(full, 125 * MIN, 'l2')).toMatchObject({ focusMs: 120 * MIN, completed: true });
  });
});

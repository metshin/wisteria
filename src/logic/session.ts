import type { PomodoroSettings, StudyLogEntry, StudySession } from '../types';

/**
 * Study-session timer as plain functions over timestamps (easy to test, survives reloads).
 * Focus time counts only while phase is 'focus'. Breaks are taken whenever you like, up to the
 * number you planned; when a break runs out the session waits for you instead of counting time
 * you might not be studying.
 */

export function startSession(id: string, s: PomodoroSettings, now: number): StudySession {
  return {
    id,
    startedAt: now,
    targetMin: s.targetMin,
    breakMin: s.breakMin,
    breaksPlanned: s.breaks,
    breaksTaken: 0,
    phase: 'focus',
    focusMs: 0,
    focusSince: now,
    breakUntil: null,
    pausedForTest: false,
    resumeAfterTest: false,
    breakOver: false,
  };
}

export function focusElapsed(s: StudySession, now: number): number {
  return s.focusMs + (s.phase === 'focus' && s.focusSince !== null ? Math.max(0, now - s.focusSince) : 0);
}

export const targetMs = (s: StudySession) => s.targetMin * 60_000;
export const breaksLeft = (s: StudySession) => Math.max(0, s.breaksPlanned - s.breaksTaken);

/** Bank the current focus stretch and stop the focus clock. */
function bank(s: StudySession, now: number): StudySession {
  return { ...s, focusMs: focusElapsed(s, now), focusSince: null };
}

export function takeBreak(s: StudySession, now: number): StudySession {
  if (s.phase === 'break' || breaksLeft(s) === 0) return s;
  return { ...bank(s, now), phase: 'break', breakUntil: now + s.breakMin * 60_000, breaksTaken: s.breaksTaken + 1, breakOver: false };
}

/** Back to studying: ends a break early, or resumes after a pause or a finished break. */
export function resume(s: StudySession, now: number): StudySession {
  if (s.phase === 'focus' || s.pausedForTest) return s;
  return { ...s, phase: 'focus', focusSince: now, breakUntil: null, breakOver: false };
}

export function pause(s: StudySession, now: number): StudySession {
  if (s.phase !== 'focus') return s;
  return { ...bank(s, now), phase: 'paused' };
}

/** Called on every tick: a finished break turns into "waiting for you". */
export function tick(s: StudySession, now: number): StudySession {
  if (s.phase === 'break' && s.breakUntil !== null && now >= s.breakUntil) {
    return { ...s, phase: 'paused', breakUntil: null, breakOver: true };
  }
  return s;
}

export const isComplete = (s: StudySession, now: number) => focusElapsed(s, now) >= targetMs(s);

/**
 * Pause while a test is open; carry on afterwards only if you were studying when it opened.
 * (No longer used for pausing: tests now count inside a session. Kept to clear pauses saved by older versions.)
 */
export function setTestOpen(s: StudySession, open: boolean, now: number): StudySession {
  if (open && !s.pausedForTest) {
    const wasFocus = s.phase === 'focus';
    return { ...(wasFocus ? pause(s, now) : s), pausedForTest: true, resumeAfterTest: wasFocus };
  }
  if (!open && s.pausedForTest) {
    const cleared = { ...s, pausedForTest: false, resumeAfterTest: false };
    return s.resumeAfterTest ? resume(cleared, now) : cleared;
  }
  return s;
}

export function finishSession(s: StudySession, now: number, logId: string): StudyLogEntry {
  const focus = Math.min(focusElapsed(s, now), targetMs(s));
  return {
    id: logId,
    start: s.startedAt,
    end: now,
    focusMs: focus,
    targetMin: s.targetMin,
    breaksTaken: s.breaksTaken,
    completed: focus >= targetMs(s),
    sessionId: s.id,
  };
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

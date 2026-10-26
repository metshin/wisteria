import type { AppData } from '../types';
import { dayKey, focusElapsed } from './session';
import { moduleScore } from './stats';

export interface StudyRow {
  key: string;
  start: number;
  end: number;
  ms: number;
  label: string;
  detail: string;
  /** Logged study session (deletable from the log). */
  logId?: string;
  /** Finished test module (deletable, undoes its results). */
  moduleId?: string;
  /** The session running right now. */
  live?: boolean;
  /** A module taken during a study session: its time is already in that session, so it isn't added again. */
  insideSession?: boolean;
}

/** Everything that counts as study time: logged sessions, the running session, and finished modules. */
export function studyRows(data: AppData, now: number): StudyRow[] {
  const loggedSessions = new Set(data.studyLog.map((e) => e.sessionId).filter(Boolean));
  const running = data.studySession;
  const rows: StudyRow[] = data.studyLog.map((e) => ({
    key: e.id,
    start: e.start,
    end: e.end,
    ms: e.focusMs,
    label: e.completed ? '🌸 Study session (finished)' : '🌱 Study session',
    detail: `planned ${Math.round(e.targetMin)} min · ${e.breaksTaken} break${e.breaksTaken === 1 ? '' : 's'}`,
    logId: e.id,
  }));
  if (running) {
    rows.push({
      key: running.id,
      start: running.startedAt,
      end: now,
      ms: focusElapsed(running, now),
      label: '🌱 Study session (in progress)',
      detail: `${running.breaksTaken} break${running.breaksTaken === 1 ? '' : 's'} so far`,
      live: true,
    });
  }
  for (const m of Object.values(data.modules)) {
    if (!m.submittedAt) continue;
    const at = data.attempts.filter((a) => a.moduleId === m.id);
    const sc = moduleScore(at);
    const inside = !!m.sessionId && (loggedSessions.has(m.sessionId) || running?.id === m.sessionId);
    rows.push({
      key: m.id,
      start: m.startedAt,
      end: m.submittedAt,
      ms: at.reduce((n, a) => n + a.timeMs, 0),
      label: `📝 ${m.isRetest ? 'Retest' : 'Test module'}${inside ? ' (inside session)' : ''}`,
      detail: `${sc.correct}/${sc.total} right`,
      moduleId: m.id,
      insideSession: inside,
    });
  }
  return rows.sort((a, b) => b.end - a.end);
}

/** Study time per calendar day (modules inside a session aren't counted twice). */
export function msByDay(rows: StudyRow[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.insideSession) continue;
    const k = dayKey(r.end);
    out.set(k, (out.get(k) ?? 0) + r.ms);
  }
  return out;
}

/** How big today's plant is: 0 nothing, 1 under an hour, 2 one hour+, 3 two hours+, 4 three hours+ (bouquet). */
export function growthLevel(ms: number): 0 | 1 | 2 | 3 | 4 {
  const h = ms / 3_600_000;
  if (h >= 3) return 4;
  if (h >= 2) return 3;
  if (h >= 1) return 2;
  if (ms >= 60_000) return 1;
  return 0;
}

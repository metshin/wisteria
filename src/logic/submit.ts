import type { AppData, Attempt } from '../types';

/**
 * Turn the running test into saved attempts:
 * - every question becomes "seen",
 * - wrong (or blank) answers join the retry queue,
 * - a queued question answered correctly leaves the queue.
 */
export function submitTest(d: AppData, auto: boolean, now = Date.now()): AppData {
  const t = d.activeTest;
  if (!t) return d;
  const m = d.modules[t.moduleId];
  if (!m) return { ...d, activeTest: null };

  const attempts: Attempt[] = m.questionIds.map((qid, i) => {
    const a = t.answers[i];
    const q = d.questions[qid];
    return {
      questionId: qid,
      moduleId: m.id,
      chosen: a.chosen,
      correct: !!q && a.chosen !== null && a.chosen === q.answer,
      timeMs: Math.round(a.timeMs),
      flagged: a.flagged,
      confused: a.confused,
      crossedOut: a.crossedOut,
    };
  });

  const seen = new Set(d.seen);
  const queue = d.wrongQueue.filter((id) => !attempts.some((a) => a.questionId === id && a.correct));
  for (const a of attempts) {
    seen.add(a.questionId);
    if (!a.correct && !queue.includes(a.questionId)) queue.push(a.questionId);
  }

  return {
    ...d,
    attempts: [...d.attempts, ...attempts],
    seen: [...seen],
    wrongQueue: queue,
    modules: { ...d.modules, [m.id]: { ...m, submittedAt: now, autoSubmitted: auto } },
    activeTest: null,
  };
}

/**
 * Delete a finished module as if it never happened: its results go, and "seen" and the retry queue
 * are rebuilt from the modules that remain (replaying them oldest first with the same rules as submit).
 */
export function deleteModule(d: AppData, moduleId: string): AppData {
  const modules = { ...d.modules };
  delete modules[moduleId];
  const attempts = d.attempts.filter((a) => a.moduleId !== moduleId);

  const order = Object.values(modules)
    .filter((m) => m.submittedAt)
    .sort((a, b) => a.submittedAt! - b.submittedAt!);
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const m of order) {
    for (const a of attempts.filter((x) => x.moduleId === m.id)) {
      seen.add(a.questionId);
      const i = queue.indexOf(a.questionId);
      if (a.correct && i >= 0) queue.splice(i, 1);
      if (!a.correct && i < 0) queue.push(a.questionId);
    }
  }
  return { ...d, modules, attempts, seen: [...seen], wrongQueue: queue.filter((id) => d.questions[id]) };
}

/** Throw away a paused test without saving any results. */
export function discardTest(d: AppData): AppData {
  if (!d.activeTest) return d;
  const modules = { ...d.modules };
  delete modules[d.activeTest.moduleId];
  return { ...d, modules, activeTest: null };
}

import type { AppData, Module, Question } from '../types';
import { findIssues, fingerprint, type Draft } from '../parse/validate';
import { uid } from './store';

export interface AddResult {
  added: number;
  duplicates: number;
  needsFix: number;
}

/** Add parsed questions, skipping duplicates already in the bank or repeated within the batch. */
export function addQuestions(d: AppData, items: { draft: Draft; raw?: string; issues?: string[] }[]): { data: AppData; result: AddResult } {
  const known = new Set(Object.values(d.questions).map(fingerprint));
  const questions = { ...d.questions };
  const result: AddResult = { added: 0, duplicates: 0, needsFix: 0 };
  const now = Date.now();
  for (const { draft, raw, issues } of items) {
    const fp = fingerprint(draft);
    if (known.has(fp)) {
      result.duplicates++;
      continue;
    }
    known.add(fp);
    const q: Question = { ...draft, id: uid('q_'), createdAt: now, issues: [...new Set([...findIssues(draft), ...(issues ?? [])])], raw };
    questions[q.id] = q;
    result.added++;
    if (q.issues.length) result.needsFix++;
  }
  return { data: { ...d, questions }, result };
}

export function saveQuestion(d: AppData, q: Question): AppData {
  return { ...d, questions: { ...d.questions, [q.id]: { ...q, issues: findIssues(q) } } };
}

export function deleteQuestion(d: AppData, id: string): AppData {
  const questions = { ...d.questions };
  delete questions[id];
  return {
    ...d,
    questions,
    wrongQueue: d.wrongQueue.filter((x) => x !== id),
  };
}

/** Save a new module and open the test screen on it. */
export function startModule(d: AppData, mod: Module): AppData {
  // A test taken during a running study session is part of that session's time.
  const m = d.studySession?.phase === 'focus' ? { ...mod, sessionId: d.studySession.id } : mod;
  return {
    ...d,
    modules: { ...d.modules, [m.id]: m },
    activeTest: {
      moduleId: m.id,
      current: 0,
      remainingSec: m.timerSec,
      timerHidden: false,
      answers: m.questionIds.map(() => ({ chosen: null, flagged: false, confused: false, crossedOut: [], timeMs: 0 })),
    },
  };
}

/** A question is usable in a module only if it parsed cleanly and isn't reported as bad. */
export function isUsable(q: Question): boolean {
  return q.issues.length === 0 && !q.excluded;
}

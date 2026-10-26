import { LETTERS, type Difficulty, type Letter, type Question } from '../types';

export type Draft = Omit<Question, 'id' | 'createdAt' | 'issues'>;

/**
 * Everything that stops a question from being used in a module. Empty array = good to go.
 * Skill, difficulty and rationale are optional (questions from TikTok/YouTube often have none).
 */
export function findIssues(q: Draft): string[] {
  const issues: string[] = [];
  if (!q.question.trim()) issues.push("Couldn't find the question sentence");
  const missing = LETTERS.filter((l) => !q.choices[l]?.trim());
  if (missing.length) issues.push(`Missing choice${missing.length > 1 ? 's' : ''} ${missing.join(', ')}`);
  if (!q.answer || !LETTERS.includes(q.answer)) issues.push('Missing answer (A–D)');
  return issues;
}

export function emptyDraft(source: Question['source']): Draft {
  return {
    source,
    passage: '',
    question: '',
    choices: { A: '', B: '', C: '', D: '' },
    answer: null,
    rationale: '',
    difficulty: null,
    skill: '',
    verified: source === 'cb-pdf',
  };
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Fingerprint used to skip duplicates (CB id if we have it, else passage start + choices). */
export function fingerprint(q: Pick<Question, 'cbId' | 'passage' | 'question' | 'choices'>): string {
  if (q.cbId) return `cb:${q.cbId.toLowerCase()}`;
  return 'tx:' + norm(q.passage).slice(0, 200) + '|' + norm(q.question).slice(0, 80) + '|' +
    LETTERS.map((l) => norm(q.choices[l] ?? '')).join('|');
}

export function isLetter(x: unknown): x is Letter {
  return typeof x === 'string' && (LETTERS as string[]).includes(x);
}

export const DIFF_LABEL: Record<Difficulty, string> = { hard: 'Hard', medium: 'Medium', easy: 'Easy' };

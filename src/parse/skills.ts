import type { Difficulty } from '../types';

/** The official Digital SAT Reading & Writing skills, grouped by domain. */
export const SKILLS_BY_DOMAIN: Record<string, string[]> = {
  'Information and Ideas': ['Central Ideas and Details', 'Inferences', 'Command of Evidence'],
  'Craft and Structure': ['Words in Context', 'Text Structure and Purpose', 'Cross-Text Connections'],
  'Expression of Ideas': ['Rhetorical Synthesis', 'Transitions'],
  'Standard English Conventions': ['Boundaries', 'Form, Structure, and Sense'],
};

export const ALL_SKILLS = Object.values(SKILLS_BY_DOMAIN).flat();

/** Label (and skill-filter key) for questions saved without a skill. */
export const NO_SKILL = 'No skill';
export const skillOf = (q: { skill: string }): string => q.skill.trim() || NO_SKILL;

export function domainOf(skill: string): string | undefined {
  return Object.entries(SKILLS_BY_DOMAIN).find(([, s]) => s.includes(skill))?.[0];
}

const ALIASES: [RegExp, string][] = [
  [/central idea|main idea|detail/i, 'Central Ideas and Details'],
  [/inference/i, 'Inferences'],
  [/command of evidence|evidence|quantitative|textual|graph|table|chart/i, 'Command of Evidence'],
  [/words? in context|\bwic\b|vocab|precise word/i, 'Words in Context'],
  [/structure and purpose|text structure|purpose|function/i, 'Text Structure and Purpose'],
  [/cross[- ]?text|two texts|text 1/i, 'Cross-Text Connections'],
  [/rhetorical|synthesis|notes/i, 'Rhetorical Synthesis'],
  [/transition/i, 'Transitions'],
  [/boundar|punctuation|comma|semicolon|colon/i, 'Boundaries'],
  [/form,? structure|sense|agreement|tense|verb|pronoun|modifier|grammar/i, 'Form, Structure, and Sense'],
];

/** Map loose skill text ("WIC", "transitions q") to an official skill name, else keep it trimmed. */
export function normalizeSkill(s: string | undefined | null): string {
  const t = (s ?? '').trim();
  if (!t) return '';
  const exact = ALL_SKILLS.find((k) => k.toLowerCase() === t.toLowerCase());
  if (exact) return exact;
  for (const [re, name] of ALIASES) if (re.test(t)) return name;
  return t;
}

export function normalizeDifficulty(s: string | undefined | null): Difficulty | null {
  const t = (s ?? '').trim().toLowerCase();
  if (!t) return null;
  if (/^(hard|h|difficult|3)\b/.test(t)) return 'hard';
  if (/^(medium|med|m|moderate|2)\b/.test(t)) return 'medium';
  if (/^(easy|e|1)\b/.test(t)) return 'easy';
  return null;
}

import { describe, expect, it } from 'vitest';
import { parsePasted, splitStem } from '../parse/pasteParser';

describe('parsePasted', () => {
  it('parses numbered questions with labelled answer and explanation', () => {
    const text = `Here are two hard ones from my notes!

1. Skill: Transitions
Difficulty: Hard
Researchers expected the drought to reduce the beetle population. ______ the population nearly doubled.
Which choice completes the text with the most logical transition?
A) Similarly,
B) Instead,
C) For example,
D) Therefore,
Answer: B
Explanation: The second sentence contrasts with the expectation.

2. [hard] In 1912 the poet published her first collection, which critics described as ______ because it broke with every convention of the period.
Which choice completes the text with the most logical and precise word or phrase?
A. derivative
B. iconoclastic
C. tentative
D. ornamental
Correct answer: B`;
    const items = parsePasted(text);
    expect(items).toHaveLength(2);
    const [a, b] = items;
    expect(a.issues).toEqual([]);
    expect(a.draft.skill).toBe('Transitions');
    expect(a.draft.difficulty).toBe('hard');
    expect(a.draft.passage).toMatch(/^Researchers expected/);
    expect(a.draft.question).toMatch(/^Which choice completes/);
    expect(a.draft.choices).toEqual({ A: 'Similarly,', B: 'Instead,', C: 'For example,', D: 'Therefore,' });
    expect(a.draft.answer).toBe('B');
    expect(a.draft.rationale).toMatch(/contrasts/);

    expect(b.draft.difficulty).toBe('hard');
    expect(b.draft.answer).toBe('B');
    expect(b.draft.choices.D).toBe('ornamental');
    // no skill given → left blank, not guessed, and not a problem
    expect(b.draft.skill).toBe('');
    expect(b.issues).toEqual([]);
  });

  it('handles inline choices, blank lines between choices and a ✅ marker', () => {
    const text = `The committee's report was notably ______: it avoided taking any position at all.
Which choice completes the text with the most logical and precise word or phrase?

A) equivocal B) strident C) exhaustive D) partisan ✅`;
    const [item] = parsePasted(text, { skill: 'WIC', difficulty: 'medium' });
    expect(item.draft.choices).toEqual({ A: 'equivocal', B: 'strident', C: 'exhaustive', D: 'partisan' });
    expect(item.draft.answer).toBe('D');
    expect(item.draft.skill).toBe('Words in Context');
    expect(item.draft.difficulty).toBe('medium');
    expect(item.issues).toEqual([]);
  });

  it('flags a question with only three choices and no answer', () => {
    const text = `Which choice best states the main idea?
A) one
B) two
C) three`;
    const [item] = parsePasted(text, { skill: 'Central Ideas', difficulty: 'hard' });
    expect(item.issues).toContain('Missing choice D');
    expect(item.issues).toContain('Missing answer (A–D)');
  });

  it('splits unnumbered questions after each answer', () => {
    const q = (n: string) => `Passage ${n} has some words in it that matter a lot for the meaning here.
Which choice most logically completes the text?
A) a${n}
B) b${n}
C) c${n}
D) d${n}
Answer: C`;
    const items = parsePasted(`${q('one')}\n\n${q('two')}`, { skill: 'Inferences', difficulty: 'hard' });
    expect(items).toHaveLength(2);
    expect(items[1].draft.choices.A).toBe('atwo');
    expect(items.every((i) => i.issues.length === 0)).toBe(true);
  });
});

describe('splitStem', () => {
  it('prefers the "The student wants" sentence for notes questions', () => {
    const pre = `While researching a topic, a student has taken the following notes:
• Fact one.
• Fact two? Maybe.
The student wants to emphasize a difference. Which choice most effectively uses relevant information from the notes to accomplish this goal?`;
    const { passage, question } = splitStem(pre);
    expect(question).toMatch(/^The student wants/);
    expect(passage).toMatch(/Fact two\? Maybe\.$/);
  });
});

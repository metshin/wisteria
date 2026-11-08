import { describe, expect, it } from 'vitest';
import { BOX_DAYS, deckWords, isDue, review, startOfDay, wordOfDay } from '../logic/flashcards';
import type { WordEntry } from '../types';

const w = (id: string, extra: Partial<WordEntry> = {}): WordEntry => ({ id, text: id, context: '', meaning: '', learned: false, addedAt: 0, ...extra });
const NOW = new Date(2026, 9, 26, 15, 0).getTime();
const DAY = 86_400_000;

describe('flashcards', () => {
  it('moves a word up the boxes and marks it learned after the last one', () => {
    let x = w('a');
    expect(isDue(x, NOW)).toBe(true);
    x = review(x, true, NOW);
    expect(x.box).toBe(1);
    expect(x.due).toBe(startOfDay(NOW) + DAY);
    expect(isDue(x, NOW)).toBe(false);
    for (let i = 1; i < BOX_DAYS.length; i++) x = review(x, true, NOW);
    expect(x.learned).toBe(false);
    x = review(x, true, NOW);
    expect(x.learned).toBe(true);
  });

  it('"Again" sends it back to box 0, due now', () => {
    const x = review(w('a', { box: 3, due: NOW + 5 * DAY }), false, NOW);
    expect(x).toMatchObject({ box: 0, due: NOW, learned: false });
  });

  it('builds decks', () => {
    const bank = [w('due'), w('later', { due: NOW + DAY }), w('done', { learned: true })];
    expect(deckWords(bank, 'due', NOW).map((x) => x.id)).toEqual(['due']);
    expect(deckWords(bank, 'learning', NOW).map((x) => x.id)).toEqual(['due', 'later']);
    expect(deckWords(bank, 'all', NOW)).toHaveLength(3);
  });

  it('keeps the same word of the day and prefers words still being learned', () => {
    const bank = [w('a'), w('b'), w('c'), w('d', { learned: true })];
    const first = wordOfDay(bank, undefined, NOW)!;
    expect(first.learned).toBe(false);
    expect(wordOfDay([w('new'), ...bank], { day: '2026-10-26', id: first.id }, NOW)!.id).toBe(first.id);
    expect(wordOfDay([], undefined, NOW)).toBeNull();
  });
});

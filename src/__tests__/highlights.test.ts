import { describe, expect, it } from 'vitest';
import { addHighlight, addWord, cleanWord, deleteHighlight, highlightAt, removeRange, sentenceAround, updateHighlight } from '../logic/highlights';
import type { TextHighlight, WordEntry } from '../types';

const hl = (id: string, start: number, end: number, extra: Partial<TextHighlight> = {}): TextHighlight =>
  ({ id, part: 'passage', start, end, color: 'yellow', underline: 'none', note: '', ...extra });

describe('highlights', () => {
  it('a new highlight replaces the overlapping part of older ones', () => {
    let l = addHighlight([], hl('a', 0, 10));
    l = addHighlight(l, hl('b', 5, 15, { color: 'pink' }));
    expect(l.map((h) => [h.id, h.start, h.end, h.color])).toEqual([['a', 0, 5, 'yellow'], ['b', 5, 15, 'pink']]);
  });

  it('removing the middle splits a highlight (new id for the second piece); other parts untouched', () => {
    const l = removeRange([hl('a', 0, 20, { note: 'n' }), hl('s', 0, 20, { part: 'stem' })], 'passage', 5, 10);
    expect(l.map((h) => [h.id, h.part, h.start, h.end, h.note])).toEqual([
      ['a', 'passage', 0, 5, 'n'], ['ab', 'passage', 10, 20, 'n'], ['s', 'stem', 0, 20, ''],
    ]);
  });

  it('edits, finds and deletes by id', () => {
    let l = [hl('a', 0, 5), hl('b', 10, 20)];
    l = updateHighlight(l, 'b', { color: 'blue', underline: 'dashed', note: 'contrast word' });
    expect(highlightAt(l, 'passage', 12)).toMatchObject({ id: 'b', color: 'blue', underline: 'dashed', note: 'contrast word' });
    expect(highlightAt(l, 'passage', 7)).toBeUndefined();
    expect(highlightAt(l, 'stem', 2)).toBeUndefined();
    expect(deleteHighlight(l, 'a').map((h) => h.id)).toEqual(['b']);
  });
});

describe('word bank helpers', () => {
  const text = 'The critics were dismissive. Her work was iconoclastic and bold! Nobody expected it.';
  it('finds the sentence a word came from', () => {
    const at = text.indexOf('iconoclastic');
    expect(sentenceAround(text, at, at + 12)).toBe('Her work was iconoclastic and bold!');
    expect(sentenceAround(text, 4, 11)).toBe('The critics were dismissive.');
  });

  it('cleans selections and skips duplicates', () => {
    expect(cleanWord(' “iconoclastic,” ')).toBe('iconoclastic');
    expect(cleanWord('well-being.')).toBe('well-being');
    const w = (text: string): WordEntry => ({ id: text, text, context: '', meaning: '', learned: false, addedAt: 0 });
    const first = addWord([], w('Iconoclastic'));
    expect(first.added).toBe(true);
    expect(addWord(first.bank, w('iconoclastic')).added).toBe(false);
  });
});

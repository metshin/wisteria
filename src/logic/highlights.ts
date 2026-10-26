import type { TextHighlight, WordEntry } from '../types';

type Part = TextHighlight['part'];

/** Remove [start, end) from any highlights in that part, trimming or splitting them. */
export function removeRange(list: TextHighlight[], part: Part, start: number, end: number): TextHighlight[] {
  const out: TextHighlight[] = [];
  for (const h of list) {
    if (h.part !== part || h.end <= start || h.start >= end) {
      out.push(h);
      continue;
    }
    if (h.start < start) out.push({ ...h, end: start });
    if (h.end > end) out.push({ ...h, id: `${h.id}b`, start: end });
  }
  return out;
}

/** Add a highlight; it replaces whatever was highlighted under it before (like Bluebook). */
export function addHighlight(list: TextHighlight[], h: TextHighlight): TextHighlight[] {
  if (h.end <= h.start) return list;
  return [...removeRange(list, h.part, h.start, h.end), h].sort((a, b) => a.start - b.start);
}

export function updateHighlight(list: TextHighlight[], id: string, patch: Partial<Pick<TextHighlight, 'color' | 'underline' | 'note'>>): TextHighlight[] {
  return list.map((h) => (h.id === id ? { ...h, ...patch } : h));
}

export function deleteHighlight(list: TextHighlight[], id: string): TextHighlight[] {
  return list.filter((h) => h.id !== id);
}

/** The highlight under a character position, if any. */
export function highlightAt(list: TextHighlight[], part: Part, offset: number): TextHighlight | undefined {
  return list.find((h) => h.part === part && offset >= h.start && offset < h.end);
}

/** The sentence around a selection, for the word bank. */
export function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const after = text.slice(end);
  const s = Math.max(before.lastIndexOf('. '), before.lastIndexOf('? '), before.lastIndexOf('! '), before.lastIndexOf('\n'));
  const ends = ['. ', '? ', '! ', '\n'].map((m) => after.indexOf(m)).filter((i) => i >= 0);
  const e = ends.length ? end + Math.min(...ends) + 1 : text.length;
  return text.slice(s < 0 ? 0 : s + 1, e).replace(/\s+/g, ' ').trim();
}

/** Tidy a selection into a word-bank entry: trim spaces and stray punctuation at the edges. */
export function cleanWord(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().replace(/^[\s"“”‘’'(\[,.;:!?—–-]+|[\s"“”‘’')\],.;:!?—–-]+$/g, '');
}

export function addWord(bank: WordEntry[], entry: WordEntry): { bank: WordEntry[]; added: boolean } {
  const key = entry.text.toLowerCase();
  if (!key || bank.some((w) => w.text.toLowerCase() === key)) return { bank, added: false };
  return { bank: [entry, ...bank], added: true };
}

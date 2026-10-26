import type { WordEntry } from '../types';
import { dayKey } from './session';

/**
 * Simple spaced repetition (Leitner boxes): "Got it" moves a word up a box and pushes it further out,
 * "Again" sends it back to box 0. A word that climbs past the last box is marked learned.
 */
export const BOX_DAYS = [1, 3, 7, 14, 30];
const DAY = 86_400_000;

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function isDue(w: WordEntry, now = Date.now()): boolean {
  return !w.learned && (w.due ?? 0) <= now;
}

export type Deck = 'due' | 'learning' | 'all';

export function deckWords(bank: WordEntry[], deck: Deck, now = Date.now()): WordEntry[] {
  if (deck === 'all') return bank;
  if (deck === 'learning') return bank.filter((w) => !w.learned);
  return bank.filter((w) => isDue(w, now));
}

/** Result of one flashcard answer. Due dates land at the start of a day, so a card is ready first thing that morning. */
export function review(w: WordEntry, gotIt: boolean, now = Date.now()): WordEntry {
  if (!gotIt) return { ...w, box: 0, due: now, learned: false };
  const box = (w.box ?? 0) + 1;
  if (box > BOX_DAYS.length) return { ...w, box, due: undefined, learned: true };
  return { ...w, box, due: startOfDay(now) + BOX_DAYS[box - 1] * DAY };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Today's word: the one already chosen today if it still exists, else a pick (the same all day)
 * from words still being learned (or any word once all are learned).
 */
export function wordOfDay(bank: WordEntry[], saved: { day: string; id: string } | undefined, now = Date.now()): WordEntry | null {
  const day = dayKey(now);
  const kept = saved?.day === day ? bank.find((w) => w.id === saved.id) : undefined;
  if (kept) return kept;
  const learning = bank.filter((w) => !w.learned);
  const pool = (learning.length ? learning : bank).slice().sort((a, b) => a.addedAt - b.addedAt || a.id.localeCompare(b.id));
  // Don't repeat yesterday's word if there's another choice.
  const pick = pool.length ? pool[hash(day) % pool.length] : null;
  if (pick && pool.length > 1 && saved && saved.day !== day && saved.id === pick.id) return pool[(hash(day) + 1) % pool.length];
  return pick;
}

export function dictUrl(word: string): string {
  return `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`;
}

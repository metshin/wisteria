import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extractPages, type Item, type Line, type PageText } from '../parse/pdfText';
import { parseCbPages } from '../parse/cbParser';

/*
 * The parser is tested on a small hand-built page that copies the Question Bank *layout*
 * (positions and labels) with original placeholder text. No real test material is included.
 */

/** One text line made of items at the given x positions (about 4.5pt per character). */
function line(page: number, y: number, parts: [number, string][], h = 9): Line {
  const items: Item[] = parts.map(([x, str]) => ({ x, w: str.length * 4.5, str }));
  const last = items[items.length - 1];
  return { page, y, x: items[0].x, xEnd: last.x + last.w, h, text: parts.map((p) => p[1]).join(' '), items };
}

const body = (page: number, y: number, text: string, x = 18) => line(page, y, [[x, text]]);
const label = (page: number, y: number, text: string) => line(page, y, [[18, text]], 8);

function fixture(): PageText[] {
  const p1: Line[] = [
    label(1, 760, 'Question ID: demo0001'),
    line(1, 740, [[18, 'Assessment'], [100, 'Test'], [200, 'Domain'], [320, 'Skill'], [440, 'Difficulty']], 8),
    line(1, 728, [[18, 'SAT'], [100, 'Reading and Writing'], [200, 'Craft and Structure'], [320, 'Words in Context'], [440, 'Hard']], 8),
    label(1, 700, 'Question'),
    body(1, 680, 'The lighthouse keeper on the small island kept a careful log of every passing ship, noting the'),
    body(1, 668, 'weather and the hour. Her notes were so ______ that historians still rely on them today.'),
    body(1, 640, 'Which choice completes the text with the most logical and precise word or phrase?'),
    label(1, 612, 'Answer'),
    body(1, 596, 'A. hurried'),
    body(1, 584, 'B. meticulous'),
    body(1, 572, 'C. careless'),
    body(1, 560, 'D. brief'),
    label(1, 530, 'Correct Answer: B'),
    label(1, 510, 'Rationale'),
    body(1, 494, 'Choice B is the best answer because a careful log of every ship is a meticulous record, one'),
  ];
  // The rationale runs onto the next page.
  const p2: Line[] = [body(2, 760, 'that later readers could trust.')];
  const p3: Line[] = [
    label(3, 760, 'Question ID: demo0002'),
    line(3, 740, [[18, 'Assessment'], [100, 'Test'], [200, 'Domain'], [320, 'Skill'], [440, 'Difficulty']], 8),
    line(3, 728, [[18, 'SAT'], [100, 'Reading and Writing'], [200, 'Information and Ideas'], [320, 'Central Ideas and'], [440, 'Medium']], 8),
    line(3, 718, [[320, 'Details']], 8),
    label(3, 700, 'Question'),
    body(3, 680, 'A town garden club planted three rows of beans and watered each row on a different schedule.'),
    body(3, 652, 'Which choice best states the main idea of the text?'),
    label(3, 630, 'Answer'),
    body(3, 614, 'A. Gardens need water.'),
    body(3, 602, 'B. The club compared watering schedules.'),
    body(3, 590, 'C. Beans grow in rows.'),
    label(3, 560, 'Correct Answer: B'),
  ];
  return [{ page: 1, lines: p1 }, { page: 2, lines: p2 }, { page: 3, lines: p3 }];
}

describe('Question Bank layout parser (placeholder fixture)', () => {
  const items = parseCbPages(fixture());

  it('finds one item per Question ID', () => {
    expect(items.map((i) => i.draft.cbId)).toEqual(['demo0001', 'demo0002']);
  });

  it('reads metadata, passage, question, choices, answer and rationale', () => {
    const q = items[0];
    expect(q.draft.domain).toBe('Craft and Structure');
    expect(q.draft.skill).toBe('Words in Context');
    expect(q.draft.difficulty).toBe('hard');
    expect(q.draft.passage).toMatch(/^The lighthouse keeper .* noting the weather and the hour\. Her notes were so ______ that historians still rely on them today\.$/);
    expect(q.draft.question).toBe('Which choice completes the text with the most logical and precise word or phrase?');
    expect(q.draft.choices).toEqual({ A: 'hurried', B: 'meticulous', C: 'careless', D: 'brief' });
    expect(q.draft.answer).toBe('B');
    expect(q.draft.rationale).toMatch(/^Choice B is the best answer/);
    expect(q.draft.rationale).toMatch(/could trust\.$/); // continues onto page 2
    expect(q.issues).toEqual([]);
  });

  it('joins a skill name that wraps onto a second line', () => {
    expect(items[1].draft.skill).toBe('Central Ideas and Details');
    expect(items[1].draft.difficulty).toBe('medium');
  });

  it('flags a missing choice', () => {
    expect(items[1].issues).toEqual(['Missing choice D']);
  });
});

/*
 * Optional: point CB_PDF at a Question Bank export you downloaded yourself to run the parser over it.
 * PDFs are never committed; without one this block is skipped.
 */
const PDF = process.env.CB_PDF ?? '';

describe.skipIf(!PDF || !existsSync(PDF))(`your own Question Bank PDF (${PDF || 'set CB_PDF'})`, () => {
  it('parses every question with choices and an answer', async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(PDF)) }).promise;
    const pages = await extractPages(doc as never, {
      OPS: pdfjs.OPS,
      wantRules: (lines) => lines.some((l) => /underlin/i.test(l.text)),
    });
    const items = parseCbPages(pages);
    expect(items.length).toBeGreaterThan(0);
    const ok = items.filter((i) => i.issues.length === 0);
    expect(ok.length / items.length).toBeGreaterThan(0.95);
  }, 300_000);
});

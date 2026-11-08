import { LETTERS, type Letter } from '../types';
import type { Item, Line, PageText } from './pdfText';
import { emptyDraft, findIssues, type Draft } from './validate';
import { normalizeDifficulty, normalizeSkill } from './skills';

/**
 * Parser for the College Board "Question Bank" PDF export layout.
 *
 * Layout of one question (each starts on a new page; long rationales run onto the next page):
 *   Question ID: 0a1b2c3d
 *   Assessment | Test | Domain | Skill | Difficulty      ← header row, 5 columns
 *   SAT | Reading and Writing | <domain> | <skill> | Hard   (cells may wrap)
 *   Question                                            ← small label
 *   passage paragraphs (x=18), literary excerpts / notes (x=27 or x=48), "Text 1"/"Text 2" labels,
 *   charts and tables (other positions/sizes, kept as images), then the question sentence
 *   Answer                                              ← label, then choices "A. …" with wrapped lines indented
 *   Correct Answer: B
 *   Rationale
 *   rationale text…
 */

export interface FigureBox {
  page: number;
  /** PDF user-space coordinates (y grows upward). */
  top: number;
  bottom: number;
}

export interface CbItem {
  draft: Draft;
  issues: string[];
  raw: string;
  figures: FigureBox[];
}

const ID_RE = /^\s*Question ID:\s*(\S+)/;
const CHOICE_RE = /^([A-D])\.\s+(.*)$/;
const CORRECT_RE = /^\s*Correct Answer:\s*([A-D])\b/;
const TEXT_X = [18, 27, 48];

const plain = (s: string) => s.replace(/<\/?u>/g, '');
const isLabel = (l: Line, word: string) => plain(l.text).trim() === word;
const near = (a: number, b: number, tol = 1.5) => Math.abs(a - b) <= tol;

/** Largest horizontal gap between visible items; table rows have big ones, prose doesn't. */
function maxGap(items: Item[]): number {
  let gap = 0;
  let prevEnd: number | null = null;
  for (const it of items) {
    if (!it.str.trim()) continue;
    if (prevEnd !== null) gap = Math.max(gap, it.x - prevEnd);
    prevEnd = it.x + it.w;
  }
  return gap;
}

/** Width of the line's first word, which may be split over several items ("text’" + "s"). */
function firstWordWidth(l: Line): number {
  let width = 0;
  let started = false;
  for (const it of l.items) {
    const lead = it.str.length - it.str.trimStart().length;
    if (!started) {
      if (!it.str.trim()) continue;
      started = true;
    } else if (lead > 0) {
      break; // a space ends the word
    }
    const sp = it.str.indexOf(' ', lead);
    if (sp > 0) return width + (it.w * (sp - lead)) / it.str.length;
    width += (it.w * (it.str.length - lead)) / it.str.length;
  }
  return width;
}

/** Join wrapped lines: same paragraph → space, a line that ended early → newline, big gap → blank line. */
function joiner(prev: Line, next: Line, rightEdge: number): string {
  const hyphen = /[-—–]$/.test(plain(prev.text).trimEnd());
  // Across a page break, the last line of the page often looks short; it's still the same sentence.
  if (prev.page !== next.page) return hyphen ? '' : ' ';
  if (prev.y - next.y > 20) return '\n\n';
  // A change of indent (intro sentence → excerpt) starts a new paragraph; x=29 is a wrapped choice.
  if (!near(prev.x, next.x, 2) && !near(next.x, 29) && !near(prev.x, 29)) return '\n\n';
  // Line-by-line breaks (notes bullets, short poem lines) only happen in indented excerpts. CB wraps
  // prose a little unevenly, so a break needs a clearly short line or a finished sentence.
  const indented = prev.x > TEXT_X[0] + 5 && near(prev.x, next.x, 2) && !near(prev.x, 29);
  const fits = indented && prev.xEnd + 3 + firstWordWidth(next) <= rightEdge;
  const clearlyShort = prev.xEnd < rightEdge - 120;
  const sentenceEnd = /[.!?:;"”)]$/.test(plain(prev.text).trimEnd()) && /^[“"A-Z0-9]/.test(plain(next.text).trimStart());
  if (fits && (clearlyShort || sentenceEnd)) return '\n';
  return hyphen ? '' : ' ';
}

function joinLines(lines: Line[], rightEdge: number): string {
  let out = '';
  lines.forEach((l, i) => {
    if (i > 0) out += joiner(lines[i - 1], l, rightEdge);
    out += i > 0 && out.endsWith('\n') ? l.text.trimStart() : l.text;
  });
  return out.replace(/[ \t]+\n/g, '\n').replace(/<\/u>(\s*)<u>/g, '$1').trim();
}

/** Split a row into cells at wide gaps between items. */
function cells(line: Line): { x: number; text: string }[] {
  const out: { x: number; text: string }[] = [];
  let cur: { x: number; text: string } | null = null;
  let prevEnd: number | null = null;
  for (const it of line.items) {
    if (!it.str.trim()) continue;
    if (!cur || (prevEnd !== null && it.x - prevEnd > 12)) {
      cur = { x: it.x, text: '' };
      out.push(cur);
    } else if (prevEnd !== null && it.x - prevEnd > 1) {
      cur.text += ' ';
    }
    cur.text += it.str;
    prevEnd = it.x + it.w;
  }
  return out.map((c) => ({ ...c, text: plain(c.text).replace(/\s+/g, ' ').trim() }));
}

function parseMeta(header: Line, rows: Line[]): Record<string, string> {
  const cols = cells(header);
  const meta: Record<string, string> = {};
  for (const row of rows) {
    for (const c of cells(row)) {
      let col = cols[0];
      for (const h of cols) if (h.x <= c.x + 4) col = h;
      const key = col.text.toLowerCase();
      meta[key] = meta[key] ? `${meta[key]} ${c.text}` : c.text;
    }
  }
  return meta;
}

/** Most common rounded text height = body text size. */
function bodyHeight(lines: Line[]): number {
  const n = new Map<number, number>();
  for (const l of lines) n.set(l.h, (n.get(l.h) ?? 0) + l.text.length);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 9;
}

export function parseCbPages(pages: PageText[]): CbItem[] {
  const all = pages.flatMap((p) => p.lines);
  if (!all.length) return [];
  // Right margin of ordinary text (charts and tables can stick out further).
  const textLines = all.filter((l) => near(l.x, TEXT_X[0]));
  const rightEdge = Math.max(...(textLines.length ? textLines : all).map((l) => l.xEnd));
  const bodyH = bodyHeight(all);

  const groups: Line[][] = [];
  for (const l of all) {
    if (ID_RE.test(plain(l.text))) groups.push([l]);
    else groups[groups.length - 1]?.push(l);
  }
  return groups.map((g) => parseGroup(g, rightEdge, bodyH));
}

function parseGroup(g: Line[], rightEdge: number, bodyH: number): CbItem {
  const draft = emptyDraft('cb-pdf');
  const extra: string[] = [];
  const figures: FigureBox[] = [];
  const raw = g.map((l) => plain(l.text)).join('\n');
  draft.cbId = plain(g[0].text).match(ID_RE)![1];

  const find = (pred: (l: Line) => boolean, from = 0) => {
    for (let i = from; i < g.length; i++) if (pred(g[i])) return i;
    return -1;
  };
  const iHead = find((l) => plain(l.text).trim().startsWith('Assessment'));
  const iQ = find((l) => isLabel(l, 'Question'), Math.max(iHead, 0));
  const iA = find((l) => isLabel(l, 'Answer'), Math.max(iQ, 0));
  const iC = find((l) => CORRECT_RE.test(plain(l.text)), Math.max(iA, 0));
  const iR = find((l) => isLabel(l, 'Rationale'), Math.max(iC, 0));

  if (iHead < 0 || iQ < 0 || iA < 0) {
    return { draft, issues: [...findIssues(draft), "Layout not recognised (couldn't find the Question/Answer labels)"], raw, figures };
  }

  // A few questions use a larger font throughout, so learn the body size from this question's choices.
  const choiceBlock = g.slice(iA + 1, iC >= 0 ? iC : iR >= 0 ? iR : g.length);
  if (choiceBlock.length) bodyH = bodyHeight(choiceBlock);

  // Metadata
  const meta = parseMeta(g[iHead], g.slice(iHead + 1, iQ));
  draft.domain = meta.domain;
  draft.skill = normalizeSkill(meta.skill);
  draft.difficulty = normalizeDifficulty(meta.difficulty);

  // Body: passage, labels, figures, question sentence
  // Body lines in reading order (tables list their cells column by column, so sort by position).
  const body = g.slice(iQ + 1, iA)
    .map((l, k) => ({ l, k }))
    .sort((a, b) => a.l.page - b.l.page || b.l.y - a.l.y || a.k - b.k)
    .map(({ l }) => l);
  const isTextLabel = (l: Line) => /^Text \d$/.test(plain(l.text).trim()) && l.h < bodyH;
  // Prose = body-size text with no wide gaps. Charts use other sizes; table rows have wide gaps.
  const prose = (l: Line) => l.h === bodyH && maxGap(l.items) < 12;
  const mainColumn = (l: Line) => near(l.x, TEXT_X[0]) || plain(l.text).trim().startsWith('©');
  // Chart/table lines, grown outward: an indented prose-looking line (a table title or header cell,
  // a one-cell row) within 32pt of a figure line belongs to the figure. Main-column text never does.
  const inFig = body.map((l) => !prose(l) && !isTextLabel(l));
  for (let changed = true; changed; ) {
    changed = false;
    body.forEach((l, k) => {
      if (inFig[k] || mainColumn(l) || isTextLabel(l)) return;
      if (body.some((o, j) => inFig[j] && o.page === l.page && Math.abs(o.y - l.y) < 32)) inFig[k] = changed = true;
    });
  }

  type Seg = { kind: 'text' | 'fig'; lines: Line[] } | { kind: 'label'; text: string };
  const segs: Seg[] = [];
  body.forEach((l, k) => {
    const last = segs[segs.length - 1];
    const kind = inFig[k] ? 'fig' : 'text';
    if (isTextLabel(l)) segs.push({ kind: 'label', text: plain(l.text).trim() });
    else if (last && last.kind === kind) last.lines.push(l);
    else segs.push({ kind, lines: [l] });
  });

  // Text blocks become paragraphs; the question sentence is the last paragraph of the last one.
  const texts = new Map<Seg, string>();
  for (const sgm of segs) if (sgm.kind === 'text') texts.set(sgm, joinLines(sgm.lines, rightEdge));
  const lastText = [...segs].reverse().find((sgm) => sgm.kind === 'text');
  let stem = '';
  if (lastText) {
    const joined = texts.get(lastText)!;
    const cut = joined.lastIndexOf('\n\n');
    stem = cut >= 0 ? joined.slice(cut + 2) : joined;
    texts.set(lastText, cut >= 0 ? joined.slice(0, cut) : '');
  }

  // Lines that frame a figure: text lines and the Question/Answer labels on the same page.
  const frame = [g[iQ], ...body.filter((_, k) => !inFig[k]), g[iA]];
  const parts: string[] = [];
  for (const sgm of segs) {
    if (sgm.kind === 'label') parts.push(sgm.text);
    else if (sgm.kind === 'text') {
      const t = texts.get(sgm)!;
      if (t.trim()) parts.push(t);
    } else {
      const page = sgm.lines[0].page;
      if (sgm.lines.some((l) => l.page !== page)) extra.push('Chart/table runs across a page break; check the figure');
      const figTop = Math.max(...sgm.lines.map((l) => l.y + l.h));
      const figBottom = Math.min(...sgm.lines.map((l) => l.y));
      const above = frame.filter((l) => l.page === page && l.y > figTop).sort((a, b) => a.y - b.y)[0];
      const below = frame.filter((l) => l.page === page && l.y + l.h < figBottom).sort((a, b) => b.y - a.y)[0];
      const top = above ? above.y - 3.5 : figTop + 6;
      const bottom = below ? below.y + below.h + 1 : figBottom - 8;
      parts.push(`[[fig:${figures.length}]]`);
      figures.push({ page, top, bottom });
    }
  }
  draft.passage = parts.join('\n\n').trim();
  draft.question = stem.trim();

  // Choices
  const choiceEnd = iC >= 0 ? iC : iR >= 0 ? iR : g.length;
  let curL: Letter | null = null;
  const choiceLines: Partial<Record<Letter, Line[]>> = {};
  for (const l of g.slice(iA + 1, choiceEnd)) {
    const m = plain(l.text).trim().match(CHOICE_RE);
    if (m && near(l.x, 18) && (curL === null || LETTERS.indexOf(m[1] as Letter) === LETTERS.indexOf(curL) + 1)) {
      curL = m[1] as Letter;
      choiceLines[curL] = [{ ...l, text: l.text.replace(/^(\s*(?:<u>)?)[A-D]\.\s+/, '$1') }];
    } else if (curL) {
      choiceLines[curL]!.push(l);
    }
  }
  for (const L of LETTERS) {
    const ls = choiceLines[L];
    if (ls) draft.choices[L] = joinLines(ls, rightEdge).replace(/\s*\n\s*/g, ' ');
  }

  // Answer + rationale
  if (iC >= 0) draft.answer = plain(g[iC].text).match(CORRECT_RE)![1] as Letter;
  if (iR >= 0) draft.rationale = plain(joinLines(g.slice(iR + 1), rightEdge));

  if (/underlin/i.test(draft.question) && !/<u>/.test(draft.passage + draft.question)) {
    extra.push("Mentions underlined text but no underline was found: add <u>…</u> around it");
  }

  return { draft: { ...draft }, issues: [...findIssues(draft), ...extra], raw, figures };
}

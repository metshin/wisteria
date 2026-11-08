import { LETTERS, type Letter } from '../types';
import { emptyDraft, findIssues, type Draft } from './validate';
import { normalizeDifficulty, normalizeSkill } from './skills';

/**
 * Forgiving parser for questions copied from Reddit, TikTok captions, notes apps etc.
 * It never guesses silently: anything it can't find ends up in `issues` for the fix queue.
 */

export interface ParsedItem {
  draft: Draft;
  issues: string[];
  raw: string;
}

export interface PasteDefaults {
  skill?: string;
  difficulty?: string;
}

const START_RE = /^\s*(?:(?:Q(?:uestion)?|#)\s*)?(\d{1,3})\s*[.):]\s+(?=\S)/i;
const START_ALONE_RE = /^\s*(?:Q(?:uestion)?|#)\s*(\d{1,3})\s*[.):]?\s*$/i;
const SEP_RE = /^\s*([-=*_~])\1{2,}\s*$/;
const CHOICE_RE = /^\s*[([]?([A-D])\s*[).:\]]\s*(.*)$/;
const ANSWER_RE = /^\s*(?:correct\s+answer|correct\s+choice|answer(?:\s+key)?|ans|key)\s*(?:is)?\s*[:\-–=]?\s*(?:choice\s+|option\s+)?[([]?([A-D])[)\]]?(?![a-zA-Z])\s*[.:\-–]?\s*(.*)$/i;
const RATIONALE_RE = /^\s*(explanation|rationale|reasoning|solution|why)\b\s*(?:[:\-–]\s*(.*)|$)/i;
const META_RE = /^\s*(skill|domain|difficulty|level|topic|type)\s*[:\-–]\s*(.+?)\s*$/i;
const CORRECT_MARK_RE = /\s*(?:✅|✔️?|✓|\(correct\)|\*correct\*)\s*/i;

function clean(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\t/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/^\s*>\s?/gm, '');
}

/** Split pasted text into one chunk per question. */
export function splitBlocks(text: string): string[] {
  const lines = clean(text).split('\n');
  const starts: number[] = [];
  let lastNum: number | null = null;
  lines.forEach((line, i) => {
    if (SEP_RE.test(line)) {
      starts.push(i);
      return;
    }
    const m = line.match(START_RE) ?? line.match(START_ALONE_RE);
    if (!m) return;
    // Don't treat "A. 1. ..." style choices as starts; also require numbering to go up by one.
    if (CHOICE_RE.test(line)) return;
    const n = Number(m[1]);
    if (lastNum === null || n === lastNum + 1) {
      starts.push(i);
      lastNum = n;
    }
  });

  let blocks: string[];
  if (starts.length) {
    blocks = [];
    const head = lines.slice(0, starts[0]).join('\n');
    if (hasChoices(head)) blocks.push(head);
    starts.forEach((s, k) => {
      const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
      const chunk = lines.slice(SEP_RE.test(lines[s]) ? s + 1 : s, end).join('\n');
      blocks.push(chunk);
    });
  } else {
    blocks = splitByAnswers(lines.join('\n'));
  }
  return blocks.map((b) => b.trim()).filter((b) => b && /\S/.test(b) && (hasChoices(b) || b.length > 40));
}

function hasChoices(s: string): boolean {
  return /(^|\s)[([]?A\s*[).:\]]\s/m.test(s) && /(^|\s)[([]?B\s*[).:\]]\s/m.test(s);
}

/** Fallback when questions aren't numbered: a question ends after its answer (and labelled explanation). */
function splitByAnswers(text: string): string[] {
  const paras = text.split(/\n\s*\n/);
  const blocks: string[] = [];
  let cur: string[] = [];
  let answered = false;
  for (const p of paras) {
    const startsRationale = RATIONALE_RE.test(p) || /^\s*Choice [A-D] is/i.test(p);
    if (answered && !startsRationale) {
      blocks.push(cur.join('\n\n'));
      cur = [];
      answered = false;
    }
    cur.push(p);
    if (p.split('\n').some((l) => ANSWER_RE.test(l))) answered = true;
  }
  if (cur.length) blocks.push(cur.join('\n\n'));
  return blocks;
}

/** Split "A) foo B) bar C) baz D) qux" written on one line into four lines. */
function expandInlineChoices(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const marks = [...line.matchAll(/(?:^|\s)[([]?([A-D])[).]\s+/g)];
    const letters = marks.map((m) => m[1]).join('');
    if (marks.length >= 3 && letters.includes('ABC')) {
      const startA = marks.find((m) => m[1] === 'A')!.index!;
      if (startA > 0 && line.slice(0, startA).trim()) out.push(line.slice(0, startA));
      const pieces = marks.filter((m) => m.index! >= startA);
      pieces.forEach((m, k) => {
        const end = k + 1 < pieces.length ? pieces[k + 1].index! : line.length;
        out.push(line.slice(m.index!, end).trim());
      });
    } else {
      out.push(line);
    }
  }
  return out;
}

const STEM_START = /(^|[\n.!?"”)]\s*)((?:The student wants to|Which choice|Which (?:finding|quotation|statement|of the following|option)|What (?:is|does|function|can)|Based on (?:the )?text|According to the text|As used in the text|How (?:does|would)|Which)\b)/g;

/** Separate the passage from the question sentence that comes right before the choices. */
export function splitStem(pre: string): { passage: string; question: string } {
  const text = pre.trim();
  if (!text) return { passage: '', question: '' };
  const candidates: number[] = [];
  let student = -1;
  for (const m of text.matchAll(STEM_START)) {
    const pos = m.index! + m[1].length;
    if (!text.slice(pos).includes('?')) continue;
    candidates.push(pos);
    if (m[2].startsWith('The student wants')) student = pos;
  }
  let pos = student >= 0 ? student : candidates.length ? candidates[candidates.length - 1] : -1;
  if (pos < 0) {
    const paras = text.split(/\n\s*\n/);
    const last = paras[paras.length - 1].trim();
    if (paras.length > 1 && last.endsWith('?')) pos = text.lastIndexOf(last);
  }
  if (pos < 0) return { passage: text, question: '' };
  return { passage: text.slice(0, pos).trim(), question: text.slice(pos).trim() };
}

export function parseBlock(raw: string, defaults: PasteDefaults = {}): ParsedItem {
  const draft = emptyDraft('paste');
  let lines = clean(raw).split('\n');

  // Drop the leading "3." / "Question 3" marker.
  const first = lines.findIndex((l) => l.trim());
  if (first >= 0) {
    if (START_ALONE_RE.test(lines[first])) lines.splice(first, 1);
    else lines[first] = lines[first].replace(START_RE, '');
  }

  // Metadata lines (Skill: …, Difficulty: …), and a leading [Hard] tag.
  const meta: Record<string, string> = {};
  lines = lines.filter((l) => {
    const m = l.match(META_RE);
    if (m && !CHOICE_RE.test(l)) {
      meta[m[1].toLowerCase()] = m[2];
      return false;
    }
    return true;
  });
  const tagLine = lines.findIndex((l) => l.trim());
  if (tagLine >= 0) {
    const t = lines[tagLine].match(/^\s*[[(](hard|medium|easy)[\])]\s*/i);
    if (t) {
      meta.difficulty ??= t[1];
      lines[tagLine] = lines[tagLine].slice(t[0].length);
    }
  }

  lines = expandInlineChoices(lines);

  // Locate answer and rationale lines.
  let answerIdx = -1;
  let rationaleIdx = -1;
  lines.forEach((l, i) => {
    if (answerIdx < 0 && ANSWER_RE.test(l)) answerIdx = i;
    if (rationaleIdx < 0 && RATIONALE_RE.test(l)) rationaleIdx = i;
  });
  const stopAt = Math.min(...[answerIdx, rationaleIdx, lines.length].filter((x) => x >= 0));

  // Find the best A→B→C→D run before the answer/rationale.
  let best: { start: number; found: Partial<Record<Letter, number>>; end: number } | null = null;
  for (let i = 0; i < stopAt; i++) {
    const m = lines[i].match(CHOICE_RE);
    if (!m || m[1] !== 'A') continue;
    const found: Partial<Record<Letter, number>> = { A: i };
    let want = 1;
    let j = i + 1;
    for (; j < stopAt && want < 4; j++) {
      const c = lines[j].match(CHOICE_RE);
      if (c && c[1] === LETTERS[want]) {
        found[LETTERS[want]] = j;
        want++;
      }
    }
    if (!best || Object.keys(found).length > Object.keys(best.found).length) best = { start: i, found, end: stopAt };
    if (want === 4) break;
  }

  let pre: string;
  if (best) {
    pre = lines.slice(0, best.start).join('\n');
    const idxs = LETTERS.map((l) => best!.found[l]);
    LETTERS.forEach((l, k) => {
      const at = idxs[k];
      if (at === undefined) return;
      const next = idxs.slice(k + 1).find((x) => x !== undefined) ?? best!.end;
      const parts = [lines[at].match(CHOICE_RE)![2]];
      for (let j = at + 1; j < next; j++) {
        const t = lines[j].trim();
        if (!t) {
          if (k === 3) break; // after D, a blank line ends the choice
          continue;
        }
        parts.push(t);
      }
      draft.choices[l] = parts.join(' ').replace(/\s+/g, ' ').trim();
    });
  } else {
    pre = lines.slice(0, stopAt).join('\n');
  }

  // Answer.
  let tail = '';
  if (answerIdx >= 0) {
    const m = lines[answerIdx].match(ANSWER_RE)!;
    draft.answer = m[1].toUpperCase() as Letter;
    tail = m[2] ?? '';
  } else {
    const marked = LETTERS.filter((l) => CORRECT_MARK_RE.test(draft.choices[l]));
    if (marked.length === 1) draft.answer = marked[0];
  }
  for (const l of LETTERS) draft.choices[l] = draft.choices[l].replace(CORRECT_MARK_RE, ' ').trim();

  // Rationale: labelled explanation, else whatever follows the answer line.
  if (rationaleIdx >= 0) {
    const m = lines[rationaleIdx].match(RATIONALE_RE)!;
    draft.rationale = [m[2] ?? '', ...lines.slice(rationaleIdx + 1)].join('\n').trim();
    if (answerIdx > rationaleIdx) {
      // Answer line sits inside the rationale text: remove it from there.
      draft.rationale = draft.rationale.replace(lines[answerIdx], '').trim();
    }
  } else if (answerIdx >= 0) {
    draft.rationale = [tail, ...lines.slice(answerIdx + 1)].join('\n').trim();
  }
  if (rationaleIdx >= 0 && tail && answerIdx < rationaleIdx) draft.rationale = `${tail}\n${draft.rationale}`.trim();

  const { passage, question } = splitStem(pre);
  draft.passage = passage;
  draft.question = question;
  draft.skill = normalizeSkill(meta.skill ?? meta.topic ?? meta.type ?? defaults.skill);
  draft.difficulty = normalizeDifficulty(meta.difficulty ?? meta.level ?? defaults.difficulty);
  if (meta.domain) draft.domain = meta.domain;

  return { draft, issues: findIssues(draft), raw: raw.trim() };
}

export function parsePasted(text: string, defaults: PasteDefaults = {}): ParsedItem[] {
  return splitBlocks(text).map((b) => parseBlock(b, defaults));
}

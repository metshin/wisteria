/**
 * Turn PDF pages into positioned text lines using pdf.js.
 * Works in the browser (with a worker) and in Node tests (legacy build), because it only
 * needs the PDFDocumentProxy-like object passed in.
 */

export interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

export interface Item {
  x: number;
  w: number;
  str: string;
}

export interface Line {
  page: number;
  y: number;
  x: number;
  xEnd: number;
  h: number;
  /** Text with underlined parts wrapped in <u>…</u>. */
  text: string;
  items: Item[];
}

export interface Rule {
  x0: number;
  x1: number;
  y: number;
}

export interface PageText {
  page: number;
  lines: Line[];
}

interface PageLike {
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  cleanup?(): void;
}

export interface DocLike {
  numPages: number;
  getPage(n: number): Promise<PageLike>;
}

export interface OpsLike {
  save: number;
  restore: number;
  transform: number;
  constructPath: number;
}

/**
 * The College Board PDFs kern "rt" (and "’ll") so tightly that pdf.js reports a space inside a
 * single text item ("repor ted"). Real word spaces are always separate items in these files,
 * so a space inside one item between r and t is never a real one.
 */
export function repairItemText(s: string): string {
  return s.replace(/r t/g, 'rt').replace(/’ ll/g, '’ll');
}

const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', '+': '₊', '-': '₋', '−': '₋' };
const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻', '−': '⁻' };

/** Use Unicode sub/superscript digits when possible; otherwise keep the text as is. */
function toScript(s: string, map: Record<string, string>): string {
  return [...s].every((c) => map[c]) ? [...s].map((c) => map[c]).join('') : s;
}

export function buildLines(page: number, rawItems: unknown[]): Line[] {
  const lines: Line[] = [];
  let cur: Line | null = null;
  for (const raw of rawItems as TextItemLike[]) {
    // Empty items are pdf.js end-of-line markers; lines are decided by position instead.
    if (typeof raw.str !== 'string' || raw.str === '') continue;
    const x = raw.transform[4];
    const y = raw.transform[5];
    const dy = cur ? y - cur.y : 0;
    // Small text nudged up/down on the same line is a subscript/superscript (NH₃, cm²).
    const isScript = !!cur && cur.h > 0 && raw.str.trim() !== '' && Math.abs(dy) > 1 && Math.abs(dy) < 6 &&
      raw.height > 0 && raw.height < cur.h * 0.9 && x >= cur.xEnd - 1 && x - cur.xEnd < 3;
    // A space nudged along with a subscript stays on the line too.
    const nudgedSpace = !!cur && raw.str.trim() === '' && Math.abs(dy) < 6;
    if (!isScript && !nudgedSpace && (!cur || Math.abs(dy) > 2)) {
      if (cur && cur.text.trim()) lines.push(cur);
      cur = { page, y, x, xEnd: x, h: 0, text: '', items: [] };
    }
    if (!cur) continue;
    let str = repairItemText(raw.str);
    if (isScript) {
      str = toScript(str, dy < 0 ? SUB : SUP);
      cur.items.push({ x, w: raw.width, str });
      cur.text += str;
      cur.xEnd = Math.max(cur.xEnd, x + raw.width);
      continue;
    }
    if (!cur.items.length || !cur.text.trim()) cur.x = str.trim() ? x : cur.x;
    cur.items.push({ x, w: raw.width, str });
    cur.text += str;
    if (str.trim()) cur.xEnd = Math.max(cur.xEnd, x + raw.width);
    if (raw.height) cur.h = Math.max(cur.h, Math.round(raw.height));
  }
  if (cur && cur.text.trim()) lines.push(cur);
  for (const l of lines) {
    // drop leading/trailing whitespace items so x is the first visible glyph
    const first = l.items.find((i) => i.str.trim());
    if (first) l.x = first.x;
  }
  return lines;
}

type Mat = [number, number, number, number, number, number];
const mul = (a: Mat, b: Mat): Mat => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const apply = (m: Mat, x: number, y: number) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Thin horizontal shapes on the page (underlines and table rules). */
export function findRules(ops: { fnArray: number[]; argsArray: unknown[][] }, OPS: OpsLike): Rule[] {
  let ctm: Mat = [1, 0, 0, 1, 0, 0];
  const stack: Mat[] = [];
  const rules: Rule[] = [];
  ops.fnArray.forEach((fn, i) => {
    const a = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, a as unknown as Mat);
    else if (fn === OPS.constructPath) {
      const mm = a?.[2] as ArrayLike<number> | undefined;
      if (!mm || mm.length < 4) return;
      const [ax, ay] = apply(ctm, mm[0], mm[1]);
      const [bx, by] = apply(ctm, mm[2], mm[3]);
      const h = Math.abs(by - ay);
      const w = Math.abs(bx - ax);
      if (h < 2 && w > 4) rules.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), y: Math.min(ay, by) });
    }
  });
  return rules;
}

/** Wrap the characters sitting over an underline rule in <u>…</u>. */
export function applyUnderlines(line: Line, rules: Rule[]): void {
  const under = rules.filter((r) => r.y < line.y && r.y > line.y - 4.5);
  if (!under.length) return;
  const flags: boolean[] = [];
  let text = '';
  for (const it of line.items) {
    const n = it.str.length || 1;
    for (let k = 0; k < it.str.length; k++) {
      const cx = it.x + ((k + 0.5) / n) * it.w;
      flags.push(under.some((r) => cx >= r.x0 - 0.5 && cx <= r.x1 + 0.5));
      text += it.str[k];
    }
  }
  // Spaces take the state of the text around them so "<u>a b</u>" stays one span.
  for (let k = 0; k < text.length; k++) {
    if (text[k] === ' ' && flags[k]) {
      const prev = flags[k - 1] ?? false;
      const next = flags[k + 1] ?? false;
      flags[k] = prev && next;
    }
  }
  let out = '';
  let open = false;
  for (let k = 0; k < text.length; k++) {
    if (flags[k] && !open) { out += '<u>'; open = true; }
    if (!flags[k] && open) { out += '</u>'; open = false; }
    out += text[k];
  }
  if (open) out += '</u>';
  line.text = out;
}

export interface ExtractOptions {
  OPS: OpsLike;
  /** Read drawing data only for pages where this returns true (it's slow). */
  wantRules?: (lines: Line[]) => boolean;
  onProgress?: (done: number, total: number) => void;
}

export async function extractPages(doc: DocLike, opts: ExtractOptions): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = buildLines(p, tc.items);
    if (opts.wantRules?.(lines)) {
      const rules = findRules(await page.getOperatorList(), opts.OPS);
      for (const l of lines) applyUnderlines(l, rules);
    }
    page.cleanup?.();
    pages.push({ page: p, lines });
    opts.onProgress?.(p, doc.numPages);
  }
  return pages;
}

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { HL_COLORS, HL_UNDERLINES, type TextHighlight } from '../types';
import { useStore, uid } from '../store/store';
import { addWord, cleanWord, sentenceAround } from '../logic/highlights';

type Part = TextHighlight['part'];

/* ---------- character offsets <-> DOM ranges ---------- */

/** Characters of text inside `container` before (node, offset). */
export function offsetOf(container: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.selectNodeContents(container);
  r.setEnd(node, offset);
  return r.toString().length;
}

export function rangeFromOffsets(container: Node, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let pos = 0;
  let started = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = n.textContent?.length ?? 0;
    if (!started && start <= pos + len) {
      r.setStart(n, Math.max(0, start - pos));
      started = true;
    }
    if (started && end <= pos + len) {
      r.setEnd(n, Math.max(0, end - pos));
      return r;
    }
    pos += len;
  }
  return null;
}

export const canHighlight = typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

const LAYERS = HL_COLORS.flatMap((c) => HL_UNDERLINES.map((u) => `hl-${c}-${u}`));

/**
 * Paint highlights with the CSS Custom Highlight API (no DOM changes, so underlines/figures stay intact).
 * One layer per colour + underline style; the highlight being edited also gets an outline layer.
 */
export function paintHighlights(parts: { el: HTMLElement | null; list: TextHighlight[] }[], activeId?: string | null): () => void {
  if (!canHighlight) return () => {};
  const layers = new Map<string, Range[]>(LAYERS.map((k) => [k, []]));
  const active: Range[] = [];
  for (const { el, list } of parts) {
    if (!el) continue;
    for (const h of list) {
      const r = rangeFromOffsets(el, h.start, h.end);
      if (!r) continue;
      layers.get(`hl-${h.color}-${h.underline}`)!.push(r);
      if (h.id === activeId) active.push(r);
    }
  }
  for (const [k, ranges] of layers) CSS.highlights.set(k, new Highlight(...ranges));
  const act = new Highlight(...active);
  act.priority = 1;
  CSS.highlights.set('hl-active', act);
  return () => [...LAYERS, 'hl-active'].forEach((k) => CSS.highlights.delete(k));
}

/** Character offset of the point (x, y) inside `container`, or null if it's outside. */
export function caretOffsetAt(container: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | undefined;
  let offset = 0;
  const p = doc.caretPositionFromPoint?.(x, y);
  if (p) {
    node = p.offsetNode;
    offset = p.offset;
  } else {
    const r = doc.caretRangeFromPoint?.(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }
  if (!node || !container.contains(node)) return null;
  return offsetOf(container, node, offset);
}

/** The current text selection as offsets inside a data-hl-part container (for the Highlights & Notes button). */
export function currentSelection(root: HTMLElement): { part: Part; start: number; end: number; text: string } | null {
  const s = window.getSelection();
  if (!s || s.isCollapsed || !s.rangeCount) return null;
  const range = s.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return null;
  const startEl = range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : (range.startContainer as Element);
  const box = startEl?.closest<HTMLElement>('[data-hl-part]');
  if (!box) return null;
  const all = box.textContent ?? '';
  let start = offsetOf(box, range.startContainer, range.startOffset);
  let end = box.contains(range.endContainer) ? offsetOf(box, range.endContainer, range.endOffset) : all.length;
  // Don't include spaces picked up at the edges of a drag.
  while (start < end && /\s/.test(all[start])) start++;
  while (end > start && /\s/.test(all[end - 1])) end--;
  if (end <= start) return null;
  return { part: box.dataset.hlPart as Part, start, end, text: all.slice(start, end) };
}

/* ---------- the floating toolbar ---------- */

interface Sel {
  text: string;
  top: number;
  left: number;
  part: Part | null;
  start: number;
  end: number;
  context: string;
}

/**
 * Shows a small toolbar above any text selected inside `root`: add to word bank, copy.
 * (Highlighting during a test goes through the Bluebook-style Highlights & Notes button instead.)
 */
export default function SelectionMenu({ root, questionId, skipHighlightable = false }: {
  root: RefObject<HTMLElement | null>;
  questionId?: string;
  /** With Highlights & Notes on, passage/question selections become highlights; only answer choices use this menu. */
  skipHighlightable?: boolean;
}) {
  const { update, data } = useStore();
  const [sel, setSel] = useState<Sel | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const skip = useRef(skipHighlightable);
  skip.current = skipHighlightable;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const read = () => window.setTimeout(() => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) return setSel(null);
      const range = s.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return setSel(null);
      const text = s.toString();
      if (!text.trim()) return setSel(null);
      const startEl = (range.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer.parentElement : range.startContainer as Element);
      const box = startEl?.closest<HTMLElement>('[data-hl-part]') ?? null;
      if (box && skip.current) return setSel(null);
      let start = 0;
      let end = 0;
      let context = text;
      if (box) {
        start = offsetOf(box, range.startContainer, range.startOffset);
        end = box.contains(range.endContainer) ? offsetOf(box, range.endContainer, range.endOffset) : (box.textContent ?? '').length;
        context = sentenceAround(box.textContent ?? '', start, end);
      } else if (startEl) {
        // A word in an answer choice: keep the whole choice as its context.
        context = (startEl.closest('.ctext, .choice, div')?.textContent ?? text).replace(/\s+/g, ' ').trim();
      }
      const rect = range.getBoundingClientRect();
      setMsg(null);
      setSel({
        text, part: (box?.dataset.hlPart as Part) ?? null, start, end, context,
        top: rect.top > 60 ? rect.top - 52 : rect.bottom + 10,
        left: rect.left + rect.width / 2,
      });
    }, 0);
    const hide = (e: Event) => {
      if (bar.current && e.target instanceof Node && bar.current.contains(e.target)) return;
      setSel(null);
    };
    el.addEventListener('mouseup', read);
    el.addEventListener('keyup', read);
    document.addEventListener('mousedown', hide);
    window.addEventListener('scroll', hide, true);
    return () => {
      el.removeEventListener('mouseup', read);
      el.removeEventListener('keyup', read);
      document.removeEventListener('mousedown', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, [root]);

  // Keep the toolbar fully on screen (its width depends on which buttons show).
  useLayoutEffect(() => {
    const b = bar.current;
    if (!b) return;
    const w = b.offsetWidth;
    const left = Math.min(window.innerWidth - w - 8, Math.max(8, (sel?.left ?? 0) - w / 2));
    b.style.left = `${left}px`;
  }, [sel, msg]);

  if (!sel) return null;
  const done = (text: string) => {
    setMsg(text);
    window.setTimeout(() => {
      setSel(null);
      window.getSelection()?.removeAllRanges();
    }, 900);
  };
  const word = cleanWord(sel.text);
  const inBank = data.wordBank.some((w) => w.text.toLowerCase() === word.toLowerCase());

  const addToBank = () => {
    if (!word) return;
    update((d) => ({
      ...d,
      wordBank: addWord(d.wordBank, {
        id: uid('w_'), text: word, context: sel.context, questionId, meaning: '', learned: false, addedAt: Date.now(),
      }).bank,
    }));
    done(inBank ? 'Already in your word bank' : 'Added to word bank 🌱');
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sel.text.trim());
    } catch {
      document.execCommand('copy');
    }
    done('Copied');
  };

  return (
    <div ref={bar} className="sel-menu" style={{ top: sel.top, left: sel.left }} onMouseDown={(e) => e.preventDefault()} role="toolbar">
      {msg ? (
        <span className="sel-msg">{msg}</span>
      ) : (
        <>
          {word.length > 0 && word.length <= 80 && (
            <button className="sel-btn" onClick={addToBank}>{inBank ? '✓ In word bank' : '🌱 Add to word bank'}</button>
          )}
          <button className="sel-btn" onClick={copy}>Copy</button>
        </>
      )}
    </div>
  );
}

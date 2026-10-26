import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HL_COLORS, HL_UNDERLINES, type HlColor, type HlUnderline, type TextHighlight } from '../types';

const COLOR_LABEL: Record<HlColor, string> = { yellow: 'Yellow', blue: 'Blue', pink: 'Pink' };
const UNDERLINE_LABEL: Record<HlUnderline, string> = { none: 'None', solid: 'Solid', dashed: 'Dashed', dotted: 'Dotted' };

/** Bluebook's drop icon on the chosen colour. */
const Drop = () => (
  <svg width="14" height="16" viewBox="0 0 14 16" aria-hidden>
    <path d="M7 1 C 7 1 1.5 7.5 1.5 10.5 A 5.5 5.5 0 0 0 12.5 10.5 C 12.5 7.5 7 1 7 1Z" fill="none" stroke="#1f1f1f" strokeWidth="1.6" />
  </svg>
);
const Trash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="#1f1f1f" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
);
const NoteIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="none" stroke="#1f1f1f" strokeWidth="1.8" strokeLinecap="round">
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="M12 8v8M8 12h8" />
  </svg>
);

/**
 * The little toolbar Bluebook shows right above a highlight: colours, underline style (dropdown),
 * delete, add a note. Plus a 🌱 word-bank button (ours, not Bluebook's). Changes apply immediately.
 */
export default function HighlightToolbar({ highlight, anchor, onChange, onDelete, onClose, onAddWord, inWordBank }: {
  highlight: TextHighlight;
  /** Where the highlight is on screen right now. */
  anchor: () => DOMRect | null;
  onChange: (p: Partial<Pick<TextHighlight, 'color' | 'underline' | 'note'>>) => void;
  onDelete: () => void;
  onClose: () => void;
  onAddWord: () => void;
  inWordBank: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [ulOpen, setUlOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(!!highlight.note);
  const [added, setAdded] = useState(false);

  // Sit just above the highlight (below it if there's no room), and follow it when the passage scrolls.
  useLayoutEffect(() => {
    const place = () => {
      const r = anchor();
      const el = ref.current;
      if (!r || !el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const top = r.top - h - 10 < 64 ? r.bottom + 10 : r.top - h - 10;
      const left = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
      setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }));
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [anchor, noteOpen, ulOpen]);

  // Clicking anywhere else closes it.
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', down);
      document.removeEventListener('keydown', key);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="hl-bar" role="toolbar" aria-label="Highlight options"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}>
      <div className="hl-row">
        {HL_COLORS.map((c) => (
          <button key={c} className={`hl-color ${c} ${highlight.color === c ? 'on' : ''}`} aria-label={COLOR_LABEL[c]} title={COLOR_LABEL[c]}
            aria-pressed={highlight.color === c} onClick={() => onChange({ color: c })}>
            {highlight.color === c && <Drop />}
          </button>
        ))}
        <div style={{ position: 'relative' }}>
          <button className={`hl-ul ${ulOpen ? 'open' : ''}`} aria-label="Underline style" title="Underline" aria-expanded={ulOpen} onClick={() => setUlOpen(!ulOpen)}>
            <span className="hl-ul-icon"><b>U</b><i /></span>
            <span className="chev">⌄</span>
          </button>
          {ulOpen && (
            <div className="hl-ul-menu" role="menu">
              {HL_UNDERLINES.map((u) => (
                <button key={u} role="menuitemradio" aria-checked={highlight.underline === u} className={highlight.underline === u ? 'on' : ''}
                  onClick={() => { onChange({ underline: u }); setUlOpen(false); }}>
                  <span style={{ textDecoration: u === 'none' ? 'none' : `underline ${u}`, textUnderlineOffset: 3, fontFamily: 'var(--serif)' }}>Abc</span>
                  <small>{UNDERLINE_LABEL[u]}</small>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="hl-icon" aria-label="Delete highlight" title="Delete" onClick={onDelete}><Trash /></button>
        <span className="hl-sep" />
        <button className={`hl-icon ${noteOpen ? 'on' : ''}`} aria-label={highlight.note ? 'Edit note' : 'Add note'} title={highlight.note ? 'Edit note' : 'Add note'}
          onClick={() => setNoteOpen(!noteOpen)}><NoteIcon /></button>
        <button className="hl-icon" aria-label="Add to word bank" title={inWordBank || added ? 'In your word bank' : 'Add to word bank'}
          onClick={() => { onAddWord(); setAdded(true); }}>{inWordBank || added ? '✓' : '🌱'}</button>
      </div>
      {noteOpen && (
        <textarea className="hl-note" rows={3} placeholder="Add a note…" value={highlight.note} maxLength={1000} autoFocus
          onChange={(e) => onChange({ note: e.target.value })} />
      )}
    </div>
  );
}

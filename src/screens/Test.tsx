import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Go } from '../route';
import { useStore, uid } from '../store/store';
import { submitTest } from '../logic/submit';
import { LETTERS, type ActiveTest, type Letter, type LiveAnswer, type TextHighlight } from '../types';
import RichText from '../components/RichText';
import SelectionMenu, { caretOffsetAt, currentSelection, paintHighlights, rangeFromOffsets } from '../components/SelectionMenu';
import HighlightToolbar from '../components/HighlightToolbar';
import { addHighlight, addWord, cleanWord, deleteHighlight, highlightAt, sentenceAround, updateHighlight } from '../logic/highlights';
import { Daisy, Leaf, Sprout } from '../components/Decor';

const SYNC_MS = 4000;
const WARN_SEC = 5 * 60;

function fmt(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function Test({ go }: { go: Go }) {
  const { data, update } = useStore();
  const t = data.activeTest!;
  const module = data.modules[t.moduleId];
  const animate = data.settings.animateTestScreen;

  // Timer runs off a deadline so it stays accurate; it's written back to storage every few seconds.
  const deadline = useRef(Date.now() + t.remainingSec * 1000);
  const [remaining, setRemaining] = useState(t.remainingSec);
  const qStart = useRef(performance.now());
  const submitted = useRef(false);
  const [crossMode, setCrossMode] = useState(false);
  // Highlights & Notes: on/off like Bluebook's top-right tool, and the highlight whose toolbar is open.
  const [hlMode, setHlMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const closeToolbar = useCallback(() => setEditingId(null), []);
  const lastPick = useRef<{ at: number; prev: Pick<LiveAnswer, 'chosen' | 'crossedOut'> } | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [reviewPage, setReviewPage] = useState(false);
  const [split, setSplit] = useState(50);
  const bodyRef = useRef<HTMLElement>(null);
  const passageRef = useRef<HTMLElement>(null);
  const stemRef = useRef<HTMLDivElement>(null);
  // Time spent on the review page isn't charged to any question.
  const reviewPageRef = useRef(reviewPage);
  reviewPageRef.current = reviewPage;

  const patchTest = useCallback(
    (fn: (t: ActiveTest) => ActiveTest) => update((d) => (d.activeTest ? { ...d, activeTest: fn(d.activeTest) } : d)),
    [update],
  );

  /** Add time spent on the current question since the last checkpoint, and save the clock. */
  const checkpoint = useCallback(() => {
    const now = performance.now();
    const spent = now - qStart.current;
    qStart.current = now;
    const left = Math.max(0, (deadline.current - Date.now()) / 1000);
    patchTest((at) => ({
      ...at,
      remainingSec: left,
      answers: reviewPageRef.current ? at.answers : at.answers.map((a, i) => (i === at.current ? { ...a, timeMs: a.timeMs + spent } : a)),
    }));
  }, [patchTest]);

  const submit = useCallback(
    (auto: boolean) => {
      if (submitted.current) return;
      submitted.current = true;
      checkpoint();
      const id = t.moduleId;
      update((d) => submitTest(d, auto));
      go({ name: 'results', moduleId: id });
    },
    [checkpoint, update, go, t.moduleId],
  );

  useEffect(() => {
    const tick = window.setInterval(() => {
      const left = (deadline.current - Date.now()) / 1000;
      setRemaining(left);
      if (left <= 0) submit(true);
    }, 250);
    const sync = window.setInterval(checkpoint, SYNC_MS);
    const onHide = () => document.visibilityState === 'hidden' && checkpoint();
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(sync);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [checkpoint, submit]);

  // Paint this question's highlights (they're stored per question in the running test).
  const rawHighlights = t.answers[t.current]?.highlights;
  const curHighlights = useMemo(() => withDefaults(rawHighlights), [rawHighlights]);
  useLayoutEffect(() => {
    if (reviewPage || !curHighlights?.length) return;
    return paintHighlights([
      { el: passageRef.current, list: curHighlights.filter((h) => h.part === 'passage') },
      { el: stemRef.current, list: curHighlights.filter((h) => h.part === 'stem') },
    ], editingId);
  }, [curHighlights, t.current, reviewPage, split, editingId]);

  if (!module) return null;
  const n = module.questionIds.length;
  const i = t.current;
  const q = data.questions[module.questionIds[i]];
  const ans = t.answers[i];

  const goTo = (k: number) => {
    checkpoint();
    setEditingId(null);
    setNavOpen(false);
    setReviewPage(false);
    patchTest((at) => ({ ...at, current: Math.max(0, Math.min(n - 1, k)) }));
  };
  const openReview = () => {
    checkpoint();
    setNavOpen(false);
    setReviewPage(true);
  };
  const setAns = (patch: Partial<LiveAnswer>) =>
    patchTest((at) => ({ ...at, answers: at.answers.map((a, k) => (k === at.current ? { ...a, ...patch } : a)) }));
  const highlights = curHighlights ?? [];
  /** Bluebook: with Highlights & Notes on, selecting text highlights it in yellow straight away. */
  const highlightSelection = () => {
    if (!hlMode || reviewPage) return;
    const sel = bodyRef.current && currentSelection(bodyRef.current);
    if (!sel) return;
    const id = uid('h_');
    setAns({ highlights: addHighlight(highlights, { id, part: sel.part, start: sel.start, end: sel.end, color: 'yellow', underline: 'none', note: '' }) });
    window.getSelection()?.removeAllRanges();
    setEditingId(id);
  };
  /** Clicking on highlighted text opens its toolbar. */
  const openHighlightAt = (part: 'passage' | 'stem', el: HTMLElement | null, x: number, y: number) => {
    if (!el || !window.getSelection()?.isCollapsed) return;
    const at = caretOffsetAt(el, x, y);
    const h = at === null ? undefined : highlightAt(highlights, part, at);
    if (h) setEditingId(h.id);
  };
  const editing = highlights.find((h) => h.id === editingId);
  const editingEl = editing ? (editing.part === 'passage' ? passageRef.current : stemRef.current) : null;
  const editingAll = editingEl?.textContent ?? '';
  const editingWord = editing ? cleanWord(editingAll.slice(editing.start, editing.end)) : '';
  const editingAnchor = () => (editing && editingEl ? rangeFromOffsets(editingEl, editing.start, editing.end)?.getBoundingClientRect() ?? null : null);
  const addEditingWord = () => {
    if (!editing || !editingWord) return;
    const context = sentenceAround(editingAll, editing.start, editing.end);
    update((d) => ({ ...d, wordBank: addWord(d.wordBank, { id: uid('w_'), text: editingWord, context, questionId: q?.id, meaning: '', learned: false, addedAt: Date.now() }).bank }));
  };

  const choose = (l: Letter) => {
    // Dragging over a choice to select a word isn't a click on the answer.
    if (window.getSelection()?.toString().trim()) return;
    lastPick.current = { at: Date.now(), prev: { chosen: ans.chosen, crossedOut: ans.crossedOut } };
    if (ans.crossedOut.includes(l)) setAns({ chosen: l, crossedOut: ans.crossedOut.filter((x) => x !== l) });
    else setAns({ chosen: l });
  };
  /** A double-click selects a word (for the word bank): undo the answer change its first click made. */
  const undoPickOnDoubleClick = () => {
    const p = lastPick.current;
    if (p && Date.now() - p.at < 600) setAns(p.prev);
    lastPick.current = null;
  };
  const toggleCross = (l: Letter) => {
    const crossed = ans.crossedOut.includes(l);
    setAns({ crossedOut: crossed ? ans.crossedOut.filter((x) => x !== l) : [...ans.crossedOut, l], chosen: !crossed && ans.chosen === l ? null : ans.chosen });
  };
  const pauseExit = () => {
    checkpoint();
    go({ name: 'home' });
  };

  const warn = remaining <= WARN_SEC;
  const showTimer = !t.timerHidden || warn;
  const answeredCount = t.answers.filter((a) => a.chosen).length;

  const onDividerDown = (e: RPointerEvent<HTMLDivElement>) => {
    const host = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
    const move = (ev: PointerEvent) => setSplit(Math.max(25, Math.min(75, ((ev.clientX - host.left) / host.width) * 100)));
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="test">
      {/* Top bar */}
      <header className="test-top">
        <div className="test-title">
          <div style={{ fontWeight: 800 }}>{module.title}</div>
          <div className="muted small">Reading and Writing · {n} questions</div>
        </div>
        <div className="test-timer" aria-live="off">
          {showTimer ? (
            <span className={`clock ${warn ? 'warn' : ''}`}>{fmt(remaining)}</span>
          ) : (
            <span className="muted small">⏱ timer hidden</span>
          )}
          {!warn && (
            <button className="btn small ghost" onClick={() => patchTest((at) => ({ ...at, timerHidden: !at.timerHidden }))}>
              {t.timerHidden ? 'Show' : 'Hide'}
            </button>
          )}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Leaf size={26} className={animate ? 'sway' : ''} />
          <button className={`tool-btn ${hlMode ? 'on' : ''}`} onClick={() => { setHlMode(!hlMode); setEditingId(null); }} disabled={reviewPage}
            aria-pressed={hlMode} title={hlMode ? 'Turn off highlighting' : 'Turn on highlighting: then select text to highlight it'}>
            <span className="tool-icons" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M14 4l6 6-9 9H5v-6z" /><path d="M4 21h8" /></svg>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>
            </span>
            <span className="tool-label">Highlights &amp; Notes</span>
          </button>
          <button className="btn small ghost" onClick={pauseExit} title="Saves your answers. The timer pauses while you're away.">Pause & exit</button>
        </div>
      </header>
      <div className="vine" aria-hidden />

      {/* Body */}
      {reviewPage ? (
        <main className="test-review">
          <h2>Check your work</h2>
          <p className="muted">
            {answeredCount} of {n} answered. Click a question to go back to it.
          </p>
          <NavGrid t={t} n={n} onPick={goTo} />
          <div className="row" style={{ justifyContent: 'center', marginTop: 24 }}>
            <button className="btn primary" onClick={() => {
              const blank = n - answeredCount;
              if (!blank || confirm(`${blank} question${blank === 1 ? ' is' : 's are'} unanswered. Submit anyway?`)) submit(false);
            }}>Submit module</button>
          </div>
        </main>
      ) : (
        <main className={`test-body ${hlMode ? 'hl-mode' : ''}`} ref={bodyRef} onMouseUp={highlightSelection} style={{ gridTemplateColumns: q?.passage ? `${split}% 10px 1fr` : '1fr' }}>
          {q?.passage && (
            <>
              <section className="test-passage passage" data-hl-part="passage" ref={passageRef}
                onClick={(e) => openHighlightAt('passage', passageRef.current, e.clientX, e.clientY)}>
                <RichText text={q.passage} figures={q.figures} />
              </section>
              <div className="divider" onPointerDown={onDividerDown} role="separator" aria-label="Drag to resize" />
            </>
          )}
          <section className="test-question">
            <div className="q-bar">
              <span className="q-num">{i + 1}</span>
              <button className={`mark ${ans.flagged ? 'on' : ''}`} onClick={() => setAns({ flagged: !ans.flagged })} aria-pressed={ans.flagged}>
                {ans.flagged ? '🚩' : '⚑'} Mark for Review
              </button>
              <button className={`mark confused ${ans.confused ? 'on' : ''}`} onClick={() => setAns({ confused: !ans.confused })} aria-pressed={ans.confused}
                title="Look at this one after you submit. It doesn't change the test.">
                🌱 {ans.confused ? 'Confused' : 'Confused?'}
              </button>
              <span className="spacer" />
              <button className={`abc ${crossMode ? 'on' : ''}`} onClick={() => setCrossMode(!crossMode)} title="Cross out answer choices" aria-pressed={crossMode}>
                <s>ABC</s>
              </button>
            </div>
            {q ? (
              <>
                <div className="stem" data-hl-part="stem" ref={stemRef}
                  onClick={(e) => openHighlightAt('stem', stemRef.current, e.clientX, e.clientY)}><RichText text={q.question} /></div>
                <div className="choices">
                  {LETTERS.map((l) => {
                    const crossed = ans.crossedOut.includes(l);
                    return (
                      <div key={l} className="choice-row">
                        <div role="button" tabIndex={0} aria-pressed={ans.chosen === l}
                          className={`choice ${ans.chosen === l ? 'selected' : ''} ${crossed ? 'crossed' : ''}`}
                          onClick={() => choose(l)} onDoubleClick={undoPickOnDoubleClick}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(l); } }}>
                          <span className="letter">{l}</span>
                          <span className="ctext"><RichText text={q.choices[l]} /></span>
                        </div>
                        {crossMode && (
                          crossed
                            ? <button className="undo" onClick={() => toggleCross(l)}>Undo</button>
                            : <button className="xbtn" onClick={() => toggleCross(l)} aria-label={`Cross out ${l}`}><s>{l}</s></button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="banner err">This question was deleted from the bank.</div>
            )}
          </section>
          <SelectionMenu root={bodyRef} questionId={q?.id} skipHighlightable={hlMode} />
        </main>
      )}

      {/* Bottom bar */}
      {editing && !reviewPage && (
        <HighlightToolbar
          key={editing.id}
          highlight={editing}
          anchor={editingAnchor}
          onChange={(p) => setAns({ highlights: updateHighlight(highlights, editing.id, p) })}
          onDelete={() => { setAns({ highlights: deleteHighlight(highlights, editing.id) }); setEditingId(null); }}
          onClose={closeToolbar}
          onAddWord={addEditingWord}
          inWordBank={data.wordBank.some((w) => w.text.toLowerCase() === editingWord.toLowerCase())}
        />
      )}
      <footer className="test-bottom">
        <div className="muted small"><Sprout size={18} className="" /> {answeredCount}/{n} answered</div>
        <div style={{ position: 'relative' }}>
          <button className="q-pill" onClick={() => setNavOpen(!navOpen)}>
            <Daisy size={16} /> {reviewPage ? 'Review' : `Question ${i + 1} of ${n}`} {navOpen ? '▾' : '▴'}
          </button>
          {navOpen && (
            <div className="nav-pop" role="dialog">
              <div className="row small muted" style={{ justifyContent: 'center', gap: 14, marginBottom: 10 }}>
                <span>📍 current</span><span className="legend-box" /> unanswered<span>🚩 marked</span><span>🌱 confused</span>
              </div>
              <NavGrid t={t} n={n} onPick={goTo} current={reviewPage ? -1 : i} />
              <div className="center" style={{ marginTop: 12 }}>
                <button className="btn small" onClick={openReview}>Go to Review Page</button>
              </div>
            </div>
          )}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {(i > 0 || reviewPage) && (
            <button className="btn" onClick={() => (reviewPage ? goTo(n - 1) : goTo(i - 1))}>Back</button>
          )}
          {!reviewPage && (
            <button className="btn primary" onClick={() => (i === n - 1 ? openReview() : goTo(i + 1))}>Next</button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** Highlights saved by an older version had no id/underline/note. */
function withDefaults(list: TextHighlight[] | undefined): TextHighlight[] | undefined {
  return list?.map((h, k) => ({ ...h, id: h.id ?? `old${k}`, underline: h.underline ?? 'none', note: h.note ?? '' }));
}

function NavGrid({ t, n, onPick, current = -1 }: { t: ActiveTest; n: number; onPick: (k: number) => void; current?: number }) {
  return (
    <div className="nav-grid">
      {Array.from({ length: n }, (_, k) => {
        const a = t.answers[k];
        return (
          <button key={k} className={`nav-cell ${a.chosen ? 'answered' : ''} ${k === current ? 'current' : ''}`} onClick={() => onPick(k)}
            aria-label={`Question ${k + 1}${a.chosen ? ', answered' : ''}${a.flagged ? ', marked' : ''}${a.confused ? ', confused' : ''}`}>
            {k === current && <span className="pin">📍</span>}
            {k + 1}
            {a.flagged && <span className="badge flag">🚩</span>}
            {a.confused && <span className="badge conf">🌱</span>}
          </button>
        );
      })}
    </div>
  );
}

import { useRef, useState } from 'react';
import type { Go } from '../route';
import { useStore } from '../store/store';
import { addQuestions, type AddResult } from '../store/actions';
import { importCbPdf, type PdfProgress, type PdfResult } from '../parse/pdfLoader';
import { DIFFICULTIES, type Difficulty } from '../types';
import { Daisy, PetalButton, Sprout, WiltedFlower } from './Decor';

export default function PdfImport({ go }: { go: Go }) {
  const { data, update } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<PdfProgress | null>(null);
  const [result, setResult] = useState<PdfResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keep, setKeep] = useState<Record<Difficulty, boolean>>({ hard: true, medium: true, easy: true });
  const [done, setDone] = useState<AddResult | null>(null);

  const run = async (file: File) => {
    setBusy(true);
    setError(null);
    setResult(null);
    setDone(null);
    setProgress(null);
    try {
      setResult(await importCbPdf(file, setProgress));
    } catch (e) {
      setError(`Couldn't open that PDF: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const chosen = result?.items.filter((i) => !i.draft.difficulty || keep[i.draft.difficulty]) ?? [];
  const flagged = chosen.filter((i) => i.issues.length);
  const known = new Set(Object.values(data.questions).map((q) => q.cbId).filter(Boolean));
  const already = chosen.filter((i) => known.has(i.draft.cbId)).length;

  const add = () => {
    setDone(addQuestions(data, chosen).result);
    update((d) => addQuestions(d, chosen).data);
    setResult(null);
  };

  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <>
      <div className="card blossom">
        <p className="muted" style={{ marginTop: 0 }}>
          Choose a PDF exported from the College Board <b>SAT Suite Question Bank</b> (Reading and Writing).
          It's read right here in your browser. Nothing is uploaded anywhere.
        </p>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => fileRef.current?.click()}>Choose PDF…</button>
          <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ''; }} />
          <span className="muted small">A big export (1,500 pages) takes about a minute or two.</span>
        </div>
        {busy && (
          <div style={{ marginTop: 16 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <Daisy size={28} className="spin" />
              <b>{!progress ? 'Opening…' : progress.stage === 'reading'
                ? `Reading page ${progress.done} of ${progress.total}`
                : `Drawing charts and tables ${progress.done} of ${progress.total}`}</b>
            </div>
            <div className="progress"><div style={{ width: `${pct}%` }} /></div>
          </div>
        )}
        {error && <div className="banner err" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {done && (
        <div className="banner ok" style={{ marginTop: 16 }}>
          Added {done.added} question{done.added === 1 ? '' : 's'}
          {done.duplicates > 0 && `, skipped ${done.duplicates} already in your bank`}.
          {done.needsFix > 0 && (
            <> {done.needsFix} need fixing → <button className="btn small pink" onClick={() => go({ name: 'fix' })}>Open fix queue</button></>
          )}
        </div>
      )}

      {result?.looksScanned && (
        <div className="banner err" style={{ marginTop: 16 }}>
          This PDF has almost no text in it. It's probably a scan or photos, which this app can't read. Try exporting it again from the
          Question Bank, or paste the questions as text.
        </div>
      )}
      {result && !result.looksScanned && result.items.length === 0 && (
        <div className="banner err" style={{ marginTop: 16 }}>
          No questions found. This doesn't look like a College Board Question Bank export (no “Question ID:” headers).
        </div>
      )}

      {result && result.items.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Found {result.items.length} questions in {result.pages} pages</h3>
          <div className="row" style={{ marginBottom: 10 }}>
            <span className="muted small">Import:</span>
            {DIFFICULTIES.map((d) => (
              <button key={d} className={`chip clickable ${keep[d] ? 'selected' : ''}`} onClick={() => setKeep({ ...keep, [d]: !keep[d] })}>
                {d} ({result.items.filter((i) => i.draft.difficulty === d).length})
              </button>
            ))}
          </div>
          <div className="row">
            <span className="chip">{chosen.length} selected</span>
            {already > 0 && <span className="chip">{already} already in bank (will be skipped)</span>}
            {flagged.length > 0 && <span className="chip warn">{flagged.length} need fixing by hand</span>}
            <span className="chip">{chosen.filter((i) => i.figures.length).length} with charts/tables</span>
            <span className="spacer" />
            <PetalButton disabled={!chosen.length} onClick={add}>Add to my bank</PetalButton>
          </div>
          {flagged.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {flagged.map((it) => (
                <div key={it.draft.cbId} className="row pop-in" style={{ padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                  <WiltedFlower />
                  <span className="small"><b>{it.draft.cbId}</b> {it.issues.join(' · ')}</span>
                </div>
              ))}
            </div>
          )}
          {flagged.length === 0 && (
            <div className="row" style={{ marginTop: 10 }}><Sprout size={26} /> <span className="small muted">Every selected question parsed cleanly.</span></div>
          )}
        </div>
      )}
    </>
  );
}

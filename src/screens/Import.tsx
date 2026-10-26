import { useState } from 'react';
import type { Go } from '../route';
import { useStore } from '../store/store';
import { addQuestions, type AddResult } from '../store/actions';
import { parsePasted, type ParsedItem } from '../parse/pasteParser';
import { ALL_SKILLS } from '../parse/skills';
import { DIFFICULTIES } from '../types';
import { PetalButton, Sprout, WiltedFlower } from '../components/Decor';
import PdfImport from '../components/PdfImport';

export default function Import({ go }: { go: Go }) {
  const [tab, setTab] = useState<'paste' | 'pdf'>('paste');
  return (
    <>
      <h1>Import questions 🌸</h1>
      <div className="row" style={{ marginBottom: 16 }}>
        <button className={`btn ${tab === 'paste' ? 'on' : 'ghost'}`} onClick={() => setTab('paste')}>Paste text</button>
        <button className={`btn ${tab === 'pdf' ? 'on' : 'ghost'}`} onClick={() => setTab('pdf')}>College Board PDF</button>
      </div>
      {tab === 'paste' ? <PasteImport go={go} /> : <PdfImport go={go} />}
    </>
  );
}

function PasteImport({ go }: { go: Go }) {
  const { data, update } = useStore();
  const [text, setText] = useState('');
  const [skill, setSkill] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [items, setItems] = useState<ParsedItem[] | null>(null);
  const [done, setDone] = useState<AddResult | null>(null);

  const parse = () => {
    setDone(null);
    setItems(parsePasted(text, { skill, difficulty }));
  };

  const add = () => {
    if (!items) return;
    setDone(addQuestions(data, items).result);
    update((d) => addQuestions(d, items).data);
    setItems(null);
    setText('');
  };

  return (
    <>
      <div className="card blossom">
        <p className="muted" style={{ marginTop: 0 }}>
          Paste one or more questions. Numbered (<code>1.</code>, <code>2.</code>) or separated by <code>---</code> works best.
          Each needs choices <b>A–D</b> and a line like <code>Answer: C</code>. <code>Explanation:</code>,{' '}
          <code>Skill:</code> and <code>Difficulty:</code> lines are picked up too, but they're optional: a question from TikTok or
          YouTube with just the question, four choices and the answer is enough.
        </p>
        <textarea value={text} rows={14} placeholder={'1. Passage text…\nWhich choice completes the text…?\nA) …\nB) …\nC) …\nD) …\nAnswer: B\nExplanation: …'}
          onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 12 }}>
          <label className="field">If a question has no skill, use
            <select value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">— leave blank (that's fine) —</option>
              {ALL_SKILLS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field">If no difficulty, use
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">— leave blank (that's fine) —</option>
              {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <span className="spacer" />
          <button className="btn primary" disabled={!text.trim()} onClick={parse}>Read questions</button>
        </div>
        <p className="muted small" style={{ marginBottom: 0 }}>
          ⚠️ Answer keys from Reddit/TikTok are sometimes wrong. Pasted questions get an “unverified” badge until you tick “I checked this”.
        </p>
      </div>

      {done && (
        <div className="banner ok" style={{ marginTop: 16 }}>
          Added {done.added} question{done.added === 1 ? '' : 's'}
          {done.duplicates > 0 && `, skipped ${done.duplicates} duplicate${done.duplicates === 1 ? '' : 's'}`}.
          {done.needsFix > 0 && (
            <> {done.needsFix} need fixing → <button className="btn small pink" onClick={() => go({ name: 'fix' })}>Open fix queue</button></>
          )}
        </div>
      )}

      {items && <ParsePreview items={items} onAdd={add} />}
    </>
  );
}

export function ParsePreview({ items, onAdd }: { items: ParsedItem[]; onAdd: () => void }) {
  const bad = items.filter((i) => i.issues.length).length;
  if (!items.length) {
    return <div className="card empty" style={{ marginTop: 16 }}>No questions found. Check that choices start with A), B), C), D).</div>;
  }
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="row">
        <h3 style={{ margin: 0 }}>Found {items.length} question{items.length === 1 ? '' : 's'}</h3>
        {bad > 0 && <span className="chip warn">{bad} need fixing by hand</span>}
        <span className="spacer" />
        <PetalButton onClick={onAdd}>Add to my bank</PetalButton>
      </div>
      <div style={{ marginTop: 12 }}>
        {items.map((it, i) => (
          <div key={i} className="row pop-in" style={{
            animationDelay: `${Math.min(i, 30) * 40}ms`, padding: '8px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap',
          }}>
            {it.issues.length ? <WiltedFlower /> : <Sprout size={26} className="" />}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <b>{i + 1}.</b> {it.draft.question || it.draft.passage.slice(0, 120) || it.raw.slice(0, 120)}
              </div>
              <div className="row small" style={{ gap: 6, marginTop: 3 }}>
                {it.draft.difficulty && <span className={`chip ${it.draft.difficulty}`}>{it.draft.difficulty}</span>}
                {it.draft.skill && <span className="chip">{it.draft.skill}</span>}
                {it.draft.answer && <span className="chip">Answer {it.draft.answer}</span>}
                {it.issues.map((s) => <span key={s} className="chip warn">{s}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

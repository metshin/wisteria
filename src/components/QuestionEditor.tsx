import { useState } from 'react';
import { DIFFICULTIES, LETTERS, type Question } from '../types';
import { findIssues } from '../parse/validate';
import { ALL_SKILLS, domainOf } from '../parse/skills';

/** Form for fixing or editing one question. Shows the original text beside it when we have it. */
export default function QuestionEditor({ question, onSave, onCancel, onDelete }: {
  question: Question;
  onSave: (q: Question) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
  const [q, setQ] = useState<Question>(question);
  const issues = findIssues(q);
  const set = <K extends keyof Question>(k: K, v: Question[K]) => setQ((p) => ({ ...p, [k]: v }));

  return (
    <div className="grid" style={{ gridTemplateColumns: q.raw ? 'minmax(0,3fr) minmax(0,2fr)' : '1fr' }}>
      <div className="grid" style={{ gap: 12 }}>
        <label className="field">Passage
          <textarea value={q.passage} rows={6} onChange={(e) => set('passage', e.target.value)} />
        </label>
        <label className="field">Question
          <textarea value={q.question} rows={2} style={{ minHeight: 50 }} onChange={(e) => set('question', e.target.value)} />
        </label>
        {LETTERS.map((l) => (
          <label key={l} className="field" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <input type="radio" name={`ans-${q.id}`} checked={q.answer === l} onChange={() => set('answer', l)}
              title="Mark as correct answer" />
            <span style={{ width: 18 }}>{l}</span>
            <input type="text" value={q.choices[l]} style={{ flex: 1 }}
              onChange={(e) => set('choices', { ...q.choices, [l]: e.target.value })} />
          </label>
        ))}
        <div className="muted small">Pick the circle next to the correct answer.</div>
        <div className="row">
          <label className="field">Difficulty
            <select value={q.difficulty ?? ''} onChange={(e) => set('difficulty', (e.target.value || null) as Question['difficulty'])}>
              <option value="">—</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="field" style={{ flex: 1 }}>Skill
            <input type="text" list="skill-list" value={q.skill}
              onChange={(e) => setQ((p) => ({ ...p, skill: e.target.value, domain: domainOf(e.target.value) ?? p.domain }))} />
            <datalist id="skill-list">{ALL_SKILLS.map((s) => <option key={s} value={s} />)}</datalist>
          </label>
        </div>
        <label className="field">Rationale
          <textarea value={q.rationale} rows={4} onChange={(e) => set('rationale', e.target.value)} />
        </label>
        {q.source === 'paste' && (
          <label className="row small" style={{ fontWeight: 700 }}>
            <input type="checkbox" checked={q.verified} onChange={(e) => set('verified', e.target.checked)} />
            I checked this answer key myself
          </label>
        )}
        {issues.length > 0 && (
          <div className="banner err small">Still needed: {issues.join(' · ')}</div>
        )}
        <div className="row">
          <button className="btn primary" onClick={() => onSave(q)}>
            {issues.length ? 'Save draft' : 'Save 🌸'}
          </button>
          {onCancel && <button className="btn ghost" onClick={onCancel}>Cancel</button>}
          <span className="spacer" />
          {onDelete && <button className="btn danger" onClick={() => confirm('Delete this question for good?') && onDelete()}>Delete</button>}
        </div>
      </div>
      {q.raw && (
        <div>
          <div className="field" style={{ marginBottom: 5 }}>Original text</div>
          <pre style={{
            whiteSpace: 'pre-wrap', background: 'var(--mint)', padding: 12, borderRadius: 12,
            fontSize: '0.82rem', maxHeight: 600, overflow: 'auto', margin: 0,
          }}>{q.raw}</pre>
        </div>
      )}
    </div>
  );
}

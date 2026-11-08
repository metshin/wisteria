import { LETTERS, type Letter, type Question } from '../types';
import { useRef } from 'react';
import RichText from './RichText';
import SelectionMenu from './SelectionMenu';

/** Read-only view of a question with the correct answer (and optionally the user's pick) marked. */
export default function QuestionView({ q, chosen, showAnswer = true }: { q: Question; chosen?: Letter | null; showAnswer?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  return (
    <div ref={root}>
      <SelectionMenu root={root} questionId={q.id} />
      {q.passage && <div className="passage" data-hl-part="passage" style={{ marginBottom: 12 }}><RichText text={q.passage} figures={q.figures} /></div>}
      <div className="stem" data-hl-part="stem"><b><RichText text={q.question} /></b></div>
      <div className="grid" style={{ gap: 6 }}>
        {LETTERS.map((l) => {
          const isAns = showAnswer && q.answer === l;
          const isMine = chosen === l;
          const bg = isAns ? 'var(--right-soft)' : isMine ? 'var(--wrong-soft)' : '#fff';
          const border = isAns ? 'var(--right)' : isMine ? 'var(--wrong)' : 'var(--line)';
          return (
            <div key={l} style={{ border: `1.5px solid ${border}`, background: bg, borderRadius: 12, padding: '8px 12px', display: 'flex', gap: 10 }}>
              <b>{l}</b>
              <span style={{ flex: 1 }}><RichText text={q.choices[l]} /></span>
              {isAns && <span className="small" style={{ color: 'var(--right)', fontWeight: 800 }}>✓ correct</span>}
              {isMine && !isAns && <span className="small" style={{ color: 'var(--wrong)', fontWeight: 800 }}>your answer</span>}
            </div>
          );
        })}
      </div>
      {chosen === null && <div className="small muted" style={{ marginTop: 6 }}>You left this one blank.</div>}
      {showAnswer && q.rationale && (
        <div style={{ marginTop: 14, background: 'var(--mint)', borderRadius: 12, padding: 12 }}>
          <div className="small" style={{ fontWeight: 800, color: 'var(--moss-dark)', marginBottom: 4 }}>💡 Rationale</div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{q.rationale}</div>
        </div>
      )}
    </div>
  );
}

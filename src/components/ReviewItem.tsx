import { useState } from 'react';
import type { Attempt, Question } from '../types';
import { useStore } from '../store/store';
import QuestionView from './QuestionView';
import { outcome } from '../logic/stats';
import { Sprout } from './Decor';

export const MISS_TAGS = ['misread', 'vocab', 'timing', 'trap answer', 'guessed', 'between two'];
export const SKIP_TAGS = ['ran out of time', 'spent too long earlier', "didn't understand", 'saved for later'];

function fmtSec(ms: number) {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

/** One answered question in a review list: the question, your answer, rationale, and a note box if wrong. */
export default function ReviewItem({ attempt, question, index, open: startOpen = false }: {
  attempt: Attempt;
  question: Question | undefined;
  index?: number;
  open?: boolean;
}) {
  const { data, update } = useStore();
  const [open, setOpen] = useState(startOpen);
  if (!question) return <div className="muted small">Question {index !== undefined ? index + 1 : ''} was deleted.</div>;

  const earlier = data.attempts.filter((a) => a.questionId === attempt.questionId && a !== attempt && (a.note || a.noteTags?.length) &&
    (data.modules[a.moduleId]?.submittedAt ?? 0) < (data.modules[attempt.moduleId]?.submittedAt ?? Infinity));
  const wasWrongBefore = data.attempts.some((a) => a.questionId === attempt.questionId && !a.correct &&
    (data.modules[a.moduleId]?.submittedAt ?? 0) < (data.modules[attempt.moduleId]?.submittedAt ?? 0));
  const stillQueued = data.wrongQueue.includes(attempt.questionId);
  const result = outcome(attempt);

  const patch = (p: Partial<Attempt>) =>
    update((d) => ({
      ...d,
      attempts: d.attempts.map((a) => (a.moduleId === attempt.moduleId && a.questionId === attempt.questionId ? { ...a, ...p } : a)),
    }));
  const toggleTag = (t: string) => {
    const tags = attempt.noteTags ?? [];
    patch({ noteTags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] });
  };

  return (
    <div className="review-item" id={`r-${attempt.moduleId}-${attempt.questionId}`}>
      <button className="review-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        {index !== undefined && <span className="q-num" style={{ fontSize: '0.85rem' }}>{index + 1}</span>}
        <span className={`verdict ${result === 'right' ? 'ok' : result === 'wrong' ? 'bad' : 'skip'}`}
          title={result === 'skipped' ? 'Skipped (left blank)' : undefined}>{result === 'right' ? '✓' : result === 'wrong' ? '✗' : '—'}</span>
        <span className="review-q">{question.question}</span>
        {result === 'skipped' && <span className="chip" style={{ background: '#eef0f3', color: '#4b5563' }}>skipped</span>}
        {attempt.flagged && <span title="Marked for review">🚩</span>}
        {attempt.confused && <span title="Confused">🌱</span>}
        {question.difficulty && <span className={`chip ${question.difficulty}`}>{question.difficulty}</span>}
        {question.skill && <span className="chip">{question.skill}</span>}
        <span className="muted small">{fmtSec(attempt.timeMs)}</span>
        <span className="muted">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="fade-up" style={{ padding: '6px 4px 16px' }}>
          <QuestionView q={question} chosen={attempt.chosen} />
          {attempt.crossedOut.length > 0 && (
            <div className="muted small" style={{ marginTop: 6 }}>You crossed out: {attempt.crossedOut.join(', ')}</div>
          )}
          {attempt.correct && wasWrongBefore && !stillQueued && (
            <div className="banner ok" style={{ marginTop: 10 }}>🌸 You missed this before and got it right now. It won't come back.</div>
          )}
          {!attempt.correct && (
            <div className="note-box">
              <div className="row" style={{ marginBottom: 8 }}>
                <Sprout size={22} className="" />
                <b>{result === 'skipped' ? 'Why I skipped it' : 'Why I missed it'}</b>
                <span className="muted small">· this question will come back in a later module until you get it right</span>
              </div>
              <div className="row" style={{ gap: 6, marginBottom: 8 }}>
                {(result === 'skipped' ? SKIP_TAGS : MISS_TAGS).map((t) => (
                  <button key={t} className={`chip clickable ${attempt.noteTags?.includes(t) ? 'selected' : ''}`} onClick={() => toggleTag(t)}>{t}</button>
                ))}
              </div>
              <textarea rows={3} placeholder={result === 'skipped' ? 'What kept you from getting to it? What will you do differently next time?' : 'What tripped you up? What will you look for next time?'}
                value={attempt.note ?? ''} onChange={(e) => patch({ note: e.target.value })} />
            </div>
          )}
          {earlier.length > 0 && (
            <div className="small" style={{ marginTop: 10 }}>
              <b>Your earlier notes on this question:</b>
              {earlier.map((a, k) => (
                <div key={k} className="muted" style={{ marginTop: 4 }}>
                  {a.noteTags?.length ? `[${a.noteTags.join(', ')}] ` : ''}{a.note}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

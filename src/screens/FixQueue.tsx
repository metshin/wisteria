import { useState } from 'react';
import { useStore } from '../store/store';
import { deleteQuestion, saveQuestion } from '../store/actions';
import QuestionEditor from '../components/QuestionEditor';
import { Daisy, WiltedFlower } from '../components/Decor';

export default function FixQueue() {
  const { data, update } = useStore();
  const queue = Object.values(data.questions)
    .filter((q) => q.issues.length > 0 && !q.excluded)
    .sort((a, b) => a.createdAt - b.createdAt);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = queue.find((q) => q.id === openId) ?? queue[0];

  if (!queue.length) {
    return (
      <div className="card empty">
        <Daisy size={60} className="bob" />
        <h2>Nothing to fix</h2>
        <p>Every question in your bank parsed cleanly.</p>
      </div>
    );
  }

  return (
    <>
      <h1>Fix by hand <span className="chip warn">{queue.length}</span></h1>
      <p className="muted">These couldn't be read completely. They stay out of modules until they're fixed.</p>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(200px, 260px) minmax(0, 1fr)', alignItems: 'start' }}>
        <div className="card" style={{ padding: 10, maxHeight: '75vh', overflow: 'auto' }}>
          {queue.map((q) => (
            <button key={q.id} onClick={() => setOpenId(q.id)} className="row"
              style={{
                width: '100%', border: 0, textAlign: 'left', padding: 8, borderRadius: 10, cursor: 'pointer', flexWrap: 'nowrap',
                background: open?.id === q.id ? 'var(--mint)' : 'transparent',
              }}>
              <WiltedFlower size={22} />
              <span style={{ minWidth: 0 }}>
                <span className="small" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {q.question || q.passage || q.raw || '(empty)'}
                </span>
                <span className="small muted">{q.issues[0]}{q.issues.length > 1 ? ` +${q.issues.length - 1}` : ''}</span>
              </span>
            </button>
          ))}
        </div>
        {open && (
          <div className="card" key={open.id}>
            <div className="row" style={{ marginBottom: 10 }}>
              {open.issues.map((s) => <span key={s} className="chip warn">{s}</span>)}
            </div>
            <QuestionEditor
              question={open}
              onSave={(q) => update((d) => saveQuestion(d, q))}
              onDelete={() => update((d) => deleteQuestion(d, open.id))}
            />
          </div>
        )}
      </div>
    </>
  );
}

import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { deleteQuestion, saveQuestion } from '../store/actions';
import { DIFFICULTIES, type Question } from '../types';
import { NO_SKILL, skillOf } from '../parse/skills';
import QuestionEditor from '../components/QuestionEditor';
import QuestionView from '../components/QuestionView';
import { Daisy } from '../components/Decor';

type SeenFilter = 'all' | 'unseen' | 'seen' | 'wrong';

export default function Bank() {
  const { data, update } = useStore();
  const [diff, setDiff] = useState<string>('');
  const [skill, setSkill] = useState('');
  const [seenF, setSeenF] = useState<SeenFilter>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [limit, setLimit] = useState(100);

  const seen = useMemo(() => new Set(data.seen), [data.seen]);
  const wrong = useMemo(() => new Set(data.wrongQueue), [data.wrongQueue]);
  const all = Object.values(data.questions);
  const skills = [...new Set(all.map(skillOf))].sort((x, y) => Number(x === NO_SKILL) - Number(y === NO_SKILL) || x.localeCompare(y));

  const list = all
    .filter((q) => !diff || q.difficulty === diff)
    .filter((q) => !skill || skillOf(q) === skill)
    .filter((q) => seenF === 'all' || (seenF === 'seen' ? seen.has(q.id) : seenF === 'unseen' ? !seen.has(q.id) : wrong.has(q.id)))
    .filter((q) => !search || `${q.passage} ${q.question} ${q.cbId ?? ''}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.createdAt - a.createdAt);

  const counts = DIFFICULTIES.map((d) => [d, all.filter((q) => q.difficulty === d).length] as const);
  const noLevel = all.filter((q) => !q.difficulty).length;

  if (!all.length) {
    return (
      <div className="card empty">
        <Daisy size={60} className="bob" />
        <h2>Your bank is empty</h2>
        <p>Import a PDF or paste some questions to grow your first blossoms.</p>
      </div>
    );
  }

  const toggle = (q: Question, patch: Partial<Question>) => update((d) => saveQuestion(d, { ...q, ...patch }));

  return (
    <>
      <h1>Question bank</h1>
      <div className="row" style={{ marginBottom: 12 }}>
        <span className="chip">{all.length} total</span>
        {counts.map(([d, n]) => <span key={d} className={`chip ${d}`}>{n} {d}</span>)}
        {noLevel > 0 && <span className="chip">{noLevel} no level</span>}
        <span className="chip">{all.length - all.filter((q) => seen.has(q.id)).length} unseen</span>
      </div>
      <div className="card">
        <div className="row">
          <select value={diff} onChange={(e) => setDiff(e.target.value)}>
            <option value="">All difficulties</option>
            {DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
          </select>
          <select value={skill} onChange={(e) => setSkill(e.target.value)}>
            <option value="">All skills</option>
            {skills.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={seenF} onChange={(e) => setSeenF(e.target.value as SeenFilter)}>
            <option value="all">Seen + unseen</option>
            <option value="unseen">Unseen only</option>
            <option value="seen">Seen only</option>
            <option value="wrong">Waiting to retry (wrong)</option>
          </select>
          <input type="text" placeholder="Search text or CB ID…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 160 }} />
        </div>
        <div className="muted small" style={{ margin: '10px 0' }}>{list.length} shown</div>
        {list.slice(0, limit).map((q) => {
          const isOpen = openId === q.id;
          return (
            <div key={q.id} style={{ borderTop: '1px solid var(--line)', padding: '10px 0' }}>
              <div className="row" style={{ cursor: 'pointer', flexWrap: 'nowrap' }} onClick={() => { setOpenId(isOpen ? null : q.id); setEditing(false); }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isOpen ? 'normal' : 'nowrap' }}>
                  {q.question || '(no question text)'}
                </span>
                {q.difficulty && <span className={`chip ${q.difficulty}`}>{q.difficulty}</span>}
                {q.skill && <span className="chip">{q.skill}</span>}
                {q.issues.length > 0 && <span className="chip warn">needs fix</span>}
                {q.source === 'paste' && !q.verified && <span className="chip pink" title="Answer key not checked yet">unverified</span>}
                {q.excluded && <span className="chip warn">reported</span>}
                {wrong.has(q.id) && <span className="chip warn">retry</span>}
                {seen.has(q.id) && <span className="chip" title="Already used in a module">seen</span>}
              </div>
              {isOpen && (
                <div className="fade-up" style={{ marginTop: 12 }}>
                  {editing ? (
                    <QuestionEditor question={q} onCancel={() => setEditing(false)}
                      onSave={(nq) => { update((d) => saveQuestion(d, nq)); setEditing(false); }}
                      onDelete={() => update((d) => deleteQuestion(d, q.id))} />
                  ) : (
                    <>
                      <QuestionView q={q} />
                      <div className="row" style={{ marginTop: 12 }}>
                        <button className="btn small" onClick={() => setEditing(true)}>Edit</button>
                        {q.source === 'paste' && (
                          <button className="btn small ghost" onClick={() => toggle(q, { verified: !q.verified })}>
                            {q.verified ? 'Mark unverified' : 'I checked the answer ✓'}
                          </button>
                        )}
                        <button className="btn small ghost" onClick={() => toggle(q, { excluded: !q.excluded })}>
                          {q.excluded ? 'Un-report' : 'Report as bad question'}
                        </button>
                        {q.cbId && <span className="muted small">CB ID {q.cbId}</span>}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {list.length > limit && (
          <div className="center"><button className="btn ghost" onClick={() => setLimit(limit + 100)}>Show more</button></div>
        )}
      </div>
    </>
  );
}

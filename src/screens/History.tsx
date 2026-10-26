import { Fragment, useState } from 'react';
import type { Go } from '../route';
import { useStore } from '../store/store';
import RetestPanel from '../components/RetestPanel';
import { moduleScore, outcome } from '../logic/stats';
import { deleteModule } from '../logic/submit';
import ReviewItem from '../components/ReviewItem';
import ReportPanel from '../components/ReportPanel';
import { Daisy } from '../components/Decor';
import { skillOf } from '../parse/skills';

type Tab = 'modules' | 'confused' | 'flagged' | 'wrong' | 'skipped';

export default function History({ go }: { go: Go }) {
  const { data, update } = useStore();
  const [tab, setTab] = useState<Tab>('modules');
  const [retestId, setRetestId] = useState<string | null>(null);
  const [skill, setSkill] = useState('');

  const modules = Object.values(data.modules).filter((m) => m.submittedAt).sort((a, b) => b.submittedAt! - a.submittedAt!);
  const when = (ts: number) => new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });


  // Newest attempt first, across every module.
  const order = new Map(modules.map((m, i) => [m.id, i]));
  const across = data.attempts
    .filter((a) => order.has(a.moduleId))
    .filter((a) => (tab === 'confused' ? a.confused : tab === 'flagged' ? a.flagged : tab === 'wrong' || tab === 'skipped' ? outcome(a) === tab : false))
    .filter((a) => { const q = data.questions[a.questionId]; return !skill || (!!q && skillOf(q) === skill); })
    .sort((a, b) => order.get(a.moduleId)! - order.get(b.moduleId)!);
  const skills = [...new Set(data.attempts.map((a) => data.questions[a.questionId]).filter(Boolean).map((q) => skillOf(q!)))].sort();
  const count = (f: (a: (typeof data.attempts)[number]) => boolean) => data.attempts.filter((a) => order.has(a.moduleId) && f(a)).length;

  if (!modules.length) {
    return (
      <div className="card empty">
        <Daisy size={60} className="bob" />
        <h2>No finished modules yet</h2>
        <p>Your results will blossom here.</p>
        <button className="btn primary" onClick={() => go({ name: 'build' })}>Build a module</button>
      </div>
    );
  }

  return (
    <>
      <h1>History</h1>
      <div style={{ marginBottom: 16 }}><ReportPanel /></div>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className={`btn ${tab === 'modules' ? 'on' : 'ghost'}`} onClick={() => setTab('modules')}>Modules ({modules.length})</button>
        <button className={`btn ${tab === 'confused' ? 'on' : 'ghost'}`} onClick={() => setTab('confused')}>🌱 Confused ({count((a) => a.confused)})</button>
        <button className={`btn ${tab === 'flagged' ? 'on' : 'ghost'}`} onClick={() => setTab('flagged')}>🚩 Flagged ({count((a) => a.flagged)})</button>
        <button className={`btn ${tab === 'wrong' ? 'on' : 'ghost'}`} onClick={() => setTab('wrong')}>❌ Wrong + notes ({count((a) => outcome(a) === 'wrong')})</button>
        <button className={`btn ${tab === 'skipped' ? 'on' : 'ghost'}`} onClick={() => setTab('skipped')}>⏭ Skipped ({count((a) => outcome(a) === 'skipped')})</button>
      </div>

      {tab === 'modules' ? (
        <div className="card">
          <table className="tbl">
            <thead><tr><th>When</th><th>Module</th><th>Score</th><th>🚩</th><th>🌱</th><th /></tr></thead>
            <tbody>
              {modules.map((m) => {
                const at = data.attempts.filter((a) => a.moduleId === m.id);
                const s = moduleScore(at);
                return (
                  <Fragment key={m.id}>
                  <tr>
                    <td className="small">{when(m.submittedAt!)}</td>
                    <td>{m.title}{m.autoSubmitted && <span className="muted small"> · ⏰</span>}</td>
                    <td><b>{s.correct}/{s.total}</b> <span className="muted small">{s.pct}%</span></td>
                    <td>{at.filter((a) => a.flagged).length || ''}</td>
                    <td>{at.filter((a) => a.confused).length || ''}</td>
                    <td className="row" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn small" onClick={() => go({ name: 'results', moduleId: m.id })}>Results</button>
                      <button className={`btn small ${retestId === m.id ? 'on' : 'ghost'}`} onClick={() => setRetestId(retestId === m.id ? null : m.id)}
                        disabled={!!data.activeTest} title={data.activeTest ? 'Finish your current test first' : 'Retest wrong, skipped or all questions'}>Retest</button>
                      <button className="btn small ghost" aria-label={`Delete ${m.title}`} title="Delete this module"
                        onClick={() => confirm('Delete this module? Its results are removed, its questions count as unseen again, and its wrong answers leave the retry queue. This can’t be undone.') && update((d) => deleteModule(d, m.id))}>✕</button>
                    </td>
                  </tr>
                  {retestId === m.id && (
                    <tr><td colSpan={6}><RetestPanel moduleId={m.id} go={go} onClose={() => setRetestId(null)} /></td></tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card">
          <div className="row" style={{ marginBottom: 10 }}>
            <select value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">All skills</option>
              {skills.map((s) => <option key={s}>{s}</option>)}
            </select>
            <span className="muted small">
              {tab === 'confused' ? 'Everything you marked 🌱, right or wrong.' : tab === 'flagged' ? 'Everything you marked for review, right or wrong.' : tab === 'skipped' ? 'Everything you left blank (often time ran out).' : 'Every wrong answer, with your notes.'}
            </span>
          </div>
          {across.length === 0 && <div className="empty">Nothing here yet 🌼</div>}
          {across.map((a) => (
            <div key={`${a.moduleId}-${a.questionId}`}>
              <div className="muted small" style={{ marginTop: 8 }}>{when(data.modules[a.moduleId].submittedAt!)} · {data.modules[a.moduleId].title}</div>
              <ReviewItem attempt={a} question={data.questions[a.questionId]} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

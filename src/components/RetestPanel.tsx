import { useState } from 'react';
import type { Go } from '../route';
import { useStore, uid } from '../store/store';
import { startModule } from '../store/actions';
import { newModule, retestQuestions, satPaceMinutes, type RetestScope } from '../logic/buildModule';

const SCOPES: { scope: RetestScope; label: string; title: string }[] = [
  { scope: 'missed', label: '❌ Wrong + ⏭ Skipped', title: 'wrong + skipped' },
  { scope: 'wrong', label: '❌ Wrong only', title: 'wrong' },
  { scope: 'skipped', label: '⏭ Skipped only', title: 'skipped' },
  { scope: 'review', label: 'Wrong + skipped + 🚩 Flagged + 🌱 Confused', title: 'missed + marked' },
  { scope: 'all', label: 'All questions', title: 'all' },
];

/** Choose which questions of a finished module to retest, and how long to give yourself. */
export default function RetestPanel({ moduleId, go, onClose }: { moduleId: string; go: Go; onClose: () => void }) {
  const { data, update } = useStore();
  const m = data.modules[moduleId];
  const counts = Object.fromEntries(SCOPES.map(({ scope }) => [scope, retestQuestions(data, moduleId, scope).length])) as Record<RetestScope, number>;
  const [scope, setScope] = useState<RetestScope>(counts.missed ? 'missed' : counts.review ? 'review' : 'all');
  const n = counts[scope];
  const [minutes, setMinutes] = useState(() => satPaceMinutes(n));
  const [touched, setTouched] = useState(false);

  if (!m) return null;
  const pick = (s: RetestScope) => {
    setScope(s);
    if (!touched) setMinutes(satPaceMinutes(counts[s])); // follow the question count until you set your own time
  };
  const start = () => {
    const ids = retestQuestions(data, moduleId, scope);
    if (!ids.length) return;
    const base = m.title.replace(/^Retest( \([^)]*\))?: /, '');
    const nm = { ...newModule(uid('m_'), ids, Math.round(minutes * 60), m), title: `Retest (${SCOPES.find((x) => x.scope === scope)!.title}): ${base}` };
    update((d) => startModule(d, nm));
    go({ name: 'test' });
  };

  return (
    <div className="retest-panel fade-up">
      <div className="row" style={{ marginBottom: 8 }}>
        <b>Retest</b>
        <span className="spacer" />
        <button className="btn small ghost" onClick={onClose} aria-label="Close retest options">✕</button>
      </div>
      <div className="row" style={{ gap: 8 }}>
        {SCOPES.map(({ scope: s, label }) => (
          <button key={s} className={`chip clickable ${scope === s ? 'selected' : ''}`} disabled={!counts[s]} onClick={() => pick(s)}
            style={!counts[s] ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
            {label} ({counts[s]})
          </button>
        ))}
      </div>
      {counts.missed === 0 && <div className="small muted" style={{ marginTop: 6 }}>You answered every question right in this module 🌸</div>}
      <div className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
        <label className="field">⏱ Timer (minutes)
          <input type="number" min={1} max={300} value={minutes} style={{ width: 100 }}
            onChange={(e) => { setTouched(true); setMinutes(Math.max(1, Math.min(300, Number(e.target.value) || 1))); }} />
        </label>
        <span className="muted small" style={{ paddingBottom: 10 }}>SAT pace for {n} question{n === 1 ? '' : 's'}: {satPaceMinutes(n)} min</span>
        <span className="spacer" />
        <button className="btn primary" disabled={!n || !!data.activeTest} onClick={start}
          title={data.activeTest ? 'Finish your current test first' : undefined}>
          Start retest ({n}) →
        </button>
      </div>
    </div>
  );
}

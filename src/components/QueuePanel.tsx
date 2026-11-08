import { useState } from 'react';
import type { Go } from '../route';
import { useStore, uid } from '../store/store';
import { startModule } from '../store/actions';
import { newModule, queueQuestions, satPaceMinutes, shuffle, type QueueScope } from '../logic/buildModule';

const SCOPES: { scope: QueueScope; label: string; title: string }[] = [
  { scope: 'skipped', label: '⏭ Skipped only', title: 'skipped' },
  { scope: 'wrong', label: '❌ Wrong only', title: 'wrong' },
  { scope: 'missed', label: 'Both', title: 'wrong + skipped' },
];

/** A module made only of questions still on the retry list, from every module you've taken. */
export default function QueuePanel({ go }: { go: Go }) {
  const { data, update } = useStore();
  const counts = Object.fromEntries(SCOPES.map(({ scope }) => [scope, queueQuestions(data, scope).length])) as Record<QueueScope, number>;
  const [scope, setScope] = useState<QueueScope>(counts.skipped ? 'skipped' : counts.wrong ? 'wrong' : 'missed');
  const [limit, setLimit] = useState(0); // 0 = all of them
  const n = limit > 0 ? Math.min(limit, counts[scope]) : counts[scope];
  const [minutes, setMinutes] = useState<number | null>(null); // null = follow SAT pace
  const mins = minutes ?? satPaceMinutes(n);

  if (!counts.missed) return null;

  const start = () => {
    const ids = shuffle(queueQuestions(data, scope)).slice(0, n);
    if (!ids.length) return;
    const title = SCOPES.find((x) => x.scope === scope)!.title;
    const m = { ...newModule(uid('m_'), ids, Math.round(mins * 60)), title: `Retry list (${title}) · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`, isRetest: true };
    update((d) => startModule(d, m));
    go({ name: 'test' });
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>🔁 Practise your retry list</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Only questions you haven't got right yet, from all your modules. Answer one right and it leaves the list.
      </p>
      <div className="row" style={{ gap: 8 }}>
        {SCOPES.map(({ scope: s, label }) => (
          <button key={s} className={`chip clickable ${scope === s ? 'selected' : ''}`} disabled={!counts[s]} onClick={() => setScope(s)}
            style={!counts[s] ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}>
            {label} ({counts[s]})
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12, alignItems: 'flex-end' }}>
        <label className="field">How many (0 = all)
          <input type="number" min={0} max={counts[scope]} value={limit} style={{ width: 100 }}
            onChange={(e) => setLimit(Math.max(0, Math.min(counts[scope], Number(e.target.value) || 0)))} />
        </label>
        <label className="field">⏱ Timer (minutes)
          <input type="number" min={1} max={300} value={mins} style={{ width: 100 }}
            onChange={(e) => setMinutes(Math.max(1, Math.min(300, Number(e.target.value) || 1)))} />
        </label>
        <span className="muted small" style={{ paddingBottom: 10 }}>SAT pace for {n}: {satPaceMinutes(n)} min</span>
        <span className="spacer" />
        <button className="btn primary" disabled={!n} onClick={start}>Start ({n}) →</button>
      </div>
    </div>
  );
}

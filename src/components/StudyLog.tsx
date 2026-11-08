import { useStore } from '../store/store';
import { dayKey, fmtDuration } from '../logic/session';
import { msByDay, studyRows, type StudyRow } from '../logic/studyTime';
import { usePomodoro } from './Pomodoro';
import { deleteModule } from '../logic/submit';

/** Today's study time (sessions + test modules) and a 7-day overview. */
export default function StudyLog() {
  const { data, update } = useStore();
  const { now } = usePomodoro(); // ticks while a session runs, so the live row and totals update

  const rows = studyRows(data, Math.max(now, Date.now()));
  const perDay = msByDay(rows);
  const today = dayKey(Date.now());
  const todays = rows.filter((r) => dayKey(r.end) === today);
  const todayMs = perDay.get(today) ?? 0;

  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - k));
    const key = dayKey(d.getTime());
    return { key, label: d.toLocaleDateString(undefined, { weekday: 'short' }), ms: perDay.get(key) ?? 0 };
  });
  const maxMs = Math.max(...days.map((d) => d.ms), 60 * 60_000);
  const time = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const remove = (r: StudyRow) => {
    if (r.logId) {
      if (confirm('Delete this study session from your log?')) update((d) => ({ ...d, studyLog: d.studyLog.filter((e) => e.id !== r.logId) }));
    } else if (r.moduleId) {
      if (confirm('Delete this test module? Its results are removed, its questions count as unseen again, and its wrong answers leave the retry queue. This can’t be undone.')) {
        update((d) => deleteModule(d, r.moduleId!));
      }
    }
  };

  return (
    <div className="card">
      <div className="row">
        <h3 style={{ margin: 0 }}>📒 Today's study log</h3>
        <span className="spacer" />
        <span className="chip" style={{ fontSize: '0.95rem' }}>Total today: <b>{fmtDuration(todayMs)}</b></span>
      </div>
      {todays.length === 0 ? (
        <div className="muted small" style={{ marginTop: 10 }}>Nothing logged yet today. Start a study session or take a module and it shows up here.</div>
      ) : (
        <table className="tbl" style={{ marginTop: 8 }}>
          <tbody>
            {todays.map((r) => (
              <tr key={r.key}>
                <td className="small muted" style={{ whiteSpace: 'nowrap' }}>{time(r.start)}–{time(r.end)}</td>
                <td>{r.label}<div className="small muted">{r.detail}</div></td>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 800, opacity: r.insideSession ? 0.55 : 1 }}
                  title={r.insideSession ? 'Already counted in the study session' : undefined}>
                  {r.insideSession ? `(${fmtDuration(r.ms)})` : fmtDuration(r.ms)}
                </td>
                <td style={{ width: 30 }}>
                  {!r.live && <button className="btn small ghost" aria-label="Delete entry" title="Delete entry" onClick={() => remove(r)}>✕</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="small muted" style={{ marginTop: 14, fontWeight: 800 }}>Last 7 days</div>
      <div className="week-bars">
        {days.map((d) => (
          <div key={d.key} className="week-day" title={`${d.label}: ${fmtDuration(d.ms)}`}>
            <span className="week-val">{d.ms ? fmtDuration(d.ms) : ''}</span>
            <span className={`week-bar ${d.key === today ? 'today' : ''}`} style={{ height: `${Math.max(d.ms ? 6 : 2, (d.ms / maxMs) * 100)}%` }} />
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

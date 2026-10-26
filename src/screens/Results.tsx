import { useMemo, useState } from 'react';
import { skillOf } from '../parse/skills';
import type { Go } from '../route';
import { useStore } from '../store/store';
import RetestPanel from '../components/RetestPanel';
import { moduleScore, outcome } from '../logic/stats';
import { DIFFICULTIES, type Attempt } from '../types';
import ReviewItem from '../components/ReviewItem';
import { FallingPetals, ScoreFlower } from '../components/Decor';

type Filter = 'all' | 'wrong' | 'skipped' | 'flagged' | 'confused';
const FILTER_LABEL: Record<Filter, string> = { all: 'All', wrong: '❌ Wrong', skipped: '⏭ Skipped', flagged: '🚩 Flagged', confused: '🌱 Confused' };

export default function Results({ moduleId, go }: { moduleId: string; go: Go }) {
  const { data } = useStore();
  const m = data.modules[moduleId];
  const attempts = useMemo(
    () => (m ? m.questionIds.map((qid) => data.attempts.find((a) => a.moduleId === moduleId && a.questionId === qid)).filter((a) => !!a) : []),
    [data.attempts, m, moduleId],
  );
  const [retestOpen, setRetestOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>(() =>
    attempts.some((a) => outcome(a) === 'wrong') ? 'wrong' : attempts.some((a) => outcome(a) === 'skipped') ? 'skipped' : 'all');

  if (!m || !attempts.length) return <div className="card empty">This module has no results yet.</div>;

  const { correct, total, pct } = moduleScore(attempts);
  const bestBefore = Math.max(
    -1,
    ...Object.values(data.modules)
      .filter((o) => o.submittedAt && o.id !== m.id && o.submittedAt < (m.submittedAt ?? 0))
      .map((o) => moduleScore(data.attempts.filter((a) => a.moduleId === o.id)).pct),
  );
  const newBest = bestBefore >= 0 && pct > bestBefore;
  const totalMs = attempts.reduce((n, a) => n + a.timeMs, 0);

  const by = (key: (qid: string) => string | null | undefined) => {
    const rows = new Map<string, { right: number; n: number }>();
    for (const a of attempts) {
      const k = key(a.questionId) ?? '—';
      const r = rows.get(k) ?? { right: 0, n: 0 };
      r.n++;
      if (a.correct) r.right++;
      rows.set(k, r);
    }
    return [...rows.entries()];
  };
  const byDiff = by((id) => data.questions[id]?.difficulty).sort((a, b) => DIFFICULTIES.indexOf(a[0] as never) - DIFFICULTIES.indexOf(b[0] as never));
  const bySkill = by((id) => { const q = data.questions[id]; return q && skillOf(q); });

  const matches = (a: Attempt, f: Filter) =>
    f === 'all' || (f === 'wrong' || f === 'skipped' ? outcome(a) === f : f === 'flagged' ? a.flagged : a.confused);
  const counts = Object.fromEntries((Object.keys(FILTER_LABEL) as Filter[]).map((f) => [f, attempts.filter((a) => matches(a, f)).length])) as Record<Filter, number>;
  const missed = counts.wrong + counts.skipped;
  const shown = attempts.map((a, i) => ({ a, i })).filter(({ a }) => matches(a, filter));


  return (
    <>
      {newBest && <FallingPetals />}
      <div className="card blossom">
        <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <ScoreFlower pct={pct} />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ marginBottom: 4 }}>{correct} / {total} <span className="muted" style={{ fontSize: '1.2rem' }}>({pct}%)</span></h1>
            <div className="muted">{m.title}</div>
            <div className="small" style={{ margin: '2px 0' }}>
              ✓ {correct} right · ❌ {counts.wrong} wrong · ⏭ {counts.skipped} skipped
            </div>
            <div className="muted small">
              {Math.round(totalMs / 60000)} min on questions · {Math.round(totalMs / 1000 / total)} s average
              {m.autoSubmitted && ' · ⏰ time ran out, auto-submitted'}
            </div>
            {newBest && <div className="banner ok" style={{ marginTop: 10 }}>🌸 New best score!</div>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" onClick={() => go({ name: 'build' })}>New module</button>
              <button className={`btn ${retestOpen ? 'on' : ''}`} onClick={() => setRetestOpen(!retestOpen)}>
                {missed ? `Retest wrong & skipped (${missed})` : 'Retest…'}
              </button>
              <button className="btn ghost" onClick={() => go({ name: 'home' })}>Home</button>
            </div>
          </div>
          <div className="grid" style={{ gap: 4, minWidth: 220 }}>
            {byDiff.map(([k, r]) => <div key={k} className="row small"><span className={`chip ${k}`}>{k}</span> {r.right}/{r.n}</div>)}
            {bySkill.map(([k, r]) => <div key={k} className="row small"><span className="chip">{k}</span> {r.right}/{r.n}</div>)}
          </div>
        </div>
      </div>

      {retestOpen && <div className="card"><RetestPanel moduleId={m.id} go={go} onClose={() => setRetestOpen(false)} /></div>}

      <div className="card">
        <h3>Time per question</h3>
        <div className="time-bars">
          {attempts.map((a, i) => {
            const s = a.timeMs / 1000;
            const max = Math.max(...attempts.map((x) => x.timeMs / 1000), 75);
            return (
              <a key={i} href={`#r-${a.moduleId}-${a.questionId}`} className="time-bar"
                title={`Q${i + 1}: ${Math.round(s)}s ${outcome(a) === 'right' ? '✓' : outcome(a) === 'wrong' ? '✗ wrong' : '⏭ skipped'}`}>
                <span className={outcome(a) === 'right' ? 'ok' : outcome(a) === 'wrong' ? 'bad' : 'skip'} style={{ height: `${Math.max(4, (s / max) * 100)}%` }} />
                <small>{i + 1}</small>
              </a>
            );
          })}
        </div>
        <div className="muted small">Bar height = seconds spent. Green = right, coral = wrong, grey = skipped. The SAT pace is about 71 s per question.</div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Review</h3>
          <span className="spacer" />
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
            <button key={f} className={`chip clickable ${filter === f ? 'selected' : ''}`} onClick={() => setFilter(f)}>
              {FILTER_LABEL[f]} ({counts[f]})
            </button>
          ))}
        </div>
        {(filter === 'flagged' || filter === 'confused') && (
          <div className="muted small" style={{ marginBottom: 8 }}>Shows these whether you got them right or wrong.</div>
        )}
        {filter === 'skipped' && (
          <div className="muted small" style={{ marginBottom: 8 }}>Questions you didn't get to. They come back in later modules until you answer them correctly.</div>
        )}
        {shown.length === 0 && <div className="empty">Nothing here 🌼</div>}
        {shown.map(({ a, i }) => (
          <ReviewItem key={`${filter}-${a.questionId}`} attempt={a} question={data.questions[a.questionId]} index={i}
            open={filter !== 'all'} />
        ))}
      </div>
    </>
  );
}

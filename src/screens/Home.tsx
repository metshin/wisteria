import type { Go } from '../route';
import { useStore } from '../store/store';
import { isUsable } from '../store/actions';
import { moduleScore } from '../logic/stats';
import ReportPanel from '../components/ReportPanel';
import PomodoroCard from '../components/Pomodoro';
import StudyLog from '../components/StudyLog';
import Countdown from '../components/Countdown';
import WordOfDay from '../components/WordOfDay';
import { Garden, PetalButton } from '../components/Decor';

function greeting(): string {
  const h = new Date().getHours();
  return h < 5 ? 'Still up? 🌙' : h < 12 ? 'Good morning 🌤' : h < 18 ? 'Good afternoon ☀️' : 'Good evening 🌙';
}

export default function Home({ go }: { go: Go }) {
  const { data } = useStore();
  const qs = Object.values(data.questions);
  const seen = new Set(data.seen);
  const unseenHard = qs.filter((q) => isUsable(q) && q.difficulty === 'hard' && !seen.has(q.id)).length;
  const toFix = qs.filter((q) => q.issues.length && !q.excluded).length;
  const done = Object.values(data.modules).filter((m) => m.submittedAt).sort((a, b) => b.submittedAt! - a.submittedAt!);
  const last = done[0];
  const lastScore = last ? moduleScore(data.attempts.filter((a) => a.moduleId === last.id)) : null;
  const daysSinceLast = last ? Math.floor((Date.now() - last.submittedAt!) / 86_400_000) : null;

  return (
    <>
      <Garden />
      <div className="grid two" style={{ alignItems: 'start' }}>
        <div className="grid" style={{ gap: 18 }}>
          <div className="card blossom">
            <h1 style={{ marginBottom: 4 }}>{greeting()}</h1>
            {qs.length === 0 ? (
              <>
                <p className="muted">Your wisteria hasn't bloomed yet. Start by importing a Question Bank PDF you downloaded yourself, or paste some questions.</p>
                <PetalButton onClick={() => go({ name: 'import' })}>Import questions</PetalButton>
              </>
            ) : (
              <>
                {daysSinceLast !== null && daysSinceLast >= 3 && (
                  <div className="banner" style={{ margin: '8px 0' }}>
                    It's been {daysSinceLast} days since your last module. A short one today keeps the streak blooming 🌸
                  </div>
                )}
                <div className="grid" style={{ margin: '14px 0', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  <div className="stat"><div className="num">{unseenHard}</div><div className="lbl">unseen hard</div></div>
                  <div className="stat"><div className="num">{data.wrongQueue.length}</div><div className="lbl">to retry</div></div>
                  <div className="stat"><div className="num">{done.length}</div><div className="lbl">modules done</div></div>
                </div>
                {lastScore && (
                  <div className="muted small" style={{ marginBottom: 12 }}>
                    Last module: <b>{lastScore.correct}/{lastScore.total}</b> ({lastScore.pct}%) ·{' '}
                    <a href="#" onClick={(e) => { e.preventDefault(); go({ name: 'results', moduleId: last.id }); }}>see results</a>
                  </div>
                )}
                <div className="row">
                  <PetalButton onClick={() => go({ name: data.activeTest ? 'test' : 'build' })}>
                    {data.activeTest ? 'Resume test →' : 'Build a module →'}
                  </PetalButton>
                  {toFix > 0 && (
                    <button className="btn pink" onClick={() => go({ name: 'fix' })}>{toFix} question{toFix === 1 ? '' : 's'} to fix</button>
                  )}
                </div>
              </>
            )}
          </div>
          <WordOfDay go={go} />
          <Countdown />
          <ReportPanel />
        </div>
        <div className="grid" style={{ gap: 18 }}>
          <PomodoroCard />
          <StudyLog />
        </div>
      </div>
    </>
  );
}

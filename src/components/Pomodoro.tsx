import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore, uid } from '../store/store';
import type { PomodoroSettings, StudyLogEntry, StudySession } from '../types';
import {
  breaksLeft, finishSession, fmtDuration, focusElapsed, isComplete, pause as pauseS, resume as resumeS,
  setTestOpen, startSession, takeBreak as takeBreakS, targetMs, tick,
} from '../logic/session';
import FruitIcon, { FRUITS } from './FruitIcon';
import { Daisy, Leaf, PetalButton } from './Decor';

interface Timer {
  session: StudySession | null;
  now: number;
  justFinished: StudyLogEntry | null;
  start: () => void;
  takeBreak: () => void;
  resume: () => void;
  pause: () => void;
  end: () => void;
  setTestRunning: (on: boolean) => void;
  dismiss: () => void;
}

const Ctx = createContext<Timer | null>(null);

/** Runs the study session across all tabs, including while you take a test (that's study time too). */
export function PomodoroProvider({ children }: { children: ReactNode }) {
  const { data, update } = useStore();
  const session = data.studySession;
  const [now, setNow] = useState(() => Date.now());
  const [justFinished, setJustFinished] = useState<StudyLogEntry | null>(null);
  const active = !!session;

  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const iv = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(iv);
  }, [active]);

  const patch = useCallback(
    (fn: (s: StudySession, t: number) => StudySession) =>
      update((d) => {
        if (!d.studySession) return d;
        const next = fn(d.studySession, Date.now());
        return next === d.studySession ? d : { ...d, studySession: next };
      }),
    [update],
  );

  const end = useCallback(() => {
    if (!session) return;
    const entry = finishSession(session, Date.now(), uid('log_'));
    update((d) => {
      if (!d.studySession) return d;
      // Under a minute isn't worth a log line (e.g. started by mistake).
      const keep = entry.focusMs >= 60_000;
      return { ...d, studySession: null, studyLog: keep ? [...d.studyLog, entry] : d.studyLog };
    });
    if (entry.focusMs >= 60_000) setJustFinished(entry);
    chime();
  }, [session, update]);

  // A break running out, or reaching the planned time.
  useEffect(() => {
    if (!session) return;
    if (tick(session, now) !== session) {
      chime();
      patch(tick);
    } else if (session.phase === 'focus' && isComplete(session, now)) {
      end();
    }
  }, [now, session, patch, end]);

  const value: Timer = {
    session,
    now,
    justFinished,
    start: () => {
      setJustFinished(null);
      update((d) => (d.studySession ? d : { ...d, studySession: startSession(uid('ss_'), d.settings.pomodoro, Date.now()) }));
    },
    takeBreak: () => patch(takeBreakS),
    resume: () => patch(resumeS),
    pause: () => patch(pauseS),
    end,
    setTestRunning: useCallback((on: boolean) => patch((s, t) => setTestOpen(s, on, t)), [patch]),
    dismiss: () => setJustFinished(null),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePomodoro(): Timer {
  const p = useContext(Ctx);
  if (!p) throw new Error('usePomodoro outside provider');
  return p;
}

function chime() {
  try {
    const ac = new AudioContext();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0, ac.currentTime + i * 0.18);
      g.gain.linearRampToValueAtTime(0.12, ac.currentTime + i * 0.18 + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + i * 0.18 + 0.9);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + i * 0.18);
      o.stop(ac.currentTime + i * 0.18 + 1);
    });
    setTimeout(() => ac.close(), 2000);
  } catch {
    /* sound is optional */
  }
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

const FRUIT_EMOJI = { tomato: '🍅', strawberry: '🍓', peach: '🍑', lemon: '🍋', cherry: '🍒', kiwi: '🥝' } as const;

/** Small indicator for the nav bar while a session runs. */
export function PomodoroChip({ onClick }: { onClick: () => void }) {
  const p = usePomodoro();
  const { data } = useStore();
  const s = p.session;
  if (!s) return null;
  const label = s.phase === 'break' ? `☕ ${clock((s.breakUntil ?? p.now) - p.now)}`
    : s.phase === 'paused' ? '⏸ paused'
    : `${FRUIT_EMOJI[data.settings.pomodoro.fruit]} ${clock(targetMs(s) - focusElapsed(s, p.now))}`;
  return <button className="chip clickable" onClick={onClick} title="Study session">{label}</button>;
}

const PRESETS = [60, 120, 180];

export default function PomodoroCard() {
  const { data, update } = useStore();
  const p = usePomodoro();
  const st = data.settings.pomodoro;
  const s = p.session;
  const setS = (patch: Partial<PomodoroSettings>) =>
    update((d) => ({ ...d, settings: { ...d.settings, pomodoro: { ...d.settings.pomodoro, ...patch } } }));
  const [moreOpen, setMoreOpen] = useState(false);

  const focus = s ? focusElapsed(s, p.now) : 0;
  const ripeness = s ? focus / targetMs(s) : 0;

  return (
    <div className="card pomo">
      <div className="row">
        <h3 style={{ margin: 0 }}>{FRUITS.find((f) => f.kind === st.fruit)!.label} study session</h3>
        {s && <span className="chip">{s.phase === 'focus' ? 'Studying' : s.phase === 'break' ? 'On a break' : 'Paused'}</span>}
        <span className="spacer" />
        <button className="btn small ghost" onClick={() => setMoreOpen(!moreOpen)}>⚙ Settings</button>
      </div>

      <div className="pomo-main">
        <div className="vine-wrap" aria-hidden>
          <Leaf size={30} className="sway" style={{ position: 'absolute', left: 6, top: 6 }} />
          <Daisy size={22} className="sway-soft" style={{ position: 'absolute', right: 10, top: 14 }} />
          <Leaf size={24} color="#8fbf86" className="sway-soft" style={{ position: 'absolute', right: 0, bottom: 20, transform: 'scaleX(-1)' }} />
          <Daisy size={18} petal="#fde3ec" className="sway" style={{ position: 'absolute', left: 14, bottom: 10 }} />
        </div>
        <div className={s?.phase === 'focus' ? 'bob' : ''} style={{ position: 'relative' }}>
          <FruitIcon kind={st.fruit} size={140} ripeness={ripeness} />
          {p.justFinished && (
            <div className="bloom-burst" aria-hidden><Daisy size={56} petal="#fde3ec" className="bloom-open" /></div>
          )}
        </div>

        {!s ? (
          <SessionSetup st={st} setS={setS} onStart={p.start} />
        ) : (
          <>
            {s.phase === 'break' ? (
              <>
                <div className="pomo-time">☕ {clock((s.breakUntil ?? p.now) - p.now)}</div>
                <div className="muted small">break left · studied {fmtDuration(focus)} so far</div>
              </>
            ) : (
              <>
                <div className="pomo-time">{clock(targetMs(s) - focus)}</div>
                <div className="muted small">to go · studied {fmtDuration(focus)} of {fmtDuration(targetMs(s))}</div>
              </>
            )}
            <div className="row" style={{ justifyContent: 'center', gap: 4, margin: '10px 0' }} title="Breaks: 🌸 taken, 🌱 left">
              {Array.from({ length: s.breaksPlanned }, (_, k) => <span key={k}>{k < s.breaksTaken ? '🌸' : '🌱'}</span>)}
              {s.breaksPlanned === 0 && <span className="muted small">no breaks planned</span>}
            </div>

            {s.pausedForTest ? (
              <div className="banner">Paused while your test is open ⏸</div>
            ) : (
              <>
                {s.breakOver && <div className="banner ok fade-up" style={{ marginBottom: 10 }}>Break's over. Ready when you are 🌸</div>}
                <div className="row" style={{ justifyContent: 'center' }}>
                  {s.phase === 'focus' && (
                    <>
                      <PetalButton className="btn pink" onClick={p.takeBreak} disabled={breaksLeft(s) === 0}>
                        Take a {s.breakMin}-min break ({breaksLeft(s)} left)
                      </PetalButton>
                      <button className="btn ghost" onClick={p.pause}>Pause</button>
                    </>
                  )}
                  {s.phase !== 'focus' && <PetalButton onClick={p.resume}>Back to studying</PetalButton>}
                  <button className="btn ghost" onClick={() => confirm(`End the session and log ${fmtDuration(focus)}?`) && p.end()}>End session</button>
                </div>
              </>
            )}
            {s.phase === 'break' && st.breathingPrompt && (
              <div className="breathe-box fade-up">
                <div className="breathe" aria-hidden />
                <div className="small">
                  Stand up, stretch, sip some water. Breathe in as the circle grows and out as it shrinks. Slow and easy, no need to force it.
                </div>
              </div>
            )}
          </>
        )}

        {p.justFinished && (
          <div className="banner ok fade-up" style={{ marginTop: 12 }}>
            {p.justFinished.completed ? 'Ripe! 🌸 ' : ''}Logged {fmtDuration(p.justFinished.focusMs)} of study.
            <button className="btn small ghost" style={{ marginLeft: 8 }} onClick={p.dismiss}>OK</button>
          </div>
        )}
      </div>

      <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
        {FRUITS.map((f) => (
          <button key={f.kind} className={`fruit-pick ${st.fruit === f.kind ? 'on' : ''}`} onClick={() => setS({ fruit: f.kind })} title={f.label} aria-label={f.label}>
            <FruitIcon kind={f.kind} size={34} />
          </button>
        ))}
      </div>

      {moreOpen && (
        <div className="fade-up" style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
          <label className="field" style={{ maxWidth: 200 }}>Break length (min)
            <input type="number" min={1} max={60} value={st.breakMin} style={{ width: 90 }}
              onChange={(e) => setS({ breakMin: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })} />
          </label>
          <label className="row small" style={{ marginTop: 10, fontWeight: 700, flexWrap: 'nowrap' }}>
            <input type="checkbox" checked={st.breathingPrompt} onChange={(e) => setS({ breathingPrompt: e.target.checked })} />
            Show a short breathing exercise during breaks
          </label>
          <label className="row small" style={{ marginTop: 6, fontWeight: 700, flexWrap: 'nowrap' }}>
            <input type="checkbox" checked={data.settings.animateTestScreen}
              onChange={(e) => update((d) => ({ ...d, settings: { ...d.settings, animateTestScreen: e.target.checked } }))} />
            Animate decorations on the test screen too (off = calmer, closer to Bluebook)
          </label>
        </div>
      )}
    </div>
  );
}

function SessionSetup({ st, setS, onStart }: { st: PomodoroSettings; setS: (p: Partial<PomodoroSettings>) => void; onStart: () => void }) {
  const preset = PRESETS.includes(st.targetMin);
  return (
    <div className="session-setup">
      <div className="pomo-time">{clock(st.targetMin * 60_000)}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
        {PRESETS.map((m) => (
          <button key={m} className={`chip clickable ${st.targetMin === m ? 'selected' : ''}`} onClick={() => setS({ targetMin: m })}>{m / 60} h</button>
        ))}
        <label className={`chip ${!preset ? 'selected' : ''}`} style={{ gap: 6 }}>
          custom
          <input type="number" min={5} max={600} step={5} value={st.targetMin} aria-label="Session length in minutes"
            style={{ width: 70, padding: '2px 6px' }} onChange={(e) => setS({ targetMin: Math.max(5, Math.min(600, Number(e.target.value) || 5)) })} />
          min
        </label>
      </div>
      <div className="row" style={{ justifyContent: 'center', marginTop: 12, gap: 8 }}>
        <button className="btn small ghost" aria-label="fewer breaks" onClick={() => setS({ breaks: Math.max(0, st.breaks - 1) })}>−</button>
        <span><b>{st.breaks}</b> × {st.breakMin}-min break{st.breaks === 1 ? '' : 's'}</span>
        <button className="btn small ghost" aria-label="more breaks" onClick={() => setS({ breaks: Math.min(12, st.breaks + 1) })}>+</button>
      </div>
      <div className="muted small center" style={{ margin: '6px 0 12px' }}>Take them whenever you want during the session.</div>
      <div className="center"><PetalButton onClick={onStart}>Start studying</PetalButton></div>
    </div>
  );
}

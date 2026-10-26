import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { examMoment, timeLeft } from '../logic/countdown';
import { Daisy, WisteriaTree } from './Decor';
import { usePomodoro } from './Pomodoro';
import { dayKey, fmtDuration } from '../logic/session';
import { growthLevel, msByDay, studyRows } from '../logic/studyTime';

const PAST_DAYS = 6;
const LEVEL_TEXT = ['no study', 'under 1 h', '1 h+', '2 h+', '3 h+ 💐'];

/** A day's plant, sized by how long you studied: sprout → bud → flower → big flower → bouquet. */
function Plant({ level, today }: { level: 0 | 1 | 2 | 3 | 4; today?: boolean }) {
  const cls = today ? 'sway' : 'sway-soft';
  const stem = (h: number, x = 15) => <path d={`M${x} 44 V ${44 - h}`} stroke="#5e8c61" strokeWidth="2.2" strokeLinecap="round" />;
  const leaf = (y: number, flip = false) => (
    <path d={flip ? `M15 ${y} q -8 -6 -11 -1 q 6 5 11 1z` : `M15 ${y} q 8 -6 11 -1 q -6 5 -11 1z`} fill="#8fbf86" />
  );
  const flower = (cx: number, cy: number, r: number, petal: string) => (
    <g>
      {Array.from({ length: 6 }, (_, k) => (
        <ellipse key={k} cx={cx} cy={cy - r} rx={r * 0.55} ry={r} fill={petal} transform={`rotate(${k * 60} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="#f7d56b" />
    </g>
  );
  return (
    <svg width="30" height="46" viewBox="0 0 30 46" className={`${cls} ${today ? 'plant-today' : ''}`} aria-hidden>
      {level === 0 && <>{stem(10)}<path d="M15 36 q 6 -6 9 -2 q -5 4 -9 2z M15 36 q -6 -6 -9 -2 q 5 4 9 2z" fill="#b9cbb3" /></>}
      {level === 1 && <>{stem(20)}{leaf(34)}<ellipse cx="15" cy="20" rx="4.5" ry="6.5" fill="#f5b5c8" /><path d="M10.5 22 Q 15 28 19.5 22" fill="#8fbf86" /></>}
      {level === 2 && <>{stem(24)}{leaf(36)}{leaf(30, true)}{flower(15, 16, 5.5, '#f5b5c8')}</>}
      {level === 3 && <>{stem(28)}{leaf(38)}{leaf(31, true)}{flower(15, 13, 7.5, '#f39ab8')}</>}
      {level === 4 && (
        <>
          <path d="M15 44 L 8 22 M15 44 L 15 18 M15 44 L 22 22" stroke="#5e8c61" strokeWidth="2" />
          {flower(8, 18, 5, '#fde3ec')}{flower(22, 18, 5, '#f7c948')}{flower(15, 12, 6, '#f39ab8')}
          <path d="M10 36 L 20 36 L 17 42 L 13 42 Z" fill="#e9a8d6" />
        </>
      )}
    </svg>
  );
}

const MAX_BUDS = 30;

/** One little wisteria tree on the vine (a day still to go). */
function Bud({ delay }: { delay: number }) {
  return <WisteriaTree size={22} delay={delay} />;
}

function message(days: number): string {
  if (days === 0) return "Test day! Breathe, read carefully, you've got this 🌸";
  if (days === 1) return 'Tomorrow! Light review only, pack your bag, early night 🌙';
  if (days <= 7) return 'Final week: full timed modules, go through your 🌱 Confused list, and sleep well.';
  if (days <= 14) return 'Two weeks out: a timed hard module every day, then retry your misses.';
  return 'Plenty of time to grow. Steady hard modules every day add up 🌱';
}

/** Days until the next SAT, as a vine of buds that ends in a flower on test day. */
export default function Countdown() {
  const { data, update } = useStore();
  usePomodoro(); // re-render while a session ticks, so today's plant grows live
  const date = data.settings.examDate;
  const [now, setNow] = useState(() => new Date());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const iv = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(iv);
  }, []);

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const t = valid ? timeLeft(date, now) : null;
  const label = valid ? examMoment(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '';
  const buds = t ? Math.min(t.days, MAX_BUDS) : 0;

  // Past days (only since you started using the app) and today, as plants sized by study time.
  const rows = studyRows(data, Date.now());
  const perDay = msByDay(rows);
  const firstDay = rows.length ? dayKey(Math.min(...rows.map((r) => r.start))) : dayKey(Date.now());
  const garden = Array.from({ length: PAST_DAYS + 1 }, (_, k) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (PAST_DAYS - k));
    const key = dayKey(d.getTime());
    const ms = perDay.get(key) ?? 0;
    return { key, ms, level: growthLevel(ms), today: k === PAST_DAYS, label: d.toLocaleDateString(undefined, { weekday: 'short' }) };
  }).filter((g) => g.today || g.key >= firstDay);
  const todayMs = garden[garden.length - 1].ms;

  return (
    <div className="card countdown">
      <div className="row">
        <h3 style={{ margin: 0 }}>🌸 SAT countdown</h3>
        <span className="spacer" />
        {editing ? (
          <input type="date" value={date} aria-label="Test date" autoFocus
            onChange={(e) => e.target.value && update((d) => ({ ...d, settings: { ...d.settings, examDate: e.target.value } }))}
            onBlur={() => setEditing(false)} />
        ) : (
          <button className="btn small ghost" onClick={() => setEditing(true)} title="Change test date">{label || 'Set date'} ✎</button>
        )}
      </div>

      {!t ? (
        <p className="muted">Set your test date to start the countdown.</p>
      ) : t.passed ? (
        <div className="center" style={{ padding: '10px 0' }}>
          <Daisy size={56} className="bloom-open" />
          <p style={{ margin: '6px 0' }}>Your test on {label} is done. How did it go? Set your next date with ✎ when you know it.</p>
        </div>
      ) : (
        <>
          <div className="cd-main">
            <div className="cd-num">{t.days}</div>
            <div>
              <div className="cd-unit">{t.days === 1 ? 'day to go' : t.days === 0 ? 'today!' : 'days to go'}</div>
              <div className="muted small">{t.d}d {t.h}h {t.m}m until 8:00 AM on {label}</div>
            </div>
          </div>
          <div className="cd-vine" aria-label={`${t.days} days left`}>
            {garden.map((g) => (
              <span key={g.key} className={`cd-day ${g.today ? 'today' : ''}`} title={`${g.today ? 'Today' : g.label}: ${g.ms ? fmtDuration(g.ms) : 'no study'} (${LEVEL_TEXT[g.level]})`}>
                <Plant level={g.level} today={g.today} />
              </span>
            ))}
            <span className="cd-sep" aria-hidden />
            {Array.from({ length: Math.max(0, buds - 1) }, (_, k) => <Bud key={k} delay={(k % 7) * 0.35} />)}
            {t.days > MAX_BUDS && <span className="muted small">+{t.days - MAX_BUDS}</span>}
            <span className="cd-goal" title="Test day">
              <WisteriaTree size={44} className="sway" />
            </span>
          </div>
          <div className="cd-legend small muted">
            Today: <b>{todayMs ? fmtDuration(todayMs) : 'nothing yet'}</b> · grows at 1 h 🌼, 2 h 🌸, 3 h 💐
          </div>
          <div className="small" style={{ marginTop: 6 }}>{message(t.days)}</div>
        </>
      )}
    </div>
  );
}

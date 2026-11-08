import { useMemo, useState } from 'react';
import type { Go } from '../route';
import { useStore, uid } from '../store/store';
import { isUsable, startModule } from '../store/actions';
import { buildModule, cellPool, LEVELS, levelOf, newModule, type Level } from '../logic/buildModule';
import { gridTotal, PRESET_TIMER_MIN, PRESETS, sameGrid } from '../logic/presets';
import { discardTest } from '../logic/submit';
import { DOMAINS, DOMAIN_SHORT, NO_SKILL, SKILLS_BY_DOMAIN, skillOf } from '../parse/skills';
import type { Difficulty } from '../types';
import { FlowerPot, PetalButton } from '../components/Decor';
import QueuePanel from '../components/QueuePanel';
import { BuildReminders } from '../components/StickyNotes';

const POT_COLOR: Record<Level, string> = { hard: '#f19c8b', medium: '#f7d56b', easy: '#a8d8a0', none: '#c9b8e8' };
const LEVEL_LABEL: Record<Level, string> = { hard: 'Hard', medium: 'Medium', easy: 'Easy', none: 'No level' };
const GRID_COLS: Difficulty[] = ['easy', 'medium', 'hard'];

export default function Builder({ go }: { go: Go }) {
  const { data, update } = useStore();
  const b = data.settings.builder;
  const [short, setShort] = useState<string[] | null>(null);

  const setB = (patch: Partial<typeof b>) => {
    setShort(null);
    update((d) => ({ ...d, settings: { ...d.settings, builder: { ...d.settings.builder, ...patch } } }));
  };
  const setReview = (n: number) => update((d) => ({ ...d, settings: { ...d.settings, reviewSlotsMax: n } }));

  const seen = useMemo(() => new Set(data.seen), [data.seen]);
  const usable = Object.values(data.questions).filter(isUsable);
  const unseen = (d: Level, skill?: string) =>
    usable.filter((q) => levelOf(q) === d && !seen.has(q.id) && (skill ? skillOf(q) === skill : !b.skills.length || b.skills.includes(skillOf(q)))).length;
  const extraSkills = [...new Set(usable.map(skillOf))].filter((s) => !Object.values(SKILLS_BY_DOMAIN).flat().includes(s))
    .sort((x, y) => Number(x === NO_SKILL) - Number(y === NO_SKILL));
  const domains = { ...SKILLS_BY_DOMAIN, ...(extraSkills.length ? { Other: extraSkills } : {}) };
  // Only show the "No level" pot when there are questions without a difficulty (or it's already in use).
  const levels = LEVELS.filter((d) => d !== 'none' || b.none > 0 || usable.some((q) => !q.difficulty));
  const byDomain = b.mode === 'domain';
  const total = byDomain ? gridTotal(b.grid) : b.hard + b.medium + b.easy + b.none;
  const activePreset = PRESETS.find((p) => sameGrid(p.grid, b.grid));
  const setCell = (dm: string, d: Difficulty, n: number) =>
    setB({ grid: { ...b.grid, [dm]: { ...b.grid[dm], [d]: Math.max(0, Math.min(99, n)) } } });
  /** Unseen questions with this skill in the cells you've asked for (domain mode) or the difficulties you've asked for. */
  const skillCount = (s: string) => byDomain
    ? DOMAINS.reduce((acc, dm) => acc + GRID_COLS.reduce((m, d) => m + (b.grid[dm][d] > 0 ? cellPool(data, dm, d, [s]).length : 0), 0), 0)
    : levels.reduce((acc, d) => acc + (b[d] > 0 ? unseen(d, s) : 0), 0);
  const waiting = data.wrongQueue.filter((id) => data.questions[id] && isUsable(data.questions[id])).length;

  const toggleSkill = (s: string) => setB({ skills: b.skills.includes(s) ? b.skills.filter((x) => x !== s) : [...b.skills, s] });

  const build = (allowShort: boolean) => {
    const r = buildModule(data, {
      counts: { hard: b.hard, medium: b.medium, easy: b.easy, none: b.none },
      grid: byDomain ? b.grid : undefined,
      skills: b.skills,
      timerMin: b.timerMin,
      reviewMax: data.settings.reviewSlotsMax,
      allowShort,
    });
    if (!r.ok) {
      setShort(r.short);
      return;
    }
    const m = newModule(uid('m_'), r.questionIds, Math.round(b.timerMin * 60));
    update((d) => startModule(d, m));
    go({ name: 'test' });
  };

  if (data.activeTest) {
    return (
      <div className="card empty">
        <h2>You have a test in progress ⏸</h2>
        <p>Finish or submit it before starting a new module.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={() => go({ name: 'test' })}>Resume test</button>
          <button className="btn danger" onClick={() => confirm('Discard this test? Nothing from it is saved.') && update((d) => discardTest(d))}>Discard this test</button>
        </div>
      </div>
    );
  }

  if (!usable.length) {
    return (
      <div className="card empty">
        <h2>No questions yet 🌸</h2>
        <p>Import some questions first, then come back to build a module.</p>
        <button className="btn primary" onClick={() => go({ name: 'import' })}>Import questions</button>
      </div>
    );
  }

  return (
    <>
      <h1>Build a module</h1>
      <QueuePanel go={go} />
      <div className="card blossom">
        <div className="row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>How many questions?</h3>
          <span className="spacer" />
          <button className={`chip clickable ${!byDomain ? 'selected' : ''}`} onClick={() => setB({ mode: 'difficulty' })}>By difficulty</button>
          <button className={`chip clickable ${byDomain ? 'selected' : ''}`} onClick={() => setB({ mode: 'domain' })}>By domain (SAT pattern)</button>
        </div>
        {!byDomain ? (
        <div className="row" style={{ gap: 28, alignItems: 'flex-end' }}>
          {levels.map((d) => (
            <div key={d} className="center">
              <FlowerPot value={b[d]} max={27} color={POT_COLOR[d]} />
              <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
                <button className="btn small ghost" aria-label={`fewer ${d}`} onClick={() => setB({ [d]: Math.max(0, b[d] - 1) })}>−</button>
                <input type="number" min={0} max={99} value={b[d]} style={{ width: 64, textAlign: 'center' }}
                  onChange={(e) => setB({ [d]: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })} aria-label={`${d} questions`} />
                <button className="btn small ghost" aria-label={`more ${d}`} onClick={() => setB({ [d]: b[d] + 1 })}>+</button>
              </div>
              <div style={{ fontWeight: 800, marginTop: 4 }} title={d === 'none' ? 'Questions saved without a difficulty' : undefined}>{LEVEL_LABEL[d]}</div>
              <div className="muted small">{unseen(d)} unseen available</div>
            </div>
          ))}
        </div>
        ) : (
          <>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              {PRESETS.map((p) => (
                <button key={p.id} className={`chip clickable ${activePreset?.id === p.id ? 'selected' : ''}`}
                  onClick={() => setB({ grid: p.grid, timerMin: PRESET_TIMER_MIN })}>
                  {p.label}
                </button>
              ))}
              <span className="muted small">Presets are rough estimates — College Board doesn't publish exact numbers.</span>
            </div>
            <div className="table-scroll">
              <table className="grid-table">
                <thead>
                  <tr><th>Domain</th>{GRID_COLS.map((d) => <th key={d} className={`gt-${d}`}>{LEVEL_LABEL[d]}</th>)}<th>Total</th></tr>
                </thead>
                <tbody>
                  {DOMAINS.map((dm) => (
                    <tr key={dm}>
                      <th scope="row">{dm}</th>
                      {GRID_COLS.map((d) => {
                        const left = cellPool(data, dm, d, b.skills).length;
                        const want = b.grid[dm][d];
                        return (
                          <td key={d}>
                            <input type="number" min={0} max={99} value={want} aria-label={`${dm} ${d}`}
                              onChange={(e) => setCell(dm, d, Number(e.target.value) || 0)} />
                            <div className={`small ${left < want ? 'gt-short' : 'muted'}`}>{left} left</div>
                          </td>
                        );
                      })}
                      <td className="gt-total">{GRID_COLS.reduce((n, d) => n + b.grid[dm][d], 0)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Total</th>
                    {GRID_COLS.map((d) => <td key={d} className="gt-total">{DOMAINS.reduce((n, dm) => n + b.grid[dm][d], 0)}</td>)}
                    <td className="gt-total gt-grand">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div className="muted small" style={{ marginTop: 8 }}>
              “left” = unseen questions for that domain and difficulty{b.skills.length ? ' (with your skill filter)' : ''}.
              The module is ordered like Bluebook: {DOMAINS.map((d) => DOMAIN_SHORT[d]).join(' → ')}, easier to harder inside each.
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="row">
          <h3 style={{ margin: 0 }}>Skills</h3>
          <span className="muted small">{b.skills.length ? `${b.skills.length} selected` : 'all skills'}</span>
          <span className="spacer" />
          {b.skills.length > 0 && <button className="btn small ghost" onClick={() => setB({ skills: [] })}>Use all skills</button>}
        </div>
        {Object.entries(domains).map(([domain, skills]) => (
          <div key={domain} style={{ marginTop: 12 }}>
            <div className="muted small" style={{ fontWeight: 800, marginBottom: 6 }}>{domain}</div>
            <div className="row" style={{ gap: 8 }}>
              {skills.map((s) => {
                const n = skillCount(s);
                return (
                  <button key={s} className={`chip clickable ${b.skills.includes(s) ? 'selected' : ''}`} onClick={() => toggleSkill(s)}>
                    {s} <span style={{ opacity: 0.7 }}>· {n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <div className="muted small" style={{ marginTop: 8 }}>The number is how many unseen questions of your chosen difficulties are left.</div>
      </div>

      <div className="card">
        <div className="row" style={{ gap: 24 }}>
          <label className="field">⏱ Timer (minutes)
            <input type="number" min={1} max={300} value={b.timerMin} style={{ width: 100 }}
              onChange={(e) => setB({ timerMin: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
          <label className="field">🌱 Wrong & skipped to bring back (max)
            <input type="number" min={0} max={99} value={data.settings.reviewSlotsMax} style={{ width: 100 }}
              onChange={(e) => setReview(Math.max(0, Number(e.target.value) || 0))} />
          </label>
          <div className="muted small" style={{ maxWidth: 320 }}>
            {waiting} wrong or skipped question{waiting === 1 ? ' is' : 's are'} waiting to be retried. They take up places in the module
            and keep coming back until you get them right.
          </div>
        </div>
        <div className="muted small" style={{ marginTop: 10 }}>
          Real SAT pace: 27 questions in 32 minutes (about 71 seconds each). You've set {total} questions in {b.timerMin} min
          {total > 0 && ` (≈ ${Math.round((b.timerMin * 60) / total)} s each)`}.
        </div>
      </div>

      {short && (
        <div className="banner err" style={{ marginTop: 16 }}>
          {short.map((s) => <div key={s}>{s}</div>)}
          {total > 0 && <button className="btn small" style={{ marginTop: 8 }} onClick={() => build(true)}>Build with what's available</button>}
        </div>
      )}

      <BuildReminders />

      <div className="row" style={{ marginTop: 18 }}>
        <span className="spacer" />
        <PetalButton disabled={total === 0} onClick={() => build(false)}>Start module ({total} questions) →</PetalButton>
      </div>
    </>
  );
}

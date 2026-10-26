import { useMemo, useState } from 'react';
import type { Go } from '../route';
import { useStore, uid } from '../store/store';
import { isUsable, startModule } from '../store/actions';
import { buildModule, LEVELS, levelOf, newModule, type Level } from '../logic/buildModule';
import { discardTest } from '../logic/submit';
import { NO_SKILL, SKILLS_BY_DOMAIN, skillOf } from '../parse/skills';
import { FlowerPot, PetalButton } from '../components/Decor';

const POT_COLOR: Record<Level, string> = { hard: '#f19c8b', medium: '#f7d56b', easy: '#a8d8a0', none: '#c9b8e8' };
const LEVEL_LABEL: Record<Level, string> = { hard: 'Hard', medium: 'Medium', easy: 'Easy', none: 'No level' };

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
  const total = b.hard + b.medium + b.easy + b.none;
  const waiting = data.wrongQueue.filter((id) => data.questions[id] && isUsable(data.questions[id])).length;

  const toggleSkill = (s: string) => setB({ skills: b.skills.includes(s) ? b.skills.filter((x) => x !== s) : [...b.skills, s] });

  const build = (allowShort: boolean) => {
    const r = buildModule(data, {
      counts: { hard: b.hard, medium: b.medium, easy: b.easy, none: b.none },
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
      <div className="card blossom">
        <h3>How many questions?</h3>
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
                const n = levels.reduce((acc, d) => acc + (b[d] > 0 ? unseen(d, s) : 0), 0);
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

      <div className="row" style={{ marginTop: 18 }}>
        <span className="spacer" />
        <PetalButton disabled={total === 0} onClick={() => build(false)}>Start module ({total} questions) →</PetalButton>
      </div>
    </>
  );
}

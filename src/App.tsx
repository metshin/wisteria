import { useEffect, useState } from 'react';
import { useStore } from './store/store';
import type { Route } from './route';
import { CornerLeaves, WisteriaTree } from './components/Decor';
import { PomodoroChip, usePomodoro } from './components/Pomodoro';
import Home from './screens/Home';
import Import from './screens/Import';
import FixQueue from './screens/FixQueue';
import Bank from './screens/Bank';
import Builder from './screens/Builder';
import Test from './screens/Test';
import Results from './screens/Results';
import History from './screens/History';
import WordBank from './screens/WordBank';

const TABS: { name: Route['name']; label: string }[] = [
  { name: 'home', label: 'Home' },
  { name: 'import', label: 'Import' },
  { name: 'fix', label: 'Fix' },
  { name: 'bank', label: 'Bank' },
  { name: 'build', label: 'Build module' },
  { name: 'history', label: 'History' },
  { name: 'words', label: 'Word bank' },
];

export default function App() {
  const { data, saveError } = useStore();
  const [route, setRoute] = useState<Route>(() => (data.activeTest ? { name: 'test' } : { name: 'home' }));
  const { setTestRunning } = usePomodoro();
  const inTest = route.name === 'test' && !!data.activeTest;
  // Tests count as study time, so a running session keeps going during them.
  // (Older versions paused it; this clears any pause left over from then.)
  useEffect(() => setTestRunning(false), [setTestRunning]);

  const go = (r: Route) => {
    setRoute(r);
    window.scrollTo({ top: 0 });
  };

  // While a test runs, the whole app is the test screen.
  if (inTest) {
    return <Test go={go} />;
  }

  const fixCount = Object.values(data.questions).filter((q) => q.issues.length > 0 && !q.excluded).length;

  return (
    <div className="app">
      <CornerLeaves />
      <nav className="nav">
        <div className="brand">
          <WisteriaTree size={30} /> Wisteria Study
        </div>
        {TABS.map((t) => (
          <button key={t.name} className={`nav-btn ${route.name === t.name ? 'active' : ''}`}
            onClick={() => go({ name: t.name } as Route)}>
            {t.label}
            {t.name === 'fix' && fixCount > 0 && <span className="count">{fixCount}</span>}
            {t.name === 'words' && data.wordBank.length > 0 && <span className="count">{data.wordBank.filter((w) => !w.learned).length || '✓'}</span>}
          </button>
        ))}
        <span className="spacer" />
        <PomodoroChip onClick={() => go({ name: 'home' })} />
        {data.activeTest && (
          <button className="btn pink small" onClick={() => go({ name: 'test' })}>Resume test →</button>
        )}
      </nav>
      {saveError && <div className="banner err" style={{ margin: 10 }}>{saveError}</div>}
      <main className="page" style={{ position: 'relative', zIndex: 1 }}>
        {route.name === 'home' && <Home go={go} />}
        {route.name === 'import' && <Import go={go} />}
        {route.name === 'fix' && <FixQueue />}
        {route.name === 'bank' && <Bank />}
        {route.name === 'build' && <Builder go={go} />}
        {route.name === 'test' && <Home go={go} />}
        {route.name === 'results' && <Results moduleId={route.moduleId} go={go} />}
        {route.name === 'history' && <History go={go} />}
        {route.name === 'words' && <WordBank key={route.tab ?? 'list'} tab={route.tab} />}
      </main>
      <footer className="site-footer muted small">
        Not affiliated with or endorsed by College Board. SAT® is a trademark of College Board.
      </footer>
    </div>
  );
}

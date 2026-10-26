import { get, set } from 'idb-keyval';
import type { AppData, Settings } from '../types';

// Questions (big: passages, rationales, chart images) are stored apart from everything else
// (small: progress, settings, the running test), so frequent saves stay cheap.
const Q_KEY = 'wisteria-study-questions-v1';
const REST_KEY = 'wisteria-study-state-v1';
const SNAP_KEY = 'wisteria-study-state-snapshot';

export function defaultSettings(): Settings {
  return {
    pomodoro: { fruit: 'tomato', targetMin: 120, breaks: 4, breakMin: 5, breathingPrompt: false },
    reviewSlotsMax: 5,
    builder: { hard: 27, medium: 0, easy: 0, none: 0, timerMin: 32, skills: [] },
    animateTestScreen: false,
    examDate: '',
  };
}

export function emptyData(): AppData {
  return {
    version: 1,
    questions: {},
    modules: {},
    attempts: [],
    seen: [],
    wrongQueue: [],
    settings: defaultSettings(),
    activeTest: null,
    studySession: null,
    studyLog: [],
    wordBank: [],
  };
}

/** Fill in any fields missing from older saves. */
export function normalize(raw: unknown): AppData {
  if (!raw || typeof raw !== 'object') throw new Error('Saved data is not in the expected format.');
  const r = raw as Partial<AppData>;
  if (r.version !== 1 || typeof r.questions !== 'object' || r.questions === null) {
    throw new Error('Saved data is not in the expected format (missing version or questions).');
  }
  const base = emptyData();
  const s = (r.settings ?? {}) as Partial<Settings>;
  // Skill and difficulty used to be required: clear those old flags so such questions become usable.
  const questions = Object.fromEntries(Object.entries(r.questions).map(([id, q]) => {
    const issues = Array.isArray(q.issues) ? q.issues.filter((i) => i !== 'Missing difficulty' && i !== 'Missing skill') : [];
    return [id, issues.length === q.issues?.length ? q : { ...q, issues }];
  }));
  return {
    ...base,
    ...r,
    questions,
    attempts: Array.isArray(r.attempts) ? r.attempts : [],
    seen: Array.isArray(r.seen) ? r.seen : [],
    wrongQueue: Array.isArray(r.wrongQueue) ? r.wrongQueue : [],
    modules: r.modules ?? {},
    activeTest: r.activeTest ?? null,
    studySession: r.studySession ?? null,
    studyLog: Array.isArray(r.studyLog) ? r.studyLog : [],
    wordBank: Array.isArray(r.wordBank) ? r.wordBank : [],
    settings: {
      ...base.settings,
      ...s,
      pomodoro: { ...base.settings.pomodoro, ...(s.pomodoro ?? {}) },
      builder: { ...base.settings.builder, ...(s.builder ?? {}) },
    },
  };
}

type Stored = Omit<AppData, 'questions'> & { savedAt?: number };

function readSnapshot(): Stored | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

/** Synchronous copy of everything except questions, written when the page is closing. */
export function saveSnapshot(data: AppData): void {
  try {
    const { questions: _q, ...rest } = data;
    void _q;
    localStorage.setItem(SNAP_KEY, JSON.stringify({ ...rest, savedAt: Date.now() }));
  } catch {
    /* storage full or blocked: the IndexedDB save still runs */
  }
}

export async function loadData(): Promise<AppData> {
  const [questions, stored] = await Promise.all([get(Q_KEY), get(REST_KEY) as Promise<Stored | undefined>]);
  const snap = readSnapshot();
  const rest = snap && (!stored || (snap.savedAt ?? 0) > (stored.savedAt ?? 0)) ? snap : stored;
  if (questions && rest) {
    const data = normalize({ ...rest, questions });
    lastQuestions = data.questions;
    return data;
  }
  return emptyData();
}

let lastQuestions: AppData['questions'] | null = null;

export async function saveData(data: AppData): Promise<void> {
  const { questions, ...rest } = data;
  if (questions !== lastQuestions) {
    await set(Q_KEY, questions);
    lastQuestions = questions;
  }
  await set(REST_KEY, { ...rest, savedAt: Date.now() });
}

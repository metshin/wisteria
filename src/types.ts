export type Letter = 'A' | 'B' | 'C' | 'D';
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D'];

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['hard', 'medium', 'easy'];

export interface Question {
  id: string;
  source: 'cb-pdf' | 'paste';
  passage: string;
  question: string;
  choices: Record<Letter, string>;
  answer: Letter | null;
  rationale: string;
  difficulty: Difficulty | null;
  skill: string;
  domain?: string;
  cbId?: string;
  /** Images of charts/tables, referenced from the passage as [[fig:N]]. */
  figures?: string[];
  /** Parse/validation problems. A question with issues can't go into a module. */
  issues: string[];
  /** Original text the parser saw, shown next to the fix form. */
  raw?: string;
  /** Pasted questions start unverified until you confirm the answer key. */
  verified: boolean;
  /** User reported the question as bad; it's left out of modules. */
  excluded?: boolean;
  createdAt: number;
}

export interface Attempt {
  questionId: string;
  moduleId: string;
  chosen: Letter | null;
  correct: boolean;
  timeMs: number;
  /** 🚩 come back during the test */
  flagged: boolean;
  /** 🌱 review after submitting */
  confused: boolean;
  crossedOut: Letter[];
  note?: string;
  noteTags?: string[];
}

export interface Module {
  id: string;
  title: string;
  questionIds: string[];
  timerSec: number;
  startedAt: number;
  submittedAt?: number;
  autoSubmitted?: boolean;
  isRetest: boolean;
  retestOf?: string;
  /** Study session that was running (focus) when the test started: its time is already counted there. */
  sessionId?: string;
}

// Bluebook's Highlights & Notes options.
export type HlColor = 'yellow' | 'blue' | 'pink';
export const HL_COLORS: HlColor[] = ['yellow', 'blue', 'pink'];
export type HlUnderline = 'none' | 'solid' | 'dashed' | 'dotted';
export const HL_UNDERLINES: HlUnderline[] = ['none', 'solid', 'dashed', 'dotted'];

/** A highlighted stretch of text, as character offsets into the passage or the question sentence. */
export interface TextHighlight {
  id: string;
  part: 'passage' | 'stem';
  start: number;
  end: number;
  color: HlColor;
  underline: HlUnderline;
  note: string;
}

/** Per-question state while a test is running. */
export interface LiveAnswer {
  chosen: Letter | null;
  flagged: boolean;
  confused: boolean;
  crossedOut: Letter[];
  timeMs: number;
  highlights?: TextHighlight[];
}

export interface WordEntry {
  id: string;
  text: string;
  /** The sentence it came from. */
  context: string;
  questionId?: string;
  meaning: string;
  learned: boolean;
  addedAt: number;
  /** Flashcard box (0 = new or missed). Each "Got it" moves it up one box and further out. */
  box?: number;
  /** When the flashcard is next due (ms). Missing = due now. */
  due?: number;
}

export interface ActiveTest {
  moduleId: string;
  current: number;
  remainingSec: number;
  answers: LiveAnswer[];
  timerHidden: boolean;
}

export type FruitKind = 'tomato' | 'strawberry' | 'apple' | 'lemon' | 'cherry' | 'kiwi';

export interface PomodoroSettings {
  fruit: FruitKind;
  /** Planned focus time for a study session. */
  targetMin: number;
  /** How many breaks you allow yourself in a session. */
  breaks: number;
  breakMin: number;
  breathingPrompt: boolean;
}

export type SessionPhase = 'focus' | 'break' | 'paused';

/** A study session in progress. Times are timestamps, so it survives reloads. */
export interface StudySession {
  id: string;
  startedAt: number;
  targetMin: number;
  breakMin: number;
  breaksPlanned: number;
  breaksTaken: number;
  phase: SessionPhase;
  /** Focus time already banked (not counting the current focus stretch). */
  focusMs: number;
  /** When the current focus stretch started (phase 'focus' only). */
  focusSince: number | null;
  /** When the current break ends (phase 'break' only). */
  breakUntil: number | null;
  /** Paused because a test is open; resumes when the test closes. */
  pausedForTest: boolean;
  /** It was counting focus time when the test opened. */
  resumeAfterTest: boolean;
  /** Set when a break ran out, so the card can say "break's over". */
  breakOver: boolean;
}

export interface StudyLogEntry {
  id: string;
  start: number;
  end: number;
  focusMs: number;
  targetMin: number;
  breaksTaken: number;
  /** true when the full planned time was reached. */
  completed: boolean;
  sessionId?: string;
}

/** How many questions of each difficulty to pick per domain (keys are domain names). */
export type DomainGrid = Record<string, Record<Difficulty, number>>;

export interface BuilderSettings {
  /** Count questions per difficulty (flower pots) or per domain × difficulty (SAT pattern). */
  mode: 'difficulty' | 'domain';
  hard: number;
  medium: number;
  easy: number;
  /** `none` = questions saved without a difficulty. */
  none: number;
  grid: DomainGrid;
  timerMin: number;
  skills: string[];
}

/** A note on the Home notes board. */
export interface StickyNote {
  id: string;
  title: string;
  kind: 'text' | 'todo';
  body: string;
  items: { id: string; text: string; done: boolean }[];
  color: NoteColor;
  /** Also show it on the Build module screen, as a reminder before starting. */
  showOnBuild: boolean;
  createdAt: number;
  updatedAt: number;
}
export type NoteColor = 'yellow' | 'pink' | 'green' | 'blue' | 'peach';
export const NOTE_COLORS: NoteColor[] = ['yellow', 'pink', 'green', 'blue', 'peach'];

export interface Settings {
  pomodoro: PomodoroSettings;
  reviewSlotsMax: number;
  builder: BuilderSettings;
  animateTestScreen: boolean;
  /** Next SAT date (YYYY-MM-DD) for the home countdown. */
  examDate: string;
  /** Today's word of the day, kept so it doesn't change when you add words. */
  wordOfDay?: { day: string; id: string };
}

export interface AppData {
  version: 1;
  questions: Record<string, Question>;
  modules: Record<string, Module>;
  attempts: Attempt[];
  seen: string[];
  wrongQueue: string[];
  settings: Settings;
  activeTest: ActiveTest | null;
  studySession: StudySession | null;
  studyLog: StudyLogEntry[];
  wordBank: WordEntry[];
  notes: StickyNote[];
}

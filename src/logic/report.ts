import type { AppData, Attempt, Difficulty, Question } from '../types';
import { DIFFICULTIES } from '../types';
import { outcome } from './stats';
import { dayKey, fmtDuration } from './session';
import { msByDay, studyRows } from './studyTime';
import { timeLeft } from './countdown';
import { skillOf } from '../parse/skills';
import { deckWords } from './flashcards';

/**
 * A plain-text (Markdown) progress report meant to be pasted into a chat for analysis:
 * accuracy, wrong vs skipped, timing by skill and difficulty, trends, repeat misses and your notes.
 */

const sec = (ms: number) => `${Math.round(ms / 1000)}s`;
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '–');
const short = (s: string, n = 110) => {
  const t = s.replace(/<\/?u>/g, '').replace(/\[\[fig:\d+\]\]/g, '[chart]').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

interface Group { n: number; right: number; wrong: number; skipped: number; ms: number; missMs: number; flagged: number; confused: number }
const empty = (): Group => ({ n: 0, right: 0, wrong: 0, skipped: 0, ms: 0, missMs: 0, flagged: 0, confused: 0 });

function addTo(g: Group, a: Attempt) {
  const o = outcome(a);
  g.n++;
  g[o]++;
  g.ms += a.timeMs;
  if (o === 'wrong') g.missMs += a.timeMs;
  if (a.flagged) g.flagged++;
  if (a.confused) g.confused++;
}

function table(rows: [string, Group][]): string {
  const head = '| | Done | Accuracy | Wrong | Skipped | Avg time | Avg time on wrong | 🌱 Confused |\n|---|---|---|---|---|---|---|---|';
  const body = rows.map(([k, g]) =>
    `| ${k} | ${g.n} | ${pct(g.right, g.n)} | ${g.wrong} | ${g.skipped} | ${sec(g.ms / Math.max(1, g.n))} | ${g.wrong ? sec(g.missMs / g.wrong) : '–'} | ${g.confused} |`);
  return [head, ...body].join('\n');
}

export function buildReport(data: AppData, now = Date.now()): string {
  const mods = Object.values(data.modules).filter((m) => m.submittedAt).sort((a, b) => a.submittedAt! - b.submittedAt!);
  const done = new Set(mods.map((m) => m.id));
  const attempts = data.attempts.filter((a) => done.has(a.moduleId));
  const q = (id: string): Question | undefined => data.questions[id];
  const out: string[] = [];

  const total = empty();
  attempts.forEach((a) => addTo(total, a));
  const t = /^\d{4}-\d{2}-\d{2}$/.test(data.settings.examDate) ? timeLeft(data.settings.examDate, new Date(now)) : null;

  out.push(`# Wisteria Study progress report — ${new Date(now).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`);
  out.push('');
  out.push('_Digital SAT Reading & Writing practice. Paste this into a chat and ask for an analysis of what to work on._');
  out.push('');
  out.push('## Overview');
  out.push(`- Test date: ${data.settings.examDate}${t && !t.passed ? ` (${t.days} days left)` : ''}`);
  out.push(`- Modules finished: ${mods.length} (${mods.filter((m) => m.isRetest).length} retests)`);
  out.push(`- Questions answered: ${total.n} — right ${total.right} (${pct(total.right, total.n)}), wrong ${total.wrong}, skipped ${total.skipped}`);
  out.push(`- Average time per question: ${sec(total.ms / Math.max(1, total.n))} (real SAT pace ≈ 71s)`);
  out.push(`- Waiting to be retried (wrong or skipped, not yet answered right): ${data.wrongQueue.length}`);
  out.push(`- Question bank: ${Object.keys(data.questions).length} questions, ${data.seen.length} seen`);

  if (!attempts.length) {
    out.push('', 'No finished modules yet.');
    return out.join('\n');
  }

  // By skill / difficulty
  const bySkill = new Map<string, Group>();
  const byDiff = new Map<Difficulty | 'no level', Group>();
  for (const a of attempts) {
    const qq = q(a.questionId);
    const sk = qq ? skillOf(qq) : 'Deleted question';
    if (!bySkill.has(sk)) bySkill.set(sk, empty());
    addTo(bySkill.get(sk)!, a);
    const df = qq?.difficulty ?? 'no level';
    if (!byDiff.has(df)) byDiff.set(df, empty());
    addTo(byDiff.get(df)!, a);
  }
  const skills = [...bySkill.entries()].sort((a, b) => a[1].right / a[1].n - b[1].right / b[1].n);
  out.push('', '## By skill (weakest first)', table(skills));
  out.push('', '## By difficulty', table([...byDiff.entries()].sort((a, b) => DIFFICULTIES.indexOf(a[0] as Difficulty) - DIFFICULTIES.indexOf(b[0] as Difficulty))));

  // Time
  const slow = attempts.filter((a) => a.timeMs > 120_000);
  const slowest = [...bySkill.entries()].sort((a, b) => b[1].ms / b[1].n - a[1].ms / a[1].n).slice(0, 3);
  out.push('', '## Time');
  out.push(`- Questions over 2 minutes: ${slow.length} (of which wrong: ${slow.filter((a) => outcome(a) === 'wrong').length}, skipped: ${slow.filter((a) => outcome(a) === 'skipped').length})`);
  out.push(`- Slowest skills: ${slowest.map(([k, g]) => `${k} (${sec(g.ms / g.n)})`).join(', ')}`);
  out.push(`- Modules that ran out of time: ${mods.filter((m) => m.autoSubmitted).length} of ${mods.length}`);

  // Trend
  out.push('', '## Module scores (oldest → newest)');
  out.push('| Date | Module | Score | Wrong | Skipped | Avg time |\n|---|---|---|---|---|---|');
  for (const m of mods.slice(-15)) {
    const g = empty();
    attempts.filter((a) => a.moduleId === m.id).forEach((a) => addTo(g, a));
    out.push(`| ${new Date(m.submittedAt!).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} | ${m.isRetest ? 'Retest' : 'Module'} (${g.n} q) | ${g.right}/${g.n} (${pct(g.right, g.n)}) | ${g.wrong} | ${g.skipped} | ${sec(g.ms / Math.max(1, g.n))} |`);
  }

  // Reasons from notes
  const tagCount = new Map<string, number>();
  attempts.forEach((a) => a.noteTags?.forEach((tg) => tagCount.set(tg, (tagCount.get(tg) ?? 0) + 1)));
  if (tagCount.size) {
    out.push('', '## Why I missed or skipped (my tags)');
    out.push([...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(' · '));
  }

  // Repeat misses
  const misses = new Map<string, number>();
  attempts.filter((a) => outcome(a) !== 'right').forEach((a) => misses.set(a.questionId, (misses.get(a.questionId) ?? 0) + 1));
  const repeat = [...misses.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (repeat.length) {
    out.push('', '## Missed more than once');
    for (const [id, n] of repeat) {
      const qq = q(id);
      out.push(`- ×${n} · ${qq ? skillOf(qq) : '?'} · ${qq?.difficulty ?? 'no level'} — “${short(qq?.question ?? '')}”`);
    }
  }

  // Recent misses with notes
  const recent = [...attempts].filter((a) => outcome(a) !== 'right').reverse().slice(0, 15);
  out.push('', '## Recent wrong / skipped questions');
  for (const a of recent) {
    const qq = q(a.questionId);
    const o = outcome(a);
    const parts = [
      `- **${o === 'skipped' ? 'Skipped' : 'Wrong'}** · ${qq ? skillOf(qq) : '?'} · ${qq?.difficulty ?? 'no level'} · ${sec(a.timeMs)}`,
      o === 'wrong' ? ` · chose ${a.chosen}, answer ${qq?.answer}` : '',
      a.confused ? ' · 🌱 confused' : '',
      a.flagged ? ' · 🚩 flagged' : '',
    ];
    out.push(parts.join(''));
    if (qq) {
      out.push(`  - Q: ${short(qq.question)}`);
      if (o === 'wrong' && a.chosen && qq.answer) out.push(`  - My pick: “${short(qq.choices[a.chosen], 80)}” · Correct: “${short(qq.choices[qq.answer], 80)}”`);
    }
    if (a.noteTags?.length || a.note) out.push(`  - My note: ${a.noteTags?.length ? `[${a.noteTags.join(', ')}] ` : ''}${short(a.note ?? '', 200)}`);
  }

  // Study time
  const rows = studyRows(data, now);
  const perDay = msByDay(rows);
  const firstDay = rows.length ? dayKey(Math.min(...rows.map((r) => r.start))) : dayKey(now);
  const days = Array.from({ length: 14 }, (_, k) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (13 - k));
    return { key: dayKey(d.getTime()), label: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) };
  })
    .filter((x) => x.key >= firstDay) // only since you started using the app
    .map((x) => [x.label, perDay.get(x.key) ?? 0] as const);
  out.push('', '## Study time per day (last 14 days)');
  out.push(days.map(([d, ms]) => `${d}: ${ms ? fmtDuration(ms) : '0'}`).join(' · '));
  out.push(`- Total: ${fmtDuration(days.reduce((n, [, ms]) => n + ms, 0))}`);

  // Word bank
  const learning = data.wordBank.filter((w) => !w.learned);
  out.push('', '## Word bank');
  out.push(`- ${data.wordBank.length} words, ${data.wordBank.length - learning.length} learned`);
  out.push(`- Flashcards due now: ${deckWords(data.wordBank, 'due', now).length}`);
  if (learning.length) out.push(`- Still learning: ${learning.slice(0, 40).map((w) => w.text).join(', ')}`);

  return out.join('\n');
}

/** Time left until the test, counted to a local date and time (test-day check-in ~8:00). */
export interface TimeLeft {
  passed: boolean;
  /** Calendar days from today to test day (0 on test day). */
  days: number;
  /** Exact remaining time, for the small ticking line. */
  d: number;
  h: number;
  m: number;
}

export function examMoment(date: string, time = '08:00'): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, h, mi);
}

export function timeLeft(date: string, now: Date, time = '08:00'): TimeLeft {
  const exam = examMoment(date, time);
  const ms = exam.getTime() - now.getTime();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(exam) - startOf(now)) / 86_400_000);
  const left = Math.max(0, ms);
  return {
    passed: ms <= 0 && days <= 0,
    days: Math.max(0, days),
    d: Math.floor(left / 86_400_000),
    h: Math.floor((left % 86_400_000) / 3_600_000),
    m: Math.floor((left % 3_600_000) / 60_000),
  };
}

import { describe, expect, it } from 'vitest';
import { timeLeft } from '../logic/countdown';

describe('timeLeft', () => {
  it('counts calendar days and exact time to 8:00 on test day', () => {
    const t = timeLeft('2026-11-07', new Date(2026, 9, 19, 20, 30)); // Oct 19, 8:30 PM
    expect(t).toEqual({ passed: false, days: 19, d: 18, h: 11, m: 30 });
  });

  it('shows 0 days on the morning of the test, then passed', () => {
    expect(timeLeft('2026-11-07', new Date(2026, 10, 7, 6, 0))).toMatchObject({ passed: false, days: 0, h: 2 });
    expect(timeLeft('2026-11-07', new Date(2026, 10, 7, 9, 0)).passed).toBe(true);
    expect(timeLeft('2026-11-07', new Date(2026, 10, 9)).passed).toBe(true);
  });
});

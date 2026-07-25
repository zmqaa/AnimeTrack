import { describe, expect, it } from 'vitest';

import {
  dateKeyToAppDate,
  formatAppDateKey,
  getAppDateTimeParts,
  shiftDateKey,
} from '../../lib/date-utils';

describe('application date helpers', () => {
  it('uses Asia/Shanghai when an instant crosses the local date boundary', () => {
    const instant = '2026-07-24T16:30:00.000Z';

    expect(formatAppDateKey(instant)).toBe('2026-07-25');
    expect(getAppDateTimeParts(instant)).toMatchObject({
      year: 2026,
      month: 7,
      day: 25,
      hour: 0,
      minute: 30,
    });
  });

  it.each([
    ['2024-02-28', 1, '2024-02-29'],
    ['2024-02-29', 1, '2024-03-01'],
    ['2026-01-01', -1, '2025-12-31'],
  ])('shifts %s by %i day(s)', (dateKey, days, expected) => {
    expect(shiftDateKey(dateKey, days)).toBe(expected);
  });

  it('converts a date key to midnight in the application timezone', () => {
    expect(dateKeyToAppDate('2026-07-25').toISOString()).toBe('2026-07-24T16:00:00.000Z');
  });

  it('rejects malformed date keys', () => {
    expect(() => shiftDateKey('2026/07/25', 1)).toThrow('无效日期键');
  });
});

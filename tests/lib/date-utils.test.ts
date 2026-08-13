import { describe, expect, it } from 'vitest';

import {
  dateKeyToAppDate,
  formatAppDateKey,
  getAppDateTimeParts,
  isValidCalendarDate,
  isValidDateTimeString,
  normalizeDateString,
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
    expect(() => shiftDateKey('2026-02-29', 1)).toThrow('无效日期键');
    expect(() => dateKeyToAppDate('2026-04-31')).toThrow('无效日期键');
  });

  it.each([
    ['2024-02-29', true],
    ['2000-02-29', true],
    ['1900-02-29', false],
    ['2026-02-29', false],
    ['2026-04-31', false],
    ['2026-13-01', false],
    ['0000-01-01', false],
    ['2026-2-01', false],
  ])('validates calendar date %s', (value, expected) => {
    expect(isValidCalendarDate(value)).toBe(expected);
  });

  it('does not normalize an impossible formatted date into another month', () => {
    expect(normalizeDateString('2026-02-31')).toBeUndefined();
    expect(normalizeDateString('2026/02/31 12:00:00')).toBeUndefined();
    expect(normalizeDateString('2024-02-29')).toBe('2024-02-29');
    expect(normalizeDateString('2024-2-29 12:00:00')).toBe('2024-02-29');
  });

  it('validates the calendar part of timestamps before parsing them', () => {
    expect(isValidDateTimeString('2026-08-13T14:30:00.000Z')).toBe(true);
    expect(isValidDateTimeString('2026-08-13 14:30:00')).toBe(true);
    expect(isValidDateTimeString('2026-02-31T14:30:00.000Z')).toBe(false);
  });
});

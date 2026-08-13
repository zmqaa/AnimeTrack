export const APP_TIME_ZONE = 'Asia/Shanghai';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface AppDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** 严格判断 YYYY-MM-DD 是否是真实存在的公历日期。 */
export function isValidCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonth[month - 1];
}

/** 校验带时间值的日期部分，防止 Date 自动把 2 月 31 日纠正到 3 月。 */
export function isValidDateTimeString(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!isValidCalendarDate(trimmed.slice(0, 10))) return false;
  return !Number.isNaN(new Date(trimmed).getTime());
}

/** 将时间统一换算为应用使用的中国标准时间。 */
export function getAppDateTimeParts(value: Date | string | number): AppDateTimeParts {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('无效日期');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

export function formatAppDateKey(value: Date | string | number): string {
  const { year, month, day } = getAppDateTimeParts(value);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 对 YYYY-MM-DD 日历日期做加减，不受运行设备时区影响。 */
export function shiftDateKey(dateKey: string, days: number): string {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match || !isValidCalendarDate(dateKey)) throw new Error(`无效日期键: ${dateKey}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function dateKeyToAppDate(dateKey: string): Date {
  if (!isValidCalendarDate(dateKey)) throw new Error(`无效日期键: ${dateKey}`);
  return new Date(`${dateKey}T00:00:00+08:00`);
}

/** 生成当前 CST (UTC+8) ISO 时间字符串，格式 "2026-03-31T14:05:00" */
export function nowISO(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', 'T');
}

export function normalizeDateString(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return undefined;
  }

  const leadingDate = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:$|[T\s])/.exec(trimmed);
  if (leadingDate) {
    const normalized = `${leadingDate[1]}-${leadingDate[2].padStart(2, '0')}-${leadingDate[3].padStart(2, '0')}`;
    return isValidCalendarDate(normalized) ? normalized : undefined;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

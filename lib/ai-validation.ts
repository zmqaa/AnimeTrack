/**
 * AI 响应值类型强制/校验工具
 * 从 ai.ts 中抽取的通用校验函数
 */

import { uniqueStrings } from './anime-cast';
import { normalizeDateString } from './date-utils';

type ParsedQuickRecordStatus = 'watching' | 'completed' | 'dropped' | 'plan_to_watch';

export function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function toOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

export function toOptionalFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function toOptionalNonNegativeNumber(value: unknown): number | undefined {
  const parsed = toOptionalFiniteNumber(value);
  if (parsed === undefined || parsed < 0) return undefined;
  return parsed;
}

export function toOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  // 兼容导入模块的字符串布尔值
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

export function toOptionalDateString(value: unknown): string | undefined {
  if (value instanceof Date) return normalizeDateString(value);
  if (typeof value !== 'string') return undefined;
  return normalizeDateString(value);
}

export function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = uniqueStrings(value.map((item) => (typeof item === 'string' ? item : String(item ?? ''))));
  return normalized.length > 0 ? normalized : undefined;
}

export function toOptionalQuickRecordStatus(value: unknown): ParsedQuickRecordStatus | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (normalized === 'watching' || normalized === 'completed' || normalized === 'dropped' || normalized === 'plan_to_watch') {
    return normalized;
  }
  return undefined;
}

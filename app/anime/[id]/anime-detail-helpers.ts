import { normalizeStringArray } from '@/lib/anime-cast';
import type { AnimeStatus, AnimeDetailItem } from '@/lib/anime-shared';
import { ANIME_STATUS_LABELS } from '@/lib/anime-shared';

export const statusMap = ANIME_STATUS_LABELS;

export const statusBadgeStyles: Record<AnimeStatus, string> = {
  watching: 'status-watching-soft',
  completed: 'status-completed-soft',
  dropped: 'status-dropped-soft',
  plan_to_watch: 'status-plan-soft',
};

export function formatDateLabel(value?: string) {
  return value || '未记录';
}

export function formatTimestampLabel(value?: string) {
  if (!value) return '未记录';
  return value.replace('T', ' ').slice(0, 16);
}

export function toTagInputValue(value: AnimeDetailItem['tags'] | string | undefined) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

export type AnimeMutationResponse = {
  ok?: boolean;
  entry: AnimeDetailItem;
  appliedFields?: string[];
};

export const OMIT_FIELD = Symbol('omit-field');

export const editableKeys = [
  'title', 'originalTitle', 'status', 'progress', 'score', 'totalEpisodes',
  'notes', 'coverUrl', 'durationMinutes', 'tags', 'summary',
  'startDate', 'endDate', 'premiereDate', 'cast', 'isFinished',
] as const;

const arrayKeys = new Set(['tags', 'cast']);
const requiredNumericKeys = new Set(['progress']);
const nullableNumericKeys = new Set(['score', 'totalEpisodes', 'durationMinutes']);
const nullableTextKeys = new Set(['originalTitle', 'notes', 'coverUrl', 'summary', 'startDate', 'endDate', 'premiereDate']);

export type EditableField = (typeof editableKeys)[number];
export type AnimeDetailPatchPayload = Partial<Record<EditableField, unknown>>;

export function resolveReturnTo(rawValue: string | null) {
  if (!rawValue) return '/anime';
  return rawValue.startsWith('/anime') ? rawValue : '/anime';
}

function areStringArraysEqual(left: unknown, right: unknown) {
  const leftValues = normalizeStringArray(left) || [];
  const rightValues = normalizeStringArray(right) || [];
  if (leftValues.length !== rightValues.length) return false;
  return leftValues.every((value, index) => value === rightValues[index]);
}

function isMissingValue(value: unknown) {
  return value === undefined || value === null || value === '';
}

function normalizeEditableFieldValue(key: EditableField, value: unknown): unknown {
  if (arrayKeys.has(key)) return normalizeStringArray(value);
  if (requiredNumericKeys.has(key)) return isMissingValue(value) ? 0 : Number(value);
  if (nullableNumericKeys.has(key)) return isMissingValue(value) ? null : Number(value);
  if (nullableTextKeys.has(key)) return isMissingValue(value) ? null : value;
  if (key === 'isFinished') return value === undefined ? OMIT_FIELD : Boolean(value);
  return value;
}

function isFieldValueUnchanged(key: EditableField, nextValue: unknown, currentValue: unknown) {
  if (arrayKeys.has(key)) return areStringArraysEqual(nextValue, currentValue);
  if (requiredNumericKeys.has(key)) return Number(currentValue ?? 0) === nextValue;
  if (nullableNumericKeys.has(key)) {
    if (nextValue === null) return isMissingValue(currentValue);
    if (currentValue === undefined || currentValue === null || currentValue === '') return false;
    return Number(currentValue) === nextValue;
  }
  if (nullableTextKeys.has(key)) {
    if (nextValue === null) return isMissingValue(currentValue);
    return nextValue === currentValue;
  }
  return nextValue === currentValue;
}

export function buildChangedPayload(formData: Partial<AnimeDetailItem>, item: AnimeDetailItem): AnimeDetailPatchPayload {
  const payload: AnimeDetailPatchPayload = {};
  for (const key of editableKeys) {
    if (!Object.prototype.hasOwnProperty.call(formData, key)) continue;
    const normalizedValue = normalizeEditableFieldValue(key, formData[key]);
    if (normalizedValue === OMIT_FIELD) continue;
    if (isFieldValueUnchanged(key, normalizedValue, item[key])) continue;
    (payload as Record<string, unknown>)[key] = normalizedValue;
  }
  return payload;
}

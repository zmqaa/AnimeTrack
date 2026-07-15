/* eslint-disable @typescript-eslint/no-explicit-any */
import { containsCjkText, uniqueStrings } from '../anime-cast';
import { normalizeDateString } from '../date-utils';

const MAX_METADATA_CAST_MEMBERS = 10;

type MetadataField =
  | 'originalTitle' | 'coverUrl' | 'score' | 'totalEpisodes'
  | 'durationMinutes' | 'summary' | 'tags' | 'premiereDate'
  | 'cast' | 'castAliases' | 'isFinished';

type SourceName = 'provider' | 'ai';

type MetadataSource = Record<string, any>;

interface NormalizedMetadata {
  originalTitle?: string;
  coverUrl?: string;
  score?: number;
  totalEpisodes?: number;
  durationMinutes?: number;
  summary?: string;
  tags?: string[];
  premiereDate?: string;
  cast?: string[];
  castAliases?: string[];
  isFinished?: boolean;
}

interface MetadataCandidate {
  candidate: Partial<NormalizedMetadata>;
  source: Record<string, string>;
}

interface MergeOptions {
  fields?: string[];
  force?: boolean;
  allowIsFinishedUpgrade?: boolean;
  allowCastAliasAugment?: boolean;
  allowReplaceFilledCover?: boolean;
}

export const DEFAULT_METADATA_FIELDS: MetadataField[] = [
  'originalTitle',
  'coverUrl',
  'score',
  'totalEpisodes',
  'durationMinutes',
  'summary',
  'tags',
  'premiereDate',
  'cast',
  'castAliases',
  'isFinished',
];

export const AI_CAPABLE_METADATA_FIELDS = new Set<MetadataField>([
  'originalTitle',
  'coverUrl',
  'totalEpisodes',
  'durationMinutes',
  'summary',
  'tags',
  'premiereDate',
  'isFinished',
]);

const FIELD_SOURCE_PRIORITY: Record<MetadataField, SourceName[]> = {
  originalTitle: ['provider', 'ai'],
  coverUrl: ['provider', 'ai'],
  score: ['provider'],
  totalEpisodes: ['provider', 'ai'],
  durationMinutes: ['ai', 'provider'],
  summary: ['ai', 'provider'],
  tags: ['ai', 'provider'],
  premiereDate: ['provider', 'ai'],
  cast: ['provider', 'ai'],
  castAliases: ['provider', 'ai'],
  isFinished: ['provider', 'ai'],
};

export const ALL_METADATA_FIELDS = Object.keys(FIELD_SOURCE_PRIORITY) as MetadataField[];

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || !value.trim();
}

function hasPlaceholderCover(value: unknown): boolean {
  return typeof value === 'string' && (
    /placeholder/i.test(value)
    || /^\/covers\/\d+\.svg(?:[?#].*)?$/i.test(value.trim())
  );
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => (typeof item === 'string' ? item : String(item ?? ''))));
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return uniqueStrings(parsed.map((item: unknown) => (typeof item === 'string' ? item : String(item ?? ''))));
  } catch {
    return [];
  }
}

export const normalizeMetadataDate = normalizeDateString;

export function normalizeMetadataFieldValue(field: string, value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  switch (field) {
    case 'originalTitle': {
      const text = String(value).trim();
      return text || undefined;
    }
    case 'coverUrl': {
      const text = String(value).trim();
      if (!text) {
        return undefined;
      }

      return text.replace(/^http:\/\//i, 'https://');
    }
    case 'summary': {
      const text = String(value).trim();
      if (!text) {
        return undefined;
      }

      if (/无法确定|信息不足|unknown/i.test(text)) {
        return undefined;
      }

      if (!containsCjkText(text)) {
        return undefined;
      }

      return text;
    }
    case 'score': {
      const score = Number(value);
      if (!Number.isFinite(score) || score <= 0 || score > 10) {
        return undefined;
      }

      return Number(score.toFixed(1));
    }
    case 'totalEpisodes':
    case 'durationMinutes': {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || numeric <= 0) {
        return undefined;
      }

      return Math.round(numeric);
    }
    case 'premiereDate':
      return normalizeMetadataDate(value);
    case 'tags': {
      const values = parseStringArray(value);
      return values.length > 0 ? values.slice(0, 20) : undefined;
    }
    case 'cast': {
      const values = parseStringArray(value);
      return values.length > 0 ? values.slice(0, MAX_METADATA_CAST_MEMBERS) : undefined;
    }
    case 'castAliases': {
      const values = parseStringArray(value);
      return values.length > 0 ? values.slice(0, 30) : undefined;
    }
    case 'isFinished':
      return typeof value === 'boolean' ? value : undefined;
    default:
      return undefined;
  }
}

export function isMetadataFieldMissing(field: string, value: unknown): boolean {
  if (field === 'summary') {
    return normalizeMetadataFieldValue(field, value) === undefined;
  }

  switch (field) {
    case 'originalTitle':
      return isBlank(value);
    case 'coverUrl':
      return isBlank(value) || hasPlaceholderCover(value);
    case 'score':
    case 'totalEpisodes':
    case 'durationMinutes': {
      const numeric = Number(value);
      return !Number.isFinite(numeric) || numeric <= 0;
    }
    case 'premiereDate':
      return !normalizeMetadataDate(value);
    case 'tags':
    case 'cast':
    case 'castAliases':
      return !Array.isArray(value) || value.length === 0;
    case 'isFinished':
      return value === null || value === undefined;
    default:
      return true;
  }
}

function sameString(left: unknown, right: unknown): boolean {
  return String(left || '').trim() === String(right || '').trim();
}

function sameNumber(left: unknown, right: unknown): boolean {
  if (left === undefined && right === undefined) {
    return true;
  }

  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }

  return Math.abs(a - b) < 0.0001;
}

function sameArray(left: unknown, right: unknown): boolean {
  const a = uniqueStrings(Array.isArray(left) ? left.map(String) : []).sort();
  const b = uniqueStrings(Array.isArray(right) ? right.map(String) : []).sort();

  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function sameBoolean(left: unknown, right: unknown): boolean {
  if (left === undefined && right === undefined) {
    return true;
  }

  if (left === undefined || right === undefined) {
    return false;
  }

  return Boolean(left) === Boolean(right);
}

export function sameMetadataFieldValue(field: string, left: unknown, right: unknown): boolean {
  switch (field) {
    case 'originalTitle':
    case 'coverUrl':
    case 'summary':
      return sameString(left, right);
    case 'score':
    case 'totalEpisodes':
    case 'durationMinutes':
      return sameNumber(left, right);
    case 'premiereDate':
      return sameString(normalizeMetadataDate(left), normalizeMetadataDate(right));
    case 'tags':
    case 'cast':
    case 'castAliases':
      return sameArray(left, right);
    case 'isFinished':
      return sameBoolean(left, right);
    default:
      return false;
  }
}

function isStrictStringArraySuperset(nextValue: unknown, currentValue: unknown): boolean {
  const next = uniqueStrings(Array.isArray(nextValue) ? nextValue.map(String) : []);
  const current = uniqueStrings(Array.isArray(currentValue) ? currentValue.map(String) : []);

  if (next.length <= current.length) {
    return false;
  }

  return current.every((item) => next.includes(item));
}

function normalizeSourceMetadata(source: MetadataSource): NormalizedMetadata {
  const value = source || {};

  return {
    originalTitle: normalizeMetadataFieldValue('originalTitle', value.originalTitle) as string | undefined,
    coverUrl: normalizeMetadataFieldValue('coverUrl', value.coverUrl) as string | undefined,
    score: normalizeMetadataFieldValue('score', value.score) as number | undefined,
    totalEpisodes: normalizeMetadataFieldValue('totalEpisodes', value.totalEpisodes) as number | undefined,
    durationMinutes: normalizeMetadataFieldValue('durationMinutes', value.durationMinutes) as number | undefined,
    summary: normalizeMetadataFieldValue('summary', value.summary ?? (value as Record<string, any>).synopsis ?? (value as Record<string, any>).description) as string | undefined,
    tags: normalizeMetadataFieldValue('tags', value.tags) as string[] | undefined,
    premiereDate: normalizeMetadataFieldValue('premiereDate', value.premiereDate) as string | undefined,
    cast: normalizeMetadataFieldValue('cast', value.cast) as string[] | undefined,
    castAliases: normalizeMetadataFieldValue('castAliases', value.castAliases) as string[] | undefined,
    isFinished: normalizeMetadataFieldValue('isFinished', value.isFinished) as boolean | undefined,
  };
}

function pickPreferredValue(
  field: MetadataField,
  normalizedSources: { provider: NormalizedMetadata; ai: NormalizedMetadata },
): unknown {
  if (field === 'castAliases') {
    const providerAliases = Array.isArray(normalizedSources.provider.castAliases) ? normalizedSources.provider.castAliases : [];
    const aiAliases = Array.isArray(normalizedSources.ai.castAliases) ? normalizedSources.ai.castAliases : [];
    const mergedAliases = uniqueStrings([...providerAliases, ...aiAliases]);
    if (mergedAliases.length > 0) {
      return mergedAliases;
    }
  }

  for (const sourceName of FIELD_SOURCE_PRIORITY[field] || []) {
    const sourceValue = normalizedSources[sourceName]?.[field];
    if (sourceValue !== undefined) {
      return sourceValue;
    }
  }

  return undefined;
}

function resolveSourceLabel(
  field: MetadataField,
  normalizedSources: { provider: NormalizedMetadata; ai: NormalizedMetadata },
  candidateValue: unknown,
): string | undefined {
  if (field === 'castAliases') {
    const providerAliases = Array.isArray(normalizedSources.provider.castAliases) ? normalizedSources.provider.castAliases : [];
    const aiAliases = Array.isArray(normalizedSources.ai.castAliases) ? normalizedSources.ai.castAliases : [];
    if (providerAliases.length > 0 && aiAliases.length > 0) {
      return 'provider+ai';
    }
  }

  for (const sourceName of FIELD_SOURCE_PRIORITY[field] || []) {
    const sourceValue = normalizedSources[sourceName]?.[field];
    if (sourceValue !== undefined && sameMetadataFieldValue(field, sourceValue, candidateValue)) {
      return sourceName;
    }
  }

  return undefined;
}

export function buildMetadataCandidate(
  provider: MetadataSource | null | undefined,
  ai: MetadataSource | null | undefined,
): MetadataCandidate {
  const normalizedSources = {
    provider: normalizeSourceMetadata(provider || {}),
    ai: normalizeSourceMetadata(ai || {}),
  };

  const candidate: Record<string, unknown> = {};
  const source: Record<string, string> = {};

  for (const field of ALL_METADATA_FIELDS) {
    const candidateValue = pickPreferredValue(field, normalizedSources);
    if (candidateValue === undefined) {
      continue;
    }

    candidate[field] = candidateValue;

    const sourceLabel = resolveSourceLabel(field, normalizedSources, candidateValue);
    if (sourceLabel) {
      source[field] = sourceLabel;
    }
  }

  return { candidate, source };
}

function fieldPrefersAi(field: MetadataField): boolean {
  return FIELD_SOURCE_PRIORITY[field]?.[0] === 'ai';
}

function fieldSupportsAi(field: MetadataField): boolean {
  return AI_CAPABLE_METADATA_FIELDS.has(field) && FIELD_SOURCE_PRIORITY[field]?.includes('ai');
}

export function shouldUseAiForMetadata(
  current: NormalizedMetadata | null | undefined,
  providerCandidate: NormalizedMetadata | null | undefined,
  options: MergeOptions = {},
): boolean {
  const fields = (Array.isArray(options.fields) && options.fields.length > 0
    ? options.fields
    : DEFAULT_METADATA_FIELDS) as MetadataField[];
  const force = Boolean(options.force);

  for (const field of fields) {
    if (!fieldSupportsAi(field)) {
      continue;
    }

    const currentValue = current?.[field];
    const providerValue = providerCandidate?.[field];

    if (force) {
      if (fieldPrefersAi(field)) {
        return true;
      }

      if (isMetadataFieldMissing(field, providerValue)) {
        return true;
      }

      continue;
    }

    if (!isMetadataFieldMissing(field, currentValue)) {
      continue;
    }

    if (fieldPrefersAi(field)) {
      return true;
    }

    if (isMetadataFieldMissing(field, providerValue)) {
      return true;
    }
  }

  return false;
}

function shouldUpdateMetadataField(
  field: string,
  currentValue: unknown,
  nextValue: unknown,
  options: MergeOptions = {},
): boolean {
  if (nextValue === undefined) {
    return false;
  }

  if (options.force) {
    return !sameMetadataFieldValue(field, currentValue, nextValue);
  }

  const currentMissing = isMetadataFieldMissing(field, currentValue);
  if (!currentMissing) {
    if (field === 'isFinished' && options.allowIsFinishedUpgrade !== false && currentValue === false && nextValue === true) {
      return true;
    }

    if (field === 'castAliases' && options.allowCastAliasAugment !== false) {
      return isStrictStringArraySuperset(nextValue, currentValue) && !sameMetadataFieldValue(field, currentValue, nextValue);
    }

    if (field === 'coverUrl' && options.allowReplaceFilledCover) {
      return !sameMetadataFieldValue(field, currentValue, nextValue);
    }

    return false;
  }

  return !sameMetadataFieldValue(field, currentValue, nextValue);
}

export function buildMetadataPatch(
  current: Record<string, any> | null | undefined,
  candidateLike: MetadataCandidate | Record<string, any> | null | undefined,
  options: MergeOptions = {},
): { patch: Record<string, any>; sources: Record<string, string> } {
  const fields = Array.isArray(options.fields) && options.fields.length > 0 ? options.fields : DEFAULT_METADATA_FIELDS;
  const candidate = (candidateLike as MetadataCandidate)?.candidate || candidateLike || {};
  const source = (candidateLike as MetadataCandidate)?.source || {};
  const patch: Record<string, any> = {};
  const sources: Record<string, string> = {};

  for (const field of fields) {
    const normalizedNext = normalizeMetadataFieldValue(field, (candidate as Record<string, any>)[field]);
    if (normalizedNext === undefined) {
      continue;
    }

    if (shouldUpdateMetadataField(field, current?.[field], normalizedNext, options)) {
      patch[field] = normalizedNext;
      if ((source as Record<string, string>)[field]) {
        sources[field] = (source as Record<string, string>)[field];
      }
    }
  }

  return { patch, sources };
}

export function applyMetadataPatch(
  current: Record<string, any> | null | undefined,
  candidateLike: MetadataCandidate | Record<string, any> | null | undefined,
  options: MergeOptions = {},
): { data: Record<string, any>; patch: Record<string, any>; sources: Record<string, string> } {
  const { patch, sources } = buildMetadataPatch(current, candidateLike, options);
  return {
    data: {
      ...(current || {}),
      ...patch,
    },
    patch,
    sources,
  };
}

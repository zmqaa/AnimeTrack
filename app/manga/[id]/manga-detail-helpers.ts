import type { MangaPublicationStatus, MangaReadingStatus, MangaRecord } from '@/lib/manga-shared';

export type MangaDetailDraft = {
  title: string;
  originalTitle: string;
  aliases: string;
  coverUrl: string;
  status: MangaReadingStatus;
  publicationStatus: MangaPublicationStatus;
  score: string;
  currentVolume: string;
  currentChapter: string;
  totalVolumes: string;
  totalChapters: string;
  notes: string;
  tags: string;
  summary: string;
  authors: string;
  illustrators: string;
  publishers: string;
  serializations: string;
  startDate: string;
  endDate: string;
  releaseDate: string;
};

export function joinMangaValues(values: string[]) {
  return values.join('、');
}

export function splitMangaValues(value: string) {
  return Array.from(new Set(value.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean)));
}

export function toMangaDetailDraft(record: MangaRecord): MangaDetailDraft {
  return {
    title: record.title,
    originalTitle: record.originalTitle || '',
    aliases: joinMangaValues(record.aliases),
    coverUrl: record.coverUrl || '',
    status: record.status,
    publicationStatus: record.publicationStatus,
    score: record.score?.toString() || '',
    currentVolume: record.currentVolume || '',
    currentChapter: record.currentChapter || '',
    totalVolumes: record.totalVolumes?.toString() || '',
    totalChapters: record.totalChapters?.toString() || '',
    notes: record.notes || '',
    tags: joinMangaValues(record.tags),
    summary: record.summary || '',
    authors: joinMangaValues(record.authors),
    illustrators: joinMangaValues(record.illustrators),
    publishers: joinMangaValues(record.publishers),
    serializations: joinMangaValues(record.serializations),
    startDate: record.startDate || '',
    endDate: record.endDate || '',
    releaseDate: record.releaseDate || '',
  };
}

export function optionalMangaNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMangaDate(value?: string) {
  return value || '未记录';
}

export function formatMangaTimestamp(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}

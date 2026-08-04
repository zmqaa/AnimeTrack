import 'server-only';

import { parseJsonStringArray } from './anime-cast';
import { query, type DbResult } from './db';
import { nowISO } from './date-utils';
import type { MangaPublicationStatus, MangaReadingStatus, MangaRecord } from './manga-shared';

export type { MangaPublicationStatus, MangaReadingStatus, MangaRecord } from './manga-shared';

export type CreateMangaDTO = Omit<MangaRecord, 'id' | 'createdAt' | 'updatedAt'>;

interface MangaRow {
  id: number;
  bangumi_id?: number | null;
  title: string;
  original_title?: string | null;
  aliases?: string | null;
  coverUrl?: string | null;
  status: MangaReadingStatus;
  publication_status: MangaPublicationStatus;
  score?: number | string | null;
  current_volume?: string | null;
  current_chapter?: string | null;
  total_volumes?: number | null;
  total_chapters?: number | null;
  notes?: string | null;
  tags?: string | null;
  summary?: string | null;
  authors?: string | null;
  illustrators?: string | null;
  publishers?: string | null;
  serializations?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  release_date?: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapMangaRow(row: MangaRow): MangaRecord {
  return {
    id: row.id,
    bangumiId: row.bangumi_id ?? undefined,
    title: row.title,
    originalTitle: row.original_title || undefined,
    aliases: parseJsonStringArray(row.aliases),
    coverUrl: row.coverUrl || undefined,
    status: row.status,
    publicationStatus: row.publication_status,
    score: row.score != null ? Number(row.score) : undefined,
    currentVolume: row.current_volume || undefined,
    currentChapter: row.current_chapter || undefined,
    totalVolumes: row.total_volumes ?? undefined,
    totalChapters: row.total_chapters ?? undefined,
    notes: row.notes || undefined,
    tags: parseJsonStringArray(row.tags),
    summary: row.summary || undefined,
    authors: parseJsonStringArray(row.authors),
    illustrators: parseJsonStringArray(row.illustrators),
    publishers: parseJsonStringArray(row.publishers),
    serializations: parseJsonStringArray(row.serializations),
    startDate: row.start_date || undefined,
    endDate: row.end_date || undefined,
    releaseDate: row.release_date || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function parseMangaId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function listMangaRecords(options: {
  search?: string;
  status?: MangaReadingStatus;
  publicationStatus?: MangaPublicationStatus;
} = {}): Promise<MangaRecord[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  if (options.search) {
    const pattern = `%${options.search}%`;
    conditions.push(`(
      title LIKE ? OR original_title LIKE ? OR aliases LIKE ?
      OR authors LIKE ? OR illustrators LIKE ?
    )`);
    params.push(pattern, pattern, pattern, pattern, pattern);
  }
  if (options.status) {
    conditions.push('status = ?');
    params.push(options.status);
  }
  if (options.publicationStatus) {
    conditions.push('publication_status = ?');
    params.push(options.publicationStatus);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const rows = await query<MangaRow[]>(`SELECT * FROM manga${where} ORDER BY updatedAt DESC`, params);
  return rows.map(mapMangaRow);
}

export async function getMangaRecord(id: number): Promise<MangaRecord | null> {
  const rows = await query<MangaRow[]>('SELECT * FROM manga WHERE id = ?', [id]);
  return rows[0] ? mapMangaRow(rows[0]) : null;
}

function valuesForManga(input: CreateMangaDTO, createdAt: string, updatedAt: string) {
  return [
    input.bangumiId ?? null,
    input.title,
    input.originalTitle || null,
    JSON.stringify(input.aliases || []),
    input.coverUrl || null,
    input.status,
    input.publicationStatus,
    input.score ?? null,
    input.currentVolume || null,
    input.currentChapter || null,
    input.totalVolumes ?? null,
    input.totalChapters ?? null,
    input.notes || null,
    JSON.stringify(input.tags || []),
    input.summary || null,
    JSON.stringify(input.authors || []),
    JSON.stringify(input.illustrators || []),
    JSON.stringify(input.publishers || []),
    JSON.stringify(input.serializations || []),
    input.startDate || null,
    input.endDate || null,
    input.releaseDate || null,
    createdAt,
    updatedAt,
  ];
}

export async function createMangaRecord(input: CreateMangaDTO): Promise<MangaRecord> {
  const now = nowISO();
  const result = await query<DbResult>(`
    INSERT INTO manga (
      bangumi_id, title, original_title, aliases, coverUrl, status, publication_status,
      score, current_volume, current_chapter, total_volumes, total_chapters, notes,
      tags, summary, authors, illustrators, publishers, serializations,
      start_date, end_date, release_date, createdAt, updatedAt
    ) VALUES (${Array.from({ length: 24 }, () => '?').join(', ')})
  `, valuesForManga(input, now, now));
  const created = await getMangaRecord(result.insertId);
  if (!created) throw new Error('漫画创建后读取失败');
  return created;
}

const UPDATE_COLUMNS: Record<keyof CreateMangaDTO, string> = {
  bangumiId: 'bangumi_id',
  title: 'title',
  originalTitle: 'original_title',
  aliases: 'aliases',
  coverUrl: 'coverUrl',
  status: 'status',
  publicationStatus: 'publication_status',
  score: 'score',
  currentVolume: 'current_volume',
  currentChapter: 'current_chapter',
  totalVolumes: 'total_volumes',
  totalChapters: 'total_chapters',
  notes: 'notes',
  tags: 'tags',
  summary: 'summary',
  authors: 'authors',
  illustrators: 'illustrators',
  publishers: 'publishers',
  serializations: 'serializations',
  startDate: 'start_date',
  endDate: 'end_date',
  releaseDate: 'release_date',
};

const ARRAY_FIELDS = new Set<keyof CreateMangaDTO>([
  'aliases', 'tags', 'authors', 'illustrators', 'publishers', 'serializations',
]);

export async function updateMangaRecord(
  id: number,
  patch: Partial<CreateMangaDTO>,
): Promise<MangaRecord | null> {
  const fields = ['updatedAt = ?'];
  const params: unknown[] = [nowISO()];
  for (const key of Object.keys(UPDATE_COLUMNS) as Array<keyof CreateMangaDTO>) {
    if (patch[key] === undefined) continue;
    fields.push(`${UPDATE_COLUMNS[key]} = ?`);
    const value = patch[key];
    params.push(ARRAY_FIELDS.has(key) ? JSON.stringify(value || []) : (value ?? null));
  }
  params.push(id);
  const rows = await query<MangaRow[]>(
    `UPDATE manga SET ${fields.join(', ')} WHERE id = ? RETURNING *`,
    params,
  );
  return rows[0] ? mapMangaRow(rows[0]) : null;
}

export async function deleteMangaRecord(id: number): Promise<boolean> {
  const result = await query<DbResult>('DELETE FROM manga WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

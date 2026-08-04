import { NextRequest } from 'next/server';

import { normalizeStringArray } from '@/lib/anime-cast';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import {
  createMangaRecord,
  listMangaRecords,
  type CreateMangaDTO,
  type MangaPublicationStatus,
  type MangaReadingStatus,
} from '@/lib/manga';
import { createMangaSchema } from '@/lib/validations';

const READING_STATUSES = new Set<MangaReadingStatus>([
  'plan_to_read', 'reading', 'caught_up', 'completed', 'paused', 'dropped',
]);
const PUBLICATION_STATUSES = new Set<MangaPublicationStatus>([
  'ongoing', 'completed', 'hiatus', 'unknown',
]);

export async function GET(request: NextRequest) {
  const statusValue = request.nextUrl.searchParams.get('status');
  const publicationValue = request.nextUrl.searchParams.get('publicationStatus');
  const records = await listMangaRecords({
    search: request.nextUrl.searchParams.get('search')?.trim() || undefined,
    status: statusValue && READING_STATUSES.has(statusValue as MangaReadingStatus)
      ? statusValue as MangaReadingStatus
      : undefined,
    publicationStatus: publicationValue && PUBLICATION_STATUSES.has(publicationValue as MangaPublicationStatus)
      ? publicationValue as MangaPublicationStatus
      : undefined,
  });
  return apiSuccess({ records, total: records.length });
}

export async function POST(request: Request) {
  const auth = await requireAdmin('只有管理员可以添加漫画');
  if (!auth.authorized) return auth.response;

  try {
    const parsed = createMangaSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || '参数校验失败', 400);
    const value = parsed.data;
    const today = new Date().toISOString().slice(0, 10);
    const shouldStart = ['reading', 'caught_up', 'completed'].includes(value.status);
    const data: CreateMangaDTO = {
      ...value,
      aliases: normalizeStringArray(value.aliases) || [],
      tags: normalizeStringArray(value.tags) || [],
      authors: normalizeStringArray(value.authors) || [],
      illustrators: normalizeStringArray(value.illustrators) || [],
      publishers: normalizeStringArray(value.publishers) || [],
      serializations: normalizeStringArray(value.serializations) || [],
      originalTitle: value.originalTitle || undefined,
      coverUrl: value.coverUrl || undefined,
      currentVolume: value.currentVolume || undefined,
      currentChapter: value.currentChapter || undefined,
      notes: value.notes || undefined,
      summary: value.summary || undefined,
      startDate: value.startDate || (shouldStart ? today : undefined),
      endDate: value.endDate || (value.status === 'completed' ? today : undefined),
      releaseDate: value.releaseDate || undefined,
      bangumiId: value.bangumiId || undefined,
      score: value.score ?? undefined,
      totalVolumes: value.totalVolumes ?? undefined,
      totalChapters: value.totalChapters ?? undefined,
    };
    return apiSuccess(await createMangaRecord(data), 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '漫画创建失败';
    if (/UNIQUE constraint failed: manga\.bangumi_id/i.test(message)) {
      return apiError('这部 Bangumi 漫画已经加入书架', 409);
    }
    console.error('Manga create error:', error);
    return apiError(message, 500);
  }
}


import { normalizeStringArray } from '@/lib/anime-cast';
import {
  apiError,
  apiInternalError,
  apiSuccess,
  readApiJson,
  requireAdmin,
  withApiErrorBoundary,
} from '@/lib/api-response';
import {
  deleteMangaRecord,
  getMangaRecord,
  parseMangaId,
  updateMangaRecord,
  type CreateMangaDTO,
} from '@/lib/manga';
import { updateMangaSchema } from '@/lib/validations';
import { buildMangaStatusDatePatch } from '@/lib/manga-status';
import { getMangaDateOrderIssue } from '@/lib/date-validation';
import { formatAppDateKey } from '@/lib/date-utils';
import { resolveLocalMangaCoverImage } from '@/lib/cover-image';

type RouteContext = { params: Promise<{ id: string }> };

async function handleGet(_request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const id = parseMangaId(rawId);
  if (!id) return apiError('无效的漫画 ID', 'BAD_REQUEST');
  const record = await getMangaRecord(id);
  return record ? apiSuccess(record) : apiError('漫画不存在', 'NOT_FOUND');
}

async function handlePatch(request: Request, context: RouteContext) {
  const auth = await requireAdmin('只有管理员可以修改漫画');
  if (!auth.authorized) return auth.response;
  const { id: rawId } = await context.params;
  const id = parseMangaId(rawId);
  if (!id) return apiError('无效的漫画 ID', 'BAD_REQUEST');
  const before = await getMangaRecord(id);
  if (!before) return apiError('漫画不存在', 'NOT_FOUND');

  const parsed = updateMangaSchema.safeParse(await readApiJson<unknown>(request));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || '参数校验失败', 'BAD_REQUEST');
  const value = parsed.data;
  const patch: Partial<CreateMangaDTO> = { ...value } as Partial<CreateMangaDTO>;
  const arrayKeys = ['aliases', 'tags', 'authors', 'illustrators', 'publishers', 'serializations'] as const;
  for (const key of arrayKeys) {
    if (value[key] !== undefined) patch[key] = normalizeStringArray(value[key]) || [];
  }
  const nullableTextKeys = [
    'originalTitle', 'coverUrl', 'currentVolume', 'currentChapter', 'notes',
    'summary', 'startDate', 'endDate', 'releaseDate',
  ] as const;
  for (const key of nullableTextKeys) {
    if (value[key] !== undefined) patch[key] = value[key] || null as never;
  }
  if (value.score !== undefined) patch.score = value.score ?? null as never;
  if (value.totalVolumes !== undefined) patch.totalVolumes = value.totalVolumes ?? null as never;
  if (value.totalChapters !== undefined) patch.totalChapters = value.totalChapters ?? null as never;
  if (value.bangumiId !== undefined) patch.bangumiId = value.bangumiId ?? null as never;

  const today = formatAppDateKey(new Date());
  Object.assign(patch, buildMangaStatusDatePatch(before, value, today));

  const dateOrderIssue = getMangaDateOrderIssue({
    startDate: patch.startDate !== undefined ? patch.startDate : before.startDate,
    endDate: patch.endDate !== undefined ? patch.endDate : before.endDate,
  });
  if (dateOrderIssue) return apiError(dateOrderIssue.message, 'BAD_REQUEST');

  if (value.coverUrl !== undefined && value.coverUrl !== before.coverUrl) {
    patch.localCoverUrl = await resolveLocalMangaCoverImage(value.coverUrl, id);
  }

  try {
    const updated = await updateMangaRecord(id, patch);
    return updated ? apiSuccess({ ok: true, entry: updated }) : apiError('漫画不存在', 'NOT_FOUND');
  } catch (error) {
    const message = error instanceof Error ? error.message : '漫画更新失败';
    if (/UNIQUE constraint failed: manga\.bangumi_id/i.test(message)) {
      return apiError('该 Bangumi 条目已经关联到另一部漫画', 'CONFLICT');
    }
    return apiInternalError(error, {
      operation: '更新漫画记录',
      message: '更新漫画失败，请稍后重试',
      context: { mangaId: id },
    });
  }
}

async function handleDelete(_request: Request, context: RouteContext) {
  const auth = await requireAdmin('只有管理员可以删除漫画');
  if (!auth.authorized) return auth.response;
  const { id: rawId } = await context.params;
  const id = parseMangaId(rawId);
  if (!id) return apiError('无效的漫画 ID', 'BAD_REQUEST');
  return await deleteMangaRecord(id)
    ? apiSuccess({ ok: true })
    : apiError('漫画不存在', 'NOT_FOUND');
}

const mangaDetailBoundary = {
  operation: '处理漫画详情请求',
  message: '处理漫画详情失败，请稍后重试',
};

export const GET = withApiErrorBoundary(mangaDetailBoundary, handleGet);
export const PATCH = withApiErrorBoundary(mangaDetailBoundary, handlePatch);
export const DELETE = withApiErrorBoundary(mangaDetailBoundary, handleDelete);

import { normalizeStringArray } from '@/lib/anime-cast';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import {
  deleteMangaRecord,
  getMangaRecord,
  parseMangaId,
  updateMangaRecord,
  type CreateMangaDTO,
} from '@/lib/manga';
import { updateMangaSchema } from '@/lib/validations';

type RouteContext = { params: { id: string } };

export async function GET(_request: Request, context: RouteContext) {
  const id = parseMangaId(context.params.id);
  if (!id) return apiError('无效的漫画 ID', 400);
  const record = await getMangaRecord(id);
  return record ? apiSuccess(record) : apiError('漫画不存在', 404);
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin('只有管理员可以修改漫画');
  if (!auth.authorized) return auth.response;
  const id = parseMangaId(context.params.id);
  if (!id) return apiError('无效的漫画 ID', 400);
  const before = await getMangaRecord(id);
  if (!before) return apiError('漫画不存在', 404);

  const parsed = updateMangaSchema.safeParse(await request.json());
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message || '参数校验失败', 400);
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

  const nextStatus = value.status || before.status;
  const today = new Date().toISOString().slice(0, 10);
  if (['reading', 'caught_up', 'completed'].includes(nextStatus) && !before.startDate && value.startDate === undefined) {
    patch.startDate = today;
  }
  if (nextStatus === 'completed' && !before.endDate && value.endDate === undefined) {
    patch.endDate = today;
  }

  try {
    const updated = await updateMangaRecord(id, patch);
    return updated ? apiSuccess({ ok: true, entry: updated }) : apiError('漫画不存在', 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : '漫画更新失败';
    if (/UNIQUE constraint failed: manga\.bangumi_id/i.test(message)) {
      return apiError('该 Bangumi 条目已经关联到另一部漫画', 409);
    }
    return apiError(message, 500);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdmin('只有管理员可以删除漫画');
  if (!auth.authorized) return auth.response;
  const id = parseMangaId(context.params.id);
  if (!id) return apiError('无效的漫画 ID', 400);
  return await deleteMangaRecord(id)
    ? apiSuccess({ ok: true })
    : apiError('漫画不存在', 404);
}


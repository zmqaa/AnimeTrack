import { NextRequest } from 'next/server';
import { listAnimeRecordsWithLastWatched, listAnimeRecordsPaginated, createAnimeRecord, updateAnimeRecord, CreateAnimeDTO, AnimeStatus } from '@/lib/anime';
import { normalizeStringArray } from '@/lib/anime-cast';
import { enrichAnimeInput } from '@/lib/anime-enrichment';
import { apiSuccess, apiError, requireAdmin } from '@/lib/api-response';
import { createAnimeSchema } from '@/lib/validations';
import { resolveCoverImage } from '@/lib/cover-image';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') as AnimeStatus | null;
  const limit = Number(searchParams.get('limit') || '0');
  const offset = Number(searchParams.get('offset') || '0');
  const search = searchParams.get('search') || undefined;
  const sortBy = searchParams.get('sortBy') || undefined;
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined;
  const page = Number(searchParams.get('page') || '0');

  try {
    // 分页模式：Client 传入 page / pageSize 时走服务端分页+排序
    if (page > 0) {
      const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '12')));
      const result = await listAnimeRecordsPaginated({
        status: status || undefined,
        search,
        sortBy,
        sortOrder,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return apiSuccess(result, 200, { 'Cache-Control': 'no-store' });
    }

    // 兼容旧行为：无 page 参数时返回全部记录（Dashboard 使用）
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 5000) : undefined;
    const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : undefined;
    const list = await listAnimeRecordsWithLastWatched({ status: status || undefined, limit: safeLimit, offset: safeOffset, search });
    return apiSuccess(list, 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '读取失败';
    return apiError(message);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  try {
    const json = await request.json();
    const parsed = createAnimeSchema.safeParse(json);
    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return apiError(firstError?.message || '参数校验失败', 400);
    }

    const v = parsed.data;
    let data: CreateAnimeDTO = {
        title: v.title,
        originalTitle: v.originalTitle || undefined,
        status: v.status || 'plan_to_watch',
        progress: v.progress || 0,
        coverUrl: v.coverUrl || undefined,
        score: v.score ?? undefined,
        totalEpisodes: v.totalEpisodes ?? undefined,
        notes: v.notes || undefined,
        durationMinutes: v.durationMinutes ?? undefined,
        tags: normalizeStringArray(v.tags),
        cast: normalizeStringArray(v.cast),
        castAliases: normalizeStringArray(v.castAliases),
        summary: v.summary || undefined,
        startDate: v.startDate || undefined,
        endDate: v.endDate || undefined,
        premiereDate: v.premiereDate || undefined,
        isFinished: typeof v.isFinished === 'boolean' ? v.isFinished : undefined
    };

    const originalUserTitle = data.title;

    data = await enrichAnimeInput(data, {
        mode: 'create',
        originalUserTitle,
    });

    // Auto-complete logic: if status is completed or has end date, set progress to total
    if ((data.status === 'completed' || data.endDate) && data.totalEpisodes) {
        data.progress = data.totalEpisodes;
        if (!data.status) data.status = 'completed';
    }

    const newRecord = await createAnimeRecord(data);

    // 下载封面图到本地
    if (newRecord.coverUrl) {
      const resolved = await resolveCoverImage(newRecord.coverUrl, newRecord.id);
      if (resolved !== newRecord.coverUrl) {
        await updateAnimeRecord(newRecord.id, { coverUrl: resolved ?? undefined });
        newRecord.coverUrl = resolved ?? undefined;
      }
    }

    return apiSuccess(newRecord);
  } catch (error: unknown) {
    console.error('Anime create error:', error);
    const message = error instanceof Error ? error.message : '创建失败';
    return apiError(message);
  }
}

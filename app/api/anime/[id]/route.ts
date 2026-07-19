import { deleteAnimeRecord, getAnimeRecord, updateAnimeRecordWithHistory, AnimeRecord, parseAnimeId } from '@/lib/anime';
import { buildVoiceActorAliases } from '@/lib/ai';
import { normalizeStringArray, areStringArraysEqual } from '@/lib/anime-cast';
import { apiSuccess, apiError, requireAdmin } from '@/lib/api-response';
import { resolveLocalCoverImage } from '@/lib/cover-image';
import { patchAnimeBodySchema } from '@/lib/validations';
import { nowISO } from '@/lib/date-utils';

function areAllowedFieldValuesEqual(key: string, nextValue: unknown, currentValue: unknown) {
  if (key === 'tags' || key === 'cast' || key === 'castAliases') {
    return areStringArraysEqual(nextValue, currentValue);
  }

  if (key === 'progress' || key === 'score' || key === 'totalEpisodes' || key === 'durationMinutes') {
    if (currentValue === undefined || currentValue === null || currentValue === '') {
      return false;
    }

    return Number(currentValue) === nextValue;
  }

  return nextValue === currentValue;
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const id = parseAnimeId(context.params.id);
  if (!id) return apiError('Invalid ID', 400);

  const record = await getAnimeRecord(id);
  if (!record) return apiError('Not found', 404);

  return apiSuccess(record);
}

export async function DELETE(
  _request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const id = parseAnimeId(context.params.id);
  if (!id) return apiError('Invalid ID', 400);

  const deleted = await deleteAnimeRecord(id);
  if (!deleted) return apiError('Not found', 404);
  
  return apiSuccess({ ok: true });
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const id = parseAnimeId(context.params.id);
  if (!id) return apiError('Invalid ID', 400);

  const before = await getAnimeRecord(id);
  if (!before) return apiError('Not found', 404);

  const rawBody = await request.json();
  const parsedBody = patchAnimeBodySchema.safeParse(rawBody);
  if (!parsedBody.success) {
    return apiError(parsedBody.error.issues[0]?.message || '参数校验失败', 400);
  }
  const body = parsedBody.data;
  const normalizedBody = {
    ...body,
    tags: normalizeStringArray(body.tags) ?? body.tags,
    cast: normalizeStringArray(body.cast) ?? body.cast,
    castAliases: normalizeStringArray(body.castAliases) ?? body.castAliases,
  };
  const allowedKeys = ['title', 'originalTitle', 'status', 'progress', 'score', 'totalEpisodes', 'notes', 'coverUrl', 'durationMinutes', 'tags', 'summary', 'startDate', 'endDate', 'premiereDate', 'cast', 'castAliases', 'isFinished'] as const;
  type AllowedKey = (typeof allowedKeys)[number];
  const updateData: Omit<Partial<AnimeRecord>, 'coverUrl' | 'localCoverUrl' | 'displayCoverUrl'> & {
    coverUrl?: string | null;
    localCoverUrl?: string | null;
  } = {};
  const updateRecord = updateData as Partial<Record<AllowedKey, unknown>>;

  for (const key of allowedKeys) {
    const value = normalizedBody[key];
    if (value !== undefined) {
      updateRecord[key] = value;
    }
  }

  for (const key of allowedKeys) {
    const value = updateRecord[key];
    if (value === undefined) {
      continue;
    }

    if (areAllowedFieldValuesEqual(key, value, before[key])) {
      delete updateRecord[key];
    }
  }

  if (updateData.cast !== undefined) {
    try {
      updateData.castAliases = await buildVoiceActorAliases(updateData.cast, updateData.castAliases || before?.castAliases || []);
    } catch (error) {
      console.error('Voice actor alias generation failed:', error);
    }
  }

  // Auto-complete logic
  const newProgress = updateData.progress !== undefined ? updateData.progress : before?.progress;
  const newTotal = updateData.totalEpisodes !== undefined ? updateData.totalEpisodes : before?.totalEpisodes;
  const newStatus = updateData.status !== undefined ? updateData.status : before?.status;

  // 进度拉满时自动标记为已看完；只有确实记录了最后一集观看历史时，
  // 才把当天写入看完日期。详情页的纯资料编辑不会伪造看完时间。
  if (newTotal && newProgress !== undefined && newProgress >= newTotal) {
    if (newStatus !== 'completed') {
      updateData.status = 'completed';
    }

    const crossedCompletionWithHistory = Boolean(
      body.recordHistory
      && Number(before.progress || 0) < newTotal
      && newProgress >= newTotal,
    );
    if (crossedCompletionWithHistory && updateData.endDate === undefined && !before.endDate) {
      updateData.endDate = nowISO().slice(0, 10);
    }
  }

  // 如果更新了 coverUrl，同步下载封面到本地
  if (updateData.coverUrl !== undefined) {
    updateData.localCoverUrl = await resolveLocalCoverImage(updateData.coverUrl, id);
  }

  const updated = updateAnimeRecordWithHistory(id, updateData, {
    recordHistory: Boolean(body.recordHistory),
    trimHistoryOnProgressDecrease: Boolean(body.trimHistoryOnProgressDecrease),
  });
  if (!updated) return apiError('Not found', 404);

  return apiSuccess({ ok: true, entry: updated });
}

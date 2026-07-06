import { getAnimeRecord, updateAnimeRecord, CreateAnimeDTO, parseAnimeId, animeRecordToDTO } from '@/lib/anime';
import { enrichAnimeInput } from '@/lib/anime-enrichment';
import { DEFAULT_METADATA_FIELDS, buildMetadataPatch } from '@/lib/metadata/merge-policy';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  const auth = await requireAdmin('只有管理员可以执行 AI 补全');
  if (!auth.authorized) {
    return auth.response;
  }

  const id = parseAnimeId(context.params.id);
  if (!id) {
    return apiError('Invalid ID', 400);
  }

  const record = await getAnimeRecord(id);
  if (!record) {
    return apiError('Not found', 404);
  }

  const baseInput = animeRecordToDTO(record);

  const enriched = await enrichAnimeInput(baseInput, {
    mode: 'create',
    originalUserTitle: record.title,
  });

  const patch: Partial<CreateAnimeDTO> = {};
  const metadataPatch = buildMetadataPatch(record, enriched, {
    fields: DEFAULT_METADATA_FIELDS,
    force: true,
    allowReplaceFilledCover: true,
    allowCastAliasAugment: true,
    allowIsFinishedUpgrade: true,
  }).patch;

  if (enriched.title && enriched.title !== record.title) {
    patch.title = enriched.title;
  }

  // 保护用户手动填写的字段，不被 AI 覆盖
  const userFields: Array<keyof CreateAnimeDTO> = ['status', 'progress', 'notes', 'startDate', 'endDate'];
  for (const field of userFields) {
    delete metadataPatch[field];
  }
  // score 只在用户未设置时才补充
  if (record.score !== undefined && record.score !== null) {
    delete metadataPatch.score;
  }

  Object.assign(patch, metadataPatch);

  const appliedFields = Object.keys(patch);
  if (appliedFields.length === 0) {
    return apiSuccess({ ok: true, appliedFields: [], entry: record });
  }

  const updated = await updateAnimeRecord(id, patch);
  if (!updated) {
    return apiError('更新失败', 500);
  }

  return apiSuccess({ ok: true, appliedFields, entry: updated });
}

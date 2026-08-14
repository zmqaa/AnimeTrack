import { apiError, apiSuccess, requireAdmin, withApiErrorBoundary } from '@/lib/api-response';
import {
  getMangaRecord,
  parseMangaId,
  updateMangaRecord,
  type CreateMangaDTO,
} from '@/lib/manga';
import { getMangaMetadataCandidate } from '@/lib/manga-provider';
import { resolveLocalMangaCoverImage } from '@/lib/cover-image';

async function handlePost(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin('只有管理员可以更新漫画资料');
  if (!auth.authorized) return auth.response;

  const { id: rawId } = await context.params;
  const id = parseMangaId(rawId);
  if (!id) return apiError('无效的漫画 ID', 'BAD_REQUEST');

  const record = await getMangaRecord(id);
  if (!record) return apiError('漫画不存在', 'NOT_FOUND');
  if (!record.bangumiId) return apiError('这部漫画没有关联 Bangumi 条目', 'BAD_REQUEST');

  const metadata = await getMangaMetadataCandidate(record.bangumiId);
  if (!metadata) return apiError('未能从 Bangumi 读取漫画资料', 'UPSTREAM_ERROR');

  const patch: Partial<CreateMangaDTO> = {};
  const assignText = <K extends keyof CreateMangaDTO>(key: K, value: CreateMangaDTO[K] | undefined) => {
    if (value !== undefined && value !== '') patch[key] = value;
  };
  const assignArray = <K extends keyof CreateMangaDTO>(key: K, value: string[]) => {
    if (value.length > 0) patch[key] = value as CreateMangaDTO[K];
  };

  assignText('originalTitle', metadata.originalTitle);
  if (!record.coverUrl) assignText('coverUrl', metadata.coverUrl);
  assignText('summary', metadata.summary);
  assignText('releaseDate', metadata.releaseDate);
  assignText('totalVolumes', metadata.volumeCount);
  assignText('totalChapters', metadata.chapterCount);
  assignArray('aliases', Array.from(new Set([...record.aliases, ...metadata.aliases])));
  assignArray('tags', Array.from(new Set([...record.tags, ...metadata.tags])));
  assignArray('authors', metadata.authors);
  assignArray('illustrators', metadata.illustrators);
  assignArray('publishers', metadata.publishers);
  assignArray('serializations', metadata.serializations);

  if (metadata.isFinished === true) {
    patch.publicationStatus = 'completed';
  } else if (record.publicationStatus === 'unknown') {
    patch.publicationStatus = 'ongoing';
  }

  const appliedFields = Object.keys(patch);
  if (appliedFields.length === 0) {
    return apiSuccess({ ok: true, appliedFields, entry: record });
  }

  if (patch.coverUrl) {
    patch.localCoverUrl = await resolveLocalMangaCoverImage(patch.coverUrl, id);
  }

  const updated = await updateMangaRecord(id, patch);
  if (!updated) throw new Error('更新漫画资料后无法读取记录');
  return apiSuccess({ ok: true, appliedFields, entry: updated });
}

export const POST = withApiErrorBoundary({
  operation: '补全漫画资料',
  message: '补全漫画资料失败，请稍后重试',
}, handlePost);

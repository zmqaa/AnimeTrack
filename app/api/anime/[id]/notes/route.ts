import {
  apiError,
  apiSuccess,
  readApiJson,
  requireAdmin,
  withApiErrorBoundary,
} from '@/lib/api-response';
import { parseAnimeId } from '@/lib/anime';
import { createEpisodeNote, listAnimeNotes, replaceEpisodeNotes } from '@/lib/anime-notes';
import { animeNoteBodySchema, animeNoteCollectionSchema } from '@/lib/validations';

async function handleGet(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const animeId = parseAnimeId(id);
  if (!animeId) return apiError('无效的动漫 ID', 'BAD_REQUEST');
  return apiSuccess(listAnimeNotes(animeId));
}

async function handlePost(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const animeId = parseAnimeId(id);
  if (!animeId) return apiError('无效的动漫 ID', 'BAD_REQUEST');

  const parsed = animeNoteBodySchema.safeParse(await readApiJson<unknown>(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '参数校验失败', 'BAD_REQUEST');
  }

  const note = createEpisodeNote(animeId, parsed.data);
  if (!note) return apiError('动漫不存在', 'NOT_FOUND');
  return apiSuccess(note, 201);
}

async function handlePut(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const { id } = await context.params;
  const animeId = parseAnimeId(id);
  if (!animeId) return apiError('无效的动漫 ID', 'BAD_REQUEST');

  const parsed = animeNoteCollectionSchema.safeParse(await readApiJson<unknown>(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '参数校验失败', 'BAD_REQUEST');
  }

  const notes = replaceEpisodeNotes(animeId, parsed.data);
  if (!notes) return apiError('动漫不存在', 'NOT_FOUND');
  return apiSuccess(notes);
}

const animeNotesBoundary = {
  operation: '处理动漫备注请求',
  message: '处理动漫备注失败，请稍后重试',
};

export const GET = withApiErrorBoundary(animeNotesBoundary, handleGet);
export const POST = withApiErrorBoundary(animeNotesBoundary, handlePost);
export const PUT = withApiErrorBoundary(animeNotesBoundary, handlePut);

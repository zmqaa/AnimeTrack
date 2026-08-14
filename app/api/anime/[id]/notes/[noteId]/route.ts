import {
  apiError,
  apiSuccess,
  readApiJson,
  requireAdmin,
  withApiErrorBoundary,
} from '@/lib/api-response';
import { parseAnimeId } from '@/lib/anime';
import { deleteAnimeNote, updateAnimeNote } from '@/lib/anime-notes';
import { animeNoteBodySchema } from '@/lib/validations';

function parseNoteId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function handlePatch(
  request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const params = await context.params;
  const animeId = parseAnimeId(params.id);
  const noteId = parseNoteId(params.noteId);
  if (!animeId || !noteId) return apiError('无效的动漫或备注 ID', 'BAD_REQUEST');

  const parsed = animeNoteBodySchema.safeParse(await readApiJson<unknown>(request));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '参数校验失败', 'BAD_REQUEST');
  }

  const note = updateAnimeNote(animeId, noteId, parsed.data);
  if (!note) return apiError('备注不存在', 'NOT_FOUND');
  return apiSuccess(note);
}

async function handleDelete(
  _request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const params = await context.params;
  const animeId = parseAnimeId(params.id);
  const noteId = parseNoteId(params.noteId);
  if (!animeId || !noteId) return apiError('无效的动漫或备注 ID', 'BAD_REQUEST');

  if (!deleteAnimeNote(animeId, noteId)) return apiError('备注不存在', 'NOT_FOUND');
  return apiSuccess({ ok: true });
}

const animeNoteBoundary = {
  operation: '处理动漫备注请求',
  message: '处理动漫备注失败，请稍后重试',
};

export const PATCH = withApiErrorBoundary(animeNoteBoundary, handlePatch);
export const DELETE = withApiErrorBoundary(animeNoteBoundary, handleDelete);

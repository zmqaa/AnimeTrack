import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { parseAnimeId } from '@/lib/anime';
import { deleteAnimeNote, updateAnimeNote } from '@/lib/anime-notes';
import { animeNoteBodySchema } from '@/lib/validations';

function parseNoteId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const params = await context.params;
  const animeId = parseAnimeId(params.id);
  const noteId = parseNoteId(params.noteId);
  if (!animeId || !noteId) return apiError('Invalid ID', 400);

  const parsed = animeNoteBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '参数校验失败', 400);
  }

  const note = updateAnimeNote(animeId, noteId, parsed.data);
  if (!note) return apiError('Not found', 404);
  return apiSuccess(note);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; noteId: string }> },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const params = await context.params;
  const animeId = parseAnimeId(params.id);
  const noteId = parseNoteId(params.noteId);
  if (!animeId || !noteId) return apiError('Invalid ID', 400);

  if (!deleteAnimeNote(animeId, noteId)) return apiError('Not found', 404);
  return apiSuccess({ ok: true });
}

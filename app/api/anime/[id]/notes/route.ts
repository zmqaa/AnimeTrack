import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { parseAnimeId } from '@/lib/anime';
import { createEpisodeNote, listAnimeNotes } from '@/lib/anime-notes';
import { animeNoteBodySchema } from '@/lib/validations';

export async function GET(
  _request: Request,
  context: { params: { id: string } },
) {
  const animeId = parseAnimeId(context.params.id);
  if (!animeId) return apiError('Invalid ID', 400);
  return apiSuccess(listAnimeNotes(animeId));
}

export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const animeId = parseAnimeId(context.params.id);
  if (!animeId) return apiError('Invalid ID', 400);

  const parsed = animeNoteBodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message || '参数校验失败', 400);
  }

  const note = createEpisodeNote(animeId, parsed.data);
  if (!note) return apiError('Not found', 404);
  return apiSuccess(note, 201);
}

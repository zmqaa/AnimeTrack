import { deleteWatchHistoryById } from '@/lib/history';
import { getRawDb } from '@/lib/db';
import { nowISO } from '@/lib/date-utils';
import { apiSuccess, apiError, requireAdmin } from '@/lib/api-response';

interface UndoContextRow {
  id: number;
  animeId: number;
  animeTitle: string;
  episode: number;
  progress: number;
  status: string;
}

function parseHistoryId(idStr: string): number | null {
  const id = Number(idStr);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getUndoPreview(id: number) {
  const db = getRawDb();
  const record = db.prepare(`
    SELECT h.id, h.animeId, h.animeTitle, h.episode, a.progress, a.status
    FROM watch_history h
    INNER JOIN anime a ON a.id = h.animeId
    WHERE h.id = ?
  `).get(id) as UndoContextRow | undefined;

  if (!record) return null;

  const targetProgress = Math.max(0, Math.min(record.progress, record.episode - 1));
  const affected = db.prepare(`
    SELECT COUNT(*) AS count, MIN(episode) AS firstEpisode, MAX(episode) AS lastEpisode
    FROM watch_history
    WHERE animeId = ? AND episode > ?
  `).get(record.animeId, targetProgress) as {
    count: number;
    firstEpisode: number | null;
    lastEpisode: number | null;
  };

  return {
    historyId: record.id,
    animeId: record.animeId,
    animeTitle: record.animeTitle,
    episode: record.episode,
    currentProgress: record.progress,
    targetProgress,
    affectedHistoryCount: Number(affected.count),
    firstAffectedEpisode: affected.firstEpisode,
    lastAffectedEpisode: affected.lastEpisode,
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id: idStr } = await params;
  const id = parseHistoryId(idStr);
  if (!id) return apiError('无效的记录 ID', 400);

  const preview = getUndoPreview(id);
  if (!preview) return apiError('记录或对应番剧不存在', 404);

  return apiSuccess({ preview });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id: idStr } = await params;
  const id = parseHistoryId(idStr);
  if (!id) return apiError('无效的记录 ID', 400);

  const db = getRawDb();
  const undo = db.transaction(() => {
    // Re-read inside the transaction so the preview cannot become the source of truth.
    const preview = getUndoPreview(id);
    if (!preview) return null;

    const deleted = db.prepare(
      'DELETE FROM watch_history WHERE animeId = ? AND episode > ?',
    ).run(preview.animeId, preview.targetProgress);

    db.prepare(`
      UPDATE anime
      SET progress = ?,
          status = CASE WHEN status = 'completed' THEN 'watching' ELSE status END,
          end_date = CASE WHEN status = 'completed' THEN NULL ELSE end_date END,
          updatedAt = ?
      WHERE id = ?
    `).run(preview.targetProgress, nowISO(), preview.animeId);

    return {
      ...preview,
      affectedHistoryCount: deleted.changes,
    };
  });

  const result = undo();
  if (!result) return apiError('记录或对应番剧不存在', 404);

  return apiSuccess({ undone: true, result });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { id: idStr } = await params;
  const id = parseHistoryId(idStr);
  if (!id) {
    return apiError('无效的记录 ID', 400);
  }

  const deleted = await deleteWatchHistoryById(id);
  if (!deleted) {
    return apiError('记录不存在', 404);
  }

  return apiSuccess({ deleted: true });
}

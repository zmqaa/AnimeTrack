import { NextRequest } from 'next/server';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { importAnimeData, type ImportPayload } from '@/lib/anime-import';
import { getRawDb } from '@/lib/db';

export async function GET() {
  const auth = await requireAdmin('只有管理员可以查看导入信息');
  if (!auth.authorized) return auth.response;

  const db = getRawDb();
  const anime = db.prepare('SELECT COUNT(*) AS count FROM anime').get() as { count: number };
  const watchHistory = db.prepare('SELECT COUNT(*) AS count FROM watch_history').get() as { count: number };
  const manga = db.prepare('SELECT COUNT(*) AS count FROM manga').get() as { count: number };
  return apiSuccess({ anime: anime.count, watchHistory: watchHistory.count, manga: manga.count });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('只有管理员可以导入数据');
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json() as ImportPayload;
    const result = await importAnimeData(body);
    return apiSuccess(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '导入失败';
    return apiError(message, 500);
  }
}

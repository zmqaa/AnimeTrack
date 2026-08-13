import { NextRequest } from 'next/server';
import { apiError, apiInternalError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { ImportValidationError, importAnimeData, type ImportPayload } from '@/lib/anime-import';
import { getRawDb } from '@/lib/db';

export async function GET() {
  const auth = await requireAdmin('只有管理员可以查看导入信息');
  if (!auth.authorized) return auth.response;

  try {
    const db = getRawDb();
    const anime = db.prepare('SELECT COUNT(*) AS count FROM anime').get() as { count: number };
    const watchHistory = db.prepare('SELECT COUNT(*) AS count FROM watch_history').get() as { count: number };
    const manga = db.prepare('SELECT COUNT(*) AS count FROM manga').get() as { count: number };
    return apiSuccess({ anime: anime.count, watchHistory: watchHistory.count, manga: manga.count });
  } catch (error) {
    return apiInternalError(error, {
      operation: '读取导入数据统计',
      message: '读取导入信息失败，请稍后重试',
    });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('只有管理员可以导入数据');
  if (!auth.authorized) return auth.response;

  let body: ImportPayload;
  try {
    body = await request.json() as ImportPayload;
  } catch {
    return apiError('导入内容不是有效的 JSON', 400);
  }

  try {
    const result = await importAnimeData(body);
    return apiSuccess(result);
  } catch (error: unknown) {
    if (error instanceof ImportValidationError) {
      return apiError(error.message, 400);
    }
    return apiInternalError(error, {
      operation: '导入便携数据',
      message: '导入失败，原有数据未被替换，请稍后重试',
      context: {
        includesAnime: Boolean(body.anime || body.records),
        includesManga: Boolean(body.manga),
      },
    });
  }
}

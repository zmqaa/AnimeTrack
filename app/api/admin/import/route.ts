import { NextRequest } from 'next/server';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { importAnimeData, type ImportPayload } from '@/lib/anime-import';

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

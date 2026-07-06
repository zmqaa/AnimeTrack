import { NextRequest } from 'next/server';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { importAnimeData } from '@/lib/anime-import';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('只有管理员可以导入数据');
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json();
    const records = Array.isArray(body.records) ? body.records : [];
    if (records.length === 0) return apiError('records 不能为空', 400);

    const result = await importAnimeData({ records });
    return apiSuccess(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '导入失败';
    return apiError(message, 500);
  }
}

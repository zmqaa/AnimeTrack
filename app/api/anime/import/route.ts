import { NextRequest } from 'next/server';
import { apiError, apiInternalError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { ImportValidationError, importAnimeData } from '@/lib/anime-import';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('只有管理员可以导入数据');
  if (!auth.authorized) return auth.response;

  let body: { records?: unknown };
  try {
    body = await request.json() as { records?: unknown };
  } catch {
    return apiError('导入内容不是有效的 JSON', 400);
  }

  const records = Array.isArray(body.records) ? body.records : [];
  if (records.length === 0) return apiError('records 不能为空', 400);

  try {
    const result = await importAnimeData({ records });
    return apiSuccess(result);
  } catch (error: unknown) {
    if (error instanceof ImportValidationError) {
      return apiError(error.message, 400);
    }
    return apiInternalError(error, {
      operation: '导入动漫数据',
      message: '导入失败，原有数据未被替换，请稍后重试',
      context: { recordCount: records.length },
    });
  }
}

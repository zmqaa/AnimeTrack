import { getRawDb } from '@/lib/db';
import { apiInternalError, apiSuccess } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getRawDb().prepare('SELECT 1 AS ok').get();
    return apiSuccess({
      database: 'available',
    }, 200, { 'Cache-Control': 'no-store' });
  } catch (error) {
    return apiInternalError(error, {
      operation: '执行数据库健康检查',
      message: '数据库暂时不可用',
      code: 'SERVICE_UNAVAILABLE',
      extra: { database: 'unavailable' },
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}

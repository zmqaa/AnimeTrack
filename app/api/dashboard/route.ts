import { apiInternalError, apiSuccess } from '@/lib/api-response';
import { getDashboardOverview } from '@/lib/dashboard-overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return apiSuccess(await getDashboardOverview(), 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    return apiInternalError(error, {
      operation: '读取首页总览',
      message: '读取首页总览失败，请稍后重试',
    });
  }
}

import { apiError, apiSuccess } from '@/lib/api-response';
import { getDashboardOverview } from '@/lib/dashboard-overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return apiSuccess(await getDashboardOverview(), 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '读取首页总览失败';
    return apiError(message);
  }
}

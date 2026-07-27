import { apiError, apiSuccess } from '@/lib/api-response';
import { getTimelineOverview } from '@/lib/timeline-overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return apiSuccess(await getTimelineOverview(), 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '读取时间线概览失败';
    return apiError(message);
  }
}

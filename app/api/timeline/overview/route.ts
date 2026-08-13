import { apiInternalError, apiSuccess } from '@/lib/api-response';
import { getTimelineOverview } from '@/lib/timeline-overview';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return apiSuccess(await getTimelineOverview(), 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    return apiInternalError(error, {
      operation: '读取时间线概览',
      message: '读取时间线概览失败，请稍后重试',
    });
  }
}

import { getAnimeListOverview } from '@/lib/anime';
import { apiInternalError, apiSuccess } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overview = await getAnimeListOverview();
    return apiSuccess(overview, 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    return apiInternalError(error, {
      operation: '读取番剧概览',
      message: '读取番剧概览失败，请稍后重试',
    });
  }
}

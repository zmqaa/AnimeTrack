import { getAnimeListOverview } from '@/lib/anime';
import { apiError, apiSuccess } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const overview = await getAnimeListOverview();
    return apiSuccess(overview, 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '读取番剧概览失败';
    return apiError(message);
  }
}

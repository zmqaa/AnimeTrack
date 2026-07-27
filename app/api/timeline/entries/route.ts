import { apiError, apiSuccess } from '@/lib/api-response';
import { getTimelineEntries } from '@/lib/timeline-queries';
import type { TimelineSortBy } from '@/lib/timeline-types';

export const dynamic = 'force-dynamic';

const SORT_OPTIONS = new Set<TimelineSortBy>(['newest', 'oldest', 'mostEpisodes']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawPage = Number(searchParams.get('page') || '1');
  const rawPageSize = Number(searchParams.get('pageSize') || '10');
  const rawSortBy = searchParams.get('sortBy') as TimelineSortBy | null;
  const page = Number.isInteger(rawPage) ? Math.max(1, rawPage) : 1;
  const pageSize = Number.isInteger(rawPageSize) ? Math.min(100, Math.max(1, rawPageSize)) : 10;
  const sortBy = rawSortBy && SORT_OPTIONS.has(rawSortBy) ? rawSortBy : 'newest';

  try {
    const result = await getTimelineEntries({
      page,
      pageSize,
      search: searchParams.get('search') || undefined,
      sortBy,
    });
    return apiSuccess(result, 200, { 'Cache-Control': 'no-store' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '读取时间线明细失败';
    return apiError(message);
  }
}

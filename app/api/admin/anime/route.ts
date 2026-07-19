import { apiSuccess, apiError, requireAdmin } from '@/lib/api-response';
import { deleteAnimeRecords, listAnimeRecordsWithLastWatched } from '@/lib/anime';
import { query } from '@/lib/db';

export async function GET(request: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') ?? '10'), 10), 200);
  const search = searchParams.get('search') || undefined;

  try {
    const offset = (page - 1) * pageSize;

    // Parallel: list + real total count
    const [all, totalResult] = await Promise.all([
      listAnimeRecordsWithLastWatched({ search, limit: pageSize, offset }),
      search
        ? query<{ total: number }[]>(
            'SELECT COUNT(*) as total FROM anime WHERE title LIKE ? OR original_title LIKE ?',
            [`%${search}%`, `%${search}%`]
          )
        : query<{ total: number }[]>('SELECT COUNT(*) as total FROM anime'),
    ]);

    const total = Number(totalResult[0]?.total ?? 0);
    return apiSuccess({ records: all, total, page, pageSize });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '读取失败';
    return apiError(message);
  }
}

export async function DELETE(request: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const body = await request.json();
  const ids: unknown = body.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
    return apiError('请提供有效的 ID 数组', 400);
  }

  if (ids.length > 100) return apiError('单次最多删除 100 条记录', 400);

  try {
    const deleted = await deleteAnimeRecords(ids);
    return apiSuccess({ deleted });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '删除失败';
    return apiError(message);
  }
}

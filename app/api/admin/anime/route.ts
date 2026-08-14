import {
  apiSuccess,
  apiError,
  apiInternalError,
  readApiJson,
  requireAdmin,
  withApiErrorBoundary,
} from '@/lib/api-response';
import { deleteAnimeRecords, listAnimeRecordsWithLastWatched } from '@/lib/anime';
import { query } from '@/lib/db';

async function handleGet(request: Request) {
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
    return apiInternalError(error, {
      operation: '读取后台动漫列表',
      message: '读取动漫列表失败，请稍后重试',
      context: { page, pageSize, hasSearch: Boolean(search) },
    });
  }
}

async function handleDelete(request: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const body = await readApiJson<{ ids?: unknown }>(request);
  const ids: unknown = body.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
    return apiError('请提供有效的 ID 数组', 'BAD_REQUEST');
  }

  if (ids.length > 100) return apiError('单次最多删除 100 条记录', 'BAD_REQUEST');

  try {
    const deleted = await deleteAnimeRecords(ids);
    return apiSuccess({ deleted });
  } catch (error: unknown) {
    return apiInternalError(error, {
      operation: '批量删除动漫',
      message: '删除动漫失败，请稍后重试',
      context: { recordCount: ids.length },
    });
  }
}

export const GET = withApiErrorBoundary({
  operation: '处理后台动漫列表请求',
  message: '处理动漫列表请求失败，请稍后重试',
}, handleGet);

export const DELETE = withApiErrorBoundary({
  operation: '处理批量删除动漫请求',
  message: '删除动漫失败，请稍后重试',
}, handleDelete);

import { getWatchHistoryPaginated, deleteWatchHistoryBatch } from '@/lib/history';
import {
  apiSuccess,
  apiError,
  readApiJson,
  requireAdmin,
  withApiErrorBoundary,
} from '@/lib/api-response';

async function handleGet(request: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const pageSize = Math.min(Math.max(Number(searchParams.get('pageSize') ?? '10'), 10), 200);
  const search = searchParams.get('search') || undefined;

  const { records, total } = await getWatchHistoryPaginated(page, pageSize, search);
  return apiSuccess({ records, total, page, pageSize });
}

async function handleDelete(request: Request) {
  const { authorized, response } = await requireAdmin();
  if (!authorized) return response;

  const body = await readApiJson<{ ids?: unknown }>(request);
  const ids: unknown = body.ids;

  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === 'number' && Number.isInteger(id) && id > 0)) {
    return apiError('请提供有效的记录 ID 数组', 'BAD_REQUEST');
  }

  if (ids.length > 500) {
    return apiError('单次最多删除 500 条记录', 'BAD_REQUEST');
  }

  const deleted = await deleteWatchHistoryBatch(ids as number[]);
  return apiSuccess({ deleted });
}

export const GET = withApiErrorBoundary({
  operation: '读取后台观看历史',
  message: '读取观看历史失败，请稍后重试',
}, handleGet);

export const DELETE = withApiErrorBoundary({
  operation: '批量删除观看历史',
  message: '删除观看历史失败，请稍后重试',
}, handleDelete);

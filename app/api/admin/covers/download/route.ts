import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { downloadAllRemoteCovers } from '@/lib/cover-batch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const auth = await requireAdmin('只有管理员可以批量下载封面');
  if (!auth.authorized) return auth.response;

  try {
    const result = await downloadAllRemoteCovers();
    return apiSuccess(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '批量下载封面失败';
    return apiError(message, 500);
  }
}

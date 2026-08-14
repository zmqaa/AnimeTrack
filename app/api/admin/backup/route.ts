import { NextRequest } from 'next/server';
import { apiError, apiInternalError, apiSuccess, requireAdmin } from '@/lib/api-response';
import {
  createJsonBackup,
  deleteJsonBackupFile,
  JsonBackupFileError,
  listJsonBackupFiles,
} from '@/lib/json-backups';


/** GET — list backup files */
export async function GET() {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    return apiSuccess({ backups: listJsonBackupFiles() });
  } catch (error) {
    return apiInternalError(error, {
      operation: '读取应用 JSON 备份列表',
      message: '读取备份列表失败，请稍后重试',
    });
  }
}

/** POST — create a new backup */
export async function POST() {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const backup = await createJsonBackup();
    return apiSuccess({ success: true, backup });
  } catch (error) {
    return apiInternalError(error, {
      operation: '创建应用 JSON 备份',
      message: '创建备份失败，请检查服务器日志',
    });
  }
}

/** DELETE — delete a backup file */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  let name: unknown;
  try {
    ({ name } = await request.json() as { name?: unknown });
  } catch {
    return apiError('请求内容不是有效的 JSON', 'BAD_REQUEST');
  }
  if (!name || typeof name !== 'string') {
    return apiError('缺少文件名', 'BAD_REQUEST');
  }

  try {
    const deleted = deleteJsonBackupFile(name);
    return apiSuccess({ success: true, deleted });
  } catch (error) {
    if (error instanceof JsonBackupFileError) {
      return apiError(error.message, error.apiCode);
    }
    return apiInternalError(error, {
      operation: '删除应用 JSON 备份',
      message: '删除备份失败，请稍后重试',
    });
  }
}

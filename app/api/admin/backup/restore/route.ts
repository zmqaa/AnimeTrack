import { NextRequest } from 'next/server';
import { apiError, apiInternalError, apiSuccess, requireAdmin } from '@/lib/api-response';
import {
  createJsonBackup,
  getJsonBackupRetention,
  JsonBackupFileError,
  readJsonBackupFile,
} from '@/lib/json-backups';
import {
  getAvailableImportDatasets,
  ImportValidationError,
  importAnimeData,
} from '@/lib/anime-import';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  let body: { name?: unknown };
  try {
    body = await request.json() as { name?: unknown };
  } catch {
    return apiError('请求内容不是有效的 JSON', 'BAD_REQUEST');
  }

  try {
    const backup = readJsonBackupFile(body.name);
    const datasets = getAvailableImportDatasets(backup.payload);
    if (!datasets.includes('anime') || !datasets.includes('manga')) {
      return apiError('应用备份必须同时包含动漫和漫画数据', 'BAD_REQUEST');
    }

    // 多保留一份，避免创建恢复前快照时轮转掉用户刚选中的最旧备份。
    await createJsonBackup(getJsonBackupRetention() + 1);
    const result = await importAnimeData({
      ...backup.payload,
      selectedDatasets: ['anime', 'manga'],
    });

    return apiSuccess({
      success: true,
      restored: backup.name,
      animeCount: result.anime.replaced,
      historyCount: result.watchHistory.replaced,
      mangaCount: result.manga.replaced,
    });
  } catch (error) {
    if (error instanceof JsonBackupFileError) {
      return apiError(error.message, error.apiCode);
    }
    if (error instanceof ImportValidationError) {
      return apiError(error.message, 'BAD_REQUEST');
    }
    return apiInternalError(error, {
      operation: '恢复应用 JSON 备份',
      message: '恢复备份失败，请检查服务器日志后确认当前数据状态',
    });
  }
}

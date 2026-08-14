import { NextRequest, NextResponse } from 'next/server';
import { apiError, requireAdmin, withApiErrorBoundary } from '@/lib/api-response';
import { getJsonBackupDownload, JsonBackupFileError } from '@/lib/json-backups';

/** GET — download a backup file */
async function handleGet(request: NextRequest) {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  const fileName = request.nextUrl.searchParams.get('file');
  if (!fileName) {
    return apiError('缺少文件名参数', 'BAD_REQUEST');
  }

  let download: ReturnType<typeof getJsonBackupDownload>;
  try {
    download = getJsonBackupDownload(fileName);
  } catch (error) {
    if (error instanceof JsonBackupFileError) {
      return apiError(error.message, error.apiCode);
    }
    throw error;
  }

  return new NextResponse(new Uint8Array(download.content), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${download.name}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export const GET = withApiErrorBoundary({
  operation: '下载应用 JSON 备份',
  message: '下载备份失败，请稍后重试',
}, handleGet);

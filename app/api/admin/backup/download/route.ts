import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { apiError, requireAdmin, withApiErrorBoundary } from '@/lib/api-response';
import { getBackupsDirectory } from '@/lib/runtime-paths';

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

  // Security: prevent path traversal, only allow .sql files from backups dir
  const baseName = path.basename(fileName);
  if (baseName !== fileName || !baseName.endsWith('.sql') || baseName.includes('..')) {
    return apiError('无效的文件名', 'BAD_REQUEST');
  }

  const backupsDirectory = getBackupsDirectory();
  const filePath = path.join(backupsDirectory, baseName);

  // Ensure resolved path is within backups dir
  const resolved = path.resolve(filePath);
  if (path.dirname(resolved) !== path.resolve(backupsDirectory)) {
    return apiError('无效的文件路径', 'BAD_REQUEST');
  }

  if (!fs.existsSync(filePath)) {
    return apiError('文件不存在', 'NOT_FOUND');
  }

  const content = fs.readFileSync(filePath);

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'application/sql; charset=utf-8',
      'Content-Disposition': `attachment; filename="${baseName}"`,
    },
  });
}

export const GET = withApiErrorBoundary({
  operation: '下载数据库备份',
  message: '下载备份失败，请稍后重试',
}, handleGet);

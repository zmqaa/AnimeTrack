import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { getBackupsDirectory, getDatabasePath } from '@/lib/runtime-paths';

const execFileAsync = promisify(execFile);


/** GET — list backup files */
export async function GET() {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  const backupsDirectory = getBackupsDirectory();
  if (!fs.existsSync(backupsDirectory)) {
    return apiSuccess({ backups: [] });
  }

  const files = fs.readdirSync(backupsDirectory)
    .filter((f) => f.endsWith('.sql'))
    .map((name) => {
      const stat = fs.statSync(path.join(backupsDirectory, name));
      return {
        name,
        size: stat.size,
        createdAt: stat.mtime.toISOString(),
      };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return apiSuccess({ backups: files });
}

/** POST — create a new backup */
export async function POST() {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const backupsDirectory = getBackupsDirectory();
    const scriptPath = path.join(process.cwd(), 'scripts/db/scheduled_backup.js');
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      timeout: 30000,
      env: {
        ...process.env,
        DB_PATH: getDatabasePath(),
        ANIMETRACK_BACKUPS_DIR: backupsDirectory,
      },
    });

    const output = (stdout + '\n' + stderr).trim();

    // Find the newly created file
    const match = output.match(/备份完成: (.+\.sql)/);
    const fileName = match?.[1] || null;

    let fileInfo = null;
    if (fileName) {
      const filePath = path.join(backupsDirectory, fileName);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        fileInfo = { name: fileName, size: stat.size, createdAt: stat.mtime.toISOString() };
      }
    }

    return apiSuccess({ success: true, backup: fileInfo, output });
  } catch (err) {
    const message = err instanceof Error ? err.message : '备份失败';
    return apiError(message, 500);
  }
}

/** DELETE — delete a backup file */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  const { name } = await request.json();
  if (!name || typeof name !== 'string') {
    return apiError('缺少文件名', 400);
  }

  // Security: only allow .sql files from backups dir, no path traversal
  const baseName = path.basename(name);
  if (baseName !== name || !baseName.endsWith('.sql') || baseName.includes('..')) {
    return apiError('无效的文件名', 400);
  }

  const filePath = path.join(getBackupsDirectory(), baseName);
  if (!fs.existsSync(filePath)) {
    return apiError('文件不存在', 404);
  }

  fs.unlinkSync(filePath);
  return apiSuccess({ success: true });
}

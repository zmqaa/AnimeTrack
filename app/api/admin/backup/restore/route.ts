import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { getRawDb } from '@/lib/db';
import { getBackupsDirectory, getDatabasePath } from '@/lib/runtime-paths';
import { clearAllCoverImages } from '@/lib/cover-image';
import { prepareBackupSqlForRestore } from '@/lib/sql-backup-validation';

const execFileAsync = promisify(execFile);

export async function POST(request: NextRequest) {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const body = await request.json() as { name?: unknown };
    if (typeof body.name !== 'string') {
      return apiError('缺少备份文件名', 400);
    }

    const baseName = path.basename(body.name);
    if (baseName !== body.name || !baseName.endsWith('.sql') || baseName.includes('..')) {
      return apiError('无效的备份文件名', 400);
    }

    const backupsDirectory = getBackupsDirectory();
    const filePath = path.join(backupsDirectory, baseName);
    const resolvedPath = path.resolve(filePath);
    if (path.dirname(resolvedPath) !== path.resolve(backupsDirectory)) {
      return apiError('无效的备份文件路径', 400);
    }
    if (!fs.existsSync(resolvedPath)) {
      return apiError('备份文件不存在', 404);
    }

    // Read and validate the selected snapshot before creating the safety backup.
    const sql = fs.readFileSync(resolvedPath, 'utf8');
    const restoreSql = prepareBackupSqlForRestore(sql);

    const scriptPath = path.join(process.cwd(), 'scripts/db/scheduled_backup.js');
    await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      timeout: 30000,
      env: {
        ...process.env,
        DB_PATH: getDatabasePath(),
        ANIMETRACK_BACKUPS_DIR: backupsDirectory,
        ANIMETRACK_BACKUP_PREFIX: 'pre-restore-backup-',
      },
    });

    const db = getRawDb();
    db.transaction(() => {
      // 兼容漫画功能加入前创建的旧备份：旧快照等价于没有漫画记录。
      db.prepare('DELETE FROM manga').run();
      db.exec(restoreSql);
      db.prepare('UPDATE anime SET localCoverUrl = NULL').run();
    })();
    await clearAllCoverImages();

    const animeCount = (db.prepare('SELECT COUNT(*) AS count FROM anime').get() as { count: number }).count;
    const historyCount = (db.prepare('SELECT COUNT(*) AS count FROM watch_history').get() as { count: number }).count;
    const mangaCount = (db.prepare('SELECT COUNT(*) AS count FROM manga').get() as { count: number }).count;

    return apiSuccess({
      success: true,
      restored: baseName,
      animeCount,
      historyCount,
      mangaCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '恢复备份失败';
    return apiError(message, 500);
  }
}

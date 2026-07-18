import { NextRequest } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { apiError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { getRawDb } from '@/lib/db';
import { getBackupsDirectory, getDatabasePath } from '@/lib/runtime-paths';
import { clearAllCoverImages } from '@/lib/cover-image';

const execFileAsync = promisify(execFile);

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index];
    const next = sql[index + 1];

    if (char === "'") {
      if (inString && next === "'") {
        current += "''";
        index++;
        continue;
      }
      inString = !inString;
    }

    if (char === ';' && !inString) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (inString) {
    throw new Error('备份文件中的 SQL 字符串不完整');
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function validateBackupSql(sql: string): void {
  if (!sql.startsWith('-- Scheduled backup (scheduled_backup.js)')) {
    throw new Error('只能恢复由应用创建的 SQL 备份');
  }

  const firstStatementIndex = sql.indexOf('DELETE FROM watch_history;');
  if (firstStatementIndex < 0) {
    throw new Error('备份文件缺少数据清理语句');
  }
  const statements = splitSqlStatements(sql.slice(firstStatementIndex));

  if (statements.length < 2) {
    throw new Error('备份文件内容为空或不完整');
  }

  for (const statement of statements) {
    const executableStatement = statement.replace(/^(?:\s*--[^\r\n]*(?:\r?\n|$))+/, '').trim();
    const normalized = executableStatement.replace(/\s+/g, ' ').trim().toUpperCase();
    const allowed =
      normalized === 'DELETE FROM WATCH_HISTORY' ||
      normalized === 'DELETE FROM ANIME' ||
      normalized.startsWith('INSERT INTO ANIME ') ||
      normalized.startsWith('INSERT INTO WATCH_HISTORY ');

    if (!allowed) {
      throw new Error('备份文件包含不允许执行的 SQL 语句');
    }
  }
}

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
    validateBackupSql(sql);

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
      db.exec(sql);
      db.prepare('UPDATE anime SET localCoverUrl = NULL').run();
    })();
    await clearAllCoverImages();

    const animeCount = (db.prepare('SELECT COUNT(*) AS count FROM anime').get() as { count: number }).count;
    const historyCount = (db.prepare('SELECT COUNT(*) AS count FROM watch_history').get() as { count: number }).count;

    return apiSuccess({
      success: true,
      restored: baseName,
      animeCount,
      historyCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '恢复备份失败';
    return apiError(message, 500);
  }
}

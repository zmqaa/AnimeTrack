const BACKUP_HEADER = '-- Scheduled backup (scheduled_backup.js)';

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

export function splitSqlStatements(sql: string): string[] {
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
    throw new BackupValidationError('备份文件中的 SQL 字符串不完整');
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function validateBackupSql(sql: string): void {
  if (!sql.startsWith(BACKUP_HEADER)) {
    throw new BackupValidationError('只能恢复由应用创建的 SQL 备份');
  }

  const statements = splitSqlStatements(sql);
  let deletesAnime = false;
  let deletesHistory = false;
  let deletesNotes = false;
  let insertsNotes = false;
  let deletesManga = false;
  let insertsManga = false;
  let executableCount = 0;

  for (const statement of statements) {
    const executableStatement = statement.replace(/^(?:\s*--[^\r\n]*(?:\r?\n|$))+/, '').trim();
    if (!executableStatement) continue;

    executableCount += 1;
    const normalized = executableStatement.replace(/\s+/g, ' ').trim().toUpperCase();
    const allowed =
      normalized === 'DELETE FROM ANIME_NOTES' ||
      normalized === 'DELETE FROM WATCH_HISTORY' ||
      normalized === 'DELETE FROM ANIME' ||
      normalized === 'DELETE FROM MANGA' ||
      normalized.startsWith('INSERT INTO ANIME ') ||
      normalized.startsWith('INSERT INTO ANIME_NOTES ') ||
      normalized.startsWith('INSERT INTO WATCH_HISTORY ') ||
      normalized.startsWith('INSERT INTO MANGA ');

    if (!allowed) {
      throw new BackupValidationError('备份文件包含不允许执行的 SQL 语句');
    }

    if (normalized === 'DELETE FROM ANIME') deletesAnime = true;
    if (normalized === 'DELETE FROM WATCH_HISTORY') deletesHistory = true;
    if (normalized === 'DELETE FROM ANIME_NOTES') deletesNotes = true;
    if (normalized === 'DELETE FROM MANGA') deletesManga = true;
    if (normalized.startsWith('INSERT INTO ANIME_NOTES ')) insertsNotes = true;
    if (normalized.startsWith('INSERT INTO MANGA ')) insertsManga = true;
  }

  if (executableCount < 2 || !deletesAnime || !deletesHistory) {
    throw new BackupValidationError('备份文件内容为空或不完整');
  }
  if (insertsNotes && !deletesNotes) {
    throw new BackupValidationError('备份文件缺少备注清理语句');
  }
  if (insertsManga && !deletesManga) {
    throw new BackupValidationError('备份文件缺少漫画清理语句');
  }
}

export function prepareBackupSqlForRestore(sql: string): string {
  validateBackupSql(sql);

  // In migrated databases, inserting anime.notes creates the overall
  // anime_notes row through a compatibility trigger. Replace that temporary
  // row with the explicit backup row so its original timestamps are retained.
  return sql.replace(
    /(^|\r?\n)(\s*)INSERT INTO anime_notes\s*\(/gi,
    '$1$2INSERT OR REPLACE INTO anime_notes (',
  );
}

/**
 * 定时备份脚本 — 配合 cron 使用（SQLite 版本）
 *
 * 导出 anime + watch_history 两张表为 SQL 文件，自动轮转旧备份。
 *
 * 用法：
 *   node scripts/db/scheduled_backup.js              # 默认保留 10 份
 *   node scripts/db/scheduled_backup.js --keep 30    # 保留 30 份
 */
const fs = require('fs');
const path = require('path');
const { getDb, projectRoot, nowCSTTimestamp, nowCSTReadable } = require('../shared/db_env');

const BACKUP_DIR = process.env.ANIMETRACK_BACKUPS_DIR
  ? path.resolve(process.env.ANIMETRACK_BACKUPS_DIR)
  : path.join(projectRoot, 'backups');
const BACKUP_PREFIX = process.env.ANIMETRACK_BACKUP_PREFIX || 'scheduled-backup-';
const DEFAULT_KEEP = 10;

function parseArgs() {
  const args = process.argv.slice(2);
  let keep = DEFAULT_KEEP;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keep' && args[i + 1]) {
      const n = parseInt(args[++i], 10);
      if (n > 0) keep = n;
    }
  }
  return { keep };
}

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildInsert(table, columns, row) {
  const cols = columns.join(', ');
  const vals = columns.map((c) => escapeSql(row[c])).join(', ');
  return `INSERT INTO ${table} (${cols}) VALUES (${vals});`;
}

function rotateBackups(keep) {
  if (!fs.existsSync(BACKUP_DIR)) return;
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith(BACKUP_PREFIX) && f.endsWith('.sql'))
    .sort();
  if (files.length <= keep) return;
  const toDelete = files.slice(0, files.length - keep);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
    console.log(`[backup] 删除旧备份: ${f}`);
  }
}

async function main() {
  const { keep } = parseArgs();
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const db = getDb();

  try {
    const animeRows = db.prepare('SELECT * FROM anime ORDER BY id ASC').all();
    const historyRows = db.prepare('SELECT id, animeId, animeTitle, episode, watchedAt FROM watch_history ORDER BY watchedAt ASC, id ASC').all();

    const animeColumns = [
      'id', 'title', 'original_title', 'coverUrl', 'localCoverUrl', 'status', 'score',
      'progress', 'totalEpisodes', 'durationMinutes', 'notes', 'tags', 'summary',
      'start_date', 'end_date', 'premiere_date',
      'cast', 'cast_aliases', 'isFinished', 'createdAt', 'updatedAt',
    ];
    const historyColumns = ['id', 'animeId', 'animeTitle', 'episode', 'watchedAt'];

    const ts = nowCSTTimestamp();
    let fileName = `${BACKUP_PREFIX}${ts}.sql`;
    let filePath = path.join(BACKUP_DIR, fileName);
    let suffix = 2;
    while (fs.existsSync(filePath)) {
      fileName = `${BACKUP_PREFIX}${ts}-${suffix}.sql`;
      filePath = path.join(BACKUP_DIR, fileName);
      suffix++;
    }

    const lines = [
      '-- Scheduled backup (scheduled_backup.js)',
      `-- Source: SQLite database`,
      `-- Generated: ${nowCSTReadable()} (UTC+8)`,
      `-- Tables: anime (${animeRows.length}), watch_history (${historyRows.length})`,
      '',
      'DELETE FROM watch_history;',
      'DELETE FROM anime;',
      '',
    ];

    for (const row of animeRows) {
      lines.push(buildInsert('anime', animeColumns, row));
    }

    lines.push('');
    lines.push('-- watch_history');
    lines.push('');

    for (const row of historyRows) {
      lines.push(buildInsert('watch_history', historyColumns, row));
    }

    lines.push('');

    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`[backup] 备份完成: ${fileName}`);
    console.log(`[backup] anime: ${animeRows.length} 条, watch_history: ${historyRows.length} 条`);

    rotateBackups(keep);
    console.log(`[backup] 保留策略: 最近 ${keep} 份`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('[backup] 备份失败:', err.message);
  process.exit(1);
});

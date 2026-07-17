/**
 * 全量数据备份脚本（SQLite 版本）
 *
 * 导出 anime + watch_history + users 三张表为 SQL INSERT 文件。
 *
 * 用法：
 *   node scripts/db/export_full_backup.js                 # 默认输出到 backups/
 *   node scripts/db/export_full_backup.js --no-users      # 不包含 users 表
 *   node scripts/db/export_full_backup.js -o path/to.sql  # 指定输出路径
 */
const fs = require('fs');
const path = require('path');
const { getDb, projectRoot, nowCSTTimestamp, nowCSTReadable } = require('../shared/db_env');
const backupsDir = path.join(projectRoot, 'backups');

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

function parseArgs() {
  const args = process.argv.slice(2);
  let outputFile = null;
  let includeUsers = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-users') {
      includeUsers = false;
    } else if (args[i] === '-o' && args[i + 1]) {
      outputFile = path.resolve(args[++i]);
    } else if (!args[i].startsWith('-')) {
      outputFile = path.resolve(args[i]);
    }
  }
  if (!outputFile) {
    const ts = nowCSTTimestamp();
    if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
    outputFile = path.join(backupsDir, `full-backup-${ts}.sql`);
  }
  return { outputFile, includeUsers };
}

async function main() {
  const { outputFile, includeUsers } = parseArgs();
  const db = getDb();

  try {
    // anime
    const animeRows = db.prepare('SELECT * FROM anime ORDER BY id ASC').all();
    const animeColumns = [
      'id', 'title', 'original_title', 'coverUrl', 'localCoverUrl', 'status', 'score',
      'progress', 'totalEpisodes', 'durationMinutes', 'notes', 'tags', 'summary',
      'start_date', 'end_date', 'premiere_date',
      'cast', 'cast_aliases', 'isFinished', 'createdAt', 'updatedAt',
    ];

    // watch_history
    const historyRows = db.prepare('SELECT id, animeId, animeTitle, episode, watchedAt FROM watch_history ORDER BY watchedAt ASC, id ASC').all();
    const historyColumns = ['id', 'animeId', 'animeTitle', 'episode', 'watchedAt'];

    // users (optional)
    let userRows = [];
    const userColumns = ['id', 'username', 'password_hash', 'name', 'role', 'createdAt', 'updatedAt'];
    if (includeUsers) {
      userRows = db.prepare('SELECT id, username, password_hash, name, role, createdAt, updatedAt FROM users ORDER BY id ASC').all();
    }

    const lines = [
      '-- Full database backup (export_full_backup.js)',
      `-- Source: SQLite database`,
      `-- Generated: ${nowCSTReadable()} (UTC+8)`,
      `-- Tables: anime (${animeRows.length}), watch_history (${historyRows.length})${includeUsers ? `, users (${userRows.length})` : ''}`,
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

    if (includeUsers && userRows.length > 0) {
      lines.push('');
      lines.push('-- users');
      lines.push('DELETE FROM users;');
      lines.push('');
      for (const row of userRows) {
        lines.push(buildInsert('users', userColumns, row));
      }
    }

    // Update sqlite_sequence
    lines.push('');
    if (animeRows.length > 0) {
      lines.push(`UPDATE sqlite_sequence SET seq = ${Number(animeRows[animeRows.length - 1].id)} WHERE name = 'anime';`);
    }
    if (historyRows.length > 0) {
      lines.push(`UPDATE sqlite_sequence SET seq = ${Number(historyRows[historyRows.length - 1].id)} WHERE name = 'watch_history';`);
    }
    if (userRows.length > 0) {
      lines.push(`UPDATE sqlite_sequence SET seq = ${Number(userRows[userRows.length - 1].id)} WHERE name = 'users';`);
    }
    lines.push('');

    const dir = path.dirname(outputFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');

    const rel = path.relative(projectRoot, outputFile);
    console.log(`Backup complete → ${rel}`);
    console.log(`  anime:         ${animeRows.length} rows`);
    console.log(`  watch_history: ${historyRows.length} rows`);
    if (includeUsers) console.log(`  users:         ${userRows.length} rows`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

/**
 * 全量数据备份脚本（SQLite 版本）
 *
 * 导出 anime + anime_notes + watch_history + manga 表为 SQL INSERT 文件。
 * 管理员账号不属于业务数据，不导出 users 表。
 *
 * 用法：
 *   node scripts/db/export_full_backup.js                 # 默认输出到 backups/
 *   node scripts/db/export_full_backup.js -o path/to.sql  # 指定输出路径
 */
const fs = require('fs');
const path = require('path');
const {
  ensurePrivateDirectory,
  getDb,
  nowCSTReadable,
  nowCSTTimestamp,
  projectRoot,
  securePrivateFile,
} = require('../shared/db_env');
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
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--include-users') {
      throw new Error('不支持导出管理员账号；账号丢失时请使用 user:create-admin 重新创建');
    } else if (args[i] === '--no-users') {
      // 兼容旧命令；账号现在默认排除。
      continue;
    } else if (args[i] === '-o' && args[i + 1]) {
      outputFile = path.resolve(args[++i]);
    } else if (!args[i].startsWith('-')) {
      outputFile = path.resolve(args[i]);
    }
  }
  if (!outputFile) {
    const ts = nowCSTTimestamp();
    ensurePrivateDirectory(backupsDir);
    outputFile = path.join(backupsDir, `full-backup-${ts}.sql`);
  }
  return { outputFile };
}

async function main() {
  const { outputFile } = parseArgs();
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
    // 总备注由 anime.notes 兼容列恢复后通过触发器重建，这里只导出分集备注。
    const noteRows = db.prepare(`
      SELECT id, animeId, episode, content, notedAt, createdAt, updatedAt
      FROM anime_notes
      WHERE episode IS NOT NULL
      ORDER BY animeId ASC, notedAt ASC, id ASC
    `).all();
    const noteColumns = ['animeId', 'episode', 'content', 'notedAt', 'createdAt', 'updatedAt'];

    const mangaRows = db.prepare('SELECT * FROM manga ORDER BY id ASC').all();
    const mangaColumns = [
      'id', 'bangumi_id', 'title', 'original_title', 'aliases', 'coverUrl', 'status',
      'publication_status', 'score', 'current_volume', 'current_chapter', 'total_volumes',
      'total_chapters', 'notes', 'tags', 'summary', 'authors', 'illustrators',
      'publishers', 'serializations', 'start_date', 'end_date', 'release_date',
      'createdAt', 'updatedAt',
    ];

    const lines = [
      '-- Full database backup (export_full_backup.js)',
      `-- Source: SQLite database`,
      `-- Generated: ${nowCSTReadable()} (UTC+8)`,
      `-- Tables: anime (${animeRows.length}), anime_notes (${noteRows.length} episode notes), watch_history (${historyRows.length}), manga (${mangaRows.length})`,
      '-- Accounts: not exported; restoring this file preserves existing users.',
      '',
      'DELETE FROM anime_notes;',
      'DELETE FROM watch_history;',
      'DELETE FROM anime;',
      'DELETE FROM manga;',
      '',
    ];

    for (const row of animeRows) {
      lines.push(buildInsert('anime', animeColumns, row));
    }

    lines.push('', '-- anime_notes (episode notes)', '');
    for (const row of noteRows) {
      lines.push(buildInsert('anime_notes', noteColumns, row));
    }

    lines.push('');
    lines.push('-- watch_history');
    lines.push('');

    for (const row of historyRows) {
      lines.push(buildInsert('watch_history', historyColumns, row));
    }

    lines.push('', '-- manga', '');
    for (const row of mangaRows) {
      lines.push(buildInsert('manga', mangaColumns, row));
    }

    // Update sqlite_sequence
    lines.push('');
    if (animeRows.length > 0) {
      lines.push(`UPDATE sqlite_sequence SET seq = ${Number(animeRows[animeRows.length - 1].id)} WHERE name = 'anime';`);
    }
    if (historyRows.length > 0) {
      lines.push(`UPDATE sqlite_sequence SET seq = ${Number(historyRows[historyRows.length - 1].id)} WHERE name = 'watch_history';`);
    }
    if (mangaRows.length > 0) {
      lines.push(`UPDATE sqlite_sequence SET seq = ${Number(mangaRows[mangaRows.length - 1].id)} WHERE name = 'manga';`);
    }
    lines.push('');

    const dir = path.dirname(outputFile);
    ensurePrivateDirectory(dir);
    fs.writeFileSync(outputFile, lines.join('\n'), 'utf8');
    securePrivateFile(outputFile);

    const rel = path.relative(projectRoot, outputFile);
    console.log(`Backup complete → ${rel}`);
    console.log(`  anime:         ${animeRows.length} rows`);
    console.log(`  anime_notes:   ${noteRows.length} episode note rows`);
    console.log(`  watch_history: ${historyRows.length} rows`);
    console.log(`  manga:         ${mangaRows.length} rows`);
    console.log('  users:         not exported (recreate administrators when needed)');
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

/**
 * 定时生成与 Web「导出 JSON」兼容的便携备份。
 *
 * 用法：
 *   node scripts/db/scheduled_json_backup.js
 *   node scripts/db/scheduled_json_backup.js --keep 30
 *   node scripts/db/scheduled_json_backup.js --output-dir /path/to/backups
 */
const fs = require('fs');
const path = require('path');
const { getDb, projectRoot, nowCSTTimestamp } = require('../shared/db_env');
const { buildPortableExport } = require('../shared/portable_export');

const BACKUP_PREFIX = 'anime-track-export-';
const DEFAULT_KEEP = 30;

function parseArgs() {
  const args = process.argv.slice(2);
  let keep = Number(process.env.ANIMETRACK_JSON_BACKUP_KEEP) || DEFAULT_KEEP;
  let outputDir = process.env.ANIMETRACK_JSON_BACKUPS_DIR
    ? path.resolve(process.env.ANIMETRACK_JSON_BACKUPS_DIR)
    : path.join(projectRoot, 'backups', 'json');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--keep' && args[i + 1]) {
      const value = Number(args[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error('--keep 必须是大于 0 的整数');
      keep = value;
    } else if ((args[i] === '--output-dir' || args[i] === '-o') && args[i + 1]) {
      outputDir = path.resolve(args[++i]);
    } else {
      throw new Error(`未知参数: ${args[i]}`);
    }
  }

  return { keep, outputDir };
}

function parseStringArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function mapAnimeRow(row) {
  return {
    id: row.id,
    title: row.title,
    ...(row.original_title ? { originalTitle: row.original_title } : {}),
    ...(row.coverUrl ? { coverUrl: row.coverUrl } : {}),
    status: row.status,
    ...(row.score !== null ? { score: Number(row.score) } : {}),
    progress: Number(row.progress) || 0,
    ...(row.totalEpisodes !== null ? { totalEpisodes: Number(row.totalEpisodes) } : {}),
    ...(row.durationMinutes !== null ? { durationMinutes: Number(row.durationMinutes) } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    tags: parseStringArray(row.tags),
    cast: parseStringArray(row.cast),
    castAliases: parseStringArray(row.cast_aliases),
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.start_date ? { startDate: row.start_date } : {}),
    ...(row.end_date ? { endDate: row.end_date } : {}),
    ...(row.premiere_date ? { premiereDate: row.premiere_date } : {}),
    ...(row.isFinished !== null ? { isFinished: Boolean(row.isFinished) } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rotateBackups(outputDir, keep) {
  const files = fs.readdirSync(outputDir)
    .filter((name) => name.startsWith(BACKUP_PREFIX) && name.endsWith('.json'))
    .sort();
  const expired = files.slice(0, Math.max(0, files.length - keep));
  for (const name of expired) {
    fs.unlinkSync(path.join(outputDir, name));
    console.log(`[json-backup] 删除旧备份: ${name}`);
  }
}

function main() {
  const { keep, outputDir } = parseArgs();
  fs.mkdirSync(outputDir, { recursive: true });

  const db = getDb();
  try {
    const anime = db.prepare('SELECT * FROM anime ORDER BY id ASC').all().map(mapAnimeRow);
    const watchHistory = db.prepare(
      'SELECT id, animeId, animeTitle, episode, watchedAt FROM watch_history ORDER BY watchedAt DESC, id DESC',
    ).all();
    const data = buildPortableExport(anime, watchHistory);
    const timestamp = nowCSTTimestamp();
    let fileName = `${BACKUP_PREFIX}${timestamp}.json`;
    let filePath = path.join(outputDir, fileName);
    let suffix = 2;
    while (fs.existsSync(filePath)) {
      fileName = `${BACKUP_PREFIX}${timestamp}-${suffix}.json`;
      filePath = path.join(outputDir, fileName);
      suffix++;
    }
    const temporaryPath = `${filePath}.tmp`;

    fs.writeFileSync(temporaryPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    const verification = JSON.parse(fs.readFileSync(temporaryPath, 'utf8'));
    if (verification.anime?.count !== anime.length || verification.watchHistory?.count !== watchHistory.length) {
      throw new Error('JSON 备份写入后的数量校验失败');
    }
    fs.renameSync(temporaryPath, filePath);

    rotateBackups(outputDir, keep);
    console.log(`[json-backup] 备份完成: ${path.relative(projectRoot, filePath)}`);
    console.log(`[json-backup] anime: ${anime.length} 条, watch_history: ${watchHistory.length} 条`);
    console.log(`[json-backup] 保留策略: 最近 ${keep} 份`);
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  console.error('[json-backup] 备份失败:', error instanceof Error ? error.message : error);
  process.exit(1);
}

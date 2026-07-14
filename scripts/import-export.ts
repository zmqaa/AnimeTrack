/**
 * 一键导入 anime-track-export.json 到 SQLite 数据库
 * 用法: npx tsx scripts/import-export.ts
 */
import { readFileSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_PATH = process.env.DB_PATH || join(process.cwd(), 'data', 'animetrack.db');
const EXPORT_FILE = resolve(process.cwd(), 'anime-track-export.json');

interface AnimeRecord {
  id?: string | number;
  title: string;
  originalTitle?: string;
  coverUrl?: string;
  status?: string;
  score?: number | null;
  progress?: number;
  totalEpisodes?: number;
  durationMinutes?: number;
  tags?: string[];
  cast?: string[];
  summary?: string;
  startDate?: string;
  endDate?: string;
  premiereDate?: string;
  isFinished?: boolean;
}

interface HistoryRecord {
  id?: string | number;
  animeId?: string | number;
  animeTitle?: string;
  episode?: number;
  watchedAt?: string;
  note?: string;
}

function nowISO(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', 'T');
}

async function main() {
  const dbDir = dirname(DB_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Auto-create tables from schema
  const schemaPath = join(process.cwd(), 'database', 'schema.sql');
  if (existsSync(schemaPath)) {
    const schema = readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }

  const raw = readFileSync(EXPORT_FILE, 'utf-8');
  const data = JSON.parse(raw);
  const animeRecords: AnimeRecord[] = data?.anime?.records || [];
  const historyRecords: HistoryRecord[] = data?.watchHistory?.records || [];

  console.log(`📦 读取到 ${animeRecords.length} 条番剧 + ${historyRecords.length} 条观看记录`);

  const now = nowISO();
  let createdAnime = 0;
  let updatedAnime = 0;
  let importedHistory = 0;
  let skippedHistory = 0;

  const importAll = db.transaction(() => {
    const titleMap = new Map<string, number>(); // title -> db id
    const idMap = new Map<string, number>();    // export id -> db id

    // --- Import anime ---
    for (const item of animeRecords) {
      if (!item.title?.trim()) continue;

      const title = item.title.trim();
      const originalTitle = item.originalTitle?.trim() || null;

      // Check existing by title
      const existing = db.prepare(
        'SELECT id FROM anime WHERE title = ? OR original_title = ? ORDER BY id DESC LIMIT 1'
      ).get(title, title) as { id: number } | undefined;

      if (existing) {
        const dbId = existing.id;
        db.prepare(
          `UPDATE anime SET title=?, original_title=?, coverUrl=?, status=?, score=?, progress=?,
           totalEpisodes=?, durationMinutes=?, tags=?, cast=?, summary=?, end_date=?, premiere_date=?, isFinished=?, updatedAt=?
           WHERE id=?`
        ).run(
          title, originalTitle, item.coverUrl || null, item.status || 'plan_to_watch',
          item.score ?? null, Number(item.progress ?? 0), item.totalEpisodes ?? null,
          item.durationMinutes ?? null, JSON.stringify(item.tags || []),
          JSON.stringify(item.cast || []), item.summary || null,
          item.endDate || null, item.premiereDate || null,
          item.isFinished != null ? (item.isFinished ? 1 : 0) : null,
          now, dbId
        );
        titleMap.set(title, dbId);
        if (typeof item.id === 'string') idMap.set(item.id, dbId);
        if (typeof item.id === 'number') idMap.set(String(item.id), dbId);
        updatedAnime++;
      } else {
        const result = db.prepare(
          `INSERT INTO anime (title, original_title, coverUrl, status, score, progress, totalEpisodes,
           durationMinutes, tags, cast, summary, end_date, premiere_date, isFinished, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          title, originalTitle, item.coverUrl || null, item.status || 'plan_to_watch',
          item.score ?? null, Number(item.progress ?? 0), item.totalEpisodes ?? null,
          item.durationMinutes ?? null, JSON.stringify(item.tags || []),
          JSON.stringify(item.cast || []), item.summary || null,
          item.endDate || null, item.premiereDate || null,
          item.isFinished != null ? (item.isFinished ? 1 : 0) : null,
          now, now
        );
        const dbId = Number(result.lastInsertRowid);
        titleMap.set(title, dbId);
        if (typeof item.id === 'string') idMap.set(item.id, dbId);
        if (typeof item.id === 'number') idMap.set(String(item.id), dbId);
        createdAnime++;
      }
    }

    console.log(`✅ 番剧: 新增 ${createdAnime}, 更新 ${updatedAnime}`);

    // --- Import watch history ---
    for (const item of historyRecords) {
      const episode = Number(item.episode);
      const watchedAt = item.watchedAt ? new Date(item.watchedAt) : null;

      if (!watchedAt || isNaN(watchedAt.getTime()) || isNaN(episode)) {
        skippedHistory++;
        continue;
      }

      // Resolve anime by id mapping or title
      let dbAnimeId: number | undefined;
      if (typeof item.animeId === 'string') {
        dbAnimeId = idMap.get(item.animeId);
      }
      if (!dbAnimeId && item.animeTitle?.trim()) {
        dbAnimeId = titleMap.get(item.animeTitle.trim());
        if (!dbAnimeId) {
          const row = db.prepare(
            'SELECT id FROM anime WHERE title = ? LIMIT 1'
          ).get(item.animeTitle.trim()) as { id: number } | undefined;
          if (row) dbAnimeId = row.id;
        }
      }

      if (!dbAnimeId) {
        skippedHistory++;
        continue;
      }

      // Dedup
      const dup = db.prepare(
        'SELECT id FROM watch_history WHERE animeId = ? AND episode = ? AND watchedAt = ? LIMIT 1'
      ).get(dbAnimeId, episode, watchedAt.toISOString()) as unknown;

      if (dup) {
        skippedHistory++;
        continue;
      }

      db.prepare(
        'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)'
      ).run(dbAnimeId, item.animeTitle || '', episode, watchedAt.toISOString());
      importedHistory++;
    }
  });

  importAll();

  console.log(`✅ 观看记录: 导入 ${importedHistory}, 跳过 ${skippedHistory}`);
  console.log('🎉 全部导入完成！');

  db.close();
}

main().catch((err) => {
  console.error('❌ 导入失败:', err);
  process.exit(1);
});

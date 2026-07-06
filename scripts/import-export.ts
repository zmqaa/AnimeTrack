/**
 * 一键导入 anime-track-export.json 到数据库
 * 用法: npx tsx scripts/import-export.ts
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import mysql from 'mysql2/promise';

// 直接读取 .env.local 中的数据库配置
function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) vars[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return vars;
}

const env = loadEnv();
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

async function main() {
  const pool = mysql.createPool({
    host: env.MYSQL_HOST || '127.0.0.1',
    port: Number(env.MYSQL_PORT) || 3306,
    user: env.MYSQL_USER || 'zmqaa',
    password: env.MYSQL_PASSWORD || '',
    database: env.MYSQL_DATABASE || 'anime_track',
    connectionLimit: 1,
    waitForConnections: true,
  });

  const conn = await pool.getConnection();

  try {
    const raw = readFileSync(EXPORT_FILE, 'utf-8');
    const data = JSON.parse(raw);

    const animeRecords: AnimeRecord[] = data?.anime?.records || [];
    const historyRecords: HistoryRecord[] = data?.watchHistory?.records || [];

    console.log(`📦 读取到 ${animeRecords.length} 条番剧 + ${historyRecords.length} 条观看记录`);

    await conn.beginTransaction();

    // --- Import anime ---
    const titleMap = new Map<string, number>(); // title -> db id
    const idMap = new Map<string, number>();    // export id -> db id
    let createdAnime = 0;
    let updatedAnime = 0;

    for (const item of animeRecords) {
      if (!item.title?.trim()) continue;

      const title = item.title.trim();
      const originalTitle = item.originalTitle?.trim() || null;

      // Check existing by title or original_title
      const [existing] = await conn.query<any[]>(
        'SELECT id FROM anime WHERE title = ? OR original_title = ? ORDER BY id DESC LIMIT 1',
        [title, title]
      );

      const payload = {
        title,
        originalTitle,
        coverUrl: item.coverUrl || null,
        status: item.status || 'plan_to_watch',
        score: item.score ?? null,
        progress: Number(item.progress ?? 0),
        totalEpisodes: item.totalEpisodes ?? null,
        durationMinutes: item.durationMinutes ?? null,
        tags: JSON.stringify(item.tags || []),
        cast: JSON.stringify(item.cast || []),
        summary: item.summary || null,
        startDate: null,
        endDate: item.endDate || null,
        premiereDate: item.premiereDate || null,
        isFinished: item.isFinished != null ? (item.isFinished ? 1 : 0) : null,
      };

      if (existing.length > 0) {
        const dbId = existing[0].id;
        await conn.query(
          `UPDATE anime SET title=?, original_title=?, coverUrl=?, status=?, score=?, progress=?,
           totalEpisodes=?, durationMinutes=?, tags=?, cast=?, summary=?, end_date=?, premiere_date=?, isFinished=?
           WHERE id=?`,
          [payload.title, payload.originalTitle, payload.coverUrl, payload.status, payload.score,
           payload.progress, payload.totalEpisodes, payload.durationMinutes, payload.tags, payload.cast,
           payload.summary, payload.endDate, payload.premiereDate, payload.isFinished, dbId]
        );
        titleMap.set(title, dbId);
        if (typeof item.id === 'string') idMap.set(item.id, dbId);
        if (typeof item.id === 'number') idMap.set(String(item.id), dbId);
        updatedAnime++;
      } else {
        const [result] = await conn.query<any>(
          `INSERT INTO anime (title, original_title, coverUrl, status, score, progress, totalEpisodes,
           durationMinutes, tags, cast, summary, end_date, premiere_date, isFinished)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [payload.title, payload.originalTitle, payload.coverUrl, payload.status, payload.score,
           payload.progress, payload.totalEpisodes, payload.durationMinutes, payload.tags, payload.cast,
           payload.summary, payload.endDate, payload.premiereDate, payload.isFinished]
        );
        const dbId = result.insertId;
        titleMap.set(title, dbId);
        if (typeof item.id === 'string') idMap.set(item.id, dbId);
        if (typeof item.id === 'number') idMap.set(String(item.id), dbId);
        createdAnime++;
      }
    }

    console.log(`✅ 番剧: 新增 ${createdAnime}, 更新 ${updatedAnime}`);

    // --- Import watch history ---
    let importedHistory = 0;
    let skippedHistory = 0;

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
          const [rows] = await conn.query<any[]>(
            'SELECT id FROM anime WHERE title = ? LIMIT 1',
            [item.animeTitle.trim()]
          );
          if (rows.length > 0) dbAnimeId = rows[0].id;
        }
      }

      if (!dbAnimeId) {
        skippedHistory++;
        continue;
      }

      // Dedup
      const [dup] = await conn.query<any[]>(
        'SELECT id FROM watch_history WHERE animeId = ? AND episode = ? AND watchedAt = ? LIMIT 1',
        [dbAnimeId, episode, watchedAt]
      );
      if (dup.length > 0) {
        skippedHistory++;
        continue;
      }

      await conn.query(
        'INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt) VALUES (?, ?, ?, ?)',
        [dbAnimeId, item.animeTitle || '', episode, watchedAt]
      );
      importedHistory++;
    }

    console.log(`✅ 观看记录: 导入 ${importedHistory}, 跳过 ${skippedHistory}`);

    await conn.commit();
    console.log('🎉 全部导入完成！');
  } catch (err) {
    await conn.rollback();
    console.error('❌ 导入失败:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();

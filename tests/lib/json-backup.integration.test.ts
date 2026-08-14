import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  ImportAnimeItem,
  ImportHistoryItem,
  ImportMangaItem,
  ImportPayload,
} from '../../lib/anime-import';

vi.mock('server-only', () => ({}));

const projectRoot = process.cwd();
const schema = readFileSync(join(projectRoot, 'database/schema.sql'), 'utf8');
type JsonBackupPayload = ImportPayload & {
  formatVersion: number;
  datasets: string[];
  anime: { count: number; records: ImportAnimeItem[] };
  watchHistory: { count: number; records: ImportHistoryItem[] };
  manga: { count: number; records: ImportMangaItem[] };
};

let temporaryDirectory: string;
let sourcePath: string;
let targetPath: string;
let backupDirectory: string;
let backupPayload: JsonBackupPayload;
let firstBackupName: string;
let importModule: typeof import('../../lib/anime-import');
let dbModule: typeof import('../../lib/db');
let jsonBackupModule: typeof import('../../lib/json-backups');

function runBackup(keep = 10) {
  execFileSync(process.execPath, [
    join(projectRoot, 'scripts/db/scheduled_json_backup.js'),
    '--keep', String(keep),
    '--output-dir', backupDirectory,
  ], {
    cwd: projectRoot,
    env: { ...process.env, DB_PATH: sourcePath },
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-json-backup-test-'));
  sourcePath = join(temporaryDirectory, 'source.db');
  targetPath = join(temporaryDirectory, 'target.db');
  backupDirectory = join(temporaryDirectory, 'backups');

  const source = new Database(sourcePath);
  source.pragma('foreign_keys = ON');
  source.exec(schema);
  source.prepare(`
    INSERT INTO anime (
      id, title, coverUrl, localCoverUrl, status, progress, totalEpisodes, notes,
      tags, cast, cast_aliases, start_date, start_date_source, createdAt, updatedAt
    ) VALUES (
      1, 'JSON 备份测试', 'https://lain.bgm.tv/pic/cover/l/test.jpg',
      '/api/local-covers/1.jpg', 'watching', 3, 12, '总体感受',
      '["日常"]', '["声优 A"]', '[]', '2026-08-01', 'history',
      '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'
    )
  `).run();
  source.prepare(`
    INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
    VALUES (1, NULL, '总体感受', '2026-08-01', '2026-08-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z')
  `).run();
  source.prepare(`
    INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
    VALUES (1, 3, '第三集随记', '2026-08-02', '2026-08-02T00:00:00.000Z', '2026-08-02T00:00:00.000Z')
  `).run();
  source.prepare(`
    INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt)
    VALUES (1, 'JSON 备份测试', 3, '2026-08-02T12:00:00.000Z')
  `).run();
  source.prepare(`
    INSERT INTO manga (
      id, title, status, publication_status, current_chapter, authors, tags, createdAt, updatedAt
    ) VALUES (
      1, 'JSON 漫画测试', 'reading', 'ongoing', '8.5', '["作者 A"]', '["漫画"]',
      '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z'
    )
  `).run();
  source.prepare(`
    INSERT INTO users (username, password_hash, name, role)
    VALUES ('source-admin', 'source-password-hash', '源管理员', 'admin')
  `).run();
  source.close();

  runBackup(10);
  [firstBackupName] = readdirSync(backupDirectory).filter((name) => name.endsWith('.json'));
  backupPayload = JSON.parse(
    readFileSync(join(backupDirectory, firstBackupName), 'utf8'),
  ) as JsonBackupPayload;

  process.env.DB_PATH = targetPath;
  process.env.ANIMETRACK_BACKUPS_DIR = join(temporaryDirectory, 'runtime-backups');
  process.env.ANIMETRACK_JSON_BACKUPS_DIR = join(temporaryDirectory, 'runtime-backups', 'json');
  process.env.ANIMETRACK_COVERS_DIR = join(temporaryDirectory, 'covers');
  importModule = await import('../../lib/anime-import');
  dbModule = await import('../../lib/db');
  jsonBackupModule = await import('../../lib/json-backups');
  dbModule.getRawDb();
});

afterAll(() => {
  dbModule?.closeDb();
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.DB_PATH;
  delete process.env.ANIMETRACK_BACKUPS_DIR;
  delete process.env.ANIMETRACK_JSON_BACKUPS_DIR;
  delete process.env.ANIMETRACK_COVERS_DIR;
});

describe('application JSON backup', () => {
  it('exports every portable dataset without accounts or local cover paths', () => {
    expect(backupPayload.formatVersion).toBe(5);
    expect(backupPayload.datasets).toEqual(['anime', 'manga']);
    expect(backupPayload.anime.count).toBe(1);
    expect(backupPayload.watchHistory.count).toBe(1);
    expect(backupPayload.manga.count).toBe(1);
    expect(backupPayload.anime.records[0]).toMatchObject({
      title: 'JSON 备份测试',
      startDate: '2026-08-01',
      startDateSource: 'history',
      notes: [
        expect.objectContaining({ content: '总体感受' }),
        expect.objectContaining({ episode: 3, content: '第三集随记' }),
      ],
    });
    expect(backupPayload.anime.records[0]).not.toHaveProperty('localCoverUrl');
    expect(backupPayload.watchHistory.records[0]).toMatchObject({ animeTitle: 'JSON 备份测试', episode: 3 });
    expect(backupPayload.manga.records[0]).toMatchObject({ title: 'JSON 漫画测试', currentChapter: '8.5' });
    expect(JSON.stringify(backupPayload)).not.toContain('source-password-hash');
    expect(backupPayload).not.toHaveProperty('users');
  });

  it('round-trips anime, notes, history and manga while preserving the target account', async () => {
    const db = dbModule.getRawDb();
    db.prepare(`
      INSERT INTO users (username, password_hash, name, role)
      VALUES ('target-admin', 'target-password-hash', '目标管理员', 'admin')
    `).run();

    const result = await importModule.importAnimeData({
      ...backupPayload,
      selectedDatasets: ['anime', 'manga'],
    });

    expect(result.anime.replaced).toBe(1);
    expect(result.watchHistory.replaced).toBe(1);
    expect(result.manga.replaced).toBe(1);
    expect(db.prepare('SELECT title, start_date, start_date_source, localCoverUrl FROM anime').get()).toEqual({
      title: 'JSON 备份测试',
      start_date: '2026-08-01',
      start_date_source: 'history',
      localCoverUrl: null,
    });
    expect(db.prepare(`
      SELECT episode, content FROM anime_notes ORDER BY episode IS NULL DESC, episode ASC
    `).all()).toEqual([
      { episode: null, content: '总体感受' },
      { episode: 3, content: '第三集随记' },
    ]);
    expect(db.prepare('SELECT animeTitle, episode FROM watch_history').get()).toEqual({
      animeTitle: 'JSON 备份测试',
      episode: 3,
    });
    expect(db.prepare('SELECT title, current_chapter FROM manga').get()).toEqual({
      title: 'JSON 漫画测试',
      current_chapter: '8.5',
    });
    expect(db.prepare('SELECT username, password_hash FROM users').all()).toEqual([
      { username: 'target-admin', password_hash: 'target-password-hash' },
    ]);
  });

  it('supports runtime creation, listing, reading and strict file names', async () => {
    const created = await jsonBackupModule.createJsonBackup(2);
    expect(created.name).toMatch(/^anime-track-export-.+\.json$/);
    expect(jsonBackupModule.listJsonBackupFiles()).toContainEqual(created);
    expect(jsonBackupModule.readJsonBackupFile(created.name).payload.anime?.records).toHaveLength(1);
    expect(jsonBackupModule.getJsonBackupDownload(created.name).content.byteLength).toBeGreaterThan(0);
    expect(() => jsonBackupModule.readJsonBackupFile('../outside.json')).toThrow('无效的备份文件名');
    expect(() => jsonBackupModule.readJsonBackupFile('bad\nname.json')).toThrow('无效的备份文件名');
  });

  it('rotates rapid consecutive backups by creation time', () => {
    runBackup(1);
    const names = readdirSync(backupDirectory).filter((name) => name.endsWith('.json'));
    expect(names).toHaveLength(1);
    expect(names[0]).not.toBe(firstBackupName);
  });
});

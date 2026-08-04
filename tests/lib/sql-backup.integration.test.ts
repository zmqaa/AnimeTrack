import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import {
  prepareBackupSqlForRestore,
  validateBackupSql,
} from '../../lib/sql-backup-validation';

const projectRoot = process.cwd();
const schema = readFileSync(join(projectRoot, 'database/schema.sql'), 'utf8');
const temporaryDirectories: string[] = [];

function makeTemporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'animetrack-sql-backup-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('scheduled SQL backup', () => {
  it('round-trips anime, overall notes, episode notes and watch history', () => {
    const directory = makeTemporaryDirectory();
    const sourcePath = join(directory, 'source.db');
    const backupDirectory = join(directory, 'backups');
    const source = new Database(sourcePath);
    source.pragma('foreign_keys = ON');
    source.exec(schema);
    source.prepare(`
      INSERT INTO anime (
        id, title, status, progress, totalEpisodes, durationMinutes, notes, tags,
        start_date, start_date_source, createdAt, updatedAt
      ) VALUES (1, '备份测试', 'watching', 3, 12, 25, '总体感受', '["日常"]',
        '2026-07-20', 'history', '2026-07-20T00:00:00.000Z', '2026-07-21T00:00:00.000Z')
    `).run();
    source.prepare(`
      INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(1, null, '总体感受', '2026-07-20', '2026-07-20T00:00:00.000Z', '2026-07-20T00:00:00.000Z');
    source.prepare(`
      INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(1, 3, '第三集随记', '2026-07-21', '2026-07-21T00:00:00.000Z', '2026-07-21T00:00:00.000Z');
    source.prepare(`
      INSERT INTO watch_history (animeId, animeTitle, episode, watchedAt)
      VALUES (1, '备份测试', 3, '2026-07-21T12:00:00.000Z')
    `).run();
    source.prepare(`
      INSERT INTO manga (
        id, bangumi_id, title, status, publication_status, current_chapter,
        authors, tags, createdAt, updatedAt
      ) VALUES (1, 73503, '大室家', 'caught_up', 'ongoing', '80',
        '["なもり"]', '["百合"]', '2026-07-20T00:00:00.000Z', '2026-07-21T00:00:00.000Z')
    `).run();
    source.close();

    execFileSync(process.execPath, [join(projectRoot, 'scripts/db/scheduled_backup.js'), '--keep', '2'], {
      cwd: projectRoot,
      env: {
        ...process.env,
        DB_PATH: sourcePath,
        ANIMETRACK_BACKUPS_DIR: backupDirectory,
        ANIMETRACK_BACKUP_PREFIX: 'test-backup-',
      },
      stdio: 'pipe',
    });

    const [backupName] = readdirSync(backupDirectory).filter((name) => name.endsWith('.sql'));
    const sql = readFileSync(join(backupDirectory, backupName), 'utf8');
    expect(() => validateBackupSql(sql)).not.toThrow();

    const restored = new Database(join(directory, 'restored.db'));
    restored.pragma('foreign_keys = ON');
    restored.exec(schema);
    restored.exec(`
      CREATE TRIGGER sync_anime_overall_note_after_insert
      AFTER INSERT ON anime
      WHEN NEW.notes IS NOT NULL AND trim(NEW.notes) <> ''
      BEGIN
        INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
        VALUES (
          NEW.id,
          NULL,
          NEW.notes,
          substr(NEW.updatedAt, 1, 10),
          NEW.createdAt,
          NEW.updatedAt
        )
        ON CONFLICT(animeId) WHERE episode IS NULL DO UPDATE SET
          content = excluded.content,
          updatedAt = excluded.updatedAt;
      END;
    `);
    restored.exec(prepareBackupSqlForRestore(sql));

    expect(restored.prepare(`
      SELECT title, progress, start_date, start_date_source FROM anime
    `).get()).toEqual({
      title: '备份测试',
      progress: 3,
      start_date: '2026-07-20',
      start_date_source: 'history',
    });
    expect(restored.prepare(`
      SELECT episode, content, notedAt, createdAt, updatedAt FROM anime_notes
      ORDER BY episode IS NOT NULL, episode
    `).all()).toEqual([
      {
        episode: null,
        content: '总体感受',
        notedAt: '2026-07-20',
        createdAt: '2026-07-20T00:00:00.000Z',
        updatedAt: '2026-07-20T00:00:00.000Z',
      },
      {
        episode: 3,
        content: '第三集随记',
        notedAt: '2026-07-21',
        createdAt: '2026-07-21T00:00:00.000Z',
        updatedAt: '2026-07-21T00:00:00.000Z',
      },
    ]);
    expect(restored.prepare(`
      SELECT animeTitle, episode, watchedAt FROM watch_history
    `).all()).toEqual([
      { animeTitle: '备份测试', episode: 3, watchedAt: '2026-07-21T12:00:00.000Z' },
    ]);
    expect(restored.prepare(`
      SELECT bangumi_id, title, status, publication_status, current_chapter FROM manga
    `).get()).toEqual({
      bangumi_id: 73503,
      title: '大室家',
      status: 'caught_up',
      publication_status: 'ongoing',
      current_chapter: '80',
    });
    restored.close();
  });

  it('rejects unexpected statements anywhere in the backup', () => {
    const sql = [
      '-- Scheduled backup (scheduled_backup.js)',
      'DROP TABLE users;',
      'DELETE FROM watch_history;',
      'DELETE FROM anime;',
    ].join('\n');

    expect(() => validateBackupSql(sql)).toThrow('备份文件包含不允许执行的 SQL 语句');
  });

  it('requires notes to be cleared before restoring note rows', () => {
    const sql = [
      '-- Scheduled backup (scheduled_backup.js)',
      'DELETE FROM watch_history;',
      'DELETE FROM anime;',
      "INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt) VALUES (1, 1, 'x', '2026-01-01', '2026-01-01', '2026-01-01');",
    ].join('\n');

    expect(() => validateBackupSql(sql)).toThrow('备份文件缺少备注清理语句');
  });

  it('requires manga to be cleared before restoring manga rows', () => {
    const sql = [
      '-- Scheduled backup (scheduled_backup.js)',
      'DELETE FROM watch_history;',
      'DELETE FROM anime;',
      "INSERT INTO manga (title, status, publication_status) VALUES ('测试', 'reading', 'ongoing');",
    ].join('\n');

    expect(() => validateBackupSql(sql)).toThrow('备份文件缺少漫画清理语句');
  });
});

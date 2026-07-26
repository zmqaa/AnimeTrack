import 'server-only';

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

import type Database from 'better-sqlite3';

import { backfillMissingAnimeStartDates } from '@/lib/anime-start-date';
import {
  getBackupsDirectory,
  getDatabasePath,
  getProjectResourcePath,
} from '@/lib/runtime-paths';

const LEGACY_BASELINE_VERSION = 20;

interface MigrationFile {
  version: number;
  name: string;
  fileName: string;
  sql: string;
  checksum: string;
  compatibleChecksums: Set<string>;
}

interface AppliedMigration {
  version: number;
  name: string;
  checksum: string;
}

export interface MigrationRunResult {
  applied: number[];
  baselined: number[];
  backupPath: string | null;
}

function loadMigrationFiles(): MigrationFile[] {
  const migrationsDirectory = getProjectResourcePath('database', 'migrations');
  if (!fs.existsSync(migrationsDirectory)) {
    throw new Error(`数据库迁移目录不存在: ${migrationsDirectory}`);
  }

  const migrations = fs.readdirSync(migrationsDirectory)
    .map((fileName) => {
      const match = /^migrate_(\d+)_([a-z0-9_]+)\.sql$/i.exec(fileName);
      if (!match) return null;

      const sql = fs.readFileSync(path.join(migrationsDirectory, fileName), 'utf8');
      const normalizedSql = sql.replace(/\r\n?/g, '\n');
      const legacyCrLfSql = normalizedSql.replace(/\n/g, '\r\n');
      const checksum = createHash('sha256').update(normalizedSql).digest('hex');
      return {
        version: Number(match[1]),
        name: match[2],
        fileName,
        sql,
        // Git may check the same SQL out with LF on Linux and CRLF on Windows.
        // Store a platform-independent checksum while accepting records created
        // by older releases that hashed the checkout's raw line endings.
        checksum,
        compatibleChecksums: new Set([
          checksum,
          createHash('sha256').update(legacyCrLfSql).digest('hex'),
        ]),
      };
    })
    .filter((migration): migration is MigrationFile => migration !== null)
    .sort((left, right) => left.version - right.version);

  const versions = new Set<number>();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new Error(`存在重复的数据库迁移版本: ${migration.version}`);
    }
    versions.add(migration.version);
  }

  return migrations;
}

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      execution_kind TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      execution_ms INTEGER NOT NULL DEFAULT 0
    )
  `);
}

function getAppliedMigrations(db: Database.Database): Map<number, AppliedMigration> {
  const rows = db.prepare(`
    SELECT version, name, checksum
    FROM schema_migrations
    ORDER BY version ASC
  `).all() as AppliedMigration[];

  return new Map(rows.map((row) => [row.version, row]));
}

function assertAppliedMigrationMatches(
  migration: MigrationFile,
  applied: AppliedMigration,
): void {
  if (applied.name !== migration.name || !migration.compatibleChecksums.has(applied.checksum)) {
    throw new Error(
      `已执行迁移 ${migration.fileName} 的名称或校验和发生变化，请新增迁移文件而不是修改历史迁移`,
    );
  }
}

function hasColumn(db: Database.Database, table: string, column: string): boolean {
  const columns = db.prepare(`PRAGMA table_info("${table.replace(/"/g, '""')}")`).all() as Array<{
    name: string;
  }>;
  return columns.some((item) => item.name === column);
}

function isMigrationAlreadySatisfied(
  db: Database.Database,
  migration: MigrationFile,
): boolean {
  if (migration.version === 21) {
    return hasColumn(db, 'anime', 'localCoverUrl');
  }
  if (migration.version === 23) {
    return hasColumn(db, 'anime', 'start_date_source');
  }
  return false;
}

function recordMigration(
  db: Database.Database,
  migration: MigrationFile,
  executionKind: 'baseline' | 'satisfied' | 'executed',
  executionMs = 0,
): void {
  db.prepare(`
    INSERT INTO schema_migrations (
      version,
      name,
      checksum,
      execution_kind,
      execution_ms
    ) VALUES (?, ?, ?, ?, ?)
  `).run(
    migration.version,
    migration.name,
    migration.checksum,
    executionKind,
    executionMs,
  );
}

function migrateStructuredAnimeNotes(db: Database.Database): void {
  if (!hasColumn(db, 'anime', 'notes')) return;
  const hasCreatedAt = hasColumn(db, 'anime', 'createdAt');
  const hasUpdatedAt = hasColumn(db, 'anime', 'updatedAt');
  const createdAtExpression = hasCreatedAt ? 'createdAt' : "datetime('now')";
  const updatedAtExpression = hasUpdatedAt ? 'updatedAt' : createdAtExpression;
  const newCreatedAtExpression = hasCreatedAt ? 'NEW.createdAt' : "datetime('now')";
  const newUpdatedAtExpression = hasUpdatedAt ? 'NEW.updatedAt' : "datetime('now')";

  db.exec(`
    INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
    SELECT
      id,
      NULL,
      notes,
      substr(COALESCE(${updatedAtExpression}, ${createdAtExpression}, datetime('now')), 1, 10),
      COALESCE(${createdAtExpression}, datetime('now')),
      COALESCE(${updatedAtExpression}, ${createdAtExpression}, datetime('now'))
    FROM anime
    WHERE notes IS NOT NULL
      AND trim(notes) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM anime_notes
        WHERE anime_notes.animeId = anime.id AND anime_notes.episode IS NULL
      );

    CREATE TRIGGER IF NOT EXISTS sync_anime_overall_note_after_insert
    AFTER INSERT ON anime
    WHEN NEW.notes IS NOT NULL AND trim(NEW.notes) <> ''
    BEGIN
      INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
      VALUES (
        NEW.id,
        NULL,
        NEW.notes,
        substr(COALESCE(${newUpdatedAtExpression}, datetime('now')), 1, 10),
        ${newCreatedAtExpression},
        ${newUpdatedAtExpression}
      )
      ON CONFLICT(animeId) WHERE episode IS NULL DO UPDATE SET
        content = excluded.content,
        updatedAt = excluded.updatedAt;
    END;

    CREATE TRIGGER IF NOT EXISTS sync_anime_overall_note_after_update
    AFTER UPDATE OF notes ON anime
    BEGIN
      DELETE FROM anime_notes
      WHERE animeId = NEW.id
        AND episode IS NULL
        AND (NEW.notes IS NULL OR trim(NEW.notes) = '');

      INSERT INTO anime_notes (animeId, episode, content, notedAt, createdAt, updatedAt)
      SELECT
        NEW.id,
        NULL,
        NEW.notes,
        substr(COALESCE(${newUpdatedAtExpression}, datetime('now')), 1, 10),
        COALESCE((
          SELECT createdAt FROM anime_notes
          WHERE animeId = NEW.id AND episode IS NULL
        ), ${newCreatedAtExpression}),
        ${newUpdatedAtExpression}
      WHERE NEW.notes IS NOT NULL AND trim(NEW.notes) <> ''
      ON CONFLICT(animeId) WHERE episode IS NULL DO UPDATE SET
        content = excluded.content,
        updatedAt = excluded.updatedAt;
    END;
  `);
}

function createMigrationBackup(
  db: Database.Database,
  databasePath: string,
  migration: MigrationFile,
): string {
  const backupDirectory = getBackupsDirectory();
  fs.mkdirSync(backupDirectory, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const databaseName = path.basename(databasePath, path.extname(databasePath));
  const backupPath = path.join(
    backupDirectory,
    `${databaseName}-pre-migration-${String(migration.version).padStart(3, '0')}-${timestamp}.db`,
  );
  const escapedBackupPath = backupPath.replace(/'/g, "''");

  db.exec(`VACUUM INTO '${escapedBackupPath}'`);
  return backupPath;
}

export function runDatabaseMigrations(
  db: Database.Database,
  databasePath = getDatabasePath(),
): MigrationRunResult {
  ensureMigrationsTable(db);

  const migrations = loadMigrationFiles();
  const appliedMigrations = getAppliedMigrations(db);
  const result: MigrationRunResult = {
    applied: [],
    baselined: [],
    backupPath: null,
  };

  for (const migration of migrations) {
    const applied = appliedMigrations.get(migration.version);
    if (applied) {
      assertAppliedMigrationMatches(migration, applied);
      continue;
    }

    if (migration.version <= LEGACY_BASELINE_VERSION) {
      db.transaction(() => recordMigration(db, migration, 'baseline'))();
      result.baselined.push(migration.version);
      continue;
    }

    if (isMigrationAlreadySatisfied(db, migration)) {
      db.transaction(() => {
        if (migration.version === 23 && hasColumn(db, 'anime', 'start_date')) {
          const hasWatchHistory = db.prepare(`
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'watch_history'
          `).get();
          if (hasWatchHistory) backfillMissingAnimeStartDates(db);
        }
        recordMigration(db, migration, 'satisfied');
      })();
      result.baselined.push(migration.version);
      continue;
    }

    if (!result.backupPath) {
      result.backupPath = createMigrationBackup(db, databasePath, migration);
      console.log(`[db:migrate] 迁移前备份已创建: ${result.backupPath}`);
    }

    const startedAt = Date.now();
    try {
      db.transaction(() => {
        db.exec(migration.sql);
        if (migration.version === 22) {
          migrateStructuredAnimeNotes(db);
        }
        if (migration.version === 23 && hasColumn(db, 'anime', 'start_date')) {
          const hasWatchHistory = db.prepare(`
            SELECT 1
            FROM sqlite_master
            WHERE type = 'table' AND name = 'watch_history'
          `).get();
          if (hasWatchHistory) {
            backfillMissingAnimeStartDates(db);
          }
        }
        recordMigration(db, migration, 'executed', Date.now() - startedAt);
      })();
      result.applied.push(migration.version);
      console.log(`[db:migrate] 已执行 ${migration.fileName}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `数据库迁移 ${migration.fileName} 失败，事务已回滚。迁移前备份: ${result.backupPath}. 原因: ${detail}`,
        { cause: error },
      );
    }
  }

  return result;
}

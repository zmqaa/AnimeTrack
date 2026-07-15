import 'server-only';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'animetrack.db');
const SCHEMA_PATH = path.join(process.cwd(), 'database', 'schema.sql');

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(DB_PATH);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  // 增大缓存，减少磁盘IO
  db.pragma('cache_size = -64000');  // 64MB
  db.pragma('mmap_size = 268435456'); // 256MB memory-mapped I/O

  if (fs.existsSync(SCHEMA_PATH)) {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);
  }

  // 启动时清理孤儿观看历史（anime 已删除但 history 未清理的记录）
  try {
    const orphanResult = db.prepare('DELETE FROM watch_history WHERE animeId NOT IN (SELECT id FROM anime)').run();
    if (orphanResult.changes > 0) {
      console.log(`[db] 清理了 ${orphanResult.changes} 条孤儿观看历史`);
    }
  } catch (err) {
    console.warn('[db] 孤儿记录清理失败:', (err as Error).message);
  }

  _db = db;
  return db;
}

export interface DbResult {
  insertId: number;
  affectedRows: number;
}

/** 预编译语句缓存 —— 避免每次 query() 都重新解析 SQL */
const stmtCache = new Map<string, Database.Statement>();

function getCachedStmt(db: Database.Database, sql: string) {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
}

export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T> {
  const db = getDb();
  const stmt = getCachedStmt(db, sql);
  const bound = params && params.length > 0 ? params : [];

  const trimmed = sql.trim().toUpperCase();

  if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH') || trimmed.includes('RETURNING')) {
    return stmt.all(...bound) as T;
  }

  const info = stmt.run(...bound);

  return {
    insertId: Number(info.lastInsertRowid),
    affectedRows: info.changes,
  } as T;
}

/** 清除语句缓存（数据库关闭时调用） */
export function clearStmtCache(): void {
  stmtCache.clear();
}

export function getRawDb() {
  return getDb();
}

export function closeDb(): void {
  clearStmtCache();
  if (_db) {
    _db.close();
    _db = null;
  }
}

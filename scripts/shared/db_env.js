const fs = require('fs');
const path = require('path');
const { config: loadEnv } = require('dotenv');

function resolveProjectRoot() {
  const cwd = process.cwd();
  if (fs.existsSync(path.join(cwd, 'package.json'))) {
    return cwd;
  }

  let currentDir = __dirname;
  while (true) {
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
  }

  return path.join(__dirname, '../..');
}

const projectRoot = resolveProjectRoot();

let loaded = false;

function loadDatabaseEnv() {
  if (loaded) return;

  for (const fileName of ['.env.local', '.env']) {
    const filePath = path.join(projectRoot, fileName);
    if (fs.existsSync(filePath)) {
      loadEnv({ path: filePath, override: false });
    }
  }

  loaded = true;
}

/**
 * Get a better-sqlite3 database instance.
 * Auto-creates the data directory and applies schema if tables don't exist.
 */
function getDb() {
  loadDatabaseEnv();

  const dbPath = getDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const Database = require('better-sqlite3');
  const db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // Auto-create tables
  const schemaPath = path.join(projectRoot, 'database', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schema);
  }

  return db;
}

/**
 * Returns current CST (UTC+8) timestamp in filename-safe format: "2026-03-31_14-05-00"
 */
function nowCSTTimestamp() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', '_').replace(/:/g, '-');
}

/**
 * Returns current CST time readable string, format "2026-03-31 14:05:00"
 */
function nowCSTReadable() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(new Date());
}

/** Returns the path to the SQLite database file */
function getDbPath() {
  loadDatabaseEnv();
  const configured = String(process.env.DB_PATH || '').trim();
  if (!configured) return path.join(projectRoot, 'data', 'animetrack.db');
  return path.isAbsolute(configured) ? path.normalize(configured) : path.resolve(projectRoot, configured);
}

module.exports = {
  projectRoot,
  getDbPath,
  loadDatabaseEnv,
  getDb,
  nowCSTTimestamp,
  nowCSTReadable,
};

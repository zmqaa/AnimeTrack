/**
 * 逐表备份脚本（SQLite 版本）
 *
 * 为当前数据库中的每张表分别导出：
 *   1) .schema.sql  表结构快照
 *   2) .data.sql    表数据快照
 *
 * 用法：
 *   node scripts/db/export_table_backups.js
 *   node scripts/db/export_table_backups.js -o backups/custom-dir
 */
const fs = require('fs');
const path = require('path');
const { getDb, projectRoot, nowCSTTimestamp, nowCSTReadable } = require('../shared/db_env');

const BACKUP_PREFIX = 'table-backup-';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Buffer.isBuffer(value)) return `X'${value.toString('hex')}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildInsert(tableName, columns, row) {
  const quotedColumns = columns.join(', ');
  const values = columns.map((column) => escapeSql(row[column])).join(', ');
  return `INSERT INTO ${tableName} (${quotedColumns}) VALUES (${values});`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let outputDir = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '-o' || args[i] === '--output-dir') && args[i + 1]) {
      outputDir = path.resolve(args[++i]);
    } else if (!args[i].startsWith('-')) {
      outputDir = path.resolve(args[i]);
    }
  }
  if (!outputDir) {
    outputDir = path.join(projectRoot, 'backups', `${BACKUP_PREFIX}${nowCSTTimestamp()}`);
  }
  return { outputDir };
}

function listTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map((row) => row.name);
}

function getTableSchema(db, tableName) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?").get(tableName);
  return row ? row.sql : null;
}

function getTableColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all()
    .map((col) => col.name);
}

function getPrimaryKeyColumns(db, tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all()
    .filter((col) => col.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((col) => col.name);
}

function getTableSnapshot(db, tableName) {
  const createSql = getTableSchema(db, tableName);
  if (!createSql) {
    throw new Error(`Unable to read schema for table: ${tableName}`);
  }

  const columns = getTableColumns(db, tableName);
  const primaryKeyColumns = getPrimaryKeyColumns(db, tableName);

  let sql = `SELECT * FROM ${tableName}`;
  if (primaryKeyColumns.length > 0) {
    sql += ` ORDER BY ${primaryKeyColumns.join(', ')}`;
  }
  const rows = db.prepare(sql).all();

  return { tableName, createSql, columns, primaryKeyColumns, rows };
}

function writeTableFiles(outputDir, snapshot, index) {
  const filePrefix = `${String(index + 1).padStart(2, '0')}-${snapshot.tableName}`;
  const schemaFile = `${filePrefix}.schema.sql`;
  const dataFile = `${filePrefix}.data.sql`;

  const schemaLines = [
    `-- Table schema backup (${snapshot.tableName})`,
    `-- Source: SQLite database`,
    `-- Generated: ${nowCSTReadable()} (UTC+8)`,
    '',
    snapshot.createSql + ';',
    '',
  ];

  const dataLines = [
    `-- Table data backup (${snapshot.tableName})`,
    `-- Source: SQLite database`,
    `-- Generated: ${nowCSTReadable()} (UTC+8)`,
    `-- Rows: ${snapshot.rows.length}`,
    '',
    `DELETE FROM ${snapshot.tableName};`,
    '',
  ];

  for (const row of snapshot.rows) {
    dataLines.push(buildInsert(snapshot.tableName, snapshot.columns, row));
  }
  dataLines.push('');

  fs.writeFileSync(path.join(outputDir, schemaFile), schemaLines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(outputDir, dataFile), dataLines.join('\n'), 'utf8');

  return { schemaFile, dataFile };
}

async function main() {
  const { outputDir } = parseArgs();
  const db = getDb();

  ensureDir(outputDir);

  try {
    const tableNames = listTables(db);
    const manifest = {
      source: 'SQLite database',
      generatedAt: `${nowCSTReadable()} (UTC+8)`,
      outputDir: path.relative(projectRoot, outputDir),
      tables: [],
    };

    for (let index = 0; index < tableNames.length; index += 1) {
      const tableName = tableNames[index];
      const snapshot = getTableSnapshot(db, tableName);
      const files = writeTableFiles(outputDir, snapshot, index);

      manifest.tables.push({
        tableName,
        rowCount: snapshot.rows.length,
        primaryKeyColumns: snapshot.primaryKeyColumns,
        schemaFile: files.schemaFile,
        dataFile: files.dataFile,
      });

      console.log(`[table-backup] ${tableName}: ${snapshot.rows.length} rows`);
    }

    fs.writeFileSync(
      path.join(outputDir, '00-manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );

    console.log(`[table-backup] Backup complete -> ${path.relative(projectRoot, outputDir)}`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

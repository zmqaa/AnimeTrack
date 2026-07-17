#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const resultPath = process.argv[2] ? path.resolve(process.argv[2]) : null;

try {
  const packagedModules = path.join(
    process.resourcesPath,
    'app',
    'standalone',
    'server_node_modules',
  );
  process.env.NODE_PATH = [packagedModules, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter);
  require('module').Module._initPaths();
  const Database = require(path.join(packagedModules, 'better-sqlite3'));
  const bcrypt = require(path.join(packagedModules, 'bcrypt'));

  const db = new Database(':memory:');
  const databaseResult = db.prepare('SELECT 1 AS ok').get();
  db.close();

  const passwordHash = bcrypt.hashSync('AnimeTrack native check', 4);
  const bcryptResult = bcrypt.compareSync('AnimeTrack native check', passwordHash);

  const result = JSON.stringify({
    electron: process.versions.electron,
    modules: process.versions.modules,
    database: databaseResult.ok === 1,
    bcrypt: bcryptResult,
  });

  if (resultPath) {
    fs.writeFileSync(resultPath, result, 'utf8');
  } else {
    console.log(result);
  }
} catch (error) {
  const detail = error instanceof Error ? error.stack || error.message : String(error);
  if (resultPath) {
    fs.writeFileSync(resultPath, JSON.stringify({ error: detail }), 'utf8');
  } else {
    console.error(detail);
  }
  process.exitCode = 1;
}

#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const resultPath = process.argv[2] ? path.resolve(process.argv[2]) : null;

try {
  const standaloneRoot = process.env.ANIMETRACK_VERIFY_STANDALONE
    ? path.resolve(process.env.ANIMETRACK_VERIFY_STANDALONE)
    : path.join(process.resourcesPath, 'app', 'standalone');
  const packagedModules = path.join(standaloneRoot, 'server_node_modules');
  process.env.NODE_PATH = [packagedModules, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter);
  require('module').Module._initPaths();
  const Database = require(path.join(packagedModules, 'better-sqlite3'));

  const db = new Database(':memory:');
  const databaseResult = db.prepare('SELECT 1 AS ok').get();
  db.close();

  const result = JSON.stringify({
    electron: process.versions.electron,
    modules: process.versions.modules,
    database: databaseResult.ok === 1,
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

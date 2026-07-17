#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const packageJson = require(path.join(projectRoot, 'package.json'));
const artifactName = `AnimeTrack-${packageJson.version}-win-x64.zip`;
const artifactPath = path.join(projectRoot, 'dist-electron', artifactName);
const unpackedRoot = path.join(projectRoot, 'dist-electron', 'win-unpacked');

if (!fs.existsSync(artifactPath)) {
  throw new Error(`未找到桌面 ZIP 产物: ${artifactPath}`);
}

const size = fs.statSync(artifactPath).size;
if (size < 10 * 1024 * 1024) {
  throw new Error(`桌面 ZIP 产物大小异常: ${(size / 1024 / 1024).toFixed(1)} MB`);
}

const requiredUnpackedPaths = [
  'AnimeTrack.exe',
  path.join('resources', 'app.asar'),
  path.join('resources', 'app', 'standalone', 'server.js'),
  path.join('resources', 'app', 'standalone', '.next', 'static'),
  path.join('resources', 'app', 'standalone', 'database', 'schema.sql'),
  path.join(
    'resources',
    'app',
    'standalone',
    'server_node_modules',
    'better-sqlite3',
    'build',
    'Release',
    'better_sqlite3.node',
  ),
];
for (const relativePath of requiredUnpackedPaths) {
  if (!fs.existsSync(path.join(unpackedRoot, relativePath))) {
    throw new Error(`解包目录缺少必要内容: ${relativePath}`);
  }
}

for (const relativePath of [
  'data',
  path.join('resources', 'app', 'standalone', 'data'),
  path.join('resources', 'app', 'standalone', 'backups'),
  path.join('resources', 'app', 'standalone', '.next', 'cache'),
]) {
  if (fs.existsSync(path.join(unpackedRoot, relativePath))) {
    throw new Error(`解包目录包含禁止发布的内容: ${relativePath}`);
  }
}

const asarSize = fs.statSync(path.join(unpackedRoot, 'resources', 'app.asar')).size;
if (asarSize > 1024 * 1024) {
  throw new Error(`app.asar 异常偏大，可能重复打包了 Web 依赖: ${(asarSize / 1024 / 1024).toFixed(1)} MB`);
}

console.log(`[desktop] ZIP 产物验证通过: ${artifactName} (${(size / 1024 / 1024).toFixed(1)} MB)`);

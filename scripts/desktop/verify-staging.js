#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const stagingRoot = path.join(projectRoot, 'dist-desktop', 'standalone');
const requiredPaths = [
  'server.js',
  'package.json',
  path.join('.next', 'static'),
  'public',
  path.join('database', 'schema.sql'),
  path.join('database', 'migrations'),
  path.join('server_node_modules', 'better-sqlite3'),
];
const forbiddenPaths = [
  'node_modules',
  'data',
  'backups',
  path.join('.next', 'cache'),
  path.join('public', 'covers'),
  '.env',
  '.env.local',
];

for (const relativePath of requiredPaths) {
  if (!fs.existsSync(path.join(stagingRoot, relativePath))) {
    throw new Error(`桌面 staging 缺少必要内容: ${relativePath}`);
  }
}
for (const relativePath of forbiddenPaths) {
  if (fs.existsSync(path.join(stagingRoot, relativePath))) {
    throw new Error(`桌面 staging 包含禁止发布的内容: ${relativePath}`);
  }
}

const electronPath = require('electron');
const nativeCheck = spawnSync(electronPath, [
  path.join(projectRoot, 'scripts', 'desktop', 'verify-packaged-native.js'),
], {
  cwd: projectRoot,
  env: {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    ANIMETRACK_VERIFY_STANDALONE: stagingRoot,
  },
  encoding: 'utf8',
  windowsHide: true,
});

if (nativeCheck.stdout) process.stdout.write(nativeCheck.stdout);
if (nativeCheck.stderr) process.stderr.write(nativeCheck.stderr);
if (nativeCheck.error) throw nativeCheck.error;
if (nativeCheck.status !== 0) {
  throw new Error(`桌面原生模块验证失败，退出码: ${nativeCheck.status}`);
}

console.log('[desktop] staging 结构与原生模块验证通过');

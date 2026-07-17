#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');

function copyPath(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`原生模块源文件不存在: ${source}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function syncNativeModules(targetNodeModules) {
  const sourceNodeModules = path.join(projectRoot, 'node_modules');
  const targetRoot = path.resolve(targetNodeModules);
  const electronVersion = require(path.join(
    sourceNodeModules,
    'electron',
    'package.json',
  )).version;
  const electronAbi = require('node-abi').getAbi(electronVersion, 'electron');
  const platformArch = `${process.platform}-${process.arch}-${electronAbi}`;

  copyPath(
    path.join(sourceNodeModules, 'better-sqlite3', 'build'),
    path.join(targetRoot, 'better-sqlite3', 'build'),
  );
  if (fs.existsSync(path.join(sourceNodeModules, 'better-sqlite3', 'bin'))) {
    copyPath(
      path.join(sourceNodeModules, 'better-sqlite3', 'bin'),
      path.join(targetRoot, 'better-sqlite3', 'bin'),
    );
  }
  copyPath(
    path.join(
      sourceNodeModules,
      'better-sqlite3',
      'bin',
      platformArch,
      'better-sqlite3.node',
    ),
    path.join(
      targetRoot,
      'better-sqlite3',
      'build',
      'Release',
      'better_sqlite3.node',
    ),
  );
  copyPath(
    path.join(sourceNodeModules, 'bcrypt'),
    path.join(targetRoot, 'bcrypt'),
  );
  copyPath(
    path.join(
      sourceNodeModules,
      'bcrypt',
      'bin',
      platformArch,
      'bcrypt.node',
    ),
    path.join(
      targetRoot,
      'bcrypt',
      'build',
      'Release',
      'bcrypt_lib.node',
    ),
  );
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    throw new Error('用法: node scripts/desktop/sync-native-modules.js <target-node_modules>');
  }
  syncNativeModules(target);
  console.log(`[desktop] 原生模块已同步到 ${path.resolve(target)}`);
}

module.exports = { syncNativeModules };

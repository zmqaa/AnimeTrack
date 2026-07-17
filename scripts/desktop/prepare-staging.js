#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const sourceRoot = path.join(projectRoot, '.next', 'standalone');
const stagingRoot = path.join(projectRoot, 'dist-desktop', 'standalone');
const stagingModules = path.join(stagingRoot, 'node_modules');
const packagedModules = path.join(stagingRoot, 'server_node_modules');

function assertInsideProject(target) {
  const relative = path.relative(projectRoot, path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`拒绝操作项目目录之外的路径: ${target}`);
  }
}

function removePath(target) {
  assertInsideProject(target);
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error(`准备桌面 staging 所需的目录不存在: ${source}`);
  }
  removePath(target);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function directoryStats(root) {
  let files = 0;
  let bytes = 0;
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (entry.isFile()) {
        files += 1;
        bytes += fs.statSync(absolute).size;
      }
    }
  }
  return { files, megabytes: (bytes / 1024 / 1024).toFixed(1) };
}

function rebuildNativeModules() {
  const electronVersion = require(path.join(projectRoot, 'node_modules', 'electron', 'package.json')).version;
  const rebuildCli = path.join(
    projectRoot,
    'node_modules',
    '@electron',
    'rebuild',
    'lib',
    'cli.js',
  );
  // electron-rebuild discovers the project root by walking up to the nearest
  // lockfile. Add a temporary marker so it stops at staging instead of finding
  // the repository lockfile and rebuilding the developer dependency.
  const stagingLockfile = path.join(stagingRoot, 'package-lock.json');
  fs.writeFileSync(stagingLockfile, '{"lockfileVersion":3}\n', 'utf8');
  try {
    const result = spawnSync(process.execPath, [
      rebuildCli,
      '--version', electronVersion,
      '--module-dir', stagingRoot,
      '--only', 'better-sqlite3',
      '--force',
    ], {
      cwd: stagingRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`better-sqlite3 Electron ABI 重建失败，退出码: ${result.status}`);
    }
  } finally {
    removePath(stagingLockfile);
  }
}

if (!fs.existsSync(path.join(sourceRoot, 'server.js'))) {
  throw new Error('未找到 .next/standalone/server.js，请先运行 npm run build:next');
}

removePath(stagingRoot);
fs.mkdirSync(path.dirname(stagingRoot), { recursive: true });
fs.cpSync(sourceRoot, stagingRoot, { recursive: true });

// Output tracing may copy local runtime data. A release must never include it.
for (const relativePath of [
  'data',
  'backups',
  path.join('.next', 'cache'),
  path.join('public', 'covers'),
]) {
  removePath(path.join(stagingRoot, relativePath));
}

copyDirectory(
  path.join(projectRoot, '.next', 'static'),
  path.join(stagingRoot, '.next', 'static'),
);
copyDirectory(path.join(projectRoot, 'public'), path.join(stagingRoot, 'public'));
removePath(path.join(stagingRoot, 'public', 'covers'));
copyDirectory(path.join(projectRoot, 'database'), path.join(stagingRoot, 'database'));

if (!fs.existsSync(stagingModules)) {
  throw new Error('Next.js standalone 中不存在 node_modules');
}

// Next output tracing keeps only the runtime files of native packages, so its
// better-sqlite3 copy has no binding.gyp/source files for electron-rebuild.
// Replace only the staging copy with the full installed package first.
copyDirectory(
  path.join(projectRoot, 'node_modules', 'better-sqlite3'),
  path.join(stagingModules, 'better-sqlite3'),
);
rebuildNativeModules();

// Build inputs are not needed at runtime.
const nativeModuleRoot = path.join(stagingModules, 'better-sqlite3');
const nativeBinary = path.join(nativeModuleRoot, 'build', 'Release', 'better_sqlite3.node');
if (!fs.existsSync(nativeBinary)) {
  throw new Error('better-sqlite3 重建完成后未找到 Electron 原生模块');
}
const temporaryBinary = path.join(nativeModuleRoot, 'better_sqlite3.node.tmp');
fs.copyFileSync(nativeBinary, temporaryBinary);
removePath(path.join(nativeModuleRoot, 'build'));
fs.mkdirSync(path.dirname(nativeBinary), { recursive: true });
fs.copyFileSync(temporaryBinary, nativeBinary);
removePath(temporaryBinary);
for (const relativePath of ['bin', 'deps', 'src', 'binding.gyp', 'README.md']) {
  removePath(path.join(nativeModuleRoot, relativePath));
}
removePath(packagedModules);
fs.renameSync(stagingModules, packagedModules);

const stats = directoryStats(stagingRoot);
console.log(`[desktop] staging 已准备完成: ${stats.files} 个文件，${stats.megabytes} MB`);

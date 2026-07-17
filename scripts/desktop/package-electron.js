#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { preparePackageStandalone } = require('./prepare-package-standalone');
const { syncNativeModules } = require('./sync-native-modules');

const target = process.argv[2] === 'portable' ? 'portable' : 'dir';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const builderCli = path.join(
  process.cwd(),
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js',
);

function run(command, args, shell = false) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    shell,
  });
  if (result.error) console.error(result.error);
  return result;
}

function cleanupPortableBuildArtifacts() {
  const projectRoot = process.cwd();
  const outputRoot = path.join(projectRoot, 'dist-electron');
  const cleanupTargets = [path.join(projectRoot, '.next', 'cache')];

  if (fs.existsSync(outputRoot)) {
    for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
      if (
        entry.isDirectory()
        && (entry.name === 'win-unpacked' || entry.name.startsWith('portable-inspect-'))
      ) {
        cleanupTargets.push(path.join(outputRoot, entry.name));
      }
    }
  }

  for (const targetPath of cleanupTargets) {
    if (!fs.existsSync(targetPath)) continue;
    fs.rmSync(targetPath, { recursive: true, force: true });
    console.log(`[desktop] 已清理打包中间产物: ${path.relative(projectRoot, targetPath)}`);
  }
}

let exitCode = 1;
try {
  // Prepare Electron-ABI native modules before electron-builder stages
  // extraResources. Doing this only in afterPack is too late for the portable
  // target on Windows because its payload can be assembled from an earlier
  // staged copy.
  const prepareNative = run(process.execPath, [builderCli, 'install-app-deps']);
  if (prepareNative.status !== 0) {
    exitCode = prepareNative.status ?? 1;
  } else {
    syncNativeModules(path.join(
      process.cwd(),
      '.next',
      'standalone',
      'node_modules',
    ));
    preparePackageStandalone();
    const build = run(
      process.execPath,
      [builderCli, '--win', target === 'dir' ? '--dir' : 'portable'],
    );
    exitCode = build.status ?? 1;
  }
} finally {
  const restore = run(
    npmCommand,
    ['rebuild', 'bcrypt', 'better-sqlite3'],
    process.platform === 'win32',
  );
  if (restore.status !== 0 && exitCode === 0) {
    exitCode = restore.status ?? 1;
  }
}

if (exitCode === 0 && target === 'portable') {
  cleanupPortableBuildArtifacts();
}

process.exit(exitCode);

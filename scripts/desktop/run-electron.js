#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const { syncNativeModules } = require('./sync-native-modules');

const projectRoot = path.resolve(__dirname, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const electronPath = require('electron');
const builderCli = path.join(
  projectRoot,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js',
);

function run(command, args, shell = false) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
      shell,
    });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

async function main() {
  let exitCode = 1;
  try {
    const rebuildCode = await run(
      process.execPath,
      [builderCli, 'install-app-deps'],
    );
    if (rebuildCode !== 0) return rebuildCode;

    syncNativeModules(path.join(projectRoot, '.next', 'standalone', 'node_modules'));
    exitCode = await run(electronPath, ['.']);
    return exitCode;
  } finally {
    const restoreCode = await run(
      npmCommand,
      ['rebuild', 'bcrypt', 'better-sqlite3'],
      process.platform === 'win32',
    );
    if (restoreCode !== 0 && exitCode === 0) {
      process.exitCode = restoreCode;
    }
  }
}

main()
  .then((code) => {
    if (process.exitCode === undefined) process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

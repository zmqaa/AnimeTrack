#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

const workspaceRoot = path.resolve(__dirname, '../..');
// PM2 的 --update-env 只会保留进程管理器收到的环境变量，而 Web 版 AI
// 配置通常保存在 .env.local。启动 Next.js 前显式加载一次，避免重启后
// AI_API_KEY 等运行时变量丢失；已有的系统/PM2 变量仍拥有更高优先级。
dotenv.config({
  path: path.join(workspaceRoot, '.env.local'),
  override: false,
  quiet: true,
});
const buildDir = path.join(workspaceRoot, '.next');
const standbyDir = path.join(workspaceRoot, '.next-standby');
const standaloneEntry = path.join(buildDir, 'standalone', 'server.js');
const lockFile = path.join(workspaceRoot, '.next-build.lock');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const requiredBuildFiles = [
  'BUILD_ID',
  'routes-manifest.json',
  'prerender-manifest.json',
  path.join('server', 'app-paths-manifest.json'),
];

const port = String(process.env.PORT || '3000');
const host = process.env.HOST || '127.0.0.1';
const lockWaitTimeoutMs = Number(process.env.PROD_GUARD_LOCK_TIMEOUT_MS || 10 * 60 * 1000);
const lockPollMs = Number(process.env.PROD_GUARD_LOCK_POLL_MS || 2000);

function log(message) {
  const time = new Date().toISOString().replace('T', ' ').replace('Z', '');
  console.log(`[prod-start ${time}] ${message}`);
}

function fileExists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureRemoved(targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function copyDirectory(sourcePath, targetPath) {
  ensureRemoved(targetPath);
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function hasValidBuild(targetDir) {
  if (!fileExists(targetDir)) {
    return false;
  }

  return requiredBuildFiles.every((relativePath) => {
    const absolutePath = path.join(targetDir, relativePath);
    try {
      return fs.statSync(absolutePath).size >= 0;
    } catch {
      return false;
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBuildLock() {
  const start = Date.now();

  while (fileExists(lockFile)) {
    if (Date.now() - start > lockWaitTimeoutMs) {
      throw new Error(`Timed out waiting for build lock ${lockFile}`);
    }

    log('Detected build lock, waiting for active build to finish...');
    await sleep(lockPollMs);
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: workspaceRoot,
      env: process.env,
      stdio: 'inherit',
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`Command exited with signal ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
        return;
      }

      resolve();
    });

    child.on('error', reject);
  });
}

async function ensureBuildReady() {
  await waitForBuildLock();

  if (hasValidBuild(buildDir)) {
    if (!hasValidBuild(standbyDir)) {
      copyDirectory(buildDir, standbyDir);
      log('Current build is valid; refreshed standby snapshot.');
    }
    return;
  }

  if (hasValidBuild(standbyDir)) {
    copyDirectory(standbyDir, buildDir);
    log('Recovered production build from standby snapshot.');
    return;
  }

  log('No valid build found. Running guarded build before start...');
  await runCommand(npmCommand, ['run', 'build']);

  if (!hasValidBuild(buildDir)) {
    throw new Error('Guarded build completed but .next is still incomplete.');
  }
}

function startNext() {
  if (!fileExists(standaloneEntry)) {
    throw new Error(`Standalone server entry is missing: ${standaloneEntry}`);
  }

  log(`Starting Next standalone server on ${host}:${port}`);

  const child = spawn(process.execPath, [standaloneEntry], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      HOSTNAME: host,
      HOST: host,
      PORT: port,
      DB_PATH: process.env.DB_PATH || path.join(workspaceRoot, 'data', 'animetrack.db'),
      ANIMETRACK_DATA_DIR: process.env.ANIMETRACK_DATA_DIR || path.join(workspaceRoot, 'data'),
      ANIMETRACK_BACKUPS_DIR: process.env.ANIMETRACK_BACKUPS_DIR || path.join(workspaceRoot, 'backups'),
      ANIMETRACK_COVERS_DIR: process.env.ANIMETRACK_COVERS_DIR || path.join(workspaceRoot, 'public', 'covers'),
      ANIMETRACK_RESOURCES_DIR: process.env.ANIMETRACK_RESOURCES_DIR || workspaceRoot,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on('error', (error) => {
    log(`Failed to launch next start: ${error.message}`);
    process.exit(1);
  });
}

ensureBuildReady()
  .then(startNext)
  .catch((error) => {
    log(`Startup guard failed: ${error.message}`);
    process.exit(1);
  });

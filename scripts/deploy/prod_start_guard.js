#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');
const {
  getEnvironmentFilePaths,
  hardenRuntimePermissions,
  setPrivateUmask,
} = require('../shared/private_files');

setPrivateUmask();

const workspaceRoot = path.resolve(__dirname, '../..');
const requestedRelease = process.env.ANIMETRACK_RELEASE_DIR;
const activeReleaseLink = path.join(workspaceRoot, '.deploy', 'current');
const legacyReleaseDir = path.join(workspaceRoot, '.next', 'standalone');
const releaseDir = requestedRelease
  ? path.resolve(requestedRelease)
  : (fs.existsSync(activeReleaseLink) ? fs.realpathSync(activeReleaseLink) : legacyReleaseDir);
const standaloneEntry = path.join(releaseDir, 'server.js');

dotenv.config({
  path: path.join(workspaceRoot, '.env.local'),
  override: false,
  quiet: true,
});

function resolveRuntimePath(configuredPath, fallbackPath) {
  const value = String(configuredPath || '').trim();
  if (!value) return path.resolve(fallbackPath);
  return path.isAbsolute(value) ? path.normalize(value) : path.resolve(workspaceRoot, value);
}

const dataDirectory = resolveRuntimePath(
  process.env.ANIMETRACK_DATA_DIR,
  path.join(workspaceRoot, 'data'),
);
const databasePath = resolveRuntimePath(
  process.env.DB_PATH,
  path.join(dataDirectory, 'animetrack.db'),
);
const backupsDirectory = resolveRuntimePath(
  process.env.ANIMETRACK_BACKUPS_DIR,
  path.join(workspaceRoot, 'backups'),
);
const jsonBackupsDirectory = resolveRuntimePath(
  process.env.ANIMETRACK_JSON_BACKUPS_DIR,
  path.join(backupsDirectory, 'json'),
);
const permissionReport = hardenRuntimePermissions({
  environmentFiles: getEnvironmentFilePaths(workspaceRoot),
  dataDirectory,
  databasePath,
  backupDirectories: [backupsDirectory, jsonBackupsDirectory],
});
if (permissionReport.filesChanged > 0 || permissionReport.directoriesChanged > 0) {
  console.log(
    `[prod-start] 已收紧 ${permissionReport.filesChanged} 个文件和 ${permissionReport.directoriesChanged} 个目录的访问权限`,
  );
}
if (permissionReport.skippedSymlinks > 0) {
  console.warn(`[prod-start] 已跳过 ${permissionReport.skippedSymlinks} 个符号链接，请单独确认其目标权限`);
}

if (!fs.existsSync(standaloneEntry)) {
  console.error(`[prod-start] Release server entry is missing: ${standaloneEntry}`);
  process.exit(1);
}

const port = String(process.env.PORT || '3000');
const host = process.env.HOST || '127.0.0.1';
console.log(`[prod-start] Starting release ${releaseDir} on ${host}:${port}`);

const child = spawn(process.execPath, [standaloneEntry], {
  cwd: releaseDir,
  env: {
    ...process.env,
    HOSTNAME: host,
    HOST: host,
    PORT: port,
    DB_PATH: databasePath,
    ANIMETRACK_DATA_DIR: dataDirectory,
    ANIMETRACK_BACKUPS_DIR: backupsDirectory,
    ANIMETRACK_JSON_BACKUPS_DIR: jsonBackupsDirectory,
    ANIMETRACK_COVERS_DIR: process.env.ANIMETRACK_COVERS_DIR || path.join(workspaceRoot, 'public', 'covers'),
    ANIMETRACK_RESOURCES_DIR: process.env.ANIMETRACK_RESOURCES_DIR || workspaceRoot,
  },
  stdio: 'inherit',
});

const forwardSignal = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.on('SIGTERM', () => forwardSignal('SIGTERM'));
process.on('SIGINT', () => forwardSignal('SIGINT'));

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
child.on('error', (error) => {
  console.error(`[prod-start] Failed to launch release: ${error.message}`);
  process.exit(1);
});

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

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
    DB_PATH: process.env.DB_PATH || path.join(workspaceRoot, 'data', 'animetrack.db'),
    ANIMETRACK_DATA_DIR: process.env.ANIMETRACK_DATA_DIR || path.join(workspaceRoot, 'data'),
    ANIMETRACK_BACKUPS_DIR: process.env.ANIMETRACK_BACKUPS_DIR || path.join(workspaceRoot, 'backups'),
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

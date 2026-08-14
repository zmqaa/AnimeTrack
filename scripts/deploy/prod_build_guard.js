#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const workspaceRoot = path.resolve(__dirname, '../..');
const deployRoot = path.join(workspaceRoot, '.deploy');
const releasesDir = path.join(deployRoot, 'releases');
const lockFile = path.join(deployRoot, 'build.lock');
const lastBuiltFile = path.join(deployRoot, 'last-built-release');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const requiredBuildFiles = [
  'BUILD_ID',
  'routes-manifest.json',
  'prerender-manifest.json',
  path.join('server', 'app-paths-manifest.json'),
];

const requiredRuntimeFiles = [
  path.join('scripts', 'db', 'scheduled_json_backup.js'),
  path.join('scripts', 'shared', 'db_env.js'),
  path.join('scripts', 'shared', 'portable_export.js'),
  path.join('scripts', 'shared', 'private_files.js'),
  path.join('database', 'schema.sql'),
];

function log(message) {
  const time = new Date().toISOString().replace('T', ' ').replace('Z', '');
  console.log(`[release-build ${time}] ${message}`);
}

function fileExists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function hasValidBuild(targetDir) {
  if (!fileExists(targetDir)) return false;
  return requiredBuildFiles.every((relativePath) => {
    try {
      return fs.statSync(path.join(targetDir, relativePath)).isFile();
    } catch {
      return false;
    }
  });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || workspaceRoot,
      env: options.env || process.env,
      stdio: options.capture ? ['ignore', 'pipe', 'inherit'] : 'inherit',
    });
    let stdout = '';
    if (options.capture) {
      child.stdout.on('data', (chunk) => { stdout += chunk; });
    }
    child.on('exit', (code, signal) => {
      if (signal) return reject(new Error(`${command} exited with signal ${signal}`));
      if (code !== 0) return reject(new Error(`${command} exited with code ${code}`));
      resolve(stdout.trim());
    });
    child.on('error', reject);
  });
}

function acquireLock() {
  fs.mkdirSync(deployRoot, { recursive: true });
  try {
    fs.writeFileSync(lockFile, JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }, null, 2), { flag: 'wx' });
  } catch (error) {
    if (error && error.code === 'EEXIST') {
      throw new Error('Another release build is already in progress.');
    }
    throw error;
  }
}

function copyDirectory(sourcePath, targetPath) {
  fs.rmSync(targetPath, { recursive: true, force: true });
  fs.cpSync(sourcePath, targetPath, { recursive: true });
}

function copyRequiredRuntimeFiles(sourceRoot, releaseDir) {
  for (const relativePath of requiredRuntimeFiles) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const targetPath = path.join(releaseDir, relativePath);
    if (!fileExists(sourcePath)) {
      throw new Error(`Required runtime file is missing from build source: ${relativePath}`);
    }
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }

  const missingFiles = requiredRuntimeFiles.filter(
    (relativePath) => !fileExists(path.join(releaseDir, relativePath)),
  );
  if (missingFiles.length > 0) {
    throw new Error(`Release is missing required runtime files: ${missingFiles.join(', ')}`);
  }
}

async function main() {
  acquireLock();
  let buildSourceDir;
  let completed = false;

  try {
    const shortCommit = await runCommand('git', ['rev-parse', '--short', 'HEAD'], { capture: true });
    const dirtyStatus = await runCommand('git', ['status', '--porcelain'], { capture: true });
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const releaseName = `${timestamp}-${shortCommit}${dirtyStatus ? '-dirty' : ''}`;
    buildSourceDir = path.join(deployRoot, `build-source-${process.pid}`);
    const buildDir = path.join(buildSourceDir, '.next');
    const releaseDir = path.join(releasesDir, releaseName);

    fs.mkdirSync(releasesDir, { recursive: true });
    log(`Preparing isolated source tree for ${releaseName}`);
    await runCommand('rsync', [
      '-a',
      '--delete',
      '--exclude=/.git/',
      '--exclude=/.next/',
      '--exclude=/.next-standby/',
      '--exclude=/.deploy/',
      '--exclude=/node_modules/',
      '--exclude=/data/',
      '--exclude=/backups/',
      '--exclude=/logs/',
      '--exclude=/public/covers/',
      '--exclude=/public/anime-track-export.json',
      '--exclude=/.env.local',
      `${workspaceRoot}/`,
      `${buildSourceDir}/`,
    ]);

    fs.symlinkSync(path.join(workspaceRoot, 'node_modules'), path.join(buildSourceDir, 'node_modules'), 'dir');
    const envFile = path.join(workspaceRoot, '.env.local');
    if (fileExists(envFile)) {
      fs.symlinkSync(envFile, path.join(buildSourceDir, '.env.local'), 'file');
    }

    log('Building candidate without touching the active production release');
    await runCommand(npmCommand, ['run', 'build:next'], { cwd: buildSourceDir });
    if (!hasValidBuild(buildDir)) {
      throw new Error('Build finished but required Next.js artifacts are incomplete.');
    }

    const standaloneDir = path.join(buildDir, 'standalone');
    if (!fileExists(path.join(standaloneDir, 'server.js'))) {
      throw new Error('Standalone server entry was not generated.');
    }

    copyDirectory(standaloneDir, releaseDir);
    copyRequiredRuntimeFiles(buildSourceDir, releaseDir);
    copyDirectory(path.join(buildDir, 'static'), path.join(releaseDir, '.next', 'static'));
    const publicDir = path.join(buildSourceDir, 'public');
    if (fileExists(publicDir)) {
      copyDirectory(publicDir, path.join(releaseDir, 'public'));
    }
    const coversDir = path.join(workspaceRoot, 'public', 'covers');
    if (fileExists(coversDir)) {
      const releaseCoversDir = path.join(releaseDir, 'public', 'covers');
      fs.rmSync(releaseCoversDir, { recursive: true, force: true });
      fs.symlinkSync(coversDir, releaseCoversDir, 'dir');
    }

    fs.writeFileSync(path.join(releaseDir, 'release.json'), JSON.stringify({
      releaseName,
      commit: shortCommit,
      dirty: Boolean(dirtyStatus),
      builtAt: new Date().toISOString(),
    }, null, 2));
    fs.writeFileSync(lastBuiltFile, `${releaseDir}\n`);
    completed = true;
    log(`Candidate release ready: ${releaseDir}`);
  } finally {
    fs.rmSync(lockFile, { force: true });
    if (completed && buildSourceDir) {
      fs.rmSync(buildSourceDir, { recursive: true, force: true });
    } else if (buildSourceDir) {
      log(`Build failed; preserved source tree for inspection: ${buildSourceDir}`);
    }
  }
}

main().catch((error) => {
  log(`ERROR: ${error.message}`);
  process.exit(1);
});

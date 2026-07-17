#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const packageJson = require(path.join(projectRoot, 'package.json'));
const outputRoot = path.join(projectRoot, 'dist-electron');
const currentArtifactName = `AnimeTrack-${packageJson.version}-win-x64.zip`;

function assertInsideProject(target) {
  const relative = path.relative(projectRoot, path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`拒绝清理项目目录之外的路径: ${target}`);
  }
}

function removePath(target) {
  if (!fs.existsSync(target)) return;
  assertInsideProject(target);
  fs.rmSync(target, { recursive: true, force: true });
  console.log(`[desktop] 已清理: ${path.relative(projectRoot, target)}`);
}

// These are reproducible build intermediates. Keep the rest of .next so a
// completed web production build can still be started without rebuilding.
removePath(path.join(projectRoot, '.next', 'cache'));
removePath(path.join(projectRoot, 'dist-desktop'));

if (fs.existsSync(outputRoot)) {
  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    const entryPath = path.join(outputRoot, entry.name);

    if (
      entry.isDirectory()
      && (entry.name === 'win-unpacked' || entry.name.startsWith('portable-inspect-'))
    ) {
      removePath(entryPath);
      continue;
    }

    if (!entry.isFile()) continue;

    const isReleaseArtifact = /^AnimeTrack-.*\.(?:exe|zip)$/i.test(entry.name);
    const isBuilderMetadata = /^builder-(?:debug|effective-config)\.ya?ml$/i.test(entry.name);
    if ((isReleaseArtifact && entry.name !== currentArtifactName) || isBuilderMetadata) {
      removePath(entryPath);
    }
  }
}

const currentArtifactPath = path.join(outputRoot, currentArtifactName);
if (!fs.existsSync(currentArtifactPath)) {
  throw new Error(`清理结束后未找到应保留的最新 ZIP: ${currentArtifactPath}`);
}

console.log(`[desktop] 已保留最新发行包: ${path.relative(projectRoot, currentArtifactPath)}`);

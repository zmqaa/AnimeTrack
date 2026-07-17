#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const standaloneRoot = path.join(projectRoot, '.next', 'standalone');

function copyDirectory(relativeSource, relativeTarget = relativeSource) {
  const source = path.join(projectRoot, relativeSource);
  const target = path.join(standaloneRoot, relativeTarget);

  if (!fs.existsSync(source)) {
    return;
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function removeStandalonePath(relativePath) {
  fs.rmSync(path.join(standaloneRoot, relativePath), {
    recursive: true,
    force: true,
  });
}

if (!fs.existsSync(path.join(standaloneRoot, 'server.js'))) {
  throw new Error('未找到 .next/standalone/server.js，请先运行 Next.js 生产构建');
}

// Next output tracing must never package the developer's live database, backups,
// or local cover cache into a desktop release.
removeStandalonePath('data');
removeStandalonePath('backups');
copyDirectory(path.join('.next', 'static'), path.join('.next', 'static'));
copyDirectory('public');
removeStandalonePath(path.join('public', 'covers'));
copyDirectory('database');
copyDirectory('scripts');

console.log('[desktop] standalone 静态资源、public、database 与 scripts 已准备完成');

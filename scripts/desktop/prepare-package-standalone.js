#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const sourceRoot = path.join(projectRoot, '.next', 'standalone');
const packageRoot = path.join(projectRoot, 'dist-desktop', 'standalone');

function preparePackageStandalone() {
  if (!fs.existsSync(path.join(sourceRoot, 'server.js'))) {
    throw new Error('standalone server.js 不存在，请先运行 desktop:build:web');
  }

  fs.rmSync(packageRoot, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(packageRoot), { recursive: true });
  fs.cpSync(sourceRoot, packageRoot, { recursive: true });

  const sourceModules = path.join(packageRoot, 'node_modules');
  const packagedModules = path.join(packageRoot, 'server_node_modules');
  if (!fs.existsSync(sourceModules)) {
    throw new Error('standalone node_modules 不存在');
  }
  fs.renameSync(sourceModules, packagedModules);

  console.log(`[desktop] 打包 staging 已准备完成: ${packageRoot}`);
}

if (require.main === module) {
  preparePackageStandalone();
}

module.exports = { preparePackageStandalone };

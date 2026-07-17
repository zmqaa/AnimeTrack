#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const target = process.argv[2] === 'dir' ? 'dir' : 'zip';
const builderCli = path.join(
  projectRoot,
  'node_modules',
  'electron-builder',
  'out',
  'cli',
  'cli.js',
);
const args = [builderCli, '--win', target === 'dir' ? '--dir' : 'zip', '--x64'];
const result = spawnSync(process.execPath, args, {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);

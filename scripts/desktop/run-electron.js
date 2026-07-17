#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const electronPath = require('electron');

async function main() {
  const child = spawn(electronPath, ['.'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      ANIMETRACK_STANDALONE_ROOT: path.join(projectRoot, 'dist-desktop', 'standalone'),
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
}

main()
  .then((code) => {
    if (process.exitCode === undefined) process.exitCode = code;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

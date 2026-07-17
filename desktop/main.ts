import { app, BrowserWindow, dialog } from 'electron';
import fs from 'fs';
import path from 'path';

import { startLocalServer, type DesktopPaths, type LocalServerHandle } from './server';
import { createMainWindow } from './window';

let serverHandle: LocalServerHandle | null = null;
let stopping = false;

function getPortableRoot(): string {
  if (!app.isPackaged) {
    return process.cwd();
  }

  const portableExecutableDirectory = process.env.PORTABLE_EXECUTABLE_DIR;
  if (portableExecutableDirectory) {
    return path.resolve(portableExecutableDirectory);
  }

  return path.dirname(process.execPath);
}

function ensureDesktopPaths(): DesktopPaths {
  const data = path.join(getPortableRoot(), 'data');
  const paths: DesktopPaths = {
    data,
    backups: path.join(data, 'backups'),
    covers: path.join(data, 'covers'),
    logs: path.join(data, 'logs'),
    settings: path.join(data, 'settings.json'),
    database: path.join(data, 'animetrack.db'),
  };

  for (const directory of [paths.data, paths.backups, paths.covers, paths.logs]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  return paths;
}

function getStandaloneRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'app', 'standalone')
    : path.join(process.cwd(), '.next', 'standalone');
}

async function stopServer(): Promise<void> {
  if (stopping) return;
  stopping = true;
  try {
    await serverHandle?.stop();
  } finally {
    serverHandle = null;
  }
}

async function launch(): Promise<void> {
  const paths = ensureDesktopPaths();
  const logPath = path.join(paths.logs, 'desktop.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  const log = (message: string) => {
    const line = `[${new Date().toISOString()}] ${message}`;
    console.log(line);
    logStream.write(`${line}\n`);
  };

  process.on('uncaughtException', (error) => log(`[main:error] ${error.stack || error.message}`));
  process.on('unhandledRejection', (reason) => log(`[main:error] ${String(reason)}`));

  log(`[main] 数据目录: ${paths.data}`);
  serverHandle = await startLocalServer(getStandaloneRoot(), paths, log);
  createMainWindow(serverHandle.origin);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.focus();
  });

  app.whenReady()
    .then(launch)
    .catch((error) => {
      dialog.showErrorBox(
        'AnimeTrack 启动失败',
        error instanceof Error ? error.message : String(error),
      );
      app.quit();
    });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', (event) => {
    if (!serverHandle || stopping) return;
    event.preventDefault();
    void stopServer().finally(() => app.quit());
  });
}

import { spawn, type ChildProcessByStdio } from 'child_process';
import { randomBytes } from 'crypto';
import fs from 'fs';
import http from 'http';
import net from 'net';
import path from 'path';
import type { Readable } from 'stream';

const LOCAL_HOST = '127.0.0.1';
type LocalServerProcess = ChildProcessByStdio<null, Readable, Readable>;

export interface DesktopPaths {
  data: string;
  backups: string;
  covers: string;
  logs: string;
  settings: string;
  database: string;
}

export interface LocalServerHandle {
  child: LocalServerProcess;
  origin: string;
  stop: () => Promise<void>;
}

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, LOCAL_HOST, () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close(() => reject(new Error('无法分配本地服务端口')));
        return;
      }
      probe.close((error) => {
        if (error) reject(error);
        else resolve(address.port);
      });
    });
  });
}

function requestHealth(origin: string): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(`${origin}/api/health`, {
      headers: { Connection: 'close' },
      timeout: 1500,
    }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.once('error', () => resolve(false));
  });
}

async function waitForHealth(
  origin: string,
  child: LocalServerProcess,
  timeoutMs = 30_000,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`本地服务提前退出，退出码: ${child.exitCode}`);
    }
    if (await requestHealth(origin)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`等待本地服务健康检查超时: ${origin}`);
}

export async function startLocalServer(
  standaloneRoot: string,
  paths: DesktopPaths,
  log: (message: string) => void,
): Promise<LocalServerHandle> {
  const serverEntry = path.join(standaloneRoot, 'server.js');
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Next.js standalone 入口不存在: ${serverEntry}`);
  }

  const port = await getAvailablePort();
  const origin = `http://${LOCAL_HOST}:${port}`;
  const packagedModules = path.join(standaloneRoot, 'server_node_modules');
  const standaloneModules = fs.existsSync(packagedModules)
    ? packagedModules
    : path.join(standaloneRoot, 'node_modules');
  const nodePath = [standaloneModules, process.env.NODE_PATH]
    .filter(Boolean)
    .join(path.delimiter);
  const nextAuthSecret = process.env.NEXTAUTH_SECRET || randomBytes(32).toString('hex');
  const child = spawn(process.execPath, [serverEntry], {
    cwd: standaloneRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOSTNAME: LOCAL_HOST,
      HOST: LOCAL_HOST,
      PORT: String(port),
      NODE_PATH: nodePath,
      NEXTAUTH_URL: origin,
      NEXTAUTH_SECRET: nextAuthSecret,
      ANIMETRACK_RUNTIME: 'desktop',
      ANIMETRACK_DATA_DIR: paths.data,
      ANIMETRACK_BACKUPS_DIR: paths.backups,
      ANIMETRACK_COVERS_DIR: paths.covers,
      ANIMETRACK_SETTINGS_PATH: paths.settings,
      DB_PATH: paths.database,
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => log(`[next] ${String(chunk).trimEnd()}`));
  child.stderr.on('data', (chunk) => log(`[next:error] ${String(chunk).trimEnd()}`));
  child.once('error', (error) => log(`[next:error] ${error.message}`));
  child.once('exit', (code, signal) => {
    log(`[next] 服务退出 code=${String(code)} signal=${String(signal)}`);
  });

  try {
    await waitForHealth(origin, child);
  } catch (error) {
    child.kill();
    throw error;
  }

  log(`[next] 本地服务已就绪: ${origin}`);
  return {
    child,
    origin,
    stop: () => new Promise((resolve) => {
      if (child.exitCode !== null || child.killed) {
        resolve();
        return;
      }

      const forceTimer = setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
      }, 5_000);
      forceTimer.unref();
      child.once('exit', () => {
        clearTimeout(forceTimer);
        resolve();
      });
      child.kill();
    }),
  };
}

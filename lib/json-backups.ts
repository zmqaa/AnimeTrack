import 'server-only';

import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import type { ImportPayload } from './anime-import';
import { getDatabasePath, getJsonBackupsDirectory } from './runtime-paths';

const execFileAsync = promisify(execFile);
const DEFAULT_KEEP = 10;
const MAX_BACKUP_BYTES = 50 * 1024 * 1024;

export interface JsonBackupFileInfo {
  name: string;
  size: number;
  createdAt: string;
}

export class JsonBackupFileError extends Error {
  constructor(
    message: string,
    readonly apiCode: 'BAD_REQUEST' | 'NOT_FOUND' = 'BAD_REQUEST',
  ) {
    super(message);
    this.name = 'JsonBackupFileError';
  }
}

export function getJsonBackupRetention(): number {
  const configured = Number(process.env.ANIMETRACK_JSON_BACKUP_KEEP);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_KEEP;
}

function validateBackupName(name: unknown): string {
  if (typeof name !== 'string') {
    throw new JsonBackupFileError('缺少备份文件名');
  }
  const baseName = path.basename(name);
  if (
    baseName !== name
    || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/.test(baseName)
    || baseName.includes('..')
  ) {
    throw new JsonBackupFileError('无效的备份文件名');
  }
  return baseName;
}

function resolveBackupPath(name: unknown, requireExisting = true): { baseName: string; filePath: string } {
  const baseName = validateBackupName(name);
  const backupsDirectory = path.resolve(getJsonBackupsDirectory());
  const filePath = path.resolve(backupsDirectory, baseName);
  if (path.dirname(filePath) !== backupsDirectory) {
    throw new JsonBackupFileError('无效的备份文件路径');
  }
  if (requireExisting) {
    if (!fs.existsSync(filePath)) {
      throw new JsonBackupFileError('备份文件不存在', 'NOT_FOUND');
    }
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new JsonBackupFileError('备份文件无效', 'BAD_REQUEST');
    }
  }
  return { baseName, filePath };
}

function describeBackup(name: string): JsonBackupFileInfo {
  const { baseName, filePath } = resolveBackupPath(name);
  const stat = fs.statSync(filePath);
  return {
    name: baseName,
    size: stat.size,
    createdAt: stat.mtime.toISOString(),
  };
}

export function listJsonBackupFiles(): JsonBackupFileInfo[] {
  const backupsDirectory = getJsonBackupsDirectory();
  if (!fs.existsSync(backupsDirectory)) return [];

  return fs.readdirSync(backupsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.json'))
    .map((entry) => describeBackup(entry.name))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function createJsonBackup(keep = getJsonBackupRetention()): Promise<JsonBackupFileInfo> {
  const backupsDirectory = getJsonBackupsDirectory();
  const scriptPath = path.join(process.cwd(), 'scripts/db/scheduled_json_backup.js');
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    scriptPath,
    '--keep', String(keep),
    '--output-dir', backupsDirectory,
  ], {
    cwd: process.cwd(),
    timeout: 30000,
    encoding: 'utf8',
    env: {
      ...process.env,
      DB_PATH: getDatabasePath(),
      ANIMETRACK_JSON_BACKUPS_DIR: backupsDirectory,
    },
  });

  const output = `${stdout}\n${stderr}`;
  const match = output.match(/备份完成:\s*(.+\.json)(?:\r?\n|$)/);
  if (!match) throw new Error('JSON 备份脚本没有返回新文件名');
  return describeBackup(path.basename(match[1].trim()));
}

export function readJsonBackupFile(name: unknown): { name: string; payload: ImportPayload } {
  const { baseName, filePath } = resolveBackupPath(name);
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_BACKUP_BYTES) {
    throw new JsonBackupFileError('备份文件过大');
  }

  let payload: unknown;
  try {
    payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new JsonBackupFileError('备份文件不是有效的 JSON');
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new JsonBackupFileError('备份文件格式无效');
  }
  return { name: baseName, payload: payload as ImportPayload };
}

export function getJsonBackupDownload(name: unknown): { name: string; content: Buffer } {
  const { baseName, filePath } = resolveBackupPath(name);
  return { name: baseName, content: fs.readFileSync(filePath) };
}

export function deleteJsonBackupFile(name: unknown): string {
  const { baseName, filePath } = resolveBackupPath(name);
  fs.unlinkSync(filePath);
  return baseName;
}

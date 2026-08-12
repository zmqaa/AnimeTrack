import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  hardenRuntimePermissions,
  securePrivateFile,
} from '../../scripts/shared/private_files';

const temporaryDirectories: string[] = [];
const originalUmask = process.platform === 'win32' ? null : process.umask();
const describePosix = process.platform === 'win32' ? describe.skip : describe;

function modeOf(targetPath: string): number {
  return lstatSync(targetPath).mode & 0o777;
}

afterEach(() => {
  if (originalUmask !== null) process.umask(originalUmask);
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describePosix('private runtime files', () => {
  it('recursively hardens environment, database, and backup permissions', () => {
    const root = mkdtempSync(join(tmpdir(), 'animetrack-private-files-'));
    temporaryDirectories.push(root);

    const environmentFile = join(root, '.env.local');
    const dataDirectory = join(root, 'data');
    const databasePath = join(dataDirectory, 'animetrack.db');
    const backupsDirectory = join(root, 'backups');
    const nestedBackupsDirectory = join(backupsDirectory, 'json');
    const sqlBackup = join(backupsDirectory, 'backup.sql');
    const jsonBackup = join(nestedBackupsDirectory, 'backup.json');
    const symlinkTarget = join(root, 'outside.txt');
    const backupSymlink = join(backupsDirectory, 'linked.txt');

    mkdirSync(dataDirectory, { recursive: true });
    mkdirSync(nestedBackupsDirectory, { recursive: true });
    writeFileSync(environmentFile, 'NEXTAUTH_SECRET=test\n');
    writeFileSync(databasePath, 'database');
    writeFileSync(`${databasePath}-wal`, 'wal');
    writeFileSync(`${databasePath}-shm`, 'shm');
    writeFileSync(sqlBackup, 'backup');
    writeFileSync(jsonBackup, '{}');
    writeFileSync(symlinkTarget, 'outside');
    symlinkSync(symlinkTarget, backupSymlink);

    for (const directory of [dataDirectory, backupsDirectory, nestedBackupsDirectory]) {
      chmodSync(directory, 0o755);
    }
    for (const file of [
      environmentFile,
      databasePath,
      `${databasePath}-wal`,
      `${databasePath}-shm`,
      sqlBackup,
      jsonBackup,
      symlinkTarget,
    ]) {
      chmodSync(file, 0o644);
    }

    const report = hardenRuntimePermissions({
      environmentFiles: [environmentFile],
      dataDirectory,
      databasePath,
      backupDirectories: [backupsDirectory],
    });

    expect(modeOf(environmentFile)).toBe(0o600);
    expect(modeOf(dataDirectory)).toBe(0o700);
    expect(modeOf(databasePath)).toBe(0o600);
    expect(modeOf(`${databasePath}-wal`)).toBe(0o600);
    expect(modeOf(`${databasePath}-shm`)).toBe(0o600);
    expect(modeOf(backupsDirectory)).toBe(0o700);
    expect(modeOf(nestedBackupsDirectory)).toBe(0o700);
    expect(modeOf(sqlBackup)).toBe(0o600);
    expect(modeOf(jsonBackup)).toBe(0o600);
    expect(modeOf(symlinkTarget)).toBe(0o644);
    expect(report.filesChanged).toBe(6);
    expect(report.directoriesChanged).toBe(3);
    expect(report.skippedSymlinks).toBe(1);
  });

  it('also fixes the mode of an existing destination file', () => {
    const root = mkdtempSync(join(tmpdir(), 'animetrack-private-file-'));
    temporaryDirectories.push(root);
    const filePath = join(root, 'existing.sql');
    writeFileSync(filePath, 'first');
    chmodSync(filePath, 0o664);

    writeFileSync(filePath, 'replaced');
    securePrivateFile(filePath);

    expect(modeOf(filePath)).toBe(0o600);
  });
});

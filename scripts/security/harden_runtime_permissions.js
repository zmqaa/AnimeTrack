#!/usr/bin/env node

const path = require('path');
const { config: loadEnv } = require('dotenv');
const {
  getEnvironmentFilePaths,
  hardenRuntimePermissions,
  setPrivateUmask,
} = require('../shared/private_files');

setPrivateUmask();

const projectRoot = path.resolve(__dirname, '../..');
for (const fileName of ['.env.local', '.env']) {
  loadEnv({ path: path.join(projectRoot, fileName), override: false, quiet: true });
}

function resolveConfiguredPath(value, fallback) {
  const configured = String(value || '').trim();
  if (!configured) return path.resolve(fallback);
  return path.isAbsolute(configured)
    ? path.normalize(configured)
    : path.resolve(projectRoot, configured);
}

const dataDirectory = resolveConfiguredPath(
  process.env.ANIMETRACK_DATA_DIR,
  path.join(projectRoot, 'data'),
);
const databasePath = resolveConfiguredPath(
  process.env.DB_PATH,
  path.join(dataDirectory, 'animetrack.db'),
);
const backupsDirectory = resolveConfiguredPath(
  process.env.ANIMETRACK_BACKUPS_DIR,
  path.join(projectRoot, 'backups'),
);
const jsonBackupsDirectory = resolveConfiguredPath(
  process.env.ANIMETRACK_JSON_BACKUPS_DIR,
  path.join(backupsDirectory, 'json'),
);

try {
  const report = hardenRuntimePermissions({
    environmentFiles: getEnvironmentFilePaths(projectRoot),
    dataDirectory,
    databasePath,
    backupDirectories: [backupsDirectory, jsonBackupsDirectory],
  });
  console.log(
    `[security] 权限检查完成：收紧 ${report.filesChanged} 个文件、${report.directoriesChanged} 个目录`,
  );
  if (report.skippedSymlinks > 0) {
    console.warn(`[security] 跳过 ${report.skippedSymlinks} 个符号链接，请单独确认其目标权限`);
  }
} catch (error) {
  console.error('[security] 权限检查失败:', error instanceof Error ? error.message : error);
  process.exit(1);
}

const fs = require('fs');
const path = require('path');

const PRIVATE_FILE_MODE = 0o600;
const PRIVATE_DIRECTORY_MODE = 0o700;
const PRIVATE_UMASK = 0o077;

function supportsPosixPermissions() {
  return process.platform !== 'win32';
}

/**
 * 让当前 Node.js 进程之后创建的文件默认仅对当前系统账号可读写。
 * 返回旧 umask，方便测试或临时调用方恢复。
 */
function setPrivateUmask() {
  if (!supportsPosixPermissions()) return null;
  return process.umask(PRIVATE_UMASK);
}

function createReport() {
  return {
    filesChanged: 0,
    directoriesChanged: 0,
    skippedSymlinks: 0,
  };
}

function securePathMode(targetPath, expectedMode, type, report) {
  if (!supportsPosixPermissions() || !fs.existsSync(targetPath)) return report;

  const stat = fs.lstatSync(targetPath);
  if (stat.isSymbolicLink()) {
    report.skippedSymlinks += 1;
    return report;
  }

  const matchesType = type === 'directory' ? stat.isDirectory() : stat.isFile();
  if (!matchesType) {
    throw new Error(`无法保护非${type === 'directory' ? '目录' : '文件'}路径: ${targetPath}`);
  }

  if ((stat.mode & 0o777) !== expectedMode) {
    fs.chmodSync(targetPath, expectedMode);
    if (type === 'directory') report.directoriesChanged += 1;
    else report.filesChanged += 1;
  }
  return report;
}

function ensurePrivateDirectory(directoryPath, report = createReport()) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true, mode: PRIVATE_DIRECTORY_MODE });
  }
  return securePathMode(directoryPath, PRIVATE_DIRECTORY_MODE, 'directory', report);
}

function securePrivateFile(filePath, report = createReport()) {
  return securePathMode(filePath, PRIVATE_FILE_MODE, 'file', report);
}

function securePrivateTree(rootDirectory, report = createReport()) {
  if (!fs.existsSync(rootDirectory)) return report;

  const rootStat = fs.lstatSync(rootDirectory);
  if (rootStat.isSymbolicLink()) {
    report.skippedSymlinks += 1;
    return report;
  }
  if (!rootStat.isDirectory()) {
    throw new Error(`无法保护非目录路径: ${rootDirectory}`);
  }

  ensurePrivateDirectory(rootDirectory, report);
  for (const entry of fs.readdirSync(rootDirectory, { withFileTypes: true })) {
    const entryPath = path.join(rootDirectory, entry.name);
    if (entry.isSymbolicLink()) {
      report.skippedSymlinks += 1;
    } else if (entry.isDirectory()) {
      securePrivateTree(entryPath, report);
    } else if (entry.isFile()) {
      securePrivateFile(entryPath, report);
    }
  }
  return report;
}

function secureDatabaseFiles(databasePath, report = createReport()) {
  ensurePrivateDirectory(path.dirname(databasePath), report);
  for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
    securePrivateFile(filePath, report);
  }
  return report;
}

function getEnvironmentFilePaths(projectRoot) {
  return [
    '.env',
    '.env.local',
    '.env.production',
    '.env.production.local',
    '.env.development',
    '.env.development.local',
    '.env.test',
    '.env.test.local',
  ].map((fileName) => path.join(projectRoot, fileName));
}

/**
 * @param {{
 *   environmentFiles?: string[],
 *   dataDirectory?: string,
 *   databasePath?: string,
 *   backupDirectories?: string[],
 * }} options
 */
function hardenRuntimePermissions({
  environmentFiles = [],
  dataDirectory,
  databasePath,
  backupDirectories = [],
}) {
  setPrivateUmask();
  const report = createReport();

  for (const filePath of new Set(environmentFiles)) {
    securePrivateFile(filePath, report);
  }
  if (dataDirectory) {
    ensurePrivateDirectory(dataDirectory, report);
  }
  if (databasePath) {
    secureDatabaseFiles(databasePath, report);
  }
  for (const directoryPath of new Set(backupDirectories)) {
    securePrivateTree(directoryPath, report);
  }

  return report;
}

module.exports = {
  PRIVATE_DIRECTORY_MODE,
  PRIVATE_FILE_MODE,
  PRIVATE_UMASK,
  ensurePrivateDirectory,
  getEnvironmentFilePaths,
  hardenRuntimePermissions,
  secureDatabaseFiles,
  securePrivateFile,
  securePrivateTree,
  setPrivateUmask,
  supportsPosixPermissions,
};

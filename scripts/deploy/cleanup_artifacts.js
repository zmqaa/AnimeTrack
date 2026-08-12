#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DEFAULT_KEEP_RELEASES = 5;
const RELEASE_NAME_PATTERN = /^\d{14}-[0-9a-f]{7,40}(?:-dirty)?$/;
const BUILD_SOURCE_NAME_PATTERN = /^build-source-\d+$/;

function isDirectChild(parentPath, targetPath) {
  return path.dirname(path.resolve(targetPath)) === path.resolve(parentPath);
}

function readProtectedReleasePaths(deployRoot, releasesDirectory, skipped) {
  const protectedPaths = new Set();

  for (const linkName of ['current', 'previous']) {
    const linkPath = path.join(deployRoot, linkName);
    try {
      const resolvedPath = fs.realpathSync(linkPath);
      if (isDirectChild(releasesDirectory, resolvedPath)) {
        protectedPaths.add(resolvedPath);
      } else {
        skipped.push(`${linkName} 指向 releases 目录之外，未纳入自动处理`);
      }
    } catch (error) {
      if (error && error.code !== 'ENOENT') {
        skipped.push(`无法读取 ${linkName}: ${error.message}`);
      }
    }
  }

  const lastBuiltFile = path.join(deployRoot, 'last-built-release');
  if (fs.existsSync(lastBuiltFile)) {
    try {
      const configuredPath = fs.readFileSync(lastBuiltFile, 'utf8').trim();
      if (configuredPath) {
        const candidatePath = path.isAbsolute(configuredPath)
          ? path.resolve(configuredPath)
          : path.resolve(deployRoot, configuredPath);
        const resolvedPath = fs.realpathSync(candidatePath);
        if (isDirectChild(releasesDirectory, resolvedPath)) {
          protectedPaths.add(resolvedPath);
        } else {
          skipped.push('last-built-release 指向 releases 目录之外，未纳入自动处理');
        }
      }
    } catch (error) {
      skipped.push(`无法读取 last-built-release: ${error.message}`);
    }
  }

  return protectedPaths;
}

function readActiveBuildSource(deployRoot, skipped) {
  const lockFile = path.join(deployRoot, 'build.lock');
  if (!fs.existsSync(lockFile)) return null;

  try {
    const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
    const pid = Number(lock.pid);
    if (!Number.isInteger(pid) || pid <= 0) {
      skipped.push('build.lock 中的 pid 无效，所有构建源码目录均跳过清理');
      return 'unknown';
    }
    return path.join(deployRoot, `build-source-${pid}`);
  } catch (error) {
    skipped.push(`无法解析 build.lock，所有构建源码目录均跳过清理: ${error.message}`);
    return 'unknown';
  }
}

/**
 * @param {string} deployRoot
 * @param {number} keepReleases
 */
function collectCleanupPlan(deployRoot, keepReleases = DEFAULT_KEEP_RELEASES) {
  if (!Number.isInteger(keepReleases) || keepReleases < 2 || keepReleases > 50) {
    throw new Error('release 保留数量必须是 2 到 50 之间的整数');
  }

  const resolvedDeployRoot = path.resolve(deployRoot);
  const releasesDirectory = path.join(resolvedDeployRoot, 'releases');
  const skipped = [];
  const protectedReleasePaths = readProtectedReleasePaths(
    resolvedDeployRoot,
    releasesDirectory,
    skipped,
  );
  const releaseDirectories = [];

  if (fs.existsSync(releasesDirectory)) {
    for (const entry of fs.readdirSync(releasesDirectory, { withFileTypes: true })) {
      const entryPath = path.join(releasesDirectory, entry.name);
      if (!entry.isDirectory() || !RELEASE_NAME_PATTERN.test(entry.name)) {
        skipped.push(`跳过无法识别的 release 项: ${entry.name}`);
        continue;
      }
      releaseDirectories.push(entryPath);
    }
  }

  releaseDirectories.sort((left, right) => path.basename(right).localeCompare(path.basename(left)));
  for (const recentPath of releaseDirectories.slice(0, keepReleases)) {
    protectedReleasePaths.add(recentPath);
  }

  const removableReleases = releaseDirectories.filter(
    (releasePath) => !protectedReleasePaths.has(releasePath),
  );

  const activeBuildSource = readActiveBuildSource(resolvedDeployRoot, skipped);
  const removableBuildSources = [];
  if (fs.existsSync(resolvedDeployRoot)) {
    for (const entry of fs.readdirSync(resolvedDeployRoot, { withFileTypes: true })) {
      if (!entry.name.startsWith('build-source-')) continue;
      if (!entry.isDirectory() || !BUILD_SOURCE_NAME_PATTERN.test(entry.name)) {
        skipped.push(`跳过无法识别的构建源码项: ${entry.name}`);
        continue;
      }

      const entryPath = path.join(resolvedDeployRoot, entry.name);
      if (activeBuildSource === 'unknown') continue;
      if (entryPath !== activeBuildSource) removableBuildSources.push(entryPath);
    }
  }

  return {
    deployRoot: resolvedDeployRoot,
    releasesDirectory,
    keepReleases,
    protectedReleasePaths: [...protectedReleasePaths].sort(),
    removableReleases,
    removableBuildSources,
    skipped,
  };
}

function removeValidatedDirectory(targetPath, expectedParent, expectedPattern) {
  const resolvedTarget = path.resolve(targetPath);
  if (!isDirectChild(expectedParent, resolvedTarget)) {
    throw new Error(`拒绝删除父目录不匹配的路径: ${resolvedTarget}`);
  }
  if (!expectedPattern.test(path.basename(resolvedTarget))) {
    throw new Error(`拒绝删除名称无法识别的路径: ${resolvedTarget}`);
  }

  const stat = fs.lstatSync(resolvedTarget);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error(`拒绝删除非普通目录: ${resolvedTarget}`);
  }
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

/** @param {ReturnType<typeof collectCleanupPlan>} plan */
function applyCleanupPlan(plan) {
  for (const releasePath of plan.removableReleases) {
    removeValidatedDirectory(releasePath, plan.releasesDirectory, RELEASE_NAME_PATTERN);
  }
  for (const sourcePath of plan.removableBuildSources) {
    removeValidatedDirectory(sourcePath, plan.deployRoot, BUILD_SOURCE_NAME_PATTERN);
  }
}

/**
 * @param {string[]} argv
 * @param {Record<string, string | undefined>} env
 */
function parseArgs(argv, env = process.env) {
  let apply = false;
  let keepReleases = Number(env.DEPLOY_RELEASE_KEEP || DEFAULT_KEEP_RELEASES);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') {
      apply = true;
    } else if (argument === '--keep' && argv[index + 1]) {
      keepReleases = Number(argv[++index]);
    } else {
      throw new Error(`未知参数: ${argument}`);
    }
  }

  return { apply, keepReleases };
}

function main() {
  const workspaceRoot = path.resolve(__dirname, '../..');
  const deployRoot = path.join(workspaceRoot, '.deploy');
  const { apply, keepReleases } = parseArgs(process.argv.slice(2));
  const plan = collectCleanupPlan(deployRoot, keepReleases);

  console.log(
    `[deploy-cleanup] ${apply ? '准备清理' : '预览'}：${plan.removableReleases.length} 个旧 release，${plan.removableBuildSources.length} 个失败构建目录；保留最近 ${keepReleases} 个 release`,
  );
  if (plan.skipped.length > 0) {
    for (const message of plan.skipped) console.warn(`[deploy-cleanup] ${message}`);
  }

  if (!apply) {
    console.log('[deploy-cleanup] 当前为只读预览；确认后使用 --apply 执行');
    return;
  }

  applyCleanupPlan(plan);
  console.log(
    `[deploy-cleanup] 清理完成：删除 ${plan.removableReleases.length} 个旧 release，${plan.removableBuildSources.length} 个失败构建目录`,
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[deploy-cleanup] 清理失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  BUILD_SOURCE_NAME_PATTERN,
  DEFAULT_KEEP_RELEASES,
  RELEASE_NAME_PATTERN,
  applyCleanupPlan,
  collectCleanupPlan,
  parseArgs,
};

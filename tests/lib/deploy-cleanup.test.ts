import {
  existsSync,
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
  applyCleanupPlan,
  collectCleanupPlan,
  parseArgs,
} from '../../scripts/deploy/cleanup_artifacts';

const temporaryDirectories: string[] = [];
const describePosix = process.platform === 'win32' ? describe.skip : describe;

function createDeployFixture() {
  const root = mkdtempSync(join(tmpdir(), 'animetrack-deploy-cleanup-'));
  const deployRoot = join(root, '.deploy');
  const releasesDirectory = join(deployRoot, 'releases');
  temporaryDirectories.push(root);
  mkdirSync(releasesDirectory, { recursive: true });

  const releases = Array.from({ length: 6 }, (_, index) => {
    const name = `20260812080${index + 1}00-abcdef${index + 1}`;
    const releasePath = join(releasesDirectory, name);
    mkdirSync(releasePath);
    writeFileSync(join(releasePath, 'server.js'), 'server');
    return releasePath;
  });

  symlinkSync(releases[5], join(deployRoot, 'current'), 'dir');
  symlinkSync(releases[4], join(deployRoot, 'previous'), 'dir');
  writeFileSync(join(deployRoot, 'last-built-release'), `${releases[2]}\n`);

  const staleBuildSource = join(deployRoot, 'build-source-100');
  const activeBuildSource = join(deployRoot, 'build-source-200');
  mkdirSync(staleBuildSource);
  mkdirSync(activeBuildSource);
  writeFileSync(join(deployRoot, 'build.lock'), JSON.stringify({ pid: 200 }));

  const unknownRelease = join(releasesDirectory, 'manual-copy');
  const unknownBuildSource = join(deployRoot, 'build-source-manual');
  mkdirSync(unknownRelease);
  mkdirSync(unknownBuildSource);

  return {
    deployRoot,
    releases,
    staleBuildSource,
    activeBuildSource,
    unknownRelease,
    unknownBuildSource,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describePosix('deployment artifact cleanup', () => {
  it('protects current, previous, last-built, recent, and active build paths', () => {
    const fixture = createDeployFixture();

    const plan = collectCleanupPlan(fixture.deployRoot, 2);

    expect(plan.removableReleases).toEqual([
      fixture.releases[3],
      fixture.releases[1],
      fixture.releases[0],
    ]);
    expect(plan.removableBuildSources).toEqual([fixture.staleBuildSource]);
    expect(plan.protectedReleasePaths).toContain(fixture.releases[5]);
    expect(plan.protectedReleasePaths).toContain(fixture.releases[4]);
    expect(plan.protectedReleasePaths).toContain(fixture.releases[2]);
    expect(plan.skipped).toContain('跳过无法识别的 release 项: manual-copy');
    expect(plan.skipped).toContain('跳过无法识别的构建源码项: build-source-manual');
  });

  it('only deletes paths that were explicitly included in the validated plan', () => {
    const fixture = createDeployFixture();
    const plan = collectCleanupPlan(fixture.deployRoot, 2);

    applyCleanupPlan(plan);

    for (const removedPath of plan.removableReleases) {
      expect(existsSync(removedPath)).toBe(false);
    }
    expect(existsSync(fixture.staleBuildSource)).toBe(false);
    expect(existsSync(fixture.releases[5])).toBe(true);
    expect(existsSync(fixture.releases[4])).toBe(true);
    expect(existsSync(fixture.releases[2])).toBe(true);
    expect(existsSync(fixture.activeBuildSource)).toBe(true);
    expect(existsSync(fixture.unknownRelease)).toBe(true);
    expect(existsSync(fixture.unknownBuildSource)).toBe(true);
  });

  it('defaults to preview mode and validates the retention range', () => {
    expect(parseArgs([], {})).toEqual({ apply: false, keepReleases: 5 });
    expect(parseArgs(['--apply', '--keep', '8'], {})).toEqual({
      apply: true,
      keepReleases: 8,
    });
    expect(() => collectCleanupPlan('/tmp/not-used', 1)).toThrow(
      'release 保留数量必须是 2 到 50 之间的整数',
    );
  });

  it('treats a missing deployment directory as an empty cleanup plan', () => {
    const root = mkdtempSync(join(tmpdir(), 'animetrack-empty-cleanup-'));
    temporaryDirectories.push(root);

    const plan = collectCleanupPlan(join(root, '.deploy'), 5);

    expect(plan.removableReleases).toEqual([]);
    expect(plan.removableBuildSources).toEqual([]);
  });
});

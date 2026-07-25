import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let temporaryDirectory: string;
let routeModule: typeof import('../../app/api/local-covers/[file]/route');

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-cover-route-test-'));
  const coversDirectory = join(temporaryDirectory, 'covers');
  mkdirSync(coversDirectory);
  writeFileSync(join(coversDirectory, '1.jpg'), Buffer.from('test image data'));
  process.env.ANIMETRACK_COVERS_DIR = coversDirectory;

  routeModule = await import('../../app/api/local-covers/[file]/route');
});

afterAll(() => {
  if (temporaryDirectory) {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  delete process.env.ANIMETRACK_COVERS_DIR;
});

describe('local cover responses', () => {
  it('allows long immutable caching for a versioned cover URL', async () => {
    const response = await routeModule.GET(
      new Request('http://localhost/api/local-covers/1.jpg?v=mtime123'),
      { params: { file: '1.jpg' } },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control'))
      .toBe('public, max-age=31536000, immutable');
  });

  it('uses a short cache for an unversioned cover URL', async () => {
    const response = await routeModule.GET(
      new Request('http://localhost/api/local-covers/1.jpg'),
      { params: { file: '1.jpg' } },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control'))
      .toBe('public, max-age=60, must-revalidate');
  });

  it('still returns 404 when the cover file does not exist', async () => {
    const response = await routeModule.GET(
      new Request('http://localhost/api/local-covers/404.jpg?v=missing'),
      { params: { file: '404.jpg' } },
    );

    expect(response.status).toBe(404);
  });
});

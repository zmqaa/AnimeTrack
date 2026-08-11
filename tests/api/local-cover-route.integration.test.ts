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
  writeFileSync(join(coversDirectory, '1.thumb.webp'), Buffer.from('test thumbnail data'));
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
      { params: Promise.resolve({ file: '1.jpg' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control'))
      .toBe('public, max-age=31536000, immutable');
  });

  it('uses a short cache for an unversioned cover URL', async () => {
    const response = await routeModule.GET(
      new Request('http://localhost/api/local-covers/1.jpg'),
      { params: Promise.resolve({ file: '1.jpg' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control'))
      .toBe('public, max-age=60, must-revalidate');
  });

  it('serves generated WebP thumbnails with immutable caching', async () => {
    const response = await routeModule.GET(
      new Request('http://localhost/api/local-covers/1.thumb.webp?v=mtime456'),
      { params: Promise.resolve({ file: '1.thumb.webp' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control'))
      .toBe('public, max-age=31536000, immutable');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('test thumbnail data');
  });

  it('still returns 404 when the cover file does not exist', async () => {
    const response = await routeModule.GET(
      new Request('http://localhost/api/local-covers/404.jpg?v=missing'),
      { params: Promise.resolve({ file: '404.jpg' }) },
    );

    expect(response.status).toBe(404);
  });
});

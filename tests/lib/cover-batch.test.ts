import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  getRawDb: vi.fn(),
  downloadCoverImage: vi.fn(),
  downloadMangaCoverImage: vi.fn(),
  hasLocalCoverImage: vi.fn(),
  fetchAnimeCoverByQueries: vi.fn(),
  getMangaMetadataCandidate: vi.fn(),
}));

vi.mock('../../lib/db', () => ({ getRawDb: mocks.getRawDb }));
vi.mock('../../lib/cover-image', () => ({
  downloadCoverImage: mocks.downloadCoverImage,
  downloadMangaCoverImage: mocks.downloadMangaCoverImage,
  hasLocalCoverImage: mocks.hasLocalCoverImage,
  isRemoteUrl: (value: unknown) => typeof value === 'string' && /^https?:\/\//i.test(value),
}));
vi.mock('../../lib/anime-provider', () => ({ fetchAnimeCoverByQueries: mocks.fetchAnimeCoverByQueries }));
vi.mock('../../lib/manga-provider', () => ({ getMangaMetadataCandidate: mocks.getMangaMetadataCandidate }));

let coverBatchModule: typeof import('../../lib/cover-batch');

beforeAll(async () => {
  coverBatchModule = await import('../../lib/cover-batch');
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('batch cover caching', () => {
  it('skips existing anime files and downloads manga into its own namespace', async () => {
    const updateAnime = vi.fn();
    const updateManga = vi.fn();
    mocks.getRawDb.mockReturnValue({
      prepare: (sql: string) => {
        if (sql.includes('FROM anime')) {
          return { all: () => [{
            id: 1,
            title: '已有动漫封面',
            coverUrl: 'https://lain.bgm.tv/anime.jpg',
            localCoverUrl: '/api/local-covers/1.jpg',
          }] };
        }
        if (sql.includes('FROM manga')) {
          return { all: () => [{
            id: 7,
            bangumiId: 700,
            coverUrl: 'https://lain.bgm.tv/manga.jpg',
            localCoverUrl: null,
          }] };
        }
        if (sql.startsWith('UPDATE anime')) return { run: updateAnime };
        if (sql.startsWith('UPDATE manga')) return { run: updateManga };
        throw new Error(`unexpected SQL: ${sql}`);
      },
    });
    mocks.hasLocalCoverImage.mockImplementation((value) => Boolean(value));
    mocks.downloadMangaCoverImage.mockResolvedValue('/api/local-covers/manga-7.jpg');

    const result = await coverBatchModule.downloadAllRemoteCovers(1);

    expect(result).toEqual({
      total: 2,
      downloaded: 1,
      skipped: 1,
      failed: 0,
      anime: { total: 1, downloaded: 0, skipped: 1, failed: 0 },
      manga: { total: 1, downloaded: 1, skipped: 0, failed: 0 },
    });
    expect(mocks.downloadCoverImage).not.toHaveBeenCalled();
    expect(mocks.downloadMangaCoverImage).toHaveBeenCalledWith('https://lain.bgm.tv/manga.jpg', 7);
    expect(updateAnime).not.toHaveBeenCalled();
    expect(updateManga).toHaveBeenCalledWith(
      'https://lain.bgm.tv/manga.jpg',
      '/api/local-covers/manga-7.jpg',
      expect.any(String),
      7,
    );
  });
});

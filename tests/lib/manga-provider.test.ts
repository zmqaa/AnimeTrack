import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getMangaMetadataCandidate } from '../../lib/manga-provider';

describe('漫画资料刷新', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('按 Bangumi ID 读取并整理最新公开资料', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 300763,
        name: '原名',
        name_cn: '中文名',
        date: '2020-01-01',
        volumes: 13,
        eps: 188,
        summary: '简介',
        images: { large: 'https://example.com/cover.jpg' },
        tags: [{ name: '百合', count: 20 }],
        infobox: [
          { key: '作者', value: '作者甲' },
          { key: '出版社', value: '出版社乙' },
          { key: '结束', value: '2025-12-31' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMangaMetadataCandidate(300763)).resolves.toMatchObject({
      id: 300763,
      title: '中文名',
      originalTitle: '原名',
      authors: ['作者甲'],
      publishers: ['出版社乙'],
      volumeCount: 13,
      chapterCount: 188,
      isFinished: true,
      tags: ['百合'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.bgm.tv/v0/subjects/300763',
      expect.objectContaining({ headers: { 'User-Agent': expect.any(String) } }),
    );
  });
});

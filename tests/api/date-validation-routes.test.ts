import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getServerSession = vi.fn();
const getAnimeRecord = vi.fn();
const updateAnimeRecordWithHistory = vi.fn();
const getMangaRecord = vi.fn();
const updateMangaRecord = vi.fn();
const updateWatchHistoryTime = vi.fn();

vi.mock('next-auth/next', () => ({ getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/anime', () => ({
  adjustAnimeProgressWithHistory: vi.fn(),
  deleteAnimeRecord: vi.fn(),
  getAnimeRecord,
  parseAnimeId: (value: string) => Number(value) || null,
  updateAnimeRecordWithHistory,
}));
vi.mock('@/lib/ai', () => ({ buildVoiceActorAliases: vi.fn() }));
vi.mock('@/lib/cover-image', () => ({ resolveLocalCoverImage: vi.fn() }));
vi.mock('@/lib/anime-notes', () => ({ listAnimeNotes: vi.fn(() => []) }));
vi.mock('@/lib/manga', () => ({
  deleteMangaRecord: vi.fn(),
  getMangaRecord,
  parseMangaId: (value: string) => Number(value) || null,
  updateMangaRecord,
}));
vi.mock('@/lib/history', () => ({
  deleteWatchHistoryById: vi.fn(),
  updateWatchHistoryTime,
}));
vi.mock('@/lib/db', () => ({ getRawDb: vi.fn() }));
vi.mock('@/lib/anime-start-date', () => ({ syncAnimeStartDateFromHistory: vi.fn() }));

let animeRoute: typeof import('../../app/api/anime/[id]/route');
let mangaRoute: typeof import('../../app/api/manga/[id]/route');
let historyRoute: typeof import('../../app/api/admin/history/[id]/route');

beforeAll(async () => {
  animeRoute = await import('../../app/api/anime/[id]/route');
  mangaRoute = await import('../../app/api/manga/[id]/route');
  historyRoute = await import('../../app/api/admin/history/[id]/route');
});

beforeEach(() => {
  getServerSession.mockReset();
  getAnimeRecord.mockReset();
  updateAnimeRecordWithHistory.mockReset();
  getMangaRecord.mockReset();
  updateMangaRecord.mockReset();
  updateWatchHistoryTime.mockReset();
  getServerSession.mockResolvedValue({
    user: { id: '1', role: 'admin', accountValid: true },
  });
});

function patchRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/test', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('date validation in update routes', () => {
  it('checks an anime end date against the stored start date', async () => {
    getAnimeRecord.mockResolvedValue({
      id: 1,
      title: '日期测试番剧',
      status: 'watching',
      progress: 1,
      tags: [],
      cast: [],
      castAliases: [],
      startDate: '2026-08-10',
    });

    const response = await animeRoute.PATCH(
      patchRequest({ endDate: '2026-08-09' }),
      { params: Promise.resolve({ id: '1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '看完日期不能早于开始观看日期' });
    expect(updateAnimeRecordWithHistory).not.toHaveBeenCalled();
  });

  it('checks a manga end date against the stored start date', async () => {
    getMangaRecord.mockResolvedValue({
      id: 1,
      title: '日期测试漫画',
      status: 'reading',
      publicationStatus: 'ongoing',
      aliases: [],
      tags: [],
      authors: [],
      illustrators: [],
      publishers: [],
      serializations: [],
      startDate: '2026-08-10',
    });

    const response = await mangaRoute.PATCH(
      patchRequest({ endDate: '2026-08-09' }),
      { params: Promise.resolve({ id: '1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '读完日期不能早于开始阅读日期' });
    expect(updateMangaRecord).not.toHaveBeenCalled();
  });

  it('rejects an impossible calendar day in a history timestamp', async () => {
    const response = await historyRoute.PATCH(
      patchRequest({ watchedAt: '2026-02-31T12:00:00.000Z' }),
      { params: Promise.resolve({ id: '1' }) },
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: '观看时间格式无效' });
    expect(updateWatchHistoryTime).not.toHaveBeenCalled();
  });
});

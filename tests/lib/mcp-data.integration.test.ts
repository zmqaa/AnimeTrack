import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let temporaryDirectory: string;
let dbModule: typeof import('../../lib/db');
let animeModule: typeof import('../../lib/anime');
let mangaModule: typeof import('../../lib/manga');
let historyModule: typeof import('../../lib/history');
let notesModule: typeof import('../../lib/anime-notes');
let mcpDataModule: typeof import('../../lib/mcp-data');

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-mcp-data-test-'));
  process.env.DB_PATH = join(temporaryDirectory, 'animetrack.db');
  process.env.ANIMETRACK_BACKUPS_DIR = join(temporaryDirectory, 'backups');
  process.env.ANIMETRACK_COVERS_DIR = join(temporaryDirectory, 'covers');
  process.env.MCP_PUBLIC_BASE_URL = 'https://anime.example.com';

  dbModule = await import('../../lib/db');
  animeModule = await import('../../lib/anime');
  mangaModule = await import('../../lib/manga');
  historyModule = await import('../../lib/history');
  notesModule = await import('../../lib/anime-notes');
  mcpDataModule = await import('../../lib/mcp-data');
  dbModule.getRawDb();
});

beforeEach(async () => {
  dbModule.getRawDb().exec('DELETE FROM watch_history; DELETE FROM anime_notes; DELETE FROM anime; DELETE FROM manga;');
  const anime = await animeModule.createAnimeRecord({
    title: 'MCP 测试番剧',
    originalTitle: 'MCP Test Anime',
    status: 'watching',
    progress: 2,
    totalEpisodes: 12,
    summary: '用于验证远程只读查询。',
    tags: ['测试'],
    cast: ['测试声优'],
  });
  await historyModule.addWatchHistory(anime.id, anime.title, 1, new Date('2026-09-01T12:00:00.000Z'));
  await historyModule.addWatchHistory(anime.id, anime.title, 2, new Date('2026-09-02T12:00:00.000Z'));
  notesModule.createEpisodeNote(anime.id, {
    episode: 2,
    content: '这一集值得记录',
    notedAt: '2026-09-02',
  });
  await mangaModule.createMangaRecord({
    title: 'MCP 测试漫画',
    aliases: ['测试漫画别名'],
    status: 'reading',
    publicationStatus: 'ongoing',
    tags: ['测试'],
    authors: ['测试作者'],
    illustrators: [],
    publishers: [],
    serializations: [],
  });
});

afterAll(() => {
  dbModule?.closeDb();
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.DB_PATH;
  delete process.env.ANIMETRACK_BACKUPS_DIR;
  delete process.env.ANIMETRACK_COVERS_DIR;
  delete process.env.MCP_PUBLIC_BASE_URL;
});

describe('MCP read-only data adapters', () => {
  it('returns paginated anime, manga, notes, history, and timeline data', async () => {
    const anime = await mcpDataModule.searchAnimeData({ query: 'MCP 测试', pageSize: 10 });
    expect(anime.total).toBe(1);
    expect(anime.records[0]).toMatchObject({ title: 'MCP 测试番剧' });

    const manga = await mcpDataModule.searchMangaData({ query: 'MCP 测试', pageSize: 10 });
    expect(manga.total).toBe(1);
    expect(manga.records[0]).toMatchObject({ title: 'MCP 测试漫画' });

    const notes = await mcpDataModule.searchNotesData({ query: '值得记录' });
    expect(notes.total).toBe(1);
    expect(notes.records[0]).toMatchObject({ content: '这一集值得记录', anime: { title: 'MCP 测试番剧' } });

    const history = await mcpDataModule.getWatchHistoryData({ pageSize: 10 });
    expect(history.total).toBe(2);
    expect(history.records[0]).toMatchObject({ animeTitle: 'MCP 测试番剧', episode: 2 });

    const timeline = await mcpDataModule.getTimelineData({ pageSize: 10 });
    expect(timeline.total).toBe(2);
    expect(timeline.records[0].history).toMatchObject({ episode: 2 });
  });

  it('supports standard search/fetch IDs and returns absolute citation URLs', async () => {
    const search = await mcpDataModule.searchMcpDocuments('值得记录');
    expect(search).toEqual([
      expect.objectContaining({
        id: expect.stringMatching(/^note:\d+$/),
        url: expect.stringMatching(/^https:\/\/anime\.example\.com\/anime\/\d+$/),
      }),
    ]);

    const fetched = await mcpDataModule.fetchMcpDocument(search[0].id);
    expect(fetched).toMatchObject({
      id: search[0].id,
      title: 'MCP 测试番剧 第2集笔记',
      url: search[0].url,
    });
    expect(fetched?.text).toContain('这一集值得记录');
  });
});

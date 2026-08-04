import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

let temporaryDirectory: string;
let mangaModule: typeof import('../../lib/manga');
let dbModule: typeof import('../../lib/db');

beforeAll(async () => {
  temporaryDirectory = mkdtempSync(join(tmpdir(), 'animetrack-manga-test-'));
  process.env.DB_PATH = join(temporaryDirectory, 'animetrack.db');
  process.env.ANIMETRACK_BACKUPS_DIR = join(temporaryDirectory, 'backups');
  mangaModule = await import('../../lib/manga');
  dbModule = await import('../../lib/db');
  dbModule.getRawDb();
});

afterAll(() => {
  dbModule?.closeDb();
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  delete process.env.DB_PATH;
  delete process.env.ANIMETRACK_BACKUPS_DIR;
});

describe('漫画书架数据', () => {
  it('创建、查询、修改和删除漫画时不产生阅读历史', async () => {
    const created = await mangaModule.createMangaRecord({
      bangumiId: 300763,
      title: '失声少女心想「她太过温柔」',
      originalTitle: '声がだせない少女は「彼女が優しすぎる」と思っている',
      aliases: ['失语少女的女友温柔过了头'],
      status: 'reading',
      publicationStatus: 'completed',
      currentChapter: '42.5',
      totalVolumes: 13,
      totalChapters: 188,
      tags: ['百合'],
      authors: ['矢村いち'],
      illustrators: [],
      publishers: ['秋田書店'],
      serializations: ['週刊少年チャンピオン'],
    });

    expect(created).toMatchObject({
      bangumiId: 300763,
      currentChapter: '42.5',
      authors: ['矢村いち'],
    });
    expect(await mangaModule.listMangaRecords({ search: '失语少女' })).toHaveLength(1);

    const updated = await mangaModule.updateMangaRecord(created.id, {
      status: 'caught_up',
      currentChapter: '番外 3',
    });
    expect(updated).toMatchObject({ status: 'caught_up', currentChapter: '番外 3' });
    expect((dbModule.getRawDb().prepare('SELECT COUNT(*) AS count FROM watch_history').get() as { count: number }).count).toBe(0);

    await expect(mangaModule.deleteMangaRecord(created.id)).resolves.toBe(true);
    await expect(mangaModule.getMangaRecord(created.id)).resolves.toBeNull();
  });
});


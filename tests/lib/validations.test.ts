import { describe, expect, it } from 'vitest';

import {
  animeNoteBodySchema,
  createAnimeSchema,
  createMangaSchema,
  patchAnimeBodySchema,
  updateMangaSchema,
  updateAnimeSchema,
} from '../../lib/validations';

describe('anime request validation', () => {
  it('keeps create defaults for status and progress', () => {
    const result = createAnimeSchema.parse({ title: '测试番剧' });

    expect(result.status).toBe('plan_to_watch');
    expect(result.progress).toBe(0);
  });

  it('does not inject create defaults into an update request', () => {
    expect(updateAnimeSchema.parse({})).toEqual({});
  });

  it('accepts a standalone progress delta request', () => {
    const result = patchAnimeBodySchema.safeParse({
      progressDelta: 1,
      recordHistory: true,
      trimHistoryOnProgressDecrease: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        progressDelta: 1,
        recordHistory: true,
        trimHistoryOnProgressDecrease: true,
      });
    }
  });

  it('rejects progress and progressDelta when explicitly submitted together', () => {
    const result = patchAnimeBodySchema.safeParse({
      progress: 2,
      progressDelta: 1,
    });

    expect(result.success).toBe(false);
  });

  it('only accepts HTTP(S) or managed local cover addresses', () => {
    expect(createAnimeSchema.safeParse({
      title: '公网封面',
      coverUrl: 'https://lain.bgm.tv/pic/cover.jpg',
    }).success).toBe(true);
    expect(createAnimeSchema.safeParse({
      title: '本地封面',
      coverUrl: '/api/local-covers/1.jpg',
    }).success).toBe(true);
    expect(createAnimeSchema.safeParse({
      title: '不支持的协议',
      coverUrl: 'file:///etc/passwd',
    }).success).toBe(false);
  });

  it('accepts real leap days and rejects impossible calendar dates', () => {
    expect(createAnimeSchema.safeParse({
      title: '闰年作品',
      premiereDate: '2024-02-29',
    }).success).toBe(true);
    expect(createAnimeSchema.safeParse({
      title: '错误日期作品',
      premiereDate: '2026-02-29',
    }).success).toBe(false);
    expect(createMangaSchema.safeParse({
      title: '错误日期漫画',
      releaseDate: '2026-04-31',
    }).success).toBe(false);
    expect(animeNoteBodySchema.safeParse({
      episode: 1,
      content: '日期错误',
      notedAt: '2026-13-01',
    }).success).toBe(false);
  });

  it('rejects personal end dates earlier than start dates', () => {
    const anime = createAnimeSchema.safeParse({
      title: '顺序错误番剧',
      startDate: '2026-08-10',
      endDate: '2026-08-09',
    });
    const manga = createMangaSchema.safeParse({
      title: '顺序错误漫画',
      startDate: '2026-08-10',
      endDate: '2026-08-09',
    });

    expect(anime.success).toBe(false);
    expect(anime.success ? '' : anime.error.issues[0]?.message).toBe('看完日期不能早于开始观看日期');
    expect(manga.success).toBe(false);
    expect(manga.success ? '' : manga.error.issues[0]?.message).toBe('读完日期不能早于开始阅读日期');
    expect(patchAnimeBodySchema.safeParse({
      startDate: '2026-08-10',
      endDate: '2026-08-09',
    }).success).toBe(false);
  });

  it('allows premiere and release metadata to differ from personal activity dates', () => {
    expect(createAnimeSchema.safeParse({
      title: '提前点映',
      startDate: '2026-08-01',
      premiereDate: '2026-08-10',
    }).success).toBe(true);
    expect(createMangaSchema.safeParse({
      title: '连载与单行本',
      startDate: '2026-08-01',
      releaseDate: '2026-08-10',
    }).success).toBe(true);
  });

  it('keeps a one-field update valid so routes can merge it with existing dates', () => {
    expect(updateAnimeSchema.safeParse({ endDate: '2026-08-10' }).success).toBe(true);
    expect(updateMangaSchema.safeParse({ endDate: '2026-08-10' }).success).toBe(true);
  });
});

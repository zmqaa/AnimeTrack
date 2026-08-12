import { describe, expect, it } from 'vitest';

import {
  createAnimeSchema,
  patchAnimeBodySchema,
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
});

import { describe, expect, it } from 'vitest';

import { buildMangaStatusDatePatch } from '../../lib/manga-status';

describe('漫画阅读状态日期维护', () => {
  it('首次开始阅读时自动记录开始日期', () => {
    expect(buildMangaStatusDatePatch(
      { status: 'plan_to_read' },
      { status: 'reading' },
      '2026-08-11',
    )).toEqual({ startDate: '2026-08-11' });
  });

  it('详情页提交空日期时仍会为已读完状态补齐日期', () => {
    expect(buildMangaStatusDatePatch(
      { status: 'plan_to_read' },
      { status: 'completed', startDate: null, endDate: null },
      '2026-08-11',
    )).toEqual({ startDate: '2026-08-11', endDate: '2026-08-11' });
  });

  it('通过快捷更新从已读完退回阅读中时清除读完日期', () => {
    expect(buildMangaStatusDatePatch(
      { status: 'completed', startDate: '2026-08-01', endDate: '2026-08-10' },
      { status: 'reading' },
      '2026-08-11',
    )).toEqual({ endDate: null });
  });
});

"use client";

import { fetchJson } from '@/lib/client-api';

// ─────────────────────────────────────────────
// 全局 fetcher — 所有 useSWR 共用
// ─────────────────────────────────────────────

export async function swrFetcher<T = unknown>(url: string): Promise<T> {
  return fetchJson<T>(url, { cache: 'no-store' }, '请求失败');
}

/** 构建 URL query string，自动跳过空值 */
function buildQuery(params: Record<string, string | number>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '' && v !== 'all') {
      sp.set(k, String(v));
    }
  }
  return sp.toString();
}

// ─────────────────────────────────────────────
// 全局 SWR key 常量 — 统一管理，替代魔法字符串
// ─────────────────────────────────────────────

/** 全量番剧列表（侧边栏统计 + 客户端筛选降级） */
export const ANIME_LIST_KEY = '/api/anime';

/** 番剧列表轻量概览（统计、标签、声优建议、最近观看） */
export const ANIME_OVERVIEW_KEY = '/api/anime/overview';

/** 番剧分页列表 */
export function animePageKey(params: Record<string, string | number>): string {
  const qs = buildQuery(params);
  return qs ? `/api/anime?${qs}` : '/api/anime?page=1&pageSize=12';
}

/** 单个番剧详情 */
export function animeDetailKey(id: number | string): string {
  return `/api/anime/${id}`;
}

/** Dashboard 近期观看历史，避免总览随数据增长而加载全部明细。 */
export const DASHBOARD_HISTORY_KEY = '/api/history?days=370&limit=800';

/** 时间线使用完整观看历史。 */
export const TIMELINE_HISTORY_KEY = '/api/history?scope=all';

export function isHistoryKey(key: unknown): boolean {
  return typeof key === 'string' && key.startsWith('/api/history');
}

/** 管理页番剧列表 */
export function adminAnimeKey(params: Record<string, string | number>): string {
  const qs = buildQuery(params);
  return `/api/admin/anime?${qs}`;
}

/** 管理页观看历史 */
export function adminHistoryKey(params: Record<string, string | number>): string {
  const qs = buildQuery(params);
  return `/api/admin/history?${qs}`;
}

/** 管理页备份列表 */
export const BACKUP_LIST_KEY = '/api/admin/backup';

"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchJson } from '@/lib/client-api';
import { readSessionCache, writeSessionCache } from '@/lib/hooks-shared';

interface UseCachedFetchOptions<T> {
  /** sessionStorage 缓存键 */
  cacheKey: string;
  /** API 路径 */
  url: string;
  /** 请求失败时的错误消息 */
  errorMessage?: string;
  /** 对 API 返回数据的转换（可选），输入为 fetchJson 的原始返回值 */
  transform?: (data: unknown) => T;
}

interface UseCachedFetchResult<T> {
  data: T;
  setData: (value: T) => void;
  isLoading: boolean;
  isRefreshing: boolean;
  /** 手动刷新（跳过缓存） */
  refresh: () => Promise<void>;
}

export function useCachedFetch<T>(options: UseCachedFetchOptions<T>): UseCachedFetchResult<T> {
  const { cacheKey, url, errorMessage = '加载数据失败', transform } = options;

  // 用 ref 持有 transform，避免内联函数导致 useCallback 依赖漂移
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const [data, setData] = useState<T>(() => {
    const cached = readSessionCache<T>(cacheKey);
    return (cached ?? []) as T;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async (skipCache = false) => {
    if (!skipCache) {
      const cached = readSessionCache<T>(cacheKey);
      if (cached) {
        setData(cached);
        setIsLoading(false);
        return;
      }
    }

    setIsRefreshing(true);
    try {
      const raw = await fetchJson<unknown>(url, undefined, errorMessage);
      const result = transformRef.current ? transformRef.current(raw) : (raw as T);
      setData(result);
      writeSessionCache(cacheKey, result);
    } catch (err) {
      console.error(`Failed to fetch ${url}`, err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, url, errorMessage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    setData,
    isLoading,
    isRefreshing,
    refresh: () => fetchData(true),
  };
}

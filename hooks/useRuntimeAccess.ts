"use client";

import { useSession } from 'next-auth/react';
import useSWR from 'swr';

import type { SessionUser } from '@/lib/anime-shared';
import { swrFetcher } from '@/lib/swr-config';

export type RuntimeInfo = {
  mode: 'web' | 'desktop';
  canManage: boolean;
  authenticationRequired: boolean;
};

const RUNTIME_INFO_KEY = '/api/runtime';

export function useRuntimeAccess() {
  const { data: session, status: sessionStatus } = useSession();
  const { data, error, isLoading } = useSWR<RuntimeInfo>(
    RUNTIME_INFO_KEY,
    swrFetcher,
    { revalidateOnFocus: false },
  );
  const isSessionAdmin = (session?.user as SessionUser | undefined)?.role === 'admin';
  const isDesktop = data?.mode === 'desktop';

  return {
    runtime: data,
    isDesktop,
    canManage: Boolean(isDesktop || isSessionAdmin || data?.canManage),
    isLoading: isLoading || (sessionStatus === 'loading' && !isDesktop),
    error,
  };
}


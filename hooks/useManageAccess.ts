"use client";

import { useSession } from 'next-auth/react';

import type { SessionUser } from '@/lib/anime-shared';

export function useManageAccess() {
  const { data: session, status } = useSession();
  const canManage = (session?.user as SessionUser | undefined)?.role === 'admin';

  return {
    canManage,
    isLoading: status === 'loading',
  };
}

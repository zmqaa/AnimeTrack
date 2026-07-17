import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { SessionUser } from '@/lib/anime-shared';
import { isDesktopRuntime } from '@/lib/runtime-mode';

export function apiSuccess<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers });
}

export function apiError(message: string, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

export async function requireManagePermission(message = '只有管理员可以执行此操作') {
  if (isDesktopRuntime()) {
    return { authorized: true as const, source: 'desktop' as const };
  }

  const session = await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;
  if (role !== 'admin') {
    return { authorized: false as const, response: apiError(message, 403) };
  }
  return { authorized: true as const, source: 'admin-session' as const, session };
}

/**
 * Backward-compatible name while routes migrate to capability-based wording.
 * Desktop runtime is trusted because its server only binds to the local machine.
 */
export async function requireAdmin(message = '只有管理员可以执行此操作') {
  return requireManagePermission(message);
}

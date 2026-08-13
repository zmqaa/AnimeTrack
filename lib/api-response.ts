import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { SessionUser } from '@/lib/anime-shared';

export function apiSuccess<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers });
}

export function apiError(message: string, status = 500, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra || {}) }, { status });
}

type ApiLogContextValue = string | number | boolean | null | undefined;

export type ApiInternalErrorOptions = {
  operation: string;
  message: string;
  status?: number;
  context?: Record<string, ApiLogContextValue>;
};

/**
 * 记录仅供服务器排查的完整异常。context 只接受简单值，调用方不得放入请求体、
 * 密钥、文件内容等敏感数据。
 */
export function logApiInternalError(
  error: unknown,
  operation: string,
  context?: Record<string, ApiLogContextValue>,
) {
  console.error(`[api] ${operation}失败`, context || {}, error);
}

/** 将内部异常留在服务器日志中，只向浏览器返回稳定、可安全展示的提示。 */
export function apiInternalError(error: unknown, options: ApiInternalErrorOptions) {
  logApiInternalError(error, options.operation, options.context);
  return apiError(options.message, options.status ?? 500);
}

export async function requireAdmin(message = '只有管理员可以执行此操作') {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (user?.accountValid !== true || user.role !== 'admin') {
    return { authorized: false as const, response: apiError(message, 403) };
  }
  return { authorized: true as const, source: 'admin-session' as const, session };
}

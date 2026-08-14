import 'server-only';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import type { SessionUser } from '@/lib/anime-shared';
import {
  API_ERROR_STATUS,
  ApiRouteError,
  type ApiErrorCode,
  type ApiServerErrorCode,
} from '@/lib/api-errors';

export function apiSuccess<T>(data: T, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers });
}

export function apiError(
  message: string,
  code: ApiErrorCode,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { ...(extra || {}), error: message, code },
    { status: API_ERROR_STATUS[code], headers },
  );
}

type ApiLogContextValue = string | number | boolean | null | undefined;

export type ApiInternalErrorOptions = {
  operation: string;
  message: string;
  code?: ApiServerErrorCode;
  context?: Record<string, ApiLogContextValue>;
  extra?: Record<string, unknown>;
  headers?: Record<string, string>;
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
  return apiError(
    options.message,
    options.code ?? 'INTERNAL_ERROR',
    options.extra,
    options.headers,
  );
}

export async function requireAdmin(message = '只有管理员可以执行此操作') {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as SessionUser | undefined;
    if (!user) {
      return {
        authorized: false as const,
        response: apiError('请先登录管理员账号', 'UNAUTHENTICATED'),
      };
    }
    if (user.accountValid !== true) {
      return {
        authorized: false as const,
        response: apiError('登录状态已失效，请重新登录', 'UNAUTHENTICATED'),
      };
    }
    if (user.role !== 'admin') {
      return { authorized: false as const, response: apiError(message, 'FORBIDDEN') };
    }
    return { authorized: true as const, source: 'admin-session' as const, session };
  } catch (error) {
    return {
      authorized: false as const,
      response: apiInternalError(error, {
        operation: '校验管理员权限',
        message: '暂时无法校验登录状态，请稍后重试',
      }),
    };
  }
}

export function apiExceptionResponse(error: unknown, options: ApiInternalErrorOptions) {
  if (error instanceof ApiRouteError) {
    if (error.status >= 500) {
      logApiInternalError(error, options.operation, options.context);
    }
    return apiError(error.message, error.code, error.details);
  }
  return apiInternalError(error, options);
}

export async function readApiJson<T>(request: Request, message = '请求内容不是有效的 JSON'): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new ApiRouteError('BAD_REQUEST', message);
  }
}

type ApiHandler<Arguments extends unknown[]> = (...args: Arguments) => Response | Promise<Response>;

/** 为路由补上统一异常边界；预期错误按错误码映射，其余异常安全收敛为服务器错误。 */
export function withApiErrorBoundary<Arguments extends unknown[]>(
  options: ApiInternalErrorOptions,
  handler: ApiHandler<Arguments>,
): ApiHandler<Arguments> {
  return async (...args: Arguments) => {
    try {
      return await handler(...args);
    } catch (error) {
      return apiExceptionResponse(error, options);
    }
  };
}

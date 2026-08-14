import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getServerSession = vi.fn();
vi.mock('next-auth/next', () => ({ getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

let apiError: typeof import('../../lib/api-response').apiError;
let apiInternalError: typeof import('../../lib/api-response').apiInternalError;
let apiSuccess: typeof import('../../lib/api-response').apiSuccess;
let readApiJson: typeof import('../../lib/api-response').readApiJson;
let requireAdmin: typeof import('../../lib/api-response').requireAdmin;
let withApiErrorBoundary: typeof import('../../lib/api-response').withApiErrorBoundary;

beforeAll(async () => {
  ({
    apiError,
    apiInternalError,
    apiSuccess,
    readApiJson,
    requireAdmin,
    withApiErrorBoundary,
  } = await import('../../lib/api-response'));
});

beforeEach(() => {
  getServerSession.mockReset();
});

describe('admin API authorization', () => {
  it('accepts a currently valid administrator session', async () => {
    getServerSession.mockResolvedValue({
      user: { id: '7', role: 'admin', accountValid: true },
    });

    const result = await requireAdmin();

    expect(result.authorized).toBe(true);
  });

  it.each([
    ['missing session', null, '请先登录管理员账号'],
    ['legacy token', { user: { id: '7', role: 'admin' } }, '登录状态已失效，请重新登录'],
    ['invalidated token', { user: { id: '7', role: 'admin', accountValid: false } }, '登录状态已失效，请重新登录'],
  ])('returns 401 for %s', async (_label, session, message) => {
    getServerSession.mockResolvedValue(session);

    const result = await requireAdmin();

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
      expect(await result.response.json()).toEqual({ error: message, code: 'UNAUTHENTICATED' });
    }
  });

  it('returns 403 for a valid non-admin account', async () => {
    getServerSession.mockResolvedValue({
      user: { id: '7', role: 'user', accountValid: true },
    });

    const result = await requireAdmin('只有管理员可以删除记录');

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(403);
      expect(await result.response.json()).toEqual({
        error: '只有管理员可以删除记录',
        code: 'FORBIDDEN',
      });
    }
  });

  it('returns a logged 500 when session validation itself fails', async () => {
    const error = new Error('session store unavailable');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getServerSession.mockRejectedValue(error);

    const result = await requireAdmin();

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(500);
      expect(await result.response.json()).toEqual({
        error: '暂时无法校验登录状态，请稍后重试',
        code: 'INTERNAL_ERROR',
      });
    }
    expect(log).toHaveBeenCalledWith('[api] 校验管理员权限失败', {}, error);
    log.mockRestore();
  });
});

describe('API route error boundary', () => {
  it('maps malformed JSON to a stable 400 response without logging an internal error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = withApiErrorBoundary({
      operation: '解析测试请求',
      message: '测试请求失败',
    }, async (request: Request) => {
      await readApiJson(request);
      return apiSuccess({ ok: true });
    });

    const response = await handler(new Request('http://localhost/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: '请求内容不是有效的 JSON',
      code: 'BAD_REQUEST',
    });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('logs unexpected exceptions and returns the stable fallback', async () => {
    const error = new Error('SQLITE_ERROR private detail');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = withApiErrorBoundary({
      operation: '执行测试请求',
      message: '测试请求失败，请稍后重试',
    }, async () => {
      throw error;
    });

    const response = await handler();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: '测试请求失败，请稍后重试',
      code: 'INTERNAL_ERROR',
    });
    expect(log).toHaveBeenCalledWith('[api] 执行测试请求失败', {}, error);
    log.mockRestore();
  });
});

describe('API error status mapping', () => {
  it.each([
    ['BAD_REQUEST', 400],
    ['UNAUTHENTICATED', 401],
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['UPSTREAM_ERROR', 502],
    ['SERVICE_UNAVAILABLE', 503],
  ] as const)('maps %s to HTTP %i', async (code, status) => {
    const response = apiError('测试错误', code);

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: '测试错误', code });
  });
});

describe('internal API errors', () => {
  it('keeps internal details in server logs and returns only the stable public message', async () => {
    const internalError = new Error(
      'SQLITE_ERROR near password_hash at /srv/animetrack/private.db; key=secret-value',
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = apiInternalError(internalError, {
      operation: '读取测试数据',
      message: '读取失败，请稍后重试',
      context: { page: 2, hasSearch: false },
    });

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload).toEqual({ error: '读取失败，请稍后重试', code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(payload)).not.toContain('SQLITE_ERROR');
    expect(JSON.stringify(payload)).not.toContain('/srv/animetrack');
    expect(JSON.stringify(payload)).not.toContain('secret-value');
    expect(log).toHaveBeenCalledWith(
      '[api] 读取测试数据失败',
      { page: 2, hasSearch: false },
      internalError,
    );

    log.mockRestore();
  });
});

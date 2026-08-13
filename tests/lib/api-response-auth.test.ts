import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getServerSession = vi.fn();
vi.mock('next-auth/next', () => ({ getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

let apiInternalError: typeof import('../../lib/api-response').apiInternalError;
let requireAdmin: typeof import('../../lib/api-response').requireAdmin;

beforeAll(async () => {
  ({ apiInternalError, requireAdmin } = await import('../../lib/api-response'));
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
    ['missing session', null],
    ['legacy token', { user: { id: '7', role: 'admin' } }],
    ['invalidated token', { user: { id: '7', role: 'admin', accountValid: false } }],
    ['non-admin account', { user: { id: '7', role: 'user', accountValid: true } }],
  ])('denies %s', async (_label, session) => {
    getServerSession.mockResolvedValue(session);

    const result = await requireAdmin();

    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(403);
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
    expect(payload).toEqual({ error: '读取失败，请稍后重试' });
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

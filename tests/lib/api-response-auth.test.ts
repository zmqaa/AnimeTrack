import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getServerSession = vi.fn();
vi.mock('next-auth/next', () => ({ getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

let requireAdmin: typeof import('../../lib/api-response').requireAdmin;

beforeAll(async () => {
  ({ requireAdmin } = await import('../../lib/api-response'));
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

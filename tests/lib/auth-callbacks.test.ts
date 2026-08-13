import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createAuthenticatedAccount,
  initializeAccountToken,
  type AccountJWT,
  type StoredAuthAccount,
} from '../../lib/auth-account';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db', () => ({ query }));

const secret = 'callback-test-secret-with-enough-randomness';
const storedAccount: StoredAuthAccount = {
  id: 7,
  username: 'admin',
  password_hash: '$2b$12$stored-hash',
  name: '管理员',
  role: 'admin',
};

let jwtCallback: (input: Record<string, unknown>) => Promise<AccountJWT>;
let sessionCallback: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;

beforeAll(async () => {
  process.env.NEXTAUTH_SECRET = secret;
  const { authOptions } = await import('../../lib/auth');
  jwtCallback = authOptions.callbacks?.jwt as unknown as typeof jwtCallback;
  sessionCallback = authOptions.callbacks?.session as unknown as typeof sessionCallback;
});

beforeEach(() => {
  query.mockReset();
});

afterAll(() => {
  delete process.env.NEXTAUTH_SECRET;
});

describe('authentication callbacks', () => {
  it('checks a signed token against the current database account', async () => {
    const token = initializeAccountToken(
      {},
      createAuthenticatedAccount(storedAccount, secret),
    );
    query.mockResolvedValue([storedAccount]);

    const refreshed = await jwtCallback({ token });

    expect(query).toHaveBeenCalledWith(
      'SELECT id, username, password_hash, name, role FROM users WHERE id = ?',
      [7],
    );
    expect(refreshed.accountValid).toBe(true);
    expect(refreshed.role).toBe('admin');
  });

  it('invalidates a token when its account no longer exists', async () => {
    const token = initializeAccountToken(
      {},
      createAuthenticatedAccount(storedAccount, secret),
    );
    query.mockResolvedValue([]);

    const refreshed = await jwtCallback({ token });

    expect(refreshed.accountValid).toBe(false);
    expect(refreshed.role).toBeUndefined();
  });

  it('rejects a legacy token without trusting its old administrator role', async () => {
    const refreshed = await jwtCallback({
      token: { sub: '7', role: 'admin' },
    });

    expect(query).not.toHaveBeenCalled();
    expect(refreshed.accountValid).toBe(false);
    expect(refreshed.role).toBeUndefined();
  });

  it('only exposes an administrator role for a valid account token', async () => {
    const validSession = await sessionCallback({
      session: { user: { name: '管理员' }, expires: '2099-01-01T00:00:00.000Z' },
      token: { userId: '7', username: 'admin', role: 'admin', accountValid: true },
    });
    const invalidSession = await sessionCallback({
      session: { user: { name: '管理员' }, expires: '2099-01-01T00:00:00.000Z' },
      token: { userId: '7', username: 'admin', role: 'admin', accountValid: false },
    });

    expect(validSession.user).toMatchObject({ role: 'admin', accountValid: true });
    expect(invalidSession.user).toMatchObject({ role: undefined, accountValid: false });
  });
});

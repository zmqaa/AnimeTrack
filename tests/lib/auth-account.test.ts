import { describe, expect, it } from 'vitest';

import {
  createAccountSignature,
  createAuthenticatedAccount,
  initializeAccountToken,
  refreshAccountToken,
  type AccountJWT,
  type StoredAuthAccount,
} from '../../lib/auth-account';

const secret = 'test-secret-with-enough-randomness';

function account(overrides: Partial<StoredAuthAccount> = {}): StoredAuthAccount {
  return {
    id: 7,
    username: 'admin',
    password_hash: '$2b$12$first-hash',
    name: '管理员',
    role: 'admin',
    ...overrides,
  };
}

function signedToken(storedAccount = account()): AccountJWT {
  return initializeAccountToken(
    {},
    createAuthenticatedAccount(storedAccount, secret),
  );
}

describe('authenticated account tokens', () => {
  it('binds the signature to account id, password hash, and role', () => {
    const original = createAccountSignature(account(), secret);

    expect(createAccountSignature(account({ name: '新名称' }), secret)).toBe(original);
    expect(createAccountSignature(account({ username: 'renamed' }), secret)).toBe(original);
    expect(createAccountSignature(account({ password_hash: '$2b$12$new-hash' }), secret))
      .not.toBe(original);
    expect(createAccountSignature(account({ role: 'user' }), secret)).not.toBe(original);
    expect(createAccountSignature(account({ id: 8 }), secret)).not.toBe(original);
  });

  it('keeps a matching account valid and refreshes display fields', () => {
    const token = signedToken();

    const refreshed = refreshAccountToken(token, account({
      username: 'new-admin',
      name: '新管理员名称',
    }), secret);

    expect(refreshed).toMatchObject({
      sub: '7',
      userId: '7',
      username: 'new-admin',
      name: '新管理员名称',
      role: 'admin',
      accountValid: true,
    });
  });

  it.each([
    ['account deletion', null],
    ['password change', account({ password_hash: '$2b$12$changed-hash' })],
    ['role change', account({ role: 'user' })],
    ['different account id', account({ id: 8 })],
  ])('invalidates an existing token after %s', (_label, storedAccount) => {
    const refreshed = refreshAccountToken(signedToken(), storedAccount, secret);

    expect(refreshed.accountValid).toBe(false);
    expect(refreshed.role).toBeUndefined();
    expect(refreshed.accountSignature).toBeUndefined();
  });

  it('rejects legacy tokens that do not have an account signature', () => {
    const legacyToken: AccountJWT = {
      sub: '7',
      userId: '7',
      role: 'admin',
    };

    const refreshed = refreshAccountToken(legacyToken, account(), secret);

    expect(refreshed.accountValid).toBe(false);
    expect(refreshed.role).toBeUndefined();
  });
});

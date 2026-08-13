import { createHmac, timingSafeEqual } from 'node:crypto';

import type { JWT } from 'next-auth/jwt';

export interface StoredAuthAccount {
  id: number;
  username: string;
  password_hash: string;
  name: string | null;
  role: string;
}

export interface AuthenticatedAccount {
  id: string;
  username: string;
  name: string;
  role: string;
  accountSignature: string;
}

export type AccountJWT = JWT & {
  userId?: string;
  username?: string;
  role?: string;
  accountSignature?: string;
  accountValid?: boolean;
};

function secureEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAccountSignature(account: StoredAuthAccount, secret: string): string {
  if (!secret.trim()) throw new Error('NEXTAUTH_SECRET 未配置');
  return createHmac('sha256', secret)
    .update(String(account.id))
    .update('\0')
    .update(account.password_hash)
    .update('\0')
    .update(account.role)
    .digest('base64url');
}

export function createAuthenticatedAccount(
  account: StoredAuthAccount,
  secret: string,
): AuthenticatedAccount {
  return {
    id: String(account.id),
    username: account.username,
    name: account.name || account.username,
    role: account.role,
    accountSignature: createAccountSignature(account, secret),
  };
}

export function initializeAccountToken(
  token: AccountJWT,
  account: AuthenticatedAccount,
): AccountJWT {
  token.sub = account.id;
  token.userId = account.id;
  token.username = account.username;
  token.name = account.name;
  token.role = account.role;
  token.accountSignature = account.accountSignature;
  token.accountValid = true;
  return token;
}

export function invalidateAccountToken(token: AccountJWT): AccountJWT {
  delete token.role;
  delete token.accountSignature;
  token.accountValid = false;
  return token;
}

export function refreshAccountToken(
  token: AccountJWT,
  account: StoredAuthAccount | null,
  secret: string,
): AccountJWT {
  if (!account || !token.accountSignature || String(account.id) !== token.userId) {
    return invalidateAccountToken(token);
  }

  const currentSignature = createAccountSignature(account, secret);
  if (!secureEqual(token.accountSignature, currentSignature)) {
    return invalidateAccountToken(token);
  }

  token.sub = String(account.id);
  token.userId = String(account.id);
  token.username = account.username;
  token.name = account.name || account.username;
  token.role = account.role;
  token.accountValid = true;
  return token;
}

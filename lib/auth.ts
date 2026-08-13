import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

import { query } from '@/lib/db';
import {
  createAuthenticatedAccount,
  initializeAccountToken,
  invalidateAccountToken,
  refreshAccountToken,
  type AccountJWT,
  type AuthenticatedAccount,
  type StoredAuthAccount,
} from '@/lib/auth-account';

function getAuthSecret(): string {
  const secret = String(process.env.NEXTAUTH_SECRET || '').trim();
  if (!secret) throw new Error('NEXTAUTH_SECRET 未配置');
  return secret;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const users = await query<StoredAuthAccount[]>(
          'SELECT id, username, password_hash, name, role FROM users WHERE username = ?',
          [credentials.username]
        );

        if (users && users.length > 0) {
          const user = users[0];
          const isValid = await bcrypt.compare(credentials.password, user.password_hash);
          if (isValid) {
            return createAuthenticatedAccount(user, getAuthSecret());
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const nextToken = token as AccountJWT;
      if (user) {
        return initializeAccountToken(nextToken, user as AuthenticatedAccount);
      }

      const userId = Number(nextToken.userId || nextToken.sub);
      if (!Number.isInteger(userId) || userId <= 0 || !nextToken.accountSignature) {
        return invalidateAccountToken(nextToken);
      }

      const users = await query<StoredAuthAccount[]>(
        'SELECT id, username, password_hash, name, role FROM users WHERE id = ?',
        [userId],
      );
      return refreshAccountToken(nextToken, users[0] || null, getAuthSecret());
    },
    async session({ session, token }) {
      if (session.user) {
        const accountToken = token as AccountJWT;
        Object.assign(session.user, {
          id: accountToken.userId,
          username: accountToken.username,
          role: accountToken.accountValid ? accountToken.role : undefined,
          accountValid: accountToken.accountValid === true,
        });
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

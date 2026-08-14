import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/middleware', () => ({
  withAuth: (options: unknown) => options,
}));

let config: typeof import('../../proxy').config;

beforeAll(async () => {
  ({ config } = await import('../../proxy'));
});

describe('API proxy boundary', () => {
  it('redirects private pages but lets API routes return their JSON auth errors', () => {
    expect(config.matcher).toContain('/admin/:path*');
    expect(config.matcher).toContain('/backup/:path*');
    expect(config.matcher).not.toContain('/api/admin/:path*');
  });
});

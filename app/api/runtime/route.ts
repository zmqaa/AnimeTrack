import { getServerSession } from 'next-auth/next';

import { apiSuccess } from '@/lib/api-response';
import { authOptions } from '@/lib/auth';
import type { SessionUser } from '@/lib/anime-shared';
import { getRuntimeMode, isDesktopRuntime } from '@/lib/runtime-mode';

export async function GET() {
  const desktop = isDesktopRuntime();
  const session = desktop ? null : await getServerSession(authOptions);
  const role = (session?.user as SessionUser | undefined)?.role;

  return apiSuccess({
    mode: getRuntimeMode(),
    canManage: desktop || role === 'admin',
    authenticationRequired: !desktop,
  }, 200, {
    'Cache-Control': 'no-store',
  });
}

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/api-response';

/** /api/anime/export simply redirects to the admin export endpoint */
export async function GET() {
  const auth = await requireAdmin('只有管理员可以导出数据');
  if (!auth.authorized) return auth.response;
  return NextResponse.redirect(new URL('/api/admin/export', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
}

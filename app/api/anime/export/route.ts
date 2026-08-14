import { NextResponse } from 'next/server';
import { requireAdmin, withApiErrorBoundary } from '@/lib/api-response';

/** /api/anime/export simply redirects to the admin export endpoint */
async function handleGet() {
  const auth = await requireAdmin('只有管理员可以导出数据');
  if (!auth.authorized) return auth.response;
  return NextResponse.redirect(new URL('/api/admin/export', process.env.NEXTAUTH_URL || 'http://localhost:3000'));
}

export const GET = withApiErrorBoundary({
  operation: '跳转动漫导出接口',
  message: '暂时无法导出数据，请稍后重试',
}, handleGet);

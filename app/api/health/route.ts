import { NextResponse } from 'next/server';

import { getRawDb } from '@/lib/db';
import { getRuntimeMode } from '@/lib/runtime-mode';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    getRawDb().prepare('SELECT 1 AS ok').get();
    return NextResponse.json({
      mode: getRuntimeMode(),
      database: 'available',
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[health] 数据库健康检查失败:', error);
    return NextResponse.json({
      mode: getRuntimeMode(),
      database: 'unavailable',
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  }
}

import fs from 'fs/promises';
import path from 'path';
import { getRawDb } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/api-response';

type SetupStatus = {
  allowed: boolean;
  envReady: boolean;
  databaseReachable: boolean;
  seeded: boolean;
  animeCount: number;
  historyCount: number;
  message: string;
  missingEnvKeys: string[];
  envFileHint: string;
  databaseError?: string;
};

function isSetupAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_SETUP === 'true';
}

async function readSql(relativePath: string) {
  const absolutePath = path.join(process.cwd(), relativePath);
  return fs.readFile(absolutePath, 'utf8');
}

async function getSetupStatus(): Promise<SetupStatus> {
  if (!isSetupAllowed()) {
    return {
      allowed: false, envReady: false, databaseReachable: false,
      seeded: false, animeCount: 0, historyCount: 0,
      message: '当前环境禁止通过网页初始化数据库。',
      missingEnvKeys: [], envFileHint: '仅开发环境或显式开启 ALLOW_LOCAL_SETUP=true 时可用。',
    };
  }

  const missingEnvKeys = [
    !process.env.NEXTAUTH_URL?.trim() ? 'NEXTAUTH_URL' : null,
    !process.env.NEXTAUTH_SECRET?.trim() ? 'NEXTAUTH_SECRET' : null,
  ].filter((item): item is string => Boolean(item));

  if (missingEnvKeys.length > 0) {
    return {
      allowed: true, envReady: false, databaseReachable: false,
      seeded: false, animeCount: 0, historyCount: 0,
      message: '请先配置 .env.local 中的 NEXTAUTH_URL 和 NEXTAUTH_SECRET。',
      missingEnvKeys,
      envFileHint: '推荐在 .env.local 中设置 NEXTAUTH_URL=http://localhost:3000 和随机 NEXTAUTH_SECRET。',
    };
  }

  try {
    const db = getRawDb();
    const animeRow = db.prepare('SELECT COUNT(*) AS count FROM anime').get() as { count: number } | undefined;
    const historyRow = db.prepare('SELECT COUNT(*) AS count FROM watch_history').get() as { count: number } | undefined;
    const animeCount = Number(animeRow?.count || 0);
    const historyCount = Number(historyRow?.count || 0);

    return {
      allowed: true, envReady: true, databaseReachable: true,
      seeded: animeCount > 0, animeCount, historyCount,
      message: animeCount > 0
        ? '数据库已准备完成，当前已导入示例数据。'
        : '数据库已初始化，但还没有导入示例数据。',
      missingEnvKeys: [], envFileHint: '环境变量已就绪。',
    };
  } catch (error) {
    return {
      allowed: true, envReady: true, databaseReachable: false,
      seeded: false, animeCount: 0, historyCount: 0,
      message: error instanceof Error ? error.message : '读取初始化状态失败。',
      missingEnvKeys: [], envFileHint: '环境变量已就绪，但数据库操作失败。',
      databaseError: error instanceof Error ? error.message : '未知数据库错误。',
    };
  }
}

export async function GET() {
  const status = await getSetupStatus();
  return apiSuccess(status, status.allowed ? 200 : 403);
}

export async function POST() {
  if (!isSetupAllowed()) {
    return apiError('当前环境禁止通过网页初始化数据库。', 403);
  }

  const currentStatus = await getSetupStatus();
  if (currentStatus.seeded && currentStatus.animeCount > 0) {
    return apiError('数据库已初始化完成，不允许重复执行。如需重置请使用命令行工具。', 409);
  }

  try {
    const schemaSql = await readSql('database/schema.sql');
    const seedSql = await readSql('database/seed_anime_data.sql');

    const db = getRawDb();
    db.exec(schemaSql);
    db.exec(seedSql);

    const status = await getSetupStatus();
    return apiSuccess({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : '初始化失败';
    return apiError(message, 500);
  }
}

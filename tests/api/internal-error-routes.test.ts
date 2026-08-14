import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getServerSession = vi.fn();
const getDashboardOverview = vi.fn();
const createAiRuntimeConfig = vi.fn();
const requestAiJson = vi.fn();
const execFile = vi.fn();
const getRawDb = vi.fn();

vi.mock('next-auth/next', () => ({ getServerSession }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/dashboard-overview', () => ({ getDashboardOverview }));
vi.mock('@/lib/ai-runtime', () => ({ createAiRuntimeConfig, requestAiJson }));
vi.mock('child_process', () => ({ execFile }));
vi.mock('@/lib/db', () => ({ getRawDb }));

let dashboardRoute: typeof import('../../app/api/dashboard/route');
let aiTestRoute: typeof import('../../app/api/settings/ai/test/route');
let backupRoute: typeof import('../../app/api/admin/backup/route');
let healthRoute: typeof import('../../app/api/health/route');

beforeAll(async () => {
  dashboardRoute = await import('../../app/api/dashboard/route');
  aiTestRoute = await import('../../app/api/settings/ai/test/route');
  backupRoute = await import('../../app/api/admin/backup/route');
  healthRoute = await import('../../app/api/health/route');
});

beforeEach(() => {
  getServerSession.mockReset();
  getDashboardOverview.mockReset();
  createAiRuntimeConfig.mockReset();
  requestAiJson.mockReset();
  execFile.mockReset();
  getRawDb.mockReset();
  getServerSession.mockResolvedValue({
    user: { id: '7', role: 'admin', accountValid: true },
  });
  createAiRuntimeConfig.mockReturnValue({
    apiUrl: 'https://example.invalid/chat/completions',
    apiKey: 'configured-key',
    model: 'test-model',
  });
});

describe('API internal error boundaries', () => {
  it('does not expose database details from the dashboard route', async () => {
    const error = new Error('SQLITE_ERROR at /srv/animetrack/private.db');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getDashboardOverview.mockRejectedValue(error);

    const response = await dashboardRoute.GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: '读取首页总览失败，请稍后重试',
      code: 'INTERNAL_ERROR',
    });
    expect(log).toHaveBeenCalledWith('[api] 读取首页总览失败', {}, error);
    log.mockRestore();
  });

  it('does not expose external service details from the AI test route', async () => {
    const error = new Error('upstream rejected Authorization: Bearer leaked-key');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    requestAiJson.mockRejectedValue(error);

    const response = await aiTestRoute.POST();
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      error: 'AI 连接测试失败，请检查配置或稍后重试',
      code: 'UPSTREAM_ERROR',
    });
    expect(JSON.stringify(payload)).not.toContain('leaked-key');
    expect(log).toHaveBeenCalledWith('[api] 测试 AI 连接失败', {}, error);
    log.mockRestore();
  });

  it('does not expose process or file paths when backup creation fails', async () => {
    const error = new Error('spawn failed for /srv/animetrack/data/backups/private.sql');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    execFile.mockImplementation((...args: unknown[]) => {
      const callback = args.at(-1);
      if (typeof callback === 'function') callback(error);
    });

    const response = await backupRoute.POST();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      error: '创建备份失败，请检查服务器日志',
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(payload)).not.toContain('/srv/animetrack');
    expect(log).toHaveBeenCalledWith('[api] 创建应用 JSON 备份失败', {}, error);
    log.mockRestore();
  });

  it('uses the service-unavailable contract when the health dependency fails', async () => {
    const error = new Error('SQLITE_CANTOPEN /srv/animetrack/private.db');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getRawDb.mockReturnValue({
      prepare: () => ({
        get: () => {
          throw error;
        },
      }),
    });

    const response = await healthRoute.GET();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({
      database: 'unavailable',
      error: '数据库暂时不可用',
      code: 'SERVICE_UNAVAILABLE',
    });
    expect(log).toHaveBeenCalledWith('[api] 执行数据库健康检查失败', {}, error);
    log.mockRestore();
  });
});

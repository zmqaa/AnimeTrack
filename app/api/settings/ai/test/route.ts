import { NextRequest } from 'next/server';

import { apiError, apiSuccess, requireManagePermission } from '@/lib/api-response';
import { createAiRuntimeConfig, requestAiJson } from '@/lib/ai-runtime';

export async function POST(request: NextRequest) {
  const auth = await requireManagePermission('需要管理权限');
  if (!auth.authorized) return auth.response;

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const overrides = {
      apiUrl: typeof body.apiUrl === 'string' && body.apiUrl.trim() ? body.apiUrl.trim() : undefined,
      model: typeof body.model === 'string' && body.model.trim() ? body.model.trim() : undefined,
      apiKey: typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : undefined,
    };
    const runtime = createAiRuntimeConfig(
      Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
    );

    if (!runtime.apiKey) {
      return apiError('尚未配置 API Key', 400);
    }

    const startedAt = Date.now();
    const result = await requestAiJson<{ ok?: boolean }>({
      ...runtime,
      messages: [
        { role: 'system', content: '只输出 JSON。' },
        { role: 'user', content: '请返回 {"ok":true}，用于 AnimeTrack AI 连接测试。' },
      ],
      temperature: 0,
      timeoutMs: 20_000,
      cache: 'no-store',
    });

    if (!result?.ok) {
      return apiError('AI 服务未返回预期结果，请检查地址、模型和密钥', 502);
    }

    return apiSuccess({
      success: true,
      model: runtime.model,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'AI 连接测试失败', 500);
  }
}

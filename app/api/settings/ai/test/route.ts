import { apiError, apiInternalError, apiSuccess, requireAdmin } from '@/lib/api-response';
import { createAiRuntimeConfig, requestAiJson } from '@/lib/ai-runtime';

export async function POST() {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) return auth.response;

  try {
    const runtime = createAiRuntimeConfig();

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
    return apiInternalError(error, {
      operation: '测试 AI 连接',
      message: 'AI 连接测试失败，请检查配置或稍后重试',
      status: 502,
    });
  }
}

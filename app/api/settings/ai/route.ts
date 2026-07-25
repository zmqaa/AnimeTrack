import { apiSuccess, requireAdmin } from '@/lib/api-response';
import { createAiRuntimeConfig } from '@/lib/ai-runtime';

function apiKeyPreview(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 3)}••••${apiKey.slice(-4)}`;
}

function responsePayload() {
  const runtime = createAiRuntimeConfig();

  return {
    source: 'environment',
    config: {
      apiUrl: runtime.apiUrl,
      model: runtime.model,
      hasApiKey: Boolean(runtime.apiKey),
      apiKeyPreview: apiKeyPreview(runtime.apiKey),
    },
  };
}

export async function GET() {
  const auth = await requireAdmin('需要管理员权限');
  if (!auth.authorized) return auth.response;
  return apiSuccess(responsePayload());
}

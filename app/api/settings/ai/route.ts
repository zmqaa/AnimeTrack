import { NextRequest } from 'next/server';

import { apiError, apiSuccess, requireManagePermission } from '@/lib/api-response';
import { createAiRuntimeConfig } from '@/lib/ai-runtime';
import { isDesktopRuntime } from '@/lib/runtime-mode';
import { readRuntimeSettings, updateStoredAiSettings } from '@/lib/runtime-settings';

function apiKeyPreview(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 8) return '••••••••';
  return `${apiKey.slice(0, 3)}••••${apiKey.slice(-4)}`;
}

function responsePayload() {
  const runtime = createAiRuntimeConfig();
  const stored = readRuntimeSettings().ai;

  return {
    editable: isDesktopRuntime(),
    source: isDesktopRuntime() && stored ? 'desktop-settings' : 'environment',
    config: {
      apiUrl: runtime.apiUrl,
      model: runtime.model,
      hasApiKey: Boolean(runtime.apiKey),
      apiKeyPreview: apiKeyPreview(runtime.apiKey),
    },
  };
}

function optionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} 必须是字符串`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw new Error(`${field} 过长`);
  return normalized || undefined;
}

export async function GET() {
  const auth = await requireManagePermission('需要管理权限');
  if (!auth.authorized) return auth.response;
  return apiSuccess(responsePayload());
}

export async function PUT(request: NextRequest) {
  const auth = await requireManagePermission('需要管理权限');
  if (!auth.authorized) return auth.response;
  if (!isDesktopRuntime()) {
    return apiError('Web 模式请通过服务器环境变量配置 AI', 403);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const apiUrl = optionalString(body.apiUrl, 'API URL', 2000);
    if (apiUrl && !/^https?:\/\//i.test(apiUrl)) {
      return apiError('API URL 必须以 http:// 或 https:// 开头', 400);
    }

    const clearApiKey = body.clearApiKey === true;
    updateStoredAiSettings({
      apiUrl,
      model: optionalString(body.model, '模型名称', 200),
      apiKey: clearApiKey ? undefined : optionalString(body.apiKey, 'API Key', 4000),
    }, {
      preserveApiKey: !clearApiKey,
    });

    return apiSuccess({ success: true, ...responsePayload() });
  } catch (error) {
    return apiError(error instanceof Error ? error.message : '保存 AI 设置失败', 400);
  }
}

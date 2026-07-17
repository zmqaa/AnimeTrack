import 'server-only';

import { isDesktopRuntime } from '@/lib/runtime-mode';
import { readRuntimeSettings } from '@/lib/runtime-settings';

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiRuntimeConfig = {
  apiUrl: string;
  model: string;
  apiKey: string;
};

export type RequestAiJsonOptions = Partial<AiRuntimeConfig> & {
  messages: AiMessage[];
  temperature?: number;
  timeoutMs?: number;
  cache?: RequestCache;
  extraBody?: Record<string, unknown>;
};

export const DEFAULT_AI_URL = 'https://api.deepseek.com/chat/completions';
export const DEFAULT_AI_MODEL = 'deepseek-v4-flash';

export function normalizeAiApiUrl(value?: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) {
    return DEFAULT_AI_URL;
  }

  const withoutTrailingSlash = normalized.replace(/\/+$/, '');
  if (/ark\.cn-[^.]+\.volces\.com\/api\/v\d+$/i.test(withoutTrailingSlash)) {
    return `${withoutTrailingSlash}/chat/completions`;
  }

  return withoutTrailingSlash;
}

export function parseJsonFromAiContent<T = unknown>(content: string): T | null {
  const normalized = String(content || '').trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const fencedContent = fencedMatch?.[1]?.trim();
    if (fencedContent) {
      try {
        return JSON.parse(fencedContent) as T;
      } catch {
        // Fall through to generic object extraction.
      }
    }

    const objectMatch = normalized.match(/\{[\s\S]*\}/);
    const objectContent = objectMatch?.[0]?.trim();
    if (!objectContent) {
      return null;
    }

    try {
      return JSON.parse(objectContent) as T;
    } catch {
      return null;
    }
  }
}

export function getAiApiKey(): string {
  return String(process.env.AI_API_KEY || process.env.DEEPSEEK_API_KEY || '').trim();
}

export function createAiRuntimeConfig(overrides: Partial<AiRuntimeConfig> = {}): AiRuntimeConfig {
  const stored = isDesktopRuntime() ? readRuntimeSettings().ai : undefined;
  const apiUrl = normalizeAiApiUrl(overrides.apiUrl ?? stored?.apiUrl ?? process.env.AI_API_URL);
  const modelInput = overrides.model ?? stored?.model ?? process.env.AI_MODEL;
  const model = String(modelInput || '').trim() || DEFAULT_AI_MODEL;
  const apiKeyInput = overrides.apiKey ?? stored?.apiKey ?? getAiApiKey();
  const apiKey = String(apiKeyInput || '').trim();

  return {
    apiUrl,
    model,
    apiKey,
  };
}

export async function requestAiJson<T = unknown>(options: RequestAiJsonOptions = {} as RequestAiJsonOptions): Promise<T | null> {
  const runtimeOverrides: Partial<AiRuntimeConfig> = {};
  if (options.apiUrl !== undefined) runtimeOverrides.apiUrl = options.apiUrl;
  if (options.model !== undefined) runtimeOverrides.model = options.model;
  if (options.apiKey !== undefined) runtimeOverrides.apiKey = options.apiKey;
  const runtime = createAiRuntimeConfig(runtimeOverrides);

  if (!runtime.apiKey || !Array.isArray(options.messages) || options.messages.length === 0) {
    return null;
  }

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs != null && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 30000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const requestBody: Record<string, unknown> = {
    model: runtime.model,
    messages: options.messages,
    temperature: typeof options.temperature === 'number' ? options.temperature : 0.1,
    response_format: { type: 'json_object' },
    ...(options.extraBody && typeof options.extraBody === 'object' ? options.extraBody : {}),
  };

  try {
    const response = await fetch(runtime.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${runtime.apiKey}`,
      },
      body: JSON.stringify(requestBody),
      ...(options.cache ? { cache: options.cache } : {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('AI request failed:', response.status, detail);
      return null;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return null;
    }

    return parseJsonFromAiContent<T>(content);
  } catch (error) {
    console.error('AI request error:', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

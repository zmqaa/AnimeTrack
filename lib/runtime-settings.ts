import 'server-only';

import fs from 'fs';
import path from 'path';

import { isDesktopRuntime } from '@/lib/runtime-mode';
import { getSettingsPath } from '@/lib/runtime-paths';

export type StoredAiSettings = {
  apiUrl?: string;
  model?: string;
  apiKey?: string;
};

export type RuntimeSettings = {
  version: 1;
  ai?: StoredAiSettings;
};

const EMPTY_SETTINGS: RuntimeSettings = { version: 1 };

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeStoredAiSettings(value: unknown): StoredAiSettings | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const input = value as Record<string, unknown>;

  return {
    apiUrl: normalizeOptionalString(input.apiUrl),
    model: normalizeOptionalString(input.model),
    apiKey: normalizeOptionalString(input.apiKey),
  };
}

export function readRuntimeSettings(): RuntimeSettings {
  if (!isDesktopRuntime()) return EMPTY_SETTINGS;

  const settingsPath = getSettingsPath();
  if (!fs.existsSync(settingsPath)) return EMPTY_SETTINGS;

  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
    return {
      version: 1,
      ai: normalizeStoredAiSettings(parsed.ai),
    };
  } catch (error) {
    console.error(`读取设置文件失败：${settingsPath}`, error);
    return EMPTY_SETTINGS;
  }
}

export function writeRuntimeSettings(settings: RuntimeSettings): void {
  if (!isDesktopRuntime()) {
    throw new Error('Web 模式不允许写入本地设置文件');
  }

  const settingsPath = getSettingsPath();
  const directory = path.dirname(settingsPath);
  fs.mkdirSync(directory, { recursive: true });

  const temporaryPath = `${settingsPath}.tmp`;
  fs.writeFileSync(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.renameSync(temporaryPath, settingsPath);
}

export function updateStoredAiSettings(
  input: StoredAiSettings,
  options: { preserveApiKey?: boolean } = {},
): RuntimeSettings {
  const current = readRuntimeSettings();
  const nextAi = normalizeStoredAiSettings(input) || {};

  if (options.preserveApiKey && !nextAi.apiKey && current.ai?.apiKey) {
    nextAi.apiKey = current.ai.apiKey;
  }

  const next: RuntimeSettings = {
    version: 1,
    ai: nextAi,
  };
  writeRuntimeSettings(next);
  return next;
}

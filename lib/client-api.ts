type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
  }
}

function looksLikeHtmlDocument(value: string): boolean {
  return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<title[\s>]/i.test(value);
}

function buildGatewayErrorMessage(status: number | undefined, fallbackMessage: string): string {
  const prefix = fallbackMessage === '请求失败' ? '' : `${fallbackMessage}：`;

  if (status === 504) {
    return `${prefix}服务响应超时，请稍后重试`;
  }

  if (status === 502 || status === 503) {
    return `${prefix}上游服务暂时不可用，请稍后重试`;
  }

  return fallbackMessage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function readResponsePayload<T>(response: Response): Promise<T | string | null> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json() as T;
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text || null;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: unknown, fallbackMessage: string, status?: number): string {
  if (typeof payload === 'string' && payload.trim()) {
    const message = payload.trim();

    if (status && (status === 502 || status === 503 || status === 504 || looksLikeHtmlDocument(message))) {
      return buildGatewayErrorMessage(status, fallbackMessage);
    }

    return message.length > 240 ? fallbackMessage : message;
  }

  if (isRecord(payload)) {
    const apiError = typeof payload.error === 'string' ? payload.error.trim() : '';
    if (apiError) {
      return apiError;
    }

    const message = typeof payload.message === 'string' ? payload.message.trim() : '';
    if (message) {
      return message;
    }
  }

  return fallbackMessage;
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit, fallbackMessage = '请求失败'): Promise<T> {
  const response = await fetch(input, init);
  const payload = await readResponsePayload<T & ApiErrorPayload>(response);

  if (!response.ok) {
    throw new ApiRequestError(
      extractErrorMessage(payload, fallbackMessage, response.status),
      response.status,
    );
  }

  return payload as T;
}

export async function fetchBlob(input: RequestInfo | URL, init?: RequestInit, fallbackMessage = '请求失败'): Promise<Blob> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = await readResponsePayload<ApiErrorPayload>(response);
    throw new ApiRequestError(
      extractErrorMessage(payload, fallbackMessage, response.status),
      response.status,
    );
  }

  return response.blob();
}

export async function fetchNdjson<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  onEvent: (event: T) => void,
  fallbackMessage = '请求失败',
): Promise<void> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const payload = await readResponsePayload<ApiErrorPayload>(response);
    throw new ApiRequestError(
      extractErrorMessage(payload, fallbackMessage, response.status),
      response.status,
    );
  }

  if (!response.body) {
    throw new Error(`${fallbackMessage}：服务未返回可读取的数据流`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const consumeLine = (line: string) => {
    const normalized = line.trim();
    if (!normalized) return;

    try {
      onEvent(JSON.parse(normalized) as T);
    } catch {
      throw new Error(`${fallbackMessage}：服务返回了无法解析的进度数据`);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    lines.forEach(consumeLine);

    if (done) break;
  }

  consumeLine(buffer);
}

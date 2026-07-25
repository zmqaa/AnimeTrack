import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchNdjson } from '../../lib/client-api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchNdjson', () => {
  it('parses events split across arbitrary response chunks', async () => {
    const encoder = new TextEncoder();
    const responseBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"type":"progress","message":"第一'));
        controller.enqueue(encoder.encode('步"}\n{"type":"result",'));
        controller.enqueue(encoder.encode('"data":{"ok":true}}\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(responseBody, {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson' },
    })));

    const events: unknown[] = [];
    await fetchNdjson('/api/test', { method: 'POST' }, (event) => events.push(event));

    expect(events).toEqual([
      { type: 'progress', message: '第一步' },
      { type: 'result', data: { ok: true } },
    ]);
  });

  it('preserves a JSON API error before streaming begins', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(
      { error: '只有管理员可以使用 AI 录入' },
      { status: 403 },
    )));

    await expect(fetchNdjson(
      '/api/test',
      { method: 'POST' },
      () => undefined,
      'AI录入失败',
    )).rejects.toThrow('只有管理员可以使用 AI 录入');
  });
});

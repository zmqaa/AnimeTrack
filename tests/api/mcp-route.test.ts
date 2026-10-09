import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/mcp-data', () => ({
  fetchMcpDocument: vi.fn().mockResolvedValue(null),
  getAnimeDetailData: vi.fn().mockResolvedValue(null),
  getLibraryOverviewData: vi.fn().mockResolvedValue({}),
  getMangaDetailData: vi.fn().mockResolvedValue(null),
  getTimelineData: vi.fn().mockResolvedValue({}),
  getWatchHistoryData: vi.fn().mockResolvedValue({}),
  searchAnimeData: vi.fn().mockResolvedValue({}),
  searchMangaData: vi.fn().mockResolvedValue({}),
  searchMcpDocuments: vi.fn().mockResolvedValue([]),
  searchNotesData: vi.fn().mockResolvedValue({}),
  MCP_MAX_PAGE_SIZE: 100,
  MCP_MAX_SEARCH_RESULTS: 50,
}));

let route: typeof import('../../app/mcp/route');

beforeAll(async () => {
  process.env.MCP_PUBLIC_BASE_URL = 'https://anime.example.com';
  route = await import('../../app/mcp/route');
});

describe('remote MCP HTTP boundary', () => {
  it('allows protocol discovery and anonymous data tools', async () => {
    const response = await route.POST(new Request('https://anime.example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'search', arguments: { query: '测试' } },
      }),
    }));
    const payload = await response.json() as { result: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(payload.result.isError).not.toBe(true);
    expect(payload.result.content).toEqual([{ type: 'text', text: '{"results":[]}' }]);
  });

  it('rejects an untrusted Origin before touching the MCP server', async () => {
    const response = await route.OPTIONS(new Request('https://anime.example.com/mcp', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example.com' },
    }));

    expect(response.status).toBe(403);
  });
});

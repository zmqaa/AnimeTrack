import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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

let createMcpServer: typeof import('../../lib/mcp-server').createMcpServer;

beforeAll(async () => {
  process.env.MCP_PUBLIC_BASE_URL = 'https://anime.example.com';
  ({ createMcpServer } = await import('../../lib/mcp-server'));
});

afterAll(() => {
  delete process.env.MCP_PUBLIC_BASE_URL;
});

async function callMcp(message: Record<string, unknown>) {
  const server = createMcpServer();
  const transportModule = await import('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js');
  const transport = new transportModule.WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(new Request('https://anime.example.com/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }));
    return {
      status: response.status,
      payload: await response.json() as Record<string, unknown>,
    };
  } finally {
    await server.close();
  }
}

describe('MCP server metadata and read-only boundary', () => {
  it('returns initialization instructions', async () => {
    const result = await callMcp({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    });

    expect(result.status).toBe(200);
    expect(result.payload.result).toMatchObject({
      serverInfo: { name: 'animetrack', version: '1.0.0' },
      instructions: expect.stringContaining('只提供公开的只读资料查询'),
    });
  });

  it('advertises anonymous access and read-only annotations on every tool', async () => {
    const result = await callMcp({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    const tools = (result.payload.result as { tools: Array<Record<string, unknown>> }).tools;

    expect(tools.length).toBeGreaterThan(0);
    expect(tools.map((tool) => tool.name)).toContain('search');
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      });
      expect(tool.securitySchemes).toEqual([{ type: 'noauth' }]);
      expect((tool._meta as Record<string, unknown>).securitySchemes)
        .toEqual([{ type: 'noauth' }]);
    }
  });

  it('allows a read tool to run without a token', async () => {
    const result = await callMcp({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search',
        arguments: { query: '测试' },
      },
    });
    const toolResult = result.payload.result as Record<string, unknown>;

    expect(toolResult.isError).not.toBe(true);
    expect(toolResult.content).toEqual([{ type: 'text', text: '{"results":[]}' }]);
  });
});

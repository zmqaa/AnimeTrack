import 'server-only';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  fetchMcpDocument,
  getAnimeDetailData,
  getLibraryOverviewData,
  getMangaDetailData,
  getTimelineData,
  getWatchHistoryData,
  searchAnimeData,
  searchMangaData,
  searchMcpDocuments,
  searchNotesData,
  MCP_MAX_PAGE_SIZE,
  MCP_MAX_SEARCH_RESULTS,
} from '@/lib/mcp-data';
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from '@/lib/mcp-config';

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

const securitySchemes = [{ type: 'noauth' }];

const securityMeta = { securitySchemes };

const searchOutputSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    title: z.string(),
    url: z.string(),
  })),
});

const fetchOutputSchema = z.object({
  id: z.string(),
  title: z.string(),
  text: z.string(),
  url: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const pageInput = {
  page: z.number().int().min(1).max(10_000).optional()
    .describe('页码，从 1 开始。'),
  pageSize: z.number().int().min(1).max(MCP_MAX_PAGE_SIZE).optional()
    .describe(`每页条数，最多 ${MCP_MAX_PAGE_SIZE} 条。`),
};

function jsonResult(value: Record<string, unknown>): CallToolResult {
  return {
    structuredContent: value,
    content: [{ type: 'text', text: JSON.stringify(value) }],
  };
}

async function runReadTool<T>(
  operation: string,
  callback: () => Promise<T> | T,
): Promise<CallToolResult> {
  try {
    const data = await callback();
    return jsonResult({ data });
  } catch (error) {
    console.error(`[mcp] ${operation}失败`, error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{ type: 'text', text: '读取 AnimeTrack 数据失败，请稍后重试。' }],
    };
  }
}

async function runStandardReadTool<T extends Record<string, unknown>>(
  operation: string,
  callback: () => Promise<T> | T,
): Promise<CallToolResult> {
  try {
    return jsonResult(await callback());
  } catch (error) {
    console.error(`[mcp] ${operation}失败`, error instanceof Error ? error.message : String(error));
    return {
      isError: true,
      content: [{ type: 'text', text: '读取 AnimeTrack 数据失败，请稍后重试。' }],
    };
  }
}

function installDirectSecuritySchemeMetadata(server: McpServer): void {
  // @modelcontextprotocol/sdk keeps custom tool metadata under `_meta`. ChatGPT
  // also reads the top-level `securitySchemes` extension, so copy it onto the
  // tools/list response while retaining `_meta` for compatibility.
  type InternalHandler = (
    request: unknown,
    extra: unknown,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  type InternalServer = {
    _requestHandlers: Map<string, InternalHandler>;
  };
  const internal = server.server as unknown as InternalServer;
  const original = internal._requestHandlers.get('tools/list');
  if (!original) throw new Error('MCP tools/list 处理器尚未初始化');

  server.server.setRequestHandler(ListToolsRequestSchema, async (request, extra) => {
    const result = await original(request, extra);
    if (!result || typeof result !== 'object') return result;

    const resultRecord = result as Record<string, unknown>;
    const tools = Array.isArray(resultRecord.tools) ? resultRecord.tools : [];
    return {
      ...resultRecord,
      tools: tools.map((tool) => (
        tool && typeof tool === 'object'
          ? { ...(tool as Record<string, unknown>), securitySchemes }
          : tool
      )),
    };
  });
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION },
    {
      instructions: 'AnimeTrack 只提供公开的只读资料查询；可查询动漫、漫画、观看历史、时间线和个人笔记。不要尝试修改或删除数据。',
    },
  );

  server.registerTool('search', {
    title: '搜索 AnimeTrack 资料',
    description: '按标题、原名、简介、标签、声优、作者、个人笔记或观看记录搜索 AnimeTrack。返回结果 ID 后可用 fetch 获取完整内容。',
    inputSchema: {
      query: z.string().min(1).max(200).describe('自然语言搜索关键词。'),
    },
    outputSchema: searchOutputSchema,
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async ({ query }) => runStandardReadTool('通用资料搜索', async () => ({
    results: await searchMcpDocuments(query),
  })));

  server.registerTool('fetch', {
    title: '获取 AnimeTrack 资料',
    description: '根据 search 返回的资料 ID 获取完整内容。支持动漫、漫画、个人笔记和观看记录。',
    inputSchema: {
      id: z.string().min(1).max(120).describe('search 返回的资料 ID。'),
    },
    outputSchema: fetchOutputSchema,
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async ({ id }) => {
    try {
      const result = await fetchMcpDocument(id);
      if (!result) {
        return {
          isError: true,
          content: [{ type: 'text', text: '没有找到对应的 AnimeTrack 资料。' }],
        };
      }
      return jsonResult(result as unknown as Record<string, unknown>);
    } catch (error) {
      console.error('[mcp] 获取资料失败', error instanceof Error ? error.message : String(error));
      return {
        isError: true,
        content: [{ type: 'text', text: '读取 AnimeTrack 数据失败，请稍后重试。' }],
      };
    }
  });

  server.registerTool('get_library_overview', {
    title: '读取资料库总览',
    description: '读取 AnimeTrack 的动漫、漫画、个人笔记、观看历史、仪表盘和时间线总览。',
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async () => runReadTool('资料库总览', getLibraryOverviewData));

  server.registerTool('search_anime', {
    title: '搜索动漫',
    description: '按标题、原名、声优或别名搜索动漫，并返回分页结果。',
    inputSchema: {
      query: z.string().max(200).optional().describe('标题、原名、声优或别名；不填则列出全部动漫。'),
      status: z.enum(['watching', 'completed', 'dropped', 'plan_to_watch']).optional()
        .describe('可选状态。'),
      ...pageInput,
    },
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async (args) => runReadTool('动漫搜索', () => searchAnimeData(args)));

  server.registerTool('get_anime_detail', {
    title: '读取动漫详情',
    description: '读取一部动漫的完整资料、结构化笔记和全部观看历史。',
    inputSchema: {
      id: z.number().int().positive().describe('动漫 ID。'),
    },
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async ({ id }) => runReadTool('动漫详情', async () => {
    const result = await getAnimeDetailData(id);
    if (!result) throw new Error('动漫不存在');
    return result;
  }));

  server.registerTool('search_manga', {
    title: '搜索漫画',
    description: '按标题、原名、别名、作者或画师搜索漫画，并返回分页结果。',
    inputSchema: {
      query: z.string().max(200).optional().describe('标题、原名、别名、作者或画师；不填则列出全部漫画。'),
      status: z.enum(['plan_to_read', 'reading', 'caught_up', 'completed', 'paused', 'dropped']).optional()
        .describe('可选阅读状态。'),
      publicationStatus: z.enum(['ongoing', 'completed', 'hiatus', 'unknown']).optional()
        .describe('可选连载状态。'),
      ...pageInput,
    },
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async (args) => runReadTool('漫画搜索', () => searchMangaData(args)));

  server.registerTool('get_manga_detail', {
    title: '读取漫画详情',
    description: '读取一部漫画的完整资料。',
    inputSchema: {
      id: z.number().int().positive().describe('漫画 ID。'),
    },
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async ({ id }) => runReadTool('漫画详情', async () => {
    const result = await getMangaDetailData(id);
    if (!result) throw new Error('漫画不存在');
    return result;
  }));

  server.registerTool('get_watch_history', {
    title: '读取观看历史',
    description: '按时间倒序读取观看历史，可按动漫标题搜索并分页。',
    inputSchema: {
      query: z.string().max(200).optional().describe('可选动漫标题关键词。'),
      ...pageInput,
    },
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async ({ query, page, pageSize }) => runReadTool('观看历史', () => getWatchHistoryData({
    query,
    page,
    pageSize,
  })));

  server.registerTool('get_timeline', {
    title: '读取观看时间线',
    description: '读取观看时间线记录、分页结果和筛选后的汇总，可按标题、日期或排序方式筛选。',
    inputSchema: {
      query: z.string().max(200).optional().describe('可选动漫标题关键词。'),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('可选日期，格式 YYYY-MM-DD。'),
      sortBy: z.enum(['newest', 'oldest', 'mostEpisodes']).optional().describe('排序方式。'),
      ...pageInput,
    },
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async ({ query, date, sortBy, page, pageSize }) => runReadTool('观看时间线', () => getTimelineData({
    query,
    date,
    sortBy,
    page,
    pageSize,
  })));

  server.registerTool('search_notes', {
    title: '搜索个人笔记',
    description: '搜索动漫的整体笔记或分集笔记，也可按动漫 ID 筛选。',
    inputSchema: {
      query: z.string().max(200).optional().describe('笔记内容关键词；不填则列出笔记。'),
      animeId: z.number().int().positive().optional().describe('可选动漫 ID。'),
      limit: z.number().int().min(1).max(MCP_MAX_SEARCH_RESULTS).optional()
        .describe(`最多返回 ${MCP_MAX_SEARCH_RESULTS} 条。`),
    },
    annotations: readOnlyAnnotations,
    _meta: securityMeta,
  }, async ({ query, animeId, limit }) => runReadTool('个人笔记搜索', () => searchNotesData({
    query,
    animeId,
    limit,
  })));

  installDirectSecuritySchemeMetadata(server);
  return server;
}

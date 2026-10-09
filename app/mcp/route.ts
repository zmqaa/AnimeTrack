import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { isAllowedMcpOrigin } from '@/lib/mcp-config';
import { createMcpServer } from '@/lib/mcp-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (!origin) return headers;
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Headers', 'Accept, Authorization, Content-Type, Last-Event-ID, Mcp-Protocol-Version, Mcp-Session-Id');
  headers.set('Access-Control-Allow-Methods', 'DELETE, GET, OPTIONS, POST');
  headers.set('Access-Control-Expose-Headers', 'Mcp-Protocol-Version, Mcp-Session-Id, WWW-Authenticate');
  headers.set('Vary', 'Origin');
  return headers;
}

function addCorsHeaders(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of corsHeaders(origin).entries()) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isMcpOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return isAllowedMcpOrigin(origin);
  } catch {
    return false;
  }
}

async function handleMcp(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (!isMcpOriginAllowed(request)) {
    return addCorsHeaders(new Response('Forbidden', {
      status: 403,
      headers: { 'Cache-Control': 'no-store' },
    }), origin);
  }

  if (request.method === 'OPTIONS') {
    return addCorsHeaders(new Response(null, { status: 204 }), origin);
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return addCorsHeaders(response, origin);
  } catch (error) {
    console.error('[mcp] MCP 请求失败', error instanceof Error ? error.message : String(error));
    return addCorsHeaders(new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32603, message: 'MCP 服务暂时不可用' },
      id: null,
    }), {
      status: 500,
      headers: {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
      },
    }), origin);
  } finally {
    await server.close().catch((error) => {
      console.error('[mcp] 关闭 MCP 请求上下文失败', error instanceof Error ? error.message : String(error));
    });
  }
}

export function GET(request: Request) {
  return handleMcp(request);
}

export function POST(request: Request) {
  return handleMcp(request);
}

export function DELETE(request: Request) {
  return handleMcp(request);
}

export function OPTIONS(request: Request) {
  return handleMcp(request);
}

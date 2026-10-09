import 'server-only';

export const MCP_SERVER_NAME = 'animetrack';
export const MCP_SERVER_VERSION = '1.0.0';

export function parseMcpBaseUrl(value: string, variableName = 'MCP_PUBLIC_BASE_URL'): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`${variableName} 必须使用 HTTP 或 HTTPS`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${variableName} 不得包含账号、密码、查询参数或片段`);
  }
  return url.toString().replace(/\/+$/, '');
}

export function getMcpPublicBaseUrl(): string {
  const configured = String(
    process.env.MCP_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000',
  ).trim();
  if (!configured) throw new Error('MCP_PUBLIC_BASE_URL 未配置');
  const parsed = parseMcpBaseUrl(configured);
  if (process.env.NODE_ENV === 'production' && !parsed.startsWith('https://')) {
    throw new Error('生产环境的 MCP_PUBLIC_BASE_URL 必须使用 HTTPS');
  }
  return parsed;
}

/** Base URL used in citation links returned by the standard search/fetch tools. */
export function getMcpSourceBaseUrl(): string {
  const configured = String(process.env.MCP_SOURCE_BASE_URL || '').trim();
  const sourceUrl = configured
    ? parseMcpBaseUrl(configured, 'MCP_SOURCE_BASE_URL')
    : getMcpPublicBaseUrl();
  if (process.env.NODE_ENV === 'production' && !sourceUrl.startsWith('https://')) {
    throw new Error('生产环境的 MCP_SOURCE_BASE_URL 必须使用 HTTPS');
  }
  return sourceUrl;
}

export function getMcpEndpointUrl(): string {
  return `${getMcpPublicBaseUrl()}/mcp`;
}

function configuredOrigins(): string[] {
  return String(process.env.MCP_ALLOWED_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => parseMcpBaseUrl(value, 'MCP_ALLOWED_ORIGINS'));
}

export function isAllowedMcpOrigin(origin: string): boolean {
  const normalized = parseMcpBaseUrl(origin, 'Origin');
  const allowed = new Set([
    getMcpPublicBaseUrl(),
    'https://chatgpt.com',
    'https://www.chatgpt.com',
    'https://chat.openai.com',
    ...configuredOrigins(),
  ]);
  return allowed.has(normalized);
}

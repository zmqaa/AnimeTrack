const { lookup: dnsLookup } = require('node:dns').promises;
const { isIP } = require('node:net');

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_REDIRECTS = 3;

function normalizeHostname(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

/** @param {Iterable<string>} hosts */
function normalizeAllowedHosts(hosts) {
  return new Set([...hosts].map(normalizeHostname).filter(Boolean));
}

function parseIpv4(address) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return octets;
}

function parseIpv6(address) {
  const normalized = address.toLowerCase().split('%', 1)[0];
  const halves = normalized.split('::');
  if (halves.length > 2) return null;

  function parseHalf(value) {
    if (!value) return [];
    const segments = value.split(':');
    const result = [];
    for (const segment of segments) {
      if (segment.includes('.')) {
        const ipv4 = parseIpv4(segment);
        if (!ipv4) return null;
        result.push((ipv4[0] << 8) | ipv4[1], (ipv4[2] << 8) | ipv4[3]);
      } else if (!/^[0-9a-f]{1,4}$/.test(segment)) {
        return null;
      } else {
        result.push(Number.parseInt(segment, 16));
      }
    }
    return result;
  }

  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] || '');
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;

  const groups = [...left, ...Array(Math.max(0, missing)).fill(0), ...right];
  if (groups.length !== 8) return null;
  return groups.flatMap((group) => [(group >> 8) & 0xff, group & 0xff]);
}

function isPublicIpv4(address) {
  const octets = parseIpv4(address);
  if (!octets) return false;
  const [first, second] = octets;

  if (first === 0 || first === 10 || first === 127) return false;
  if (first === 100 && second >= 64 && second <= 127) return false;
  if (first === 169 && second === 254) return false;
  if (first === 172 && second >= 16 && second <= 31) return false;
  if (first === 192 && second === 0) return false;
  if (first === 192 && second === 168) return false;
  if (first === 198 && (second === 18 || second === 19)) return false;
  if (first === 198 && second === 51 && octets[2] === 100) return false;
  if (first === 203 && second === 0 && octets[2] === 113) return false;
  if (first >= 224) return false;
  return true;
}

function isPublicIpv6(address) {
  const bytes = parseIpv6(address);
  if (!bytes) return false;

  const ipv4Mapped = bytes.slice(0, 10).every((value) => value === 0)
    && bytes[10] === 0xff
    && bytes[11] === 0xff;
  if (ipv4Mapped) {
    return isPublicIpv4(bytes.slice(12).join('.'));
  }

  // 可公开路由的单播 IPv6 目前位于 2000::/3。先拒绝其他地址，覆盖
  // ::1、链路本地、ULA、组播和 IPv4 兼容等特殊范围。
  if ((bytes[0] & 0xe0) !== 0x20) return false;

  // 2001:db8::/32 文档地址、2001::/32 Teredo 和 ORCHID 均不应作为封面来源。
  if (bytes[0] === 0x20 && bytes[1] === 0x01) {
    if (bytes[2] === 0x0d && bytes[3] === 0xb8) return false;
    if (bytes[2] === 0x00 && bytes[3] === 0x00) return false;
    if (bytes[2] === 0x00 && (bytes[3] & 0xf0) === 0x10) return false;
  }

  // 6to4 地址携带一个 IPv4 目标，嵌入的地址也必须是公网地址。
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isPublicIpv4(bytes.slice(2, 6).join('.'));
  }
  return true;
}

function isPublicIpAddress(address) {
  const normalized = normalizeHostname(address);
  const family = isIP(normalized);
  if (family === 4) return isPublicIpv4(normalized);
  if (family === 6) return isPublicIpv6(normalized);
  return false;
}

function validateTrustedHttpsUrl(value, allowedHosts) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('远程地址格式无效');
  }

  if (url.protocol !== 'https:') throw new Error('远程地址必须使用 HTTPS');
  if (url.username || url.password) throw new Error('远程地址不能包含账号信息');
  if (url.port && url.port !== '443') throw new Error('远程地址不能使用非标准端口');

  const hostname = normalizeHostname(url.hostname);
  const normalizedAllowedHosts = normalizeAllowedHosts(allowedHosts);
  if (!hostname || !normalizedAllowedHosts.has(hostname)) {
    throw new Error(`远程地址域名不在允许列表中: ${hostname || '(empty)'}`);
  }
  return { url, hostname };
}

async function defaultLookup(hostname) {
  return dnsLookup(hostname, { all: true, verbatim: true });
}

/**
 * @param {string | URL} value
 * @param {{
 *   allowedHosts: Iterable<string>,
 *   lookup?: (hostname: string) => Promise<Array<{ address: string, family?: number }>>,
 * }} options
 */
async function assertSafeRemoteUrl(value, options) {
  const { url, hostname } = validateTrustedHttpsUrl(String(value), options.allowedHosts);
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await (options.lookup || defaultLookup)(hostname);

  if (!Array.isArray(addresses) || addresses.length === 0) {
    throw new Error(`远程地址没有可用的 DNS 记录: ${hostname}`);
  }
  const blockedAddress = addresses.find((record) => !isPublicIpAddress(record.address));
  if (blockedAddress) {
    throw new Error(`远程地址解析到了非公网 IP: ${blockedAddress.address}`);
  }
  return url;
}

async function cancelResponseBody(response) {
  try {
    await response.body?.cancel();
  } catch {
    // 跳转响应可能没有正文，释放失败不应掩盖地址校验结果。
  }
}

/**
 * @param {string | URL} value
 * @param {{
 *   allowedHosts: Iterable<string>,
 *   fetchImpl?: typeof fetch,
 *   lookup?: (hostname: string) => Promise<Array<{ address: string, family?: number }>>,
 *   maxRedirects?: number,
 *   requestInit?: RequestInit,
 * }} options
 * @returns {Promise<Response>}
 */
async function fetchWithValidatedRedirects(value, options) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const maxRedirects = options.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  if (typeof fetchImpl !== 'function') throw new Error('当前运行环境不支持 fetch');
  if (!Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 10) {
    throw new Error('最大跳转次数必须是 0 到 10 之间的整数');
  }

  let currentUrl = await assertSafeRemoteUrl(value, options);
  let redirectCount = 0;
  while (true) {
    const response = await fetchImpl(currentUrl, {
      ...(options.requestInit || {}),
      redirect: 'manual',
    });
    if (!REDIRECT_STATUSES.has(response.status)) return response;

    const location = response.headers.get('location');
    if (!location) return response;
    if (redirectCount >= maxRedirects) {
      await cancelResponseBody(response);
      throw new Error(`远程地址跳转超过 ${maxRedirects} 次限制`);
    }

    const nextUrl = new URL(location, currentUrl);
    await cancelResponseBody(response);
    currentUrl = await assertSafeRemoteUrl(nextUrl, options);
    redirectCount += 1;
  }
}

module.exports = {
  DEFAULT_MAX_REDIRECTS,
  assertSafeRemoteUrl,
  fetchWithValidatedRedirects,
  isPublicIpAddress,
  normalizeAllowedHosts,
  validateTrustedHttpsUrl,
};

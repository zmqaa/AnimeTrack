import { describe, expect, it } from 'vitest';

import {
  assertSafeRemoteUrl,
  fetchWithValidatedRedirects,
  isPublicIpAddress,
} from '../../scripts/shared/safe_remote_fetch';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

describe('safe remote fetch', () => {
  it('distinguishes public addresses from local, private, and reserved ranges', () => {
    for (const address of [
      '8.8.8.8',
      '1.1.1.1',
      '2606:4700:4700::1111',
      '2001:4860:4860::8888',
      '::ffff:8.8.8.8',
    ]) {
      expect(isPublicIpAddress(address), address).toBe(true);
    }

    for (const address of [
      '0.0.0.0',
      '10.0.0.1',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '::',
      '::1',
      '::ffff:127.0.0.1',
      'fc00::1',
      'fe80::1',
      'ff02::1',
      '2001:db8::1',
      '2002:7f00:1::',
    ]) {
      expect(isPublicIpAddress(address), address).toBe(false);
    }
  });

  it('requires an allowlisted HTTPS host, standard port, and no credentials', async () => {
    const options = {
      allowedHosts: new Set(['images.example.com']),
      lookup: publicLookup,
    };

    await expect(assertSafeRemoteUrl('https://images.example.com/cover.jpg', options))
      .resolves.toEqual(new URL('https://images.example.com/cover.jpg'));
    await expect(assertSafeRemoteUrl('http://images.example.com/cover.jpg', options))
      .rejects.toThrow('必须使用 HTTPS');
    await expect(assertSafeRemoteUrl('https://user:pass@images.example.com/cover.jpg', options))
      .rejects.toThrow('不能包含账号信息');
    await expect(assertSafeRemoteUrl('https://images.example.com:8443/cover.jpg', options))
      .rejects.toThrow('不能使用非标准端口');
    await expect(assertSafeRemoteUrl('https://untrusted.example.com/cover.jpg', options))
      .rejects.toThrow('域名不在允许列表');
  });

  it('blocks a trusted hostname when any DNS result is not public', async () => {
    await expect(assertSafeRemoteUrl('https://images.example.com/cover.jpg', {
      allowedHosts: ['images.example.com'],
      lookup: async () => [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
    })).rejects.toThrow('解析到了非公网 IP: 127.0.0.1');
  });

  it('revalidates every relative or cross-host redirect before fetching it', async () => {
    const requests: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      requests.push(`${url} (${init?.redirect})`);
      if (url === 'https://images.example.com/start') {
        return new Response(null, {
          status: 302,
          headers: { location: '/middle' },
        });
      }
      if (url === 'https://images.example.com/middle') {
        return new Response(null, {
          status: 307,
          headers: { location: 'https://cdn.example.com/final.jpg' },
        });
      }
      return new Response(Buffer.alloc(512), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    };

    const response = await fetchWithValidatedRedirects('https://images.example.com/start', {
      allowedHosts: ['images.example.com', 'cdn.example.com'],
      fetchImpl,
      lookup: publicLookup,
    });

    expect(response.status).toBe(200);
    expect(requests).toEqual([
      'https://images.example.com/start (manual)',
      'https://images.example.com/middle (manual)',
      'https://cdn.example.com/final.jpg (manual)',
    ]);
  });

  it('rejects a redirect to an allowlisted name that resolves to the local network', async () => {
    const requests: string[] = [];
    const fetchImpl = async (input: RequestInfo | URL): Promise<Response> => {
      requests.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: 'https://internal.example.com/admin' },
      });
    };

    await expect(fetchWithValidatedRedirects('https://images.example.com/start', {
      allowedHosts: ['images.example.com', 'internal.example.com'],
      fetchImpl,
      lookup: async (hostname: string) => [{
        address: hostname === 'internal.example.com' ? '169.254.169.254' : '93.184.216.34',
        family: 4,
      }],
    })).rejects.toThrow('解析到了非公网 IP: 169.254.169.254');
    expect(requests).toEqual(['https://images.example.com/start']);
  });

  it('stops redirect loops after the configured maximum', async () => {
    let requestCount = 0;
    const fetchImpl = async (): Promise<Response> => {
      requestCount += 1;
      return new Response(null, {
        status: 302,
        headers: { location: '/again' },
      });
    };

    await expect(fetchWithValidatedRedirects('https://images.example.com/start', {
      allowedHosts: ['images.example.com'],
      fetchImpl,
      lookup: publicLookup,
      maxRedirects: 3,
    })).rejects.toThrow('跳转超过 3 次限制');
    expect(requestCount).toBe(4);
  });
});

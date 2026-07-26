#!/usr/bin/env node

const baseUrl = (process.argv[2] || '').replace(/\/$/, '');

if (!baseUrl) {
  console.error('[asset-check] ERROR: base URL is required');
  process.exit(2);
}

async function main() {
  const pageResponse = await fetch(`${baseUrl}/login`, { redirect: 'follow' });
  if (!pageResponse.ok) {
    throw new Error(`/login returned HTTP ${pageResponse.status}`);
  }

  const html = await pageResponse.text();
  const assetPaths = [...new Set(
    [...html.matchAll(/(?:href|src)="([^"]*\/_next\/static\/[^"]+\.(?:css|js))"/g)]
      .map((match) => match[1]),
  )];
  if (assetPaths.length === 0) {
    throw new Error('No CSS or JavaScript assets were found in /login');
  }

  for (const assetPath of assetPaths) {
    const response = await fetch(new URL(assetPath, baseUrl));
    if (!response.ok) {
      throw new Error(`${assetPath} returned HTTP ${response.status}`);
    }
  }

  console.log(`[asset-check] Verified ${assetPaths.length} assets from ${baseUrl}/login`);
}

main().catch((error) => {
  console.error(`[asset-check] ERROR: ${error.message}`);
  process.exit(1);
});

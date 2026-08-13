const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');
const exampleDirectory = path.join(projectRoot, 'config/nginx');

function readExample(name) {
  return fs.readFileSync(path.join(exampleDirectory, name), 'utf8');
}

function main() {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'animetrack-nginx-check-'));
  try {
    const certificatePath = path.join(temporaryDirectory, 'certificate.pem');
    const privateKeyPath = path.join(temporaryDirectory, 'private-key.pem');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=anime.example.com',
      '-keyout', privateKeyPath,
      '-out', certificatePath,
    ], { stdio: 'pipe' });

    const proxyPath = path.join(temporaryDirectory, 'animetrack-proxy.conf');
    const securityPath = path.join(temporaryDirectory, 'animetrack-security.conf');
    const rateLimitPath = path.join(temporaryDirectory, 'animetrack-rate-limits.conf');
    const sitePath = path.join(temporaryDirectory, 'animetrack-site.conf');
    fs.writeFileSync(proxyPath, readExample('animetrack-proxy.conf.example'));
    fs.writeFileSync(securityPath, readExample('animetrack-security.conf.example'));
    fs.writeFileSync(rateLimitPath, readExample('animetrack-rate-limits.conf.example'));
    fs.writeFileSync(sitePath, readExample('animetrack-site.conf.example')
      .replaceAll('/etc/nginx/snippets/animetrack-proxy.conf', proxyPath)
      .replaceAll('/etc/nginx/snippets/animetrack-security.conf', securityPath)
      .replace('/etc/letsencrypt/live/anime.example.com/fullchain.pem', certificatePath)
      .replace('/etc/letsencrypt/live/anime.example.com/privkey.pem', privateKeyPath)
      .replace('listen 80;', 'listen 127.0.0.1:18080;')
      .replace('listen [::]:80;', 'listen [::1]:18080;')
      .replace('listen 443 ssl http2;', 'listen 127.0.0.1:18443 ssl http2;')
      .replace('listen [::]:443 ssl http2;', 'listen [::1]:18443 ssl http2;'));

    const rootConfigPath = path.join(temporaryDirectory, 'nginx.conf');
    fs.writeFileSync(rootConfigPath, [
      `pid ${path.join(temporaryDirectory, 'nginx.pid')};`,
      'error_log stderr;',
      'events {}',
      'http {',
      '    access_log off;',
      `    include ${rateLimitPath};`,
      `    include ${sitePath};`,
      '}',
      '',
    ].join('\n'));

    const result = spawnSync('nginx', ['-t', '-p', `${temporaryDirectory}/`, '-c', rootConfigPath], {
      encoding: 'utf8',
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(output || `nginx -t 退出码为 ${result.status}`);
    console.log(output);
    console.log('[nginx-check] 示例配置校验通过');
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  console.error('[nginx-check] 示例配置校验失败:', error instanceof Error ? error.message : error);
  process.exit(1);
}

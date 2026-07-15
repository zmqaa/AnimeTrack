/**
 * 历史封面数据迁移脚本
 *
 * 将数据库中所有远程封面 URL（lain.bgm.tv / cdn.myanimelist.net）
 * 下载到本地 public/covers/，并更新 coverUrl 字段。
 *
 * 用法：node scripts/migrate-covers.js [--dry-run] [--concurrency 5]
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { getDb, projectRoot } = require('./shared/db_env');

const COVERS_DIR = path.join(projectRoot, 'public', 'covers');
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = Math.max(1, Math.min(10, parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '3', 10)));

// ── Helpers ────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isRemoteUrl(value) {
  if (!value || typeof value !== 'string') return false;
  return /^https?:\/\//i.test(value.trim());
}

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, { timeout: 15000, headers: { 'User-Agent': 'AnimeTrack/1.0 (cover migrator)' } }, (res) => {
      // Follow redirects (max 3)
      if ([301, 302, 307, 308].includes(res.statusCode)) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          return resolve(downloadFile(redirectUrl));
        }
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 512) {
          return reject(new Error(`文件过小 (${buffer.length} bytes)`));
        }
        resolve(buffer);
      });
      res.on('error', reject);
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
    req.on('error', reject);
  });
}

function saveCover(animeId, buffer) {
  const filePath = path.join(COVERS_DIR, `${animeId}.jpg`);
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, buffer);
  }
  return `/covers/${animeId}.jpg`;
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log(`封面迁移脚本${DRY_RUN ? ' (DRY RUN 模式，不实际写入)' : ''}`);
  console.log(`并发数: ${CONCURRENCY}`);
  console.log('');

  const db = getDb();

  // 查找所有远程 URL
  const rows = db.prepare(`
    SELECT id, title, coverUrl FROM anime
    WHERE coverUrl IS NOT NULL AND coverUrl != ''
      AND (coverUrl LIKE 'http://%' OR coverUrl LIKE 'https://%')
    ORDER BY id
  `).all();

  console.log(`找到 ${rows.length} 条远程封面记录\n`);

  if (rows.length === 0) {
    console.log('没有需要迁移的记录。');
    db.close();
    return;
  }

  // 显示待处理的 URL 主机分布
  const hosts = {};
  for (const row of rows) {
    try {
      const host = new URL(row.coverUrl).hostname;
      hosts[host] = (hosts[host] || 0) + 1;
    } catch { hosts['(invalid)'] = (hosts['(invalid)'] || 0) + 1; }
  }
  console.log('URL 来源分布:');
  for (const [host, count] of Object.entries(hosts)) {
    console.log(`  ${host}: ${count} 条`);
  }
  console.log('');

  ensureDir(COVERS_DIR);

  // 并发下载
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  const updateStmt = DRY_RUN ? null : db.prepare('UPDATE anime SET coverUrl = ?, updatedAt = datetime(\'now\', \'localtime\') WHERE id = ?');

  const pool = [...rows];
  const workers = Array.from({ length: CONCURRENCY }, async (_, workerIndex) => {
    while (pool.length > 0) {
      const row = pool.shift();
      if (!row) break;

      const label = `[#${row.id}] ${row.title.slice(0, 30)}`;
      try {
        const buffer = await downloadFile(row.coverUrl);
        const localPath = saveCover(row.id, buffer);
        if (!DRY_RUN) {
          updateStmt.run(localPath, row.id);
        }
        succeeded++;
        console.log(`  ✓ ${label} → ${localPath}`);
      } catch (err) {
        failed++;
        console.log(`  ✗ ${label} — ${err.message}`);
        // 下载失败时保留远程 URL，方便之后继续重试。
      }
    }
  });

  await Promise.all(workers);

  console.log('');
  console.log(`完成！成功: ${succeeded}, 失败: ${failed}, 总计: ${rows.length}`);

  if (failed > 0 && !DRY_RUN) {
    console.log(`\n${failed} 条记录下载失败，coverUrl 已保留。可稍后重新运行脚本继续重试。`);
  }

  db.close();
}

main().catch((err) => {
  console.error('迁移脚本异常:', err);
  process.exit(1);
});

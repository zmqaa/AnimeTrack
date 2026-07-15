const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const Database = require('better-sqlite3');

const projectRoot = process.cwd();
const db = new Database(path.join(projectRoot, 'data', 'animetrack.db'));
const coversDir = path.join(projectRoot, 'public', 'covers');
const timeoutMs = Number(process.env.COVER_DOWNLOAD_TIMEOUT_MS || 30000);

const sourceUrls = new Map([
  [203, 'https://lain.bgm.tv/pic/cover/l/cd/71/575057_BCS8O.jpg'],
  [204, 'https://lain.bgm.tv/pic/cover/l/5d/5a/564289_b6sb7.jpg'],
  [205, 'https://lain.bgm.tv/pic/cover/l/e1/34/379442_l87Dd.jpg'],
  [206, 'https://lain.bgm.tv/pic/cover/l/24/d6/569161_MtUOQ.jpg'],
  [207, 'https://lain.bgm.tv/pic/cover/l/f2/9f/28900_PB3pC.jpg'],
  [208, 'https://lain.bgm.tv/pic/cover/l/cb/c2/99796_NV7tq.jpg'],
  [209, 'https://lain.bgm.tv/pic/cover/l/3e/f2/127573_HfPRJ.jpg'],
  [210, 'https://lain.bgm.tv/pic/cover/l/e8/57/323626_4yEBY.jpg'],
  [211, 'https://lain.bgm.tv/pic/cover/l/e8/57/323626_4yEBY.jpg'],
  [212, 'https://lain.bgm.tv/pic/cover/l/6b/ca/449567_uN5U8.jpg'],
  [213, 'https://lain.bgm.tv/pic/cover/l/ee/96/100040_cs2Gg.jpg'],
  [214, 'https://lain.bgm.tv/pic/cover/l/e2/68/240828_H4uLo.jpg'],
]);

function parseIds() {
  const arg = process.argv.find((item) => item.startsWith('--ids='));
  if (!arg) return null;
  const ids = arg.slice('--ids='.length)
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && sourceUrls.has(value));
  return ids.length > 0 ? new Set(ids) : null;
}

function download(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    const request = protocol.get(url, {
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'AnimeTrack/1.0 (placeholder cover retry)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    }, (response) => {
      const redirectUrl = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.statusCode) && redirectUrl && redirectCount < 3) {
        response.resume();
        const nextUrl = new URL(redirectUrl, url).toString();
        resolve(download(nextUrl, redirectCount + 1));
        return;
      }

      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (buffer.length < 512) {
          reject(new Error(`file too small (${buffer.length} bytes)`));
          return;
        }
        resolve(buffer);
      });
      response.on('error', reject);
    });

    request.on('timeout', () => {
      request.destroy(new Error(`timeout after ${timeoutMs}ms`));
    });
    request.on('error', reject);
  });
}

function formatError(error) {
  if (!error) return 'unknown error';
  const parts = [];
  if (error.code) parts.push(error.code);
  if (error.message) parts.push(error.message);
  return parts.length > 0 ? parts.join(': ') : String(error);
}

async function main() {
  fs.mkdirSync(coversDir, { recursive: true });

  const selectedIds = parseIds();
  const rows = db.prepare(`
    SELECT id, title, coverUrl
    FROM anime
    WHERE coverUrl LIKE '/covers/%.svg'
    ORDER BY id
  `).all().filter((row) => sourceUrls.has(row.id) && (!selectedIds || selectedIds.has(row.id)));

  if (rows.length === 0) {
    console.log('No placeholder covers need retrying.');
    return;
  }

  const update = db.prepare('UPDATE anime SET coverUrl = ? WHERE id = ?');
  let succeeded = 0;
  let failed = 0;

  for (const row of rows) {
    const url = sourceUrls.get(row.id);
    try {
      const buffer = await download(url);
      const filePath = path.join(coversDir, `${row.id}.jpg`);
      fs.writeFileSync(filePath, buffer);
      update.run(`/covers/${row.id}.jpg`, row.id);
      succeeded += 1;
      console.log(`OK  #${row.id} ${row.title} -> /covers/${row.id}.jpg`);
    } catch (error) {
      failed += 1;
      console.log(`ERR #${row.id} ${row.title} -> ${formatError(error)}`);
    }
  }

  console.log(JSON.stringify({ succeeded, failed, total: rows.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.close());

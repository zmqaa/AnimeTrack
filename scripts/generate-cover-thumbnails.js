const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const coversDirectory = path.resolve(
  String(process.env.ANIMETRACK_COVERS_DIR || path.join(process.cwd(), 'public', 'covers')),
);
const force = process.argv.includes('--force');
const concurrencyArg = process.argv.find((arg) => arg.startsWith('--concurrency='));
const concurrency = Math.min(8, Math.max(1, Number(concurrencyArg?.split('=')[1]) || 4));
const sourcePattern = /^(\d+)\.(jpg|jpeg|png|webp|gif)$/i;
const extensionPriority = new Map([
  ['jpg', 0],
  ['jpeg', 1],
  ['png', 2],
  ['webp', 3],
  ['gif', 4],
]);

async function generateThumbnail(sourcePath, outputPath) {
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp.webp`;
  try {
    await sharp(sourcePath)
      .rotate()
      .resize(600, 800, {
        fit: 'cover',
        position: 'centre',
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toFile(temporaryPath);
    await fs.promises.rename(temporaryPath, outputPath);
  } catch (error) {
    await fs.promises.unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function main() {
  const entries = await fs.promises.readdir(coversDirectory, { withFileTypes: true });
  const sourceById = new Map();

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = sourcePattern.exec(entry.name);
    if (!match) continue;
    const id = Number(match[1]);
    const extension = match[2].toLowerCase();
    const current = sourceById.get(id);
    if (!current || extensionPriority.get(extension) < extensionPriority.get(current.extension)) {
      sourceById.set(id, { name: entry.name, extension });
    }
  }

  const queue = Array.from(sourceById.entries()).sort((left, right) => left[0] - right[0]);
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let originalBytes = 0;
  let thumbnailBytes = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;
      const [id, source] = next;
      const sourcePath = path.join(coversDirectory, source.name);
      const outputPath = path.join(coversDirectory, `${id}.thumb.webp`);

      try {
        const sourceStat = await fs.promises.stat(sourcePath);
        const outputStat = await fs.promises.stat(outputPath).catch(() => null);
        if (!force && outputStat && outputStat.mtimeMs >= sourceStat.mtimeMs) {
          skipped += 1;
          originalBytes += sourceStat.size;
          thumbnailBytes += outputStat.size;
          continue;
        }

        await generateThumbnail(sourcePath, outputPath);
        const thumbnailStat = await fs.promises.stat(outputPath);
        generated += 1;
        originalBytes += sourceStat.size;
        thumbnailBytes += thumbnailStat.size;
      } catch (error) {
        failed += 1;
        console.warn(`[thumbnail] #${id} 生成失败: ${error.message}`);
      }
    }
  });

  await Promise.all(workers);
  const saving = originalBytes > 0
    ? Math.round((1 - thumbnailBytes / originalBytes) * 100)
    : 0;
  console.log(`[thumbnail] 目录: ${coversDirectory}`);
  console.log(`[thumbnail] 新生成 ${generated}，跳过 ${skipped}，失败 ${failed}`);
  console.log(`[thumbnail] 原图 ${(originalBytes / 1024 / 1024).toFixed(1)}MB → 缩略图 ${(thumbnailBytes / 1024 / 1024).toFixed(1)}MB，减少 ${saving}%`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('[thumbnail] 执行失败:', error);
  process.exitCode = 1;
});

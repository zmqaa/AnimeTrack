import 'server-only';
import { existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { writeFile, unlink, readdir } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { getCoversDirectory } from '@/lib/runtime-paths';

const LEGACY_COVERS_PUBLIC_PREFIX = '/covers';
const DATA_COVERS_PUBLIC_PREFIX = '/api/local-covers';
const COVER_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'] as const;

/** 封面存放的公开路径前缀 */
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const DEFAULT_ALLOWED_COVER_HOSTS = ['lain.bgm.tv', 'cdn.myanimelist.net'];

function allowedCoverHosts(): Set<string> {
  const configured = (process.env.COVER_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  return new Set([...DEFAULT_ALLOWED_COVER_HOSTS, ...configured]);
}

function isAllowedRemoteCoverUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && allowedCoverHosts().has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

async function readBodyWithLimit(response: Response): Promise<Buffer> {
  if (!response.body) throw new Error('封面响应没有内容');
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_COVER_BYTES) {
      await reader.cancel();
      throw new Error(`封面超过 ${MAX_COVER_BYTES / 1024 / 1024} MB 限制`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

// 懒初始化目录（首次写入时自动创建）
let dirReady = false;
function ensureCoversDir(): void {
  if (dirReady) return;
  const coversDirectory = getCoversDirectory();
  if (!existsSync(coversDirectory)) {
    mkdirSync(coversDirectory, { recursive: true });
  }
  dirReady = true;
}

/** 判断是否为远程 URL */
export function isRemoteUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

/** 判断是否为本地封面路径 */
export function isLocalCoverPath(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.startsWith(LEGACY_COVERS_PUBLIC_PREFIX)
    || trimmed.startsWith(DATA_COVERS_PUBLIC_PREFIX);
}

export function resolveDisplayCoverUrl(
  localCoverUrl: string | null | undefined,
  remoteCoverUrl: string | null | undefined,
): string | undefined {
  const local = String(localCoverUrl || '').trim();
  const remote = String(remoteCoverUrl || '').trim();

  if (!local || !isLocalCoverPath(local)) {
    return remote || undefined;
  }

  const fileName = basename(local.split(/[?#]/, 1)[0]);
  const localFilePath = local.startsWith(DATA_COVERS_PUBLIC_PREFIX)
    ? join(getCoversDirectory(), fileName)
    : join(process.cwd(), 'public', 'covers', fileName);

  // public/ 下运行时新增的文件不会被 Next.js 生产服务稳定识别。
  // 无论数据库保存的是旧版 /covers 路径还是新版动态路径，展示时都
  // 统一通过 Route Handler 读取磁盘，因此重新下载封面后无需重启服务。
  if (!existsSync(localFilePath)) {
    return remote || undefined;
  }

  // 文件名基于番剧 ID，覆盖图片时路径本身不会改变。附加修改时间可避免
  // 浏览器继续复用同一路径下的旧封面（也能淘汰修复前已缓存的响应）。
  try {
    const version = Math.trunc(statSync(localFilePath).mtimeMs).toString(36);
    return `${DATA_COVERS_PUBLIC_PREFIX}/${fileName}?v=${version}`;
  } catch {
    // 文件可能恰好在 existsSync 与 statSync 之间被删除。
    return remote || undefined;
  }
}

/** 判断是否为系统生成的本地占位封面 */
export function isPlaceholderCoverPath(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /placeholder/i.test(trimmed) || /^\/covers\/\d+\.svg(?:[?#].*)?$/i.test(trimmed);
}

/** 获取封面文件的磁盘绝对路径 */
function coverFilePath(animeId: number): string {
  return join(getCoversDirectory(), `${animeId}.jpg`);
}

/** 获取某个番剧可能拥有的全部本地封面路径（含旧版 public/covers 目录）。 */
function coverFilePaths(animeId: number): string[] {
  const directories = new Set([
    resolve(getCoversDirectory()),
    resolve(process.cwd(), 'public', 'covers'),
  ]);

  return [...directories].flatMap((directory) =>
    COVER_FILE_EXTENSIONS.map((extension) => join(directory, `${animeId}.${extension}`)),
  );
}

/** 获取封面文件的公开 URL 路径 */
function coverPublicPath(animeId: number): string {
  return `${DATA_COVERS_PUBLIC_PREFIX}/${animeId}.jpg`;
}

/**
 * 下载远程封面图到本地 public/covers/
 * @returns 本地公开路径，失败返回 null
 */
export async function downloadCoverImage(
  remoteUrl: string,
  animeId: number,
): Promise<string | null> {
  const url = remoteUrl.trim();
  if (!url) return null;

  if (!isAllowedRemoteCoverUrl(url)) {
    console.warn(`[cover] 已阻止不受信任的封面地址: ${url}`);
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AnimeTrack/1.0 (cover downloader)',
      },
    });

    if (!response.ok) {
      console.warn(`[cover] 下载失败 HTTP ${response.status}: ${url}`);
      return null;
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      console.warn(`[cover] 响应不是图片 (${contentType || 'unknown'}): ${url}`);
      return null;
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_COVER_BYTES) {
      console.warn(`[cover] 文件过大 (${contentLength} bytes): ${url}`);
      return null;
    }

    const buffer = await readBodyWithLimit(response);
    if (buffer.length < 512) {
      // 太小，不是有效图片
      console.warn(`[cover] 文件过小 (${buffer.length} bytes): ${url}`);
      return null;
    }

    ensureCoversDir();
    await writeFile(coverFilePath(animeId), buffer);

    return coverPublicPath(animeId);
  } catch (error) {
    console.warn(`[cover] 下载异常: ${url}`, (error as Error)?.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 删除本地封面文件（如果存在）
 */
export async function deleteCoverImage(animeId: number): Promise<void> {
  await Promise.all(coverFilePaths(animeId).map(async (filePath) => {
    try {
      await unlink(filePath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      // 文件不存在不算错误
      if (err.code !== 'ENOENT') {
        console.warn(`[cover] 删除封面文件失败 id=${animeId}:`, err.message);
      }
    }
  }));
}

/** 同步删除封面文件 */
export function deleteCoverImageSync(animeId: number): void {
  for (const filePath of coverFilePaths(animeId)) {
    try {
      unlinkSync(filePath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== 'ENOENT') {
        console.warn(`[cover] 删除封面文件失败 id=${animeId}:`, err.message);
      }
    }
  }
}

/** 清空系统管理的本地封面文件，保留封面目录本身。 */
export async function clearAllCoverImages(): Promise<number> {
  const coversDirectory = getCoversDirectory();
  if (!existsSync(coversDirectory)) return 0;

  const entries = await readdir(coversDirectory, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  await Promise.all(files.map((entry) => unlink(join(coversDirectory, entry.name))));
  return files.length;
}

/**
 * 解析封面 URL：远程 URL 自动下载到本地，返回本地路径
 *
 * @param coverUrl  当前封面字段的值（可能是远程 URL、本地路径、null）
 * @param animeId   番剧 ID
 * @returns 应存入数据库的 coverUrl 值
 *
 * 逻辑：
 * - 远程 URL → 下载到 public/covers/{id}.jpg → 返回本地路径；下载失败返回 null
 * - 本地路径 → 直接返回（无需变动）
 * - null / 空 → 删除本地文件 → 返回 null
 */
export async function resolveLocalCoverImage(
  coverUrl: string | null | undefined,
  animeId: number,
): Promise<string | null> {
  const trimmed = (coverUrl ?? '').trim();

  // 空值 → 清理本地文件
  if (!trimmed) {
    await deleteCoverImage(animeId);
    return null;
  }

  // 已经是本地路径 → 保持不变
  if (isLocalCoverPath(trimmed)) {
    return trimmed;
  }

  // 远程 URL → 下载到本地
  if (isRemoteUrl(trimmed)) {
    const localPath = await downloadCoverImage(trimmed, animeId);
    if (localPath) {
      return localPath;
    }
    console.warn(`[cover] 封面下载失败，将继续使用远程来源地址: ${trimmed}`);
    return null;
  }

  // 既不是远程 URL 也不是本地路径（异常值）→ 清理
  await deleteCoverImage(animeId);
  return null;
}

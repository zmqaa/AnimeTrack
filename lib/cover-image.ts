import 'server-only';
import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';

const COVERS_DIR = join(process.cwd(), 'public', 'covers');

/** 封面存放的公开路径前缀 */
const COVERS_PUBLIC_PREFIX = '/covers';
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
  if (!existsSync(COVERS_DIR)) {
    mkdirSync(COVERS_DIR, { recursive: true });
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
  return value.trim().startsWith(COVERS_PUBLIC_PREFIX);
}

/** 判断是否为系统生成的本地占位封面 */
export function isPlaceholderCoverPath(value: string | null | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return /placeholder/i.test(trimmed) || /^\/covers\/\d+\.svg(?:[?#].*)?$/i.test(trimmed);
}

/** 获取封面文件的磁盘绝对路径 */
function coverFilePath(animeId: number): string {
  return join(COVERS_DIR, `${animeId}.jpg`);
}

/** 获取封面文件的公开 URL 路径 */
function coverPublicPath(animeId: number): string {
  return `${COVERS_PUBLIC_PREFIX}/${animeId}.jpg`;
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
  try {
    await unlink(coverFilePath(animeId));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // 文件不存在不算错误
    if (err.code !== 'ENOENT') {
      console.warn(`[cover] 删除封面文件失败 id=${animeId}:`, err.message);
    }
  }
}

/** 同步删除封面文件 */
export function deleteCoverImageSync(animeId: number): void {
  try {
    unlinkSync(coverFilePath(animeId));
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      console.warn(`[cover] 删除封面文件失败 id=${animeId}:`, err.message);
    }
  }
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
export async function resolveCoverImage(
  coverUrl: string | null | undefined,
  animeId: number,
  options: { fallbackOnDownloadFailure?: string | null; preserveRemoteOnFailure?: boolean } = {},
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
    const fallback = options.fallbackOnDownloadFailure;
    if (fallback !== undefined) {
      console.warn(`[cover] 封面下载失败，保留原封面: ${trimmed}`);
      return fallback;
    }
    if (options.preserveRemoteOnFailure !== false) {
      console.warn(`[cover] 封面下载失败，保留远程 URL: ${trimmed}`);
      return trimmed;
    }
    console.warn(`[cover] 封面下载失败，清空 coverUrl: ${trimmed}`);
    return null;
  }

  // 既不是远程 URL 也不是本地路径（异常值）→ 清理
  await deleteCoverImage(animeId);
  return null;
}

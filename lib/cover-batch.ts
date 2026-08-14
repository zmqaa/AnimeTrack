import 'server-only';

import { getRawDb } from './db';
import {
  downloadCoverImage,
  downloadMangaCoverImage,
  hasLocalCoverImage,
  isRemoteUrl,
} from './cover-image';
import { fetchAnimeCoverByQueries } from './anime-provider';
import { getMangaMetadataCandidate } from './manga-provider';

export interface CoverBatchGroupResult {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
}

export interface CoverBatchResult extends CoverBatchGroupResult {
  anime: CoverBatchGroupResult;
  manga: CoverBatchGroupResult;
}

interface BaseCoverSourceRow {
  id: number;
  coverUrl?: string | null;
  localCoverUrl?: string | null;
}

interface AnimeCoverSourceRow extends BaseCoverSourceRow {
  kind: 'anime';
  title: string;
  originalTitle?: string | null;
}

interface MangaCoverSourceRow extends BaseCoverSourceRow {
  kind: 'manga';
  bangumiId?: number | null;
}

type CoverSourceRow = AnimeCoverSourceRow | MangaCoverSourceRow;

function createGroupResult(total: number): CoverBatchGroupResult {
  return { total, downloaded: 0, skipped: 0, failed: 0 };
}

/** 下载缺失的动漫与漫画远程封面，并刷新各自的本地缓存路径。 */
export async function downloadAllRemoteCovers(concurrency = 3): Promise<CoverBatchResult> {
  const db = getRawDb();
  const animeRows = (db.prepare(`
    SELECT id, title, original_title AS originalTitle, coverUrl, localCoverUrl
    FROM anime
    ORDER BY id
  `).all() as Array<Omit<AnimeCoverSourceRow, 'kind'>>)
    .map((row) => ({ ...row, kind: 'anime' as const }));
  const mangaRows = (db.prepare(`
    SELECT id, bangumi_id AS bangumiId, coverUrl, localCoverUrl
    FROM manga
    ORDER BY id
  `).all() as Array<Omit<MangaCoverSourceRow, 'kind'>>)
    .map((row) => ({ ...row, kind: 'manga' as const }));

  const updateAnimeCover = db.prepare(
    'UPDATE anime SET coverUrl = ?, localCoverUrl = ?, updatedAt = ? WHERE id = ?',
  );
  const updateMangaCover = db.prepare(
    'UPDATE manga SET coverUrl = ?, localCoverUrl = ?, updatedAt = ? WHERE id = ?',
  );
  const queue: CoverSourceRow[] = [...animeRows, ...mangaRows];
  const anime = createGroupResult(animeRows.length);
  const manga = createGroupResult(mangaRows.length);
  const workerCount = Math.max(1, Math.min(5, Math.floor(concurrency)));

  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) return;
      const result = row.kind === 'anime' ? anime : manga;

      if (hasLocalCoverImage(row.localCoverUrl)) {
        result.skipped++;
        continue;
      }

      try {
        const existingRemoteCoverUrl = isRemoteUrl(row.coverUrl) ? row.coverUrl?.trim() : undefined;
        const remoteCoverUrl = existingRemoteCoverUrl || (row.kind === 'anime'
          ? await fetchAnimeCoverByQueries(row.originalTitle, row.title)
          : (row.bangumiId ? (await getMangaMetadataCandidate(row.bangumiId))?.coverUrl : undefined));
        const localCoverUrl = remoteCoverUrl
          ? await (row.kind === 'anime'
            ? downloadCoverImage(remoteCoverUrl, row.id)
            : downloadMangaCoverImage(remoteCoverUrl, row.id))
          : null;
        const update = row.kind === 'anime' ? updateAnimeCover : updateMangaCover;
        update.run(remoteCoverUrl || null, localCoverUrl, new Date().toISOString(), row.id);
        if (localCoverUrl) result.downloaded++;
        else result.failed++;
      } catch (error) {
        console.warn(`[cover] 批量恢复${row.kind === 'anime' ? '动漫' : '漫画'}封面失败 id=${row.id}:`, error);
        const update = row.kind === 'anime' ? updateAnimeCover : updateMangaCover;
        update.run(isRemoteUrl(row.coverUrl) ? row.coverUrl : null, null, new Date().toISOString(), row.id);
        result.failed++;
      }
    }
  });

  await Promise.all(workers);
  return {
    total: anime.total + manga.total,
    downloaded: anime.downloaded + manga.downloaded,
    skipped: anime.skipped + manga.skipped,
    failed: anime.failed + manga.failed,
    anime,
    manga,
  };
}

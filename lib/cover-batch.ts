import 'server-only';

import { getRawDb } from './db';
import { downloadCoverImage, isRemoteUrl } from './cover-image';
import { fetchAnimeCoverByQueries } from './anime-provider';

export interface CoverBatchResult {
  total: number;
  downloaded: number;
  failed: number;
}

interface CoverSourceRow {
  id: number;
  title: string;
  originalTitle?: string | null;
  coverUrl?: string | null;
}

/** 下载所有具有远程来源地址的封面，并刷新 localCoverUrl。 */
export async function downloadAllRemoteCovers(concurrency = 3): Promise<CoverBatchResult> {
  const db = getRawDb();
  const rows = db.prepare(`
    SELECT id, title, original_title AS originalTitle, coverUrl
    FROM anime
    ORDER BY id
  `).all() as CoverSourceRow[];

  const updateCover = db.prepare(
    'UPDATE anime SET coverUrl = ?, localCoverUrl = ?, updatedAt = ? WHERE id = ?',
  );
  const queue = [...rows];
  let downloaded = 0;
  let failed = 0;
  const workerCount = Math.max(1, Math.min(5, Math.floor(concurrency)));

  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const row = queue.shift();
      if (!row) return;

      try {
        const existingRemoteCoverUrl = isRemoteUrl(row.coverUrl) ? row.coverUrl?.trim() : undefined;
        const remoteCoverUrl = existingRemoteCoverUrl
          || await fetchAnimeCoverByQueries(row.originalTitle, row.title);
        if (!remoteCoverUrl) {
          updateCover.run(null, null, new Date().toISOString(), row.id);
          failed++;
          continue;
        }

        const localCoverUrl = await downloadCoverImage(remoteCoverUrl, row.id);
        updateCover.run(remoteCoverUrl, localCoverUrl, new Date().toISOString(), row.id);
        if (localCoverUrl) downloaded++;
        else failed++;
      } catch (error) {
        console.warn(`[cover] 批量恢复封面失败 id=${row.id}:`, error);
        updateCover.run(isRemoteUrl(row.coverUrl) ? row.coverUrl : null, null, new Date().toISOString(), row.id);
        failed++;
      }
    }
  });

  await Promise.all(workers);
  return { total: rows.length, downloaded, failed };
}

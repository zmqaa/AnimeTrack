import 'server-only';

import { listAnimeRecordsWithLastWatched } from './anime';
import { buildDashboardOverview } from './dashboard-overview-helpers';
import { getWatchHistorySince } from './history';

export async function getDashboardOverview(now = new Date()) {
  const historySince = new Date(now.getTime() - 370 * 24 * 60 * 60 * 1000);
  const [animeList, history] = await Promise.all([
    listAnimeRecordsWithLastWatched(),
    getWatchHistorySince(historySince, 800),
  ]);
  return buildDashboardOverview(animeList, history, now);
}

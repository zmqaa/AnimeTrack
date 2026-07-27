import 'server-only';

import { listTimelineAnime, listTimelineHistory } from './timeline-queries';
import { buildTimelineOverview } from './timeline-overview-helpers';

export async function getTimelineOverview(now = new Date()) {
  const [animeList, history] = await Promise.all([
    listTimelineAnime(),
    listTimelineHistory(),
  ]);
  return buildTimelineOverview(animeList, history, now);
}

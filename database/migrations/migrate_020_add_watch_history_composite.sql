-- 加速 listAnimeRecordsWithLastWatched 中的子查询
-- SELECT animeId, MAX(watchedAt) FROM watch_history GROUP BY animeId
CREATE INDEX IF NOT EXISTS idx_watch_history_anime_watched ON watch_history (animeId, watchedAt);

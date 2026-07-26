CREATE TABLE IF NOT EXISTS anime_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animeId INTEGER NOT NULL,
    episode INTEGER,
    content TEXT NOT NULL,
    notedAt TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (animeId) REFERENCES anime(id) ON DELETE CASCADE,
    CHECK (episode IS NULL OR episode > 0)
);

CREATE INDEX IF NOT EXISTS idx_anime_notes_animeId ON anime_notes(animeId);
CREATE INDEX IF NOT EXISTS idx_anime_notes_timeline
    ON anime_notes(animeId, notedAt DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_anime_notes_overall
    ON anime_notes(animeId) WHERE episode IS NULL;

CREATE TABLE IF NOT EXISTS manga (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bangumi_id INTEGER,
    title TEXT NOT NULL,
    original_title TEXT,
    aliases TEXT,
    coverUrl TEXT,
    status TEXT NOT NULL DEFAULT 'plan_to_read'
        CHECK (status IN ('plan_to_read', 'reading', 'caught_up', 'completed', 'paused', 'dropped')),
    publication_status TEXT NOT NULL DEFAULT 'unknown'
        CHECK (publication_status IN ('ongoing', 'completed', 'hiatus', 'unknown')),
    score REAL,
    current_volume TEXT,
    current_chapter TEXT,
    total_volumes INTEGER,
    total_chapters INTEGER,
    notes TEXT,
    tags TEXT,
    summary TEXT,
    authors TEXT,
    illustrators TEXT,
    publishers TEXT,
    serializations TEXT,
    start_date TEXT,
    end_date TEXT,
    release_date TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_manga_bangumi_id
    ON manga(bangumi_id) WHERE bangumi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_manga_status ON manga(status);
CREATE INDEX IF NOT EXISTS idx_manga_updatedAt ON manga(updatedAt);
CREATE INDEX IF NOT EXISTS idx_manga_title ON manga(title);
CREATE INDEX IF NOT EXISTS idx_manga_original_title ON manga(original_title);


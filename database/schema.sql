-- Anime table (SQLite)
CREATE TABLE IF NOT EXISTS anime (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    original_title TEXT,
    coverUrl TEXT,
    localCoverUrl TEXT,
    status TEXT NOT NULL,
    score REAL,
    progress INTEGER DEFAULT 0,
    totalEpisodes INTEGER,
    durationMinutes INTEGER,
    notes TEXT,
    tags TEXT,
    summary TEXT,
    start_date TEXT,
    end_date TEXT,
    premiere_date TEXT,
    cast TEXT,
    cast_aliases TEXT,
    isFinished INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_anime_status ON anime(status);
CREATE INDEX IF NOT EXISTS idx_anime_updatedAt ON anime(updatedAt);
CREATE INDEX IF NOT EXISTS idx_anime_title ON anime(title);
CREATE INDEX IF NOT EXISTS idx_anime_original_title ON anime(original_title);

-- Watch history table
CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animeId INTEGER NOT NULL,
    animeTitle TEXT NOT NULL,
    episode INTEGER NOT NULL,
    watchedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (animeId) REFERENCES anime(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_watch_history_animeId ON watch_history(animeId);
CREATE INDEX IF NOT EXISTS idx_watch_history_watchedAt ON watch_history(watchedAt);
CREATE INDEX IF NOT EXISTS idx_watch_history_anime_watched ON watch_history(animeId, watchedAt);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

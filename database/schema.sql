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
    start_date_source TEXT CHECK (start_date_source IS NULL OR start_date_source = 'history'),
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

-- Structured personal notes. episode NULL is the overall note.
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
CREATE INDEX IF NOT EXISTS idx_anime_notes_timeline ON anime_notes(animeId, notedAt DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_anime_notes_overall
    ON anime_notes(animeId) WHERE episode IS NULL;

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

-- Manga library. Reading position is stored directly on the record; manga does
-- not create per-chapter history rows.
CREATE TABLE IF NOT EXISTS manga (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bangumi_id INTEGER,
    title TEXT NOT NULL,
    original_title TEXT,
    aliases TEXT,
    coverUrl TEXT,
    localCoverUrl TEXT,
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

-- OAuth state used by the read-only remote MCP endpoint.
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
    clientId TEXT PRIMARY KEY,
    clientName TEXT NOT NULL,
    redirectUris TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
    codeHash TEXT PRIMARY KEY,
    clientId TEXT NOT NULL,
    redirectUri TEXT NOT NULL,
    userId INTEGER NOT NULL,
    codeChallenge TEXT NOT NULL,
    codeChallengeMethod TEXT NOT NULL DEFAULT 'S256'
        CHECK (codeChallengeMethod = 'S256'),
    scope TEXT NOT NULL,
    resource TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    consumedAt TEXT,
    FOREIGN KEY (clientId) REFERENCES mcp_oauth_clients(clientId) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_client ON mcp_oauth_codes(clientId);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expiry ON mcp_oauth_codes(expiresAt);

CREATE TABLE IF NOT EXISTS mcp_oauth_tokens (
    tokenHash TEXT PRIMARY KEY,
    tokenType TEXT NOT NULL CHECK (tokenType IN ('access', 'refresh')),
    clientId TEXT NOT NULL,
    userId INTEGER NOT NULL,
    scope TEXT NOT NULL,
    resource TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    revokedAt TEXT,
    FOREIGN KEY (clientId) REFERENCES mcp_oauth_clients(clientId) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_client ON mcp_oauth_tokens(clientId);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_user ON mcp_oauth_tokens(userId);
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_tokens_expiry ON mcp_oauth_tokens(expiresAt);

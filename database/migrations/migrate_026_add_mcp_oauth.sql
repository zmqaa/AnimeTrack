-- Migration 026: persist OAuth clients, authorization codes, and tokens for the read-only MCP endpoint

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

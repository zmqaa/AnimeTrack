ALTER TABLE anime ADD COLUMN localCoverUrl TEXT;

UPDATE anime
SET localCoverUrl = coverUrl,
    coverUrl = NULL
WHERE coverUrl LIKE '/covers/%'
   OR coverUrl LIKE '/api/local-covers/%';


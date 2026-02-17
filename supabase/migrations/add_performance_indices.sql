-- Performance indices for TV Box catalog queries
-- Composite indices for filtered queries
CREATE INDEX IF NOT EXISTS idx_movies_platform_status ON movies(platform, status);
CREATE INDEX IF NOT EXISTS idx_series_platform_status ON series(platform, status);

-- GIN indices for genre array searches
CREATE INDEX IF NOT EXISTS idx_movies_genre ON movies USING GIN(genre);
CREATE INDEX IF NOT EXISTS idx_series_genre ON series USING GIN(genre);

-- Index for created_at ordering (catalog pagination)
CREATE INDEX IF NOT EXISTS idx_movies_created_at ON movies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_created_at ON series(created_at DESC);

-- Index for tmdb_id lookups (deduplication)
CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies(tmdb_id);
CREATE INDEX IF NOT EXISTS idx_series_tmdb_id ON series(tmdb_id);

-- Channels ordering
CREATE INDEX IF NOT EXISTS idx_channels_name ON channels(name);
CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category);

CREATE TABLE IF NOT EXISTS crawl_urls (
  url_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  canonical_url TEXT,
  title TEXT,
  description TEXT,
  first_fetched_at TEXT NOT NULL,
  last_fetched_at TEXT NOT NULL,
  last_status TEXT NOT NULL,
  last_snapshot_id TEXT,
  last_result_key TEXT,
  last_content_hash TEXT,
  strategy_used TEXT,
  rendered INTEGER NOT NULL DEFAULT 0,
  cache_ttl_seconds INTEGER NOT NULL DEFAULT 86400,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_crawl_urls_source ON crawl_urls(source);
CREATE INDEX IF NOT EXISTS idx_crawl_urls_last_fetched ON crawl_urls(last_fetched_at);

CREATE TABLE IF NOT EXISTS crawl_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  url_hash TEXT NOT NULL,
  url TEXT NOT NULL,
  result_key TEXT,
  content_hash TEXT,
  fetched_at TEXT NOT NULL,
  title TEXT,
  canonical_url TEXT,
  strategy_used TEXT,
  rendered INTEGER NOT NULL DEFAULT 0,
  markdown_chars INTEGER,
  html_chars INTEGER,
  image_count INTEGER,
  link_count INTEGER,
  error TEXT,
  FOREIGN KEY (url_hash) REFERENCES crawl_urls(url_hash) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crawl_snapshots_url_hash ON crawl_snapshots(url_hash, fetched_at DESC);

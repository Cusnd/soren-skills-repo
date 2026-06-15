CREATE TABLE IF NOT EXISTS screenshots (
  screenshot_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  r2_key TEXT,
  content_type TEXT,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  full_page INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  error TEXT
);

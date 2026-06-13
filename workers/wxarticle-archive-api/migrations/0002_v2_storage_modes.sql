ALTER TABLE jobs ADD COLUMN mode TEXT NOT NULL DEFAULT 'md-only';

ALTER TABLE items ADD COLUMN result_kind TEXT;

CREATE TABLE IF NOT EXISTS assets (
  job_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  original_url TEXT NOT NULL,
  asset_key TEXT,
  content_type TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, item_id, original_url),
  FOREIGN KEY (job_id, item_id) REFERENCES items(job_id, item_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assets_item ON assets(job_id, item_id);

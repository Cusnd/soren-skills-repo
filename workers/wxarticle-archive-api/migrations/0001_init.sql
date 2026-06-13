CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  total INTEGER NOT NULL,
  queued INTEGER NOT NULL DEFAULT 0,
  processing INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  job_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 4,
  error TEXT,
  result_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (job_id, item_id),
  FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_items_job_status ON items(job_id, status);

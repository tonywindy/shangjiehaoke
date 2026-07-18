CREATE TABLE IF NOT EXISTS api_usage_daily (
  usage_date TEXT NOT NULL,
  client_hash TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (usage_date, client_hash)
);

CREATE INDEX IF NOT EXISTS idx_api_usage_updated_at ON api_usage_daily(updated_at);

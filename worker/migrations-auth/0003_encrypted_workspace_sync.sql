PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace_sync_snapshots (
  user_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
  cipher_version INTEGER NOT NULL DEFAULT 1,
  algorithm TEXT NOT NULL DEFAULT 'AES-GCM',
  payload_key TEXT NOT NULL,
  payload_size INTEGER NOT NULL DEFAULT 0 CHECK (payload_size >= 0),
  payload_sha256 TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_sync_updated
  ON workspace_sync_snapshots(updated_at DESC);

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  must_change_password INTEGER NOT NULL DEFAULT 0 CHECK (must_change_password IN (0, 1)),
  terms_version TEXT,
  terms_accepted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS license_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  code_prefix TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'authorized' CHECK (plan IN ('authorized', 'yearly', 'permanent')),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed', 'revoked', 'expired')),
  duration_days INTEGER NOT NULL DEFAULT 365 CHECK (duration_days BETWEEN 0 AND 3650),
  redeem_before TEXT,
  expires_at TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL,
  redeemed_by TEXT,
  redeemed_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (redeemed_by) REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail_json TEXT,
  client_hash TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON license_codes(status);
CREATE INDEX IF NOT EXISTS idx_licenses_redeemed_by ON license_codes(redeemed_by);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

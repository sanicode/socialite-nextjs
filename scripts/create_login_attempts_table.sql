-- Login attempts table untuk persistent rate limiting
-- Jalankan sekali di database production sebelum deploy

CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGSERIAL PRIMARY KEY,
  key          VARCHAR(512)  NOT NULL,
  ip           VARCHAR(45),
  email        VARCHAR(255),
  attempted_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_key_time
  ON login_attempts (key, attempted_at DESC);

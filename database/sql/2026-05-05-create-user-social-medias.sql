CREATE TABLE IF NOT EXISTS user_social_medias (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  display_name VARCHAR(255),
  profile_url VARCHAR(2048),
  avatar_url VARCHAR(2048),
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP(0),
  scopes JSONB,
  metadata JSONB,
  connected_at TIMESTAMP(0),
  disconnected_at TIMESTAMP(0),
  last_synced_at TIMESTAMP(0),
  created_at TIMESTAMP(0),
  updated_at TIMESTAMP(0),
  CONSTRAINT user_social_medias_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS user_social_medias_platform_provider_account_id_unique
  ON user_social_medias(platform, provider_account_id);

CREATE INDEX IF NOT EXISTS user_social_medias_user_id_index
  ON user_social_medias(user_id);

CREATE INDEX IF NOT EXISTS user_social_medias_platform_index
  ON user_social_medias(platform);

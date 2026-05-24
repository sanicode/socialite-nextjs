ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS is_trending boolean NOT NULL DEFAULT false;

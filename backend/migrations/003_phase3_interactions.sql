-- ============================================================================
-- Migration 003: Phase 3 — Interactions, Content Management, Member Governance
--
-- This migration adds like/favorite/share counts to posts and replies,
-- creates user_likes and user_favorites tables, makes floor_number nullable
-- for child replies, and adds child_count to replies.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Extend posts table with interaction counts
-- --------------------------------------------------------------------------

ALTER TABLE posts ADD COLUMN IF NOT EXISTS like_count     INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS favorite_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS share_count    INTEGER NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------------
-- 2. Extend replies table
-- --------------------------------------------------------------------------

ALTER TABLE replies ADD COLUMN IF NOT EXISTS like_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE replies ADD COLUMN IF NOT EXISTS child_count INTEGER NOT NULL DEFAULT 0;

-- Make floor_number nullable for child replies (楼中楼)
ALTER TABLE replies ALTER COLUMN floor_number DROP NOT NULL;

-- --------------------------------------------------------------------------
-- 3. Create user_likes table (点赞记录)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_likes (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(20)  NOT NULL,
  target_id   UUID         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_user_likes_target
  ON user_likes (target_type, target_id);

-- --------------------------------------------------------------------------
-- 4. Create user_favorites table (收藏记录)
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_favorites (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user_created
  ON user_favorites (user_id, created_at);

-- --------------------------------------------------------------------------
-- 5. Index for child replies (楼中楼子回复查询)
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_replies_parent_reply_id
  ON replies (parent_reply_id, created_at)
  WHERE parent_reply_id IS NOT NULL;

COMMIT;

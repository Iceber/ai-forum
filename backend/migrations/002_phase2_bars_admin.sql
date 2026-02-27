-- ============================================================================
-- Migration 002: Phase 2 — Bars Administration & Admin Actions
--
-- This migration extends the bars table with review/moderation fields and
-- additional statuses required for the admin approval workflow, creates the
-- admin_actions audit log table, and adds indexes to support common query
-- patterns for bars listing, user content lookups, and admin action history.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Modify bars table
-- --------------------------------------------------------------------------

-- 1a. Drop the old status CHECK constraint and add the expanded one.
--     The constraint name comes from 001_initial_schema.sql.
ALTER TABLE bars DROP CONSTRAINT IF EXISTS bars_status_check;

ALTER TABLE bars ADD CONSTRAINT bars_status_check
  CHECK (status IN ('pending_review', 'active', 'rejected', 'suspended', 'permanently_banned', 'closed'));

-- 1b. Change the default status so newly created bars enter the review queue.
ALTER TABLE bars ALTER COLUMN status SET DEFAULT 'pending_review';

-- 1c. Add moderation / review columns.
ALTER TABLE bars ADD COLUMN IF NOT EXISTS reviewed_by   UUID          REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bars ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ;
ALTER TABLE bars ADD COLUMN IF NOT EXISTS status_reason TEXT;
ALTER TABLE bars ADD COLUMN IF NOT EXISTS suspend_until TIMESTAMPTZ;
-- member_count is denormalized; kept in sync by application logic on join/leave.
ALTER TABLE bars ADD COLUMN IF NOT EXISTS member_count  INTEGER       NOT NULL DEFAULT 0;

-- --------------------------------------------------------------------------
-- 2. Create admin_actions audit log table
-- --------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_actions (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID         NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action      VARCHAR(50)  NOT NULL,
  target_type VARCHAR(20)  NOT NULL,
  target_id   UUID         NOT NULL,
  reason      TEXT,
  metadata    JSONB,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- 3. Indexes
-- --------------------------------------------------------------------------

-- Bars: support listing active bars sorted by popularity then recency.
CREATE INDEX IF NOT EXISTS idx_bars_status_member_count
  ON bars (status, member_count DESC, created_at DESC);

-- Bars: look up bars created by a specific user.
CREATE INDEX IF NOT EXISTS idx_bars_created_by
  ON bars (created_by, created_at);

-- Posts: look up posts by author (profile / moderation views).
CREATE INDEX IF NOT EXISTS idx_posts_author_id
  ON posts (author_id, created_at);

-- Replies: look up replies by author (profile / moderation views).
CREATE INDEX IF NOT EXISTS idx_replies_author_id
  ON replies (author_id, created_at);

-- Admin actions: query history for a specific target entity.
CREATE INDEX IF NOT EXISTS idx_admin_actions_target
  ON admin_actions (target_type, target_id, created_at);

-- Bar members: ensure no duplicate memberships (may already exist from 001).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_bar_members_bar_user
  ON bar_members (bar_id, user_id);

COMMIT;

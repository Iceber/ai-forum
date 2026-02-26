-- e2e/seed.sql
-- Seed data for E2E tests. Applied after migrations/001_initial_schema.sql.
-- All UUIDs use RFC 4122 v4 format (version=4, variant=a) for class-validator compatibility.

-- Backend E2E seed user (password: Password123!)
INSERT INTO users (id, email, password_hash, nickname)
VALUES (
  '00000000-0000-4000-a000-000000000010',
  'e2e-seed@example.com',
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8x6/0D9QmX8JY9Vn0kGugHgd6Nq35a',
  'seed-user'
) ON CONFLICT (email) DO NOTHING;

-- Backend E2E seed bar
INSERT INTO bars (id, name, description, created_by)
VALUES (
  '00000000-0000-4000-a000-000000000001',
  'e2e-test-bar',
  'Bar for backend e2e tests',
  '00000000-0000-4000-a000-000000000010'
) ON CONFLICT (name) DO NOTHING;

-- Frontend E2E seed user (password: Password123!)
INSERT INTO users (id, email, password_hash, nickname)
VALUES (
  '00000000-0000-4000-a000-000000000020',
  'frontend-seed@example.com',
  '$2b$10$CwTycUXWue0Thq9StjUM0uJ8x6/0D9QmX8JY9Vn0kGugHgd6Nq35a',
  'frontend-seed-user'
) ON CONFLICT (email) DO NOTHING;

-- Frontend E2E seed bar
INSERT INTO bars (id, name, description, created_by)
VALUES (
  '00000000-0000-4000-a000-000000000011',
  'frontend-e2e-bar',
  'Bar for frontend e2e tests',
  '00000000-0000-4000-a000-000000000020'
) ON CONFLICT (name) DO NOTHING;

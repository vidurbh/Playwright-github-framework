-- ============================================================
-- ORGS TABLE: Each company buying a subscription is an org
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- Fix: Drop old plan constraint and add new one with just free/paid
ALTER TABLE orgs DROP CONSTRAINT IF EXISTS orgs_plan_check;
ALTER TABLE orgs ADD CONSTRAINT orgs_plan_check CHECK (plan IN ('free', 'paid'));

-- Create table if not exists (safe to run even if table exists)
CREATE TABLE IF NOT EXISTS orgs (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  plan TEXT DEFAULT 'free',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add org_id to chat_sessions (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'chat_sessions') THEN
    ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add org_id to session_messages (optional, for future isolation)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'session_messages') THEN
    ALTER TABLE session_messages ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add org_id to test_runs
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'test_runs') THEN
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS org_id BIGINT REFERENCES orgs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add status and triggered_at columns to test_runs for pending run tracking
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'test_runs') THEN
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT NULL;
    ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org_id ON chat_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_org_id ON test_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_orgs_slug ON orgs(slug);

-- Seed a default org (for existing data)
INSERT INTO orgs (name, slug, plan, status)
VALUES ('Default Org', 'default', 'free', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Update existing sessions/orgs with old plan values to free
UPDATE orgs SET plan = 'free' WHERE plan NOT IN ('free', 'paid');

-- Update existing sessions without org_id to point to default org
UPDATE chat_sessions SET org_id = (SELECT id FROM orgs WHERE slug = 'default') WHERE org_id IS NULL;
UPDATE test_runs SET org_id = (SELECT id FROM orgs WHERE slug = 'default') WHERE org_id IS NULL;
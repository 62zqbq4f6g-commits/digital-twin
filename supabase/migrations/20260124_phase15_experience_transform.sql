-- Migration: 20260124_phase15_experience_transform.sql
-- Phase 15: Experience Transformation
-- Creates tables for State of You, Whispers, and Memory Moments features
-- CRITICAL: RLS policies are created BEFORE tables are used

-- ============================================================================
-- TABLE 1: user_reports (Monthly State of You reports)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,  -- First day of the month
  report_data JSONB NOT NULL,  -- Full report content
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,
  UNIQUE(user_id, report_month)
);

-- Enable RLS
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own reports
CREATE POLICY "Users can only access own reports"
ON user_reports FOR ALL
USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_user_reports_user_month
  ON user_reports(user_id, report_month);

-- Grants
GRANT ALL ON user_reports TO authenticated;
GRANT ALL ON user_reports TO service_role;

-- ============================================================================
-- TABLE 2: whispers (Quick Capture - E2E Encrypted, Text-Only in V1)
-- ============================================================================

CREATE TABLE IF NOT EXISTS whispers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,  -- E2E encrypted content (NO plaintext)
  iv TEXT NOT NULL,                  -- Initialization vector for decryption
  source TEXT DEFAULT 'text',        -- V1 is text-only
  processed BOOLEAN DEFAULT FALSE,
  entities_extracted JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE whispers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own whispers
CREATE POLICY "Users can only access own whispers"
ON whispers FOR ALL
USING (auth.uid() = user_id);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_whispers_user_processed
  ON whispers(user_id, processed);

CREATE INDEX IF NOT EXISTS idx_whispers_user_created
  ON whispers(user_id, created_at DESC);

-- Grants
GRANT ALL ON whispers TO authenticated;
GRANT ALL ON whispers TO service_role;

-- ============================================================================
-- TABLE 3: memory_moments (Proactive Memory Surfacing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS memory_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_type TEXT NOT NULL,  -- 'anniversary', 'dormant_entity', 'progress', 'pattern', 'callback'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_entity_id UUID REFERENCES user_entities(id) ON DELETE SET NULL,
  related_note_ids UUID[],
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  shown_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  engaged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE memory_moments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own moments
CREATE POLICY "Users can only access own moments"
ON memory_moments FOR ALL
USING (auth.uid() = user_id);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_memory_moments_user_shown
  ON memory_moments(user_id, shown_at);

CREATE INDEX IF NOT EXISTS idx_memory_moments_priority
  ON memory_moments(user_id, priority DESC);

CREATE INDEX IF NOT EXISTS idx_memory_moments_pending
  ON memory_moments(user_id)
  WHERE shown_at IS NULL AND dismissed_at IS NULL;

-- Grants
GRANT ALL ON memory_moments TO authenticated;
GRANT ALL ON memory_moments TO service_role;

-- ============================================================================
-- TABLE 4: user_notification_preferences
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  timezone TEXT DEFAULT 'UTC',  -- Inferred from browser on first visit
  memory_moments_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_day INTEGER DEFAULT 1 CHECK (monthly_report_day >= 1 AND monthly_report_day <= 28),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own preferences
CREATE POLICY "Users can only access own preferences"
ON user_notification_preferences FOR ALL
USING (auth.uid() = user_id);

-- Grants
GRANT ALL ON user_notification_preferences TO authenticated;
GRANT ALL ON user_notification_preferences TO service_role;

-- ============================================================================
-- FUNCTION: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS trigger_update_notification_preferences_updated_at ON user_notification_preferences;
CREATE TRIGGER trigger_update_notification_preferences_updated_at
  BEFORE UPDATE ON user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();

-- ============================================================================
-- VALIDATION: Confirm tables and RLS are set up correctly
-- ============================================================================

DO $$
DECLARE
  table_count INTEGER;
  rls_count INTEGER;
BEGIN
  -- Count Phase 15 tables
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('user_reports', 'whispers', 'memory_moments', 'user_notification_preferences');

  -- Count RLS policies
  SELECT COUNT(*) INTO rls_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('user_reports', 'whispers', 'memory_moments', 'user_notification_preferences');

  RAISE NOTICE 'Phase 15 Migration Complete:';
  RAISE NOTICE '  Tables created: %', table_count;
  RAISE NOTICE '  RLS policies: %', rls_count;

  IF table_count < 4 THEN
    RAISE WARNING 'Expected 4 tables, found %', table_count;
  END IF;

  IF rls_count < 4 THEN
    RAISE WARNING 'Expected 4 RLS policies, found %', rls_count;
  END IF;
END $$;

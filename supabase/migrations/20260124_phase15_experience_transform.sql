-- ============================================
-- PHASE 15: Experience Transformation
-- Database Migration Script
-- Run in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Create Tables
-- ============================================

-- 1. Monthly Reports
CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  report_data JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  viewed_at TIMESTAMP,
  UNIQUE(user_id, report_month)
);

-- 2. Whispers (E2E Encrypted, Text-Only)
CREATE TABLE IF NOT EXISTS whispers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,
  iv TEXT NOT NULL,
  source TEXT DEFAULT 'text',
  processed BOOLEAN DEFAULT FALSE,
  entities_extracted JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Memory Moments
CREATE TABLE IF NOT EXISTS memory_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_entity_id UUID REFERENCES user_entities(id),
  related_note_ids UUID[],
  priority INTEGER DEFAULT 5,
  shown_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  engaged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Notification Preferences
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  timezone TEXT DEFAULT 'UTC',
  memory_moments_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_day INTEGER DEFAULT 1,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- STEP 2: Enable Row Level Security
-- ============================================

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create RLS Policies
-- ============================================

-- user_reports policies
CREATE POLICY "Users can only access own reports"
ON user_reports FOR ALL
USING (auth.uid() = user_id);

-- whispers policies
CREATE POLICY "Users can only access own whispers"
ON whispers FOR ALL
USING (auth.uid() = user_id);

-- memory_moments policies
CREATE POLICY "Users can only access own moments"
ON memory_moments FOR ALL
USING (auth.uid() = user_id);

-- user_notification_preferences policies
CREATE POLICY "Users can only access own preferences"
ON user_notification_preferences FOR ALL
USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: Create Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_user_reports_user_month ON user_reports(user_id, report_month);
CREATE INDEX IF NOT EXISTS idx_whispers_user_processed ON whispers(user_id, processed);
CREATE INDEX IF NOT EXISTS idx_whispers_user_created ON whispers(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_moments_user_shown ON memory_moments(user_id, shown_at);
CREATE INDEX IF NOT EXISTS idx_memory_moments_priority ON memory_moments(user_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_memory_moments_type ON memory_moments(user_id, moment_type);

-- ============================================
-- STEP 5: Analytics Table (Optional)
-- ============================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  properties JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access own analytics"
ON analytics_events FOR ALL
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_user_event ON analytics_events(user_id, event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at DESC);

-- ============================================
-- VERIFICATION: Check tables exist
-- ============================================

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_reports', 'whispers', 'memory_moments', 'user_notification_preferences', 'analytics_events');

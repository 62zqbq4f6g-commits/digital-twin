-- Phase 8: Intelligent Twin Package - Database Migration
-- Run this in Supabase SQL Editor

-- 1. User Profiles table (Component 1: About Me Profile)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  display_name_encrypted TEXT,
  about_me_encrypted TEXT,
  self_descriptors JSONB DEFAULT '[]'::jsonb,
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own profile"
  ON user_profiles FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Add Follow-up columns to action_signals (Component 5: Did You Do It?)
ALTER TABLE action_signals
ADD COLUMN IF NOT EXISTS follow_up_response TEXT,
ADD COLUMN IF NOT EXISTS follow_up_shown_at TIMESTAMPTZ;

-- 3. Entity Corrections table (Component 2: Entity Corrections UI)
CREATE TABLE IF NOT EXISTS entity_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for entity_corrections
ALTER TABLE entity_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corrections"
  ON entity_corrections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own corrections"
  ON entity_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 4. Nudge Effectiveness table (Component 6: Nudge Effectiveness)
CREATE TABLE IF NOT EXISTS nudge_effectiveness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nudge_type TEXT NOT NULL,
  shown_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  effectiveness_score FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, nudge_type)
);

-- RLS for nudge_effectiveness
ALTER TABLE nudge_effectiveness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own nudge stats"
  ON nudge_effectiveness FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nudge stats"
  ON nudge_effectiveness FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nudge stats"
  ON nudge_effectiveness FOR UPDATE
  USING (auth.uid() = user_id);

-- 5. Add user_corrected column to entities (Component 3: Relationship Context)
ALTER TABLE entities
ADD COLUMN IF NOT EXISTS user_corrected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS relationship_to_user TEXT;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_corrections_user_id ON entity_corrections(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_corrections_entity_id ON entity_corrections(entity_id);
CREATE INDEX IF NOT EXISTS idx_nudge_effectiveness_user_id ON nudge_effectiveness(user_id);
CREATE INDEX IF NOT EXISTS idx_action_signals_follow_up ON action_signals(user_id, follow_up_response) WHERE completed_at IS NULL;

-- Grant permissions
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON entity_corrections TO authenticated;
GRANT ALL ON nudge_effectiveness TO authenticated;

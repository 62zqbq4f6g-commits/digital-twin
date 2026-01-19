-- Phase 9: Personalization System
-- Migration: 20260118_phase9_personalization.sql
-- Creates tables for user profiles, entities, feedback, and learning

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Table: user_profiles
-- Stores explicit user preferences from onboarding and settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Onboarding (required)
  name TEXT NOT NULL,
  role_type TEXT NOT NULL CHECK (role_type IN (
    'BUILDING', 'LEADING', 'MAKING', 'LEARNING', 'JUGGLING', 'TRANSITIONING'
  )),
  goals TEXT[] NOT NULL DEFAULT '{}',

  -- Progressive (optional, unlocks after 5 notes)
  tone TEXT CHECK (tone IN ('DIRECT', 'WARM', 'CHALLENGING', 'ADAPTIVE')),
  life_context TEXT,
  boundaries TEXT[] DEFAULT '{}',

  -- Metadata
  onboarding_completed_at TIMESTAMPTZ,
  preferences_unlocked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- =============================================================================
-- Table: user_key_people
-- People manually added by user in profile settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_key_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  added_via TEXT DEFAULT 'profile', -- 'profile' or 'confirmed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_key_people_user_id ON user_key_people(user_id);

-- =============================================================================
-- Table: user_entities
-- Auto-detected entities from notes (people, projects, places, pets)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Entity info
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'person', 'project', 'place', 'pet', 'other'
  )),
  relationship TEXT, -- null until user confirms

  -- Learning data
  mention_count INTEGER DEFAULT 1,
  first_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  last_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  sentiment_average DECIMAL(3,2), -- -1 to 1
  context_notes TEXT[], -- recent context snippets

  -- User feedback
  confirmed BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,

  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_entities_user_id ON user_entities(user_id);
CREATE INDEX IF NOT EXISTS idx_user_entities_type ON user_entities(user_id, entity_type);

-- =============================================================================
-- Table: user_feedback
-- Records every APPROVE/REJECT/COMMENT action
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  note_id TEXT REFERENCES notes(id) ON DELETE CASCADE,

  feedback_type TEXT NOT NULL CHECK (feedback_type IN (
    'approve', 'reject', 'comment'
  )),
  comment_text TEXT, -- only for 'comment' type

  -- Context about what was rated
  insight_type TEXT, -- what type of insight was in this note
  output_section TEXT, -- which section user was rating

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_note_id ON user_feedback(note_id);

-- =============================================================================
-- Table: user_learning_profile
-- Aggregated learning data (computed from notes + feedback)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_learning_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Vocabulary
  common_phrases TEXT[] DEFAULT '{}',
  vocabulary_style TEXT DEFAULT 'casual', -- casual, formal, mixed

  -- Insight preferences (JSON: {"type": count})
  approved_insight_types JSONB DEFAULT '{}',
  rejected_insight_types JSONB DEFAULT '{}',

  -- Action patterns
  actions_completed INTEGER DEFAULT 0,
  actions_ignored INTEGER DEFAULT 0,
  action_types_completed TEXT[] DEFAULT '{}',
  action_types_ignored TEXT[] DEFAULT '{}',

  -- Temporal
  preferred_times TEXT[] DEFAULT '{}',
  temporal_patterns JSONB DEFAULT '{}',

  -- Themes
  recurring_themes JSONB DEFAULT '{}',

  -- Meta
  total_notes INTEGER DEFAULT 0,
  total_approved INTEGER DEFAULT 0,
  total_rejected INTEGER DEFAULT 0,
  total_reflections INTEGER DEFAULT 0,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- Row Level Security (RLS)
-- Users can only see/edit their own data
-- =============================================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_key_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_profile ENABLE ROW LEVEL SECURITY;

-- RLS Policies

CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own key people" ON user_key_people
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own entities" ON user_entities
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own feedback" ON user_feedback
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own learning profile" ON user_learning_profile
  FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- Triggers for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_learning_profile_updated_at
  BEFORE UPDATE ON user_learning_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE user_profiles IS 'User preferences from onboarding - name, role, goals, tone';
COMMENT ON TABLE user_key_people IS 'People manually added by user (from profile or entity confirmation)';
COMMENT ON TABLE user_entities IS 'Auto-detected entities from notes with learning data';
COMMENT ON TABLE user_feedback IS 'Every approve/reject/comment action for learning';
COMMENT ON TABLE user_learning_profile IS 'Aggregated learning data computed from notes and feedback';

COMMENT ON COLUMN user_profiles.role_type IS 'BUILDING, LEADING, MAKING, LEARNING, JUGGLING, TRANSITIONING';
COMMENT ON COLUMN user_profiles.goals IS 'Array: DECISIONS, PROCESS, ORGANIZE, SELF_UNDERSTANDING, REMEMBER, EXPLORING';
COMMENT ON COLUMN user_profiles.tone IS 'DIRECT, WARM, CHALLENGING, ADAPTIVE (unlocks after 5 notes)';
COMMENT ON COLUMN user_entities.sentiment_average IS 'Range -1 to 1 based on note sentiment when entity mentioned';
COMMENT ON COLUMN user_feedback.insight_type IS 'emotional_observation, hidden_assumption, action_suggestion, pattern_recognition, question_prompt, reframe, validation, summary';

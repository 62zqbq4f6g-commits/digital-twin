-- Phase 19: Intent-Aware Extraction — User Behaviors Table
-- Stores user's relationship TO entities (trust, reliance, inspiration, etc.)
-- This is Layer 4 (Procedural Memory) — "how the user behaves" not just "what happened"
-- Date: 2026-01-29

-- ============================================
-- User Behaviors: How the user relates to entities
-- ============================================
CREATE TABLE IF NOT EXISTS user_behaviors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The behavior relationship
  predicate TEXT NOT NULL, -- trusts_opinion_of, seeks_advice_from, inspired_by, relies_on, etc.
  entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE, -- The entity this behavior relates to
  entity_name TEXT NOT NULL, -- Denormalized for quick access

  -- Context
  topic TEXT, -- Optional: what topic/area this applies to (e.g., 'AI strategy', 'career decisions')
  sentiment FLOAT, -- User's feeling in this behavior (-1.0 to 1.0)
  evidence TEXT, -- The specific phrase/context that indicates this behavior

  -- Confidence and metadata
  confidence FLOAT DEFAULT 0.8,
  source_note_id TEXT, -- The note this was extracted from
  source_type TEXT DEFAULT 'note', -- 'note', 'mirror_conversation', 'meeting'

  -- Status tracking
  status TEXT DEFAULT 'active', -- 'active', 'superseded', 'rejected'
  superseded_by UUID REFERENCES user_behaviors(id),

  -- Timestamps
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_reinforced_at TIMESTAMPTZ DEFAULT NOW(), -- Updated when behavior is detected again
  reinforcement_count INT DEFAULT 1, -- How many times this behavior has been detected
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_behaviors_user ON user_behaviors(user_id);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_entity ON user_behaviors(entity_id);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_predicate ON user_behaviors(user_id, predicate);
CREATE INDEX IF NOT EXISTS idx_user_behaviors_active ON user_behaviors(user_id, status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_behaviors_confidence ON user_behaviors(user_id, confidence DESC);

-- Enable RLS
ALTER TABLE user_behaviors ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Users can manage own behaviors" ON user_behaviors;
CREATE POLICY "Users can manage own behaviors" ON user_behaviors
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Entity Relationship Qualities: How entities relate TO the user
-- ============================================
CREATE TABLE IF NOT EXISTS entity_qualities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The entity and its quality
  entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE,
  entity_name TEXT NOT NULL,
  predicate TEXT NOT NULL, -- helps_with, challenges, supports, mentors, drains, energizes
  object TEXT NOT NULL, -- What they help/challenge/support with

  -- Confidence and source
  confidence FLOAT DEFAULT 0.8,
  source_note_id TEXT,

  -- Status
  status TEXT DEFAULT 'active',

  -- Timestamps
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
  reinforcement_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entity_qualities_user ON entity_qualities(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_qualities_entity ON entity_qualities(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_qualities_predicate ON entity_qualities(user_id, predicate);

-- Enable RLS
ALTER TABLE entity_qualities ENABLE ROW LEVEL SECURITY;

-- RLS policies
DROP POLICY IF EXISTS "Users can manage own entity qualities" ON entity_qualities;
CREATE POLICY "Users can manage own entity qualities" ON entity_qualities
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- Function to get user's behavioral profile for context loading
-- ============================================
CREATE OR REPLACE FUNCTION get_user_behavioral_profile(p_user_id UUID)
RETURNS TABLE (
  behavior_type TEXT,
  entity_name TEXT,
  entity_type TEXT,
  topic TEXT,
  sentiment FLOAT,
  confidence FLOAT,
  reinforcement_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.predicate AS behavior_type,
    b.entity_name,
    COALESCE(e.entity_type, 'unknown') AS entity_type,
    b.topic,
    b.sentiment,
    b.confidence,
    b.reinforcement_count
  FROM user_behaviors b
  LEFT JOIN user_entities e ON b.entity_id = e.id
  WHERE b.user_id = p_user_id
    AND b.status = 'active'
  ORDER BY b.confidence DESC, b.reinforcement_count DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to get entity qualities for context loading
-- ============================================
CREATE OR REPLACE FUNCTION get_entity_qualities_for_user(p_user_id UUID)
RETURNS TABLE (
  entity_name TEXT,
  quality_type TEXT,
  quality_object TEXT,
  confidence FLOAT,
  reinforcement_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.entity_name,
    q.predicate AS quality_type,
    q.object AS quality_object,
    q.confidence,
    q.reinforcement_count
  FROM entity_qualities q
  WHERE q.user_id = p_user_id
    AND q.status = 'active'
  ORDER BY q.confidence DESC, q.reinforcement_count DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_behavioral_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entity_qualities_for_user(UUID) TO authenticated;

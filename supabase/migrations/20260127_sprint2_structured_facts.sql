-- Sprint 2: Structured Facts & Privacy Controls
-- OWNER: T1
-- BLOCKS: T2 (queries), T3 (UI)
--
-- This migration adds:
-- 1. privacy_level columns to user_entities, notes, user_patterns
-- 2. entity_facts table for structured knowledge (e.g., "Marcus works_at Anthropic")
-- 3. aliases column to user_entities for name variations

-- ============================================
-- 1.1 Add privacy_level to user_entities
-- ============================================

ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'internal';

-- Add check constraint (separate statement for IF NOT EXISTS compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_entities_privacy_level_check'
  ) THEN
    ALTER TABLE user_entities
    ADD CONSTRAINT user_entities_privacy_level_check
    CHECK (privacy_level IN ('private', 'internal', 'shared'));
  END IF;
END $$;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_user_entities_privacy
ON user_entities(user_id, privacy_level);

COMMENT ON COLUMN user_entities.privacy_level IS 'Privacy level: private (never export), internal (personal export), shared (third-party apps)';

-- ============================================
-- 1.2 Add privacy_level to notes
-- ============================================

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_privacy_level_check'
  ) THEN
    ALTER TABLE notes
    ADD CONSTRAINT notes_privacy_level_check
    CHECK (privacy_level IN ('private', 'internal', 'shared'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notes_privacy
ON notes(user_id, privacy_level);

COMMENT ON COLUMN notes.privacy_level IS 'Privacy level: private (never export), internal (personal export), shared (third-party apps)';

-- ============================================
-- 1.3 Add privacy_level to user_patterns
-- ============================================

ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_patterns_privacy_level_check'
  ) THEN
    ALTER TABLE user_patterns
    ADD CONSTRAINT user_patterns_privacy_level_check
    CHECK (privacy_level IN ('private', 'internal', 'shared'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_patterns_privacy
ON user_patterns(user_id, privacy_level);

COMMENT ON COLUMN user_patterns.privacy_level IS 'Privacy level: private (never export), internal (personal export), shared (third-party apps)';

-- ============================================
-- 1.4 Create entity_facts table
-- ============================================

CREATE TABLE IF NOT EXISTS entity_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,

  -- The fact itself (Subject-Predicate-Object triple)
  -- Subject = entity_id (implicit)
  predicate TEXT NOT NULL,           -- e.g., 'works_at', 'role', 'likes', 'location'
  object_text TEXT,                  -- e.g., 'Anthropic', 'Product Manager'
  object_entity_id UUID REFERENCES user_entities(id) ON DELETE SET NULL,  -- If object is another entity

  -- Metadata
  confidence FLOAT DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  source_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,  -- notes.id is TEXT

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_entity_facts_user ON entity_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_facts_entity ON entity_facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_facts_predicate ON entity_facts(predicate);
CREATE INDEX IF NOT EXISTS idx_entity_facts_object_entity ON entity_facts(object_entity_id) WHERE object_entity_id IS NOT NULL;

-- Enable RLS
ALTER TABLE entity_facts ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only access their own facts
CREATE POLICY "Users can view own facts" ON entity_facts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own facts" ON entity_facts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own facts" ON entity_facts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own facts" ON entity_facts
  FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for API access
CREATE POLICY "Service role has full access to entity_facts" ON entity_facts
  FOR ALL USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

COMMENT ON TABLE entity_facts IS 'Sprint 2: Structured facts about entities (SPO triples). E.g., Marcus works_at Anthropic';
COMMENT ON COLUMN entity_facts.predicate IS 'Fact type: works_at, role, relationship, location, likes, dislikes, status, expertise, studied_at, owns';
COMMENT ON COLUMN entity_facts.object_text IS 'The fact value as text';
COMMENT ON COLUMN entity_facts.object_entity_id IS 'Reference to another entity if the object is an entity';
COMMENT ON COLUMN entity_facts.confidence IS 'Confidence score 0-1. >0.9 for explicit facts, <0.7 for inferred';

-- ============================================
-- 1.5 Add aliases to user_entities
-- ============================================

ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

COMMENT ON COLUMN user_entities.aliases IS 'Alternative names for this entity (e.g., ["Mike", "Michael", "Mike Smith"])';

-- ============================================
-- Verification queries (run after migration)
-- ============================================

-- Verify entity_facts table:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'entity_facts';

-- Verify privacy_level columns:
-- SELECT table_name, column_name FROM information_schema.columns WHERE column_name = 'privacy_level' AND table_schema = 'public';

-- Verify aliases column:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'aliases';

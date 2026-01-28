-- Knowledge Graph Schema Migration
-- Phase 19: Unified Knowledge Architecture
-- Date: 2026-01-28

-- ============================================
-- Track all user inputs for full traceability
-- ============================================
CREATE TABLE IF NOT EXISTS user_inputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL, -- 'note', 'voice', 'meeting', 'mirror_message', 'onboarding', 'preference', 'feedback'
  source_id UUID, -- Reference to the original record
  content_preview TEXT, -- First 200 chars for quick reference
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_inputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own inputs" ON user_inputs;
CREATE POLICY "Users can manage own inputs" ON user_inputs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_inputs_user_type ON user_inputs(user_id, input_type);
CREATE INDEX IF NOT EXISTS idx_user_inputs_created ON user_inputs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_inputs_source ON user_inputs(source_id);

-- ============================================
-- Track entity mentions with context
-- ============================================
CREATE TABLE IF NOT EXISTS entity_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  context_snippet TEXT,
  mentioned_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own mentions" ON entity_mentions;
CREATE POLICY "Users can manage own mentions" ON entity_mentions
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_user ON entity_mentions(user_id, mentioned_at DESC);

-- ============================================
-- Link entities to each other (co-occurrence)
-- ============================================
CREATE TABLE IF NOT EXISTS entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_a UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  entity_b UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  context TEXT,
  strength INTEGER DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entity_a, entity_b)
);

ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own links" ON entity_links;
CREATE POLICY "Users can manage own links" ON entity_links
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_entity_links_user ON entity_links(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_entity_a ON entity_links(entity_a);
CREATE INDEX IF NOT EXISTS idx_entity_links_entity_b ON entity_links(entity_b);
CREATE INDEX IF NOT EXISTS idx_entity_links_strength ON entity_links(user_id, strength DESC);

-- ============================================
-- Link notes to entities (many-to-many)
-- ============================================
CREATE TABLE IF NOT EXISTS note_entities (
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (note_id, entity_id)
);

ALTER TABLE note_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own note_entities" ON note_entities;
CREATE POLICY "Users can manage own note_entities" ON note_entities
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_note_entities_note ON note_entities(note_id);
CREATE INDEX IF NOT EXISTS idx_note_entities_entity ON note_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_note_entities_user ON note_entities(user_id);

-- ============================================
-- Add columns to user_entities if they don't exist
-- ============================================
DO $$
BEGIN
  -- Add mention_count column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_entities' AND column_name = 'mention_count') THEN
    ALTER TABLE user_entities ADD COLUMN mention_count INTEGER DEFAULT 0;
  END IF;

  -- Add first_mentioned column if not exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'user_entities' AND column_name = 'first_mentioned') THEN
    ALTER TABLE user_entities ADD COLUMN first_mentioned TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- ============================================
-- Function to increment mention count
-- ============================================
CREATE OR REPLACE FUNCTION increment_mention_count(p_entity_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_entities
  SET mention_count = COALESCE(mention_count, 0) + 1,
      updated_at = NOW()
  WHERE id = p_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Function to get entity graph for a user
-- ============================================
CREATE OR REPLACE FUNCTION get_entity_graph(p_user_id UUID)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  mention_count INTEGER,
  linked_entities JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id AS entity_id,
    e.name AS entity_name,
    e.type AS entity_type,
    COALESCE(e.mention_count, 0) AS mention_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', linked.id,
          'name', linked.name,
          'strength', el.strength
        )
      ) FILTER (WHERE linked.id IS NOT NULL),
      '[]'::jsonb
    ) AS linked_entities
  FROM user_entities e
  LEFT JOIN entity_links el ON (e.id = el.entity_a OR e.id = el.entity_b) AND el.user_id = p_user_id
  LEFT JOIN user_entities linked ON (
    (el.entity_a = e.id AND el.entity_b = linked.id) OR
    (el.entity_b = e.id AND el.entity_a = linked.id)
  )
  WHERE e.user_id = p_user_id
  GROUP BY e.id, e.name, e.type, e.mention_count
  ORDER BY e.mention_count DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Grant execute on functions
-- ============================================
GRANT EXECUTE ON FUNCTION increment_mention_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_entity_graph(UUID) TO authenticated;

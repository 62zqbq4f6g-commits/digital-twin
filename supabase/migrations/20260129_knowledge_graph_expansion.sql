-- ============================================
-- KNOWLEDGE GRAPH EXPANSION
-- Adds remaining pieces for exhaustive entity types and relationships
-- Date: 2026-01-29
-- ============================================

-- 1. Add missing columns to user_entities
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS subtype TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS importance_score FLOAT DEFAULT 0.5,
ADD COLUMN IF NOT EXISTS last_mentioned TIMESTAMPTZ DEFAULT NOW();

-- Update importance_score for existing entities based on mention_count
UPDATE user_entities
SET importance_score = LEAST(1.0, 0.3 + (COALESCE(mention_count, 0) * 0.05))
WHERE importance_score IS NULL OR importance_score = 0.5;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_entities_type ON user_entities(user_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_user_entities_importance ON user_entities(user_id, importance_score DESC);
CREATE INDEX IF NOT EXISTS idx_user_entities_last_mentioned ON user_entities(user_id, last_mentioned DESC);

-- 2. Add missing columns to entity_facts
ALTER TABLE entity_facts
ADD COLUMN IF NOT EXISTS first_mentioned TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS last_mentioned TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'note',
ADD COLUMN IF NOT EXISTS source_id UUID;

CREATE INDEX IF NOT EXISTS idx_entity_facts_predicate ON entity_facts(user_id, predicate);
CREATE INDEX IF NOT EXISTS idx_entity_facts_source ON entity_facts(source_type, source_id);

-- 3. Add relationship_type to entity_links if missing
ALTER TABLE entity_links
ADD COLUMN IF NOT EXISTS relationship_type TEXT DEFAULT 'co_occurred';

-- 4. Create user_topics table for topic tracking
CREATE TABLE IF NOT EXISTS user_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  parent_topic_id UUID REFERENCES user_topics(id) ON DELETE SET NULL,
  description TEXT,
  mention_count INTEGER DEFAULT 1,
  importance_score FLOAT DEFAULT 0.5,
  first_mentioned TIMESTAMPTZ DEFAULT NOW(),
  last_mentioned TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, normalized_name)
);

ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own topics" ON user_topics;
CREATE POLICY "Users can manage own topics" ON user_topics
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_topics_user ON user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topics_importance ON user_topics(user_id, importance_score DESC);

-- 5. Add source_type column to notes if missing
ALTER TABLE notes ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual';

-- 6. Helper function: Update entity mention tracking
CREATE OR REPLACE FUNCTION update_entity_mention(p_entity_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_entities SET
    mention_count = COALESCE(mention_count, 0) + 1,
    last_mentioned = NOW(),
    importance_score = LEAST(1.0, COALESCE(importance_score, 0.5) + 0.02),
    updated_at = NOW()
  WHERE id = p_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper function: Update fact mention tracking
CREATE OR REPLACE FUNCTION update_fact_mention(p_fact_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE entity_facts SET
    mention_count = COALESCE(mention_count, 0) + 1,
    last_mentioned = NOW(),
    confidence = LEAST(1.0, COALESCE(confidence, 0.7) + 0.02),
    updated_at = NOW()
  WHERE id = p_fact_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Helper function: Update topic mention tracking
CREATE OR REPLACE FUNCTION update_topic_mention(p_topic_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE user_topics SET
    mention_count = COALESCE(mention_count, 0) + 1,
    last_mentioned = NOW(),
    importance_score = LEAST(1.0, COALESCE(importance_score, 0.5) + 0.02),
    updated_at = NOW()
  WHERE id = p_topic_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Function to get knowledge graph data for visualization
CREATE OR REPLACE FUNCTION get_knowledge_graph_data(p_user_id UUID, p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  subtype TEXT,
  importance_score FLOAT,
  mention_count INTEGER,
  facts JSONB,
  links JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH entity_base AS (
    SELECT
      e.id,
      e.name,
      e.entity_type,
      e.subtype,
      COALESCE(e.importance_score, 0.5) as importance,
      COALESCE(e.mention_count, 0) as mentions
    FROM user_entities e
    WHERE e.user_id = p_user_id
      AND e.status = 'active'
    ORDER BY e.importance_score DESC NULLS LAST
    LIMIT p_limit
  ),
  entity_facts_agg AS (
    SELECT
      ef.entity_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'predicate', ef.predicate,
            'object', ef.object_text,
            'confidence', ef.confidence
          )
        ) FILTER (WHERE ef.id IS NOT NULL),
        '[]'::jsonb
      ) as facts
    FROM entity_facts ef
    WHERE ef.user_id = p_user_id
    GROUP BY ef.entity_id
  ),
  entity_links_agg AS (
    SELECT
      e.id as entity_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'linked_id', CASE WHEN el.entity_a = e.id THEN el.entity_b ELSE el.entity_a END,
            'relationship', el.relationship_type,
            'strength', el.strength
          )
        ) FILTER (WHERE el.id IS NOT NULL),
        '[]'::jsonb
      ) as links
    FROM entity_base e
    LEFT JOIN entity_links el ON (el.entity_a = e.id OR el.entity_b = e.id) AND el.user_id = p_user_id
    GROUP BY e.id
  )
  SELECT
    eb.id as entity_id,
    eb.name as entity_name,
    eb.entity_type,
    eb.subtype,
    eb.importance as importance_score,
    eb.mentions as mention_count,
    COALESCE(ef.facts, '[]'::jsonb) as facts,
    COALESCE(el.links, '[]'::jsonb) as links
  FROM entity_base eb
  LEFT JOIN entity_facts_agg ef ON eb.id = ef.entity_id
  LEFT JOIN entity_links_agg el ON eb.id = el.entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION update_entity_mention(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_fact_mention(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_topic_mention(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_knowledge_graph_data(UUID, INTEGER) TO authenticated;

-- ============================================
-- MIGRATION COMPLETE
-- Run this in Supabase SQL Editor
-- ============================================

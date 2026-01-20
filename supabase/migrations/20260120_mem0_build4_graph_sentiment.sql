-- =====================================================
-- MEM0 BUILD 4: GRAPH RELATIONSHIPS + SENTIMENT TRACKING
-- Enhanced relationship tracking and sentiment history
-- =====================================================

-- =====================================================
-- 4.1 Enhance entity_relationships Table
-- =====================================================

-- Add temporal tracking to relationships
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Add relationship strength (0-1)
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS strength FLOAT DEFAULT 0.5
CHECK (strength >= 0 AND strength <= 1);

-- Add active flag for temporal reasoning
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add relationship metadata
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add confidence score
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.8
CHECK (confidence >= 0 AND confidence <= 1);

-- Unique constraint for relationship type between entities (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_relationship'
  ) THEN
    ALTER TABLE entity_relationships
    ADD CONSTRAINT unique_relationship
    UNIQUE (source_entity_id, target_entity_id, relationship_type);
  END IF;
END $$;

-- =====================================================
-- Indexes for graph traversal
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_relationships_source
ON entity_relationships(source_entity_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_target
ON entity_relationships(target_entity_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_type
ON entity_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationships_strength
ON entity_relationships(strength DESC)
WHERE is_active = true;

-- =====================================================
-- 4.2 Entity Sentiment History Table
-- Track sentiment changes over time per entity
-- =====================================================

CREATE TABLE IF NOT EXISTS entity_sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,

  -- Sentiment value (-1 to 1)
  sentiment FLOAT NOT NULL CHECK (sentiment >= -1 AND sentiment <= 1),

  -- Context for this sentiment reading
  context TEXT,

  -- Source note that triggered this
  source_note_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_history_entity
ON entity_sentiment_history(entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentiment_history_time
ON entity_sentiment_history(created_at DESC);

-- RLS policy for entity_sentiment_history
ALTER TABLE entity_sentiment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own entity sentiment history"
ON entity_sentiment_history FOR SELECT
USING (
  entity_id IN (
    SELECT id FROM user_entities WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage all sentiment history"
ON entity_sentiment_history FOR ALL
USING (auth.role() = 'service_role');

-- =====================================================
-- 4.3 Function to get sentiment trajectory
-- =====================================================

CREATE OR REPLACE FUNCTION get_sentiment_trajectory(
  p_entity_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  avg_sentiment FLOAT,
  min_sentiment FLOAT,
  max_sentiment FLOAT,
  reading_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as date,
    AVG(sentiment)::FLOAT as avg_sentiment,
    MIN(sentiment)::FLOAT as min_sentiment,
    MAX(sentiment)::FLOAT as max_sentiment,
    COUNT(*)::INTEGER as reading_count
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4.4 Function to detect sentiment trends
-- =====================================================

CREATE OR REPLACE FUNCTION get_sentiment_trend(
  p_entity_id UUID,
  p_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  trend TEXT,
  change_percent FLOAT,
  current_avg FLOAT,
  previous_avg FLOAT
) AS $$
DECLARE
  v_current FLOAT;
  v_previous FLOAT;
  v_change FLOAT;
BEGIN
  -- Current period average
  SELECT AVG(sentiment) INTO v_current
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;

  -- Previous period average
  SELECT AVG(sentiment) INTO v_previous
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days * 2 || ' days')::INTERVAL
    AND created_at <= NOW() - (p_days || ' days')::INTERVAL;

  -- Calculate change
  IF v_previous IS NOT NULL AND v_previous != 0 THEN
    v_change := ((v_current - v_previous) / ABS(v_previous)) * 100;
  ELSE
    v_change := 0;
  END IF;

  RETURN QUERY SELECT
    CASE
      WHEN v_change > 10 THEN 'improving'
      WHEN v_change < -10 THEN 'declining'
      ELSE 'stable'
    END as trend,
    v_change as change_percent,
    v_current as current_avg,
    v_previous as previous_avg;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 4.5 Graph Traversal Function
-- Traverse entity graph to find connections
-- =====================================================

CREATE OR REPLACE FUNCTION traverse_entity_graph(
  p_entity_id UUID,
  p_user_id UUID,
  p_max_depth INTEGER DEFAULT 2,
  p_min_strength FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  relationship_path TEXT[],
  relationship_types TEXT[],
  total_strength FLOAT,
  depth INTEGER
) AS $$
WITH RECURSIVE graph_traversal AS (
  -- Base case: start entity
  SELECT
    e.id as entity_id,
    e.name as entity_name,
    e.entity_type,
    ARRAY[]::TEXT[] as relationship_path,
    ARRAY[]::TEXT[] as relationship_types,
    1.0::FLOAT as total_strength,
    0 as depth
  FROM user_entities e
  WHERE e.id = p_entity_id
    AND e.user_id = p_user_id
    AND e.status = 'active'

  UNION ALL

  -- Recursive case: follow relationships
  SELECT
    CASE
      WHEN r.source_entity_id = gt.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END as entity_id,
    e.name as entity_name,
    e.entity_type,
    gt.relationship_path || e.name,
    gt.relationship_types || r.relationship_type,
    gt.total_strength * COALESCE(r.strength, 0.5),
    gt.depth + 1
  FROM graph_traversal gt
  JOIN entity_relationships r ON (
    r.source_entity_id = gt.entity_id OR r.target_entity_id = gt.entity_id
  )
  JOIN user_entities e ON (
    e.id = CASE
      WHEN r.source_entity_id = gt.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END
  )
  WHERE gt.depth < p_max_depth
    AND COALESCE(r.is_active, true) = true
    AND COALESCE(r.strength, 0.5) >= p_min_strength
    AND e.status = 'active'
    AND e.user_id = p_user_id
    AND NOT e.name = ANY(gt.relationship_path) -- Prevent cycles
)
SELECT DISTINCT ON (gt2.entity_id)
  gt2.entity_id,
  gt2.entity_name,
  gt2.entity_type,
  gt2.relationship_path,
  gt2.relationship_types,
  gt2.total_strength,
  gt2.depth
FROM graph_traversal gt2
WHERE gt2.depth > 0 -- Exclude start entity
ORDER BY gt2.entity_id, gt2.total_strength DESC;
$$ LANGUAGE sql;

-- =====================================================
-- 4.6 Update relationship strength function
-- Increases strength when relationship is reconfirmed
-- =====================================================

CREATE OR REPLACE FUNCTION update_relationship_strength(
  p_source_entity_id UUID,
  p_target_entity_id UUID,
  p_relationship_type TEXT,
  p_strength_boost FLOAT DEFAULT 0.1
)
RETURNS VOID AS $$
BEGIN
  UPDATE entity_relationships
  SET
    strength = LEAST(1.0, COALESCE(strength, 0.5) + p_strength_boost),
    updated_at = NOW()
  WHERE source_entity_id = p_source_entity_id
    AND target_entity_id = p_target_entity_id
    AND relationship_type = p_relationship_type;

  -- If no rows updated, relationship doesn't exist - could create it here
  IF NOT FOUND THEN
    INSERT INTO entity_relationships (
      source_entity_id,
      target_entity_id,
      relationship_type,
      strength,
      is_active,
      user_id
    )
    SELECT
      p_source_entity_id,
      p_target_entity_id,
      p_relationship_type,
      0.5 + p_strength_boost,
      true,
      e.user_id
    FROM user_entities e
    WHERE e.id = p_source_entity_id
    ON CONFLICT (source_entity_id, target_entity_id, relationship_type)
    DO UPDATE SET
      strength = LEAST(1.0, entity_relationships.strength + p_strength_boost),
      updated_at = NOW();
  END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE entity_sentiment_history IS 'Tracks sentiment changes over time for each entity';
COMMENT ON COLUMN entity_relationships.strength IS 'Relationship strength 0-1, increases with reconfirmation';
COMMENT ON COLUMN entity_relationships.is_active IS 'False for ended relationships (breakups, departures)';
COMMENT ON FUNCTION traverse_entity_graph IS 'Recursive CTE to traverse entity relationship graph';
COMMENT ON FUNCTION get_sentiment_trajectory IS 'Returns daily sentiment aggregates for an entity';
COMMENT ON FUNCTION get_sentiment_trend IS 'Compares current vs previous period sentiment to detect trends';

-- =====================================================
-- FIX: match_entities_enhanced function schema mismatch
-- The function was returning columns that don't exist
-- =====================================================

-- Drop existing function (all overloads)
DROP FUNCTION IF EXISTS match_entities_enhanced(vector, FLOAT, INTEGER, UUID, TEXT[], BOOLEAN, BOOLEAN, TEXT, TEXT);
DROP FUNCTION IF EXISTS match_entities_enhanced(vector(1536), FLOAT, INTEGER, UUID, TEXT[], BOOLEAN, BOOLEAN, TEXT, TEXT);

-- Recreate with correct column references
CREATE OR REPLACE FUNCTION match_entities_enhanced(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INTEGER,
  p_user_id UUID,
  p_memory_types TEXT[] DEFAULT NULL,
  p_include_historical BOOLEAN DEFAULT FALSE,
  p_exclude_expired BOOLEAN DEFAULT TRUE,
  p_min_importance TEXT DEFAULT NULL,
  p_sensitivity_max TEXT DEFAULT 'normal'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  entity_type TEXT,
  memory_type TEXT,
  summary TEXT,
  importance TEXT,
  sentiment_average FLOAT,
  is_historical BOOLEAN,
  effective_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  recurrence_pattern JSONB,
  sensitivity_level TEXT,
  similarity FLOAT,
  recency_boost FLOAT,
  access_boost FLOAT,
  final_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.entity_type,
    e.memory_type,
    e.summary,
    e.importance,
    e.sentiment_average,
    e.is_historical,
    e.effective_from,
    e.expires_at,
    e.recurrence_pattern,
    e.sensitivity_level,
    (1 - (e.embedding <=> query_embedding))::FLOAT as similarity,
    POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800)::FLOAT as recency_boost,
    (CASE WHEN COALESCE(e.access_count, 0) > 0 THEN LN(e.access_count + 1) / 5 ELSE 0 END)::FLOAT as access_boost,
    (
      (1 - (e.embedding <=> query_embedding)) * 0.5 +
      (CASE e.importance
        WHEN 'critical' THEN 1.0
        WHEN 'high' THEN 0.8
        WHEN 'medium' THEN 0.6
        WHEN 'low' THEN 0.4
        WHEN 'trivial' THEN 0.2
        ELSE 0.5
      END) * 0.2 +
      POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800) * 0.15 +
      (CASE WHEN COALESCE(e.access_count, 0) > 0 THEN LN(e.access_count + 1) / 5 ELSE 0 END) * 0.15
    )::FLOAT as final_score
  FROM user_entities e
  WHERE e.user_id = p_user_id
    AND e.status = 'active'
    AND e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (p_memory_types IS NULL OR e.memory_type = ANY(p_memory_types))
    AND (p_include_historical = TRUE OR COALESCE(e.is_historical, FALSE) = FALSE)
    AND (p_exclude_expired = FALSE OR e.expires_at IS NULL OR e.expires_at > NOW())
    AND (e.effective_from IS NULL OR e.effective_from <= NOW())
    AND (
      p_sensitivity_max = 'private' OR
      (p_sensitivity_max = 'sensitive' AND COALESCE(e.sensitivity_level, 'normal') IN ('normal', 'sensitive')) OR
      (p_sensitivity_max = 'normal' AND COALESCE(e.sensitivity_level, 'normal') = 'normal')
    )
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Ensure entity_type constraint allows all needed values
ALTER TABLE user_entities DROP CONSTRAINT IF EXISTS user_entities_entity_type_check;
ALTER TABLE user_entities ADD CONSTRAINT user_entities_entity_type_check
CHECK (entity_type IN ('person', 'project', 'place', 'pet', 'organization', 'concept', 'event', 'other'));

-- Add comment
COMMENT ON FUNCTION match_entities_enhanced IS 'Enhanced entity matching with composite scoring: 50% similarity + 20% importance + 15% recency + 15% access frequency. Fixed to use sentiment_average column.';

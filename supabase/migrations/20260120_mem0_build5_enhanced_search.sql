-- =====================================================
-- MEM0 BUILD 5: ENHANCED SEARCH + TIME-BOUND MEMORIES
-- Composite scoring, access tracking, cleanup, and decay
-- =====================================================

-- =====================================================
-- 5.1 Enhanced Entity Matching with Composite Scoring
-- 50% semantic, 20% importance, 15% recency, 15% access
-- =====================================================

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
  importance_score FLOAT,
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
DECLARE
  importance_values TEXT[] := ARRAY['critical', 'high', 'medium', 'low', 'trivial'];
  min_importance_idx INTEGER;
BEGIN
  -- Get minimum importance index if specified
  IF p_min_importance IS NOT NULL THEN
    min_importance_idx := array_position(importance_values, p_min_importance);
  ELSE
    min_importance_idx := 5; -- Include all
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.entity_type,
    e.memory_type,
    e.summary,
    e.importance,
    e.importance_score,
    e.sentiment_average,
    e.is_historical,
    e.effective_from,
    e.expires_at,
    e.recurrence_pattern,
    e.sensitivity_level,
    -- Raw similarity
    (1 - (e.embedding <=> query_embedding))::FLOAT as similarity,
    -- Recency boost: exponential decay over weeks (0.95^weeks)
    POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800)::FLOAT as recency_boost,
    -- Access frequency boost (log scale, capped)
    LEAST(1.0, 0.5 + (LN(GREATEST(1, COALESCE(e.access_count, 0))) / 10))::FLOAT as access_boost,
    -- Final composite score
    (
      (1 - (e.embedding <=> query_embedding)) * 0.50 +  -- 50% semantic similarity
      COALESCE(e.importance_score, 0.5) * 0.20 +        -- 20% importance
      POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800) * 0.15 +  -- 15% recency
      LEAST(1.0, 0.5 + (LN(GREATEST(1, COALESCE(e.access_count, 0))) / 10)) * 0.15  -- 15% access frequency
    )::FLOAT as final_score
  FROM user_entities e
  WHERE e.user_id = p_user_id
    AND e.status = 'active'
    -- Embedding must exist
    AND e.embedding IS NOT NULL
    -- Similarity threshold
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    -- Memory type filter
    AND (p_memory_types IS NULL OR e.memory_type = ANY(p_memory_types))
    -- Historical filter
    AND (p_include_historical OR COALESCE(e.is_historical, false) = FALSE)
    -- Expiration filter
    AND (NOT p_exclude_expired OR e.expires_at IS NULL OR e.expires_at > NOW())
    -- Effective date filter (don't return future-dated memories before their time)
    AND (e.effective_from IS NULL OR e.effective_from <= NOW())
    -- Importance filter
    AND (p_min_importance IS NULL OR array_position(importance_values, e.importance) <= min_importance_idx)
    -- Sensitivity filter
    AND (
      p_sensitivity_max = 'private' OR
      (p_sensitivity_max = 'sensitive' AND COALESCE(e.sensitivity_level, 'normal') IN ('normal', 'sensitive')) OR
      (p_sensitivity_max = 'normal' AND COALESCE(e.sensitivity_level, 'normal') = 'normal')
    )
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5.2 Update Access Tracking
-- Increments access count when memories are retrieved
-- =====================================================

CREATE OR REPLACE FUNCTION update_memory_access(p_memory_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE user_entities
  SET
    access_count = COALESCE(access_count, 0) + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(p_memory_ids);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5.3 Cleanup Expired Memories
-- Daily job to archive expired and decay very old memories
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS TABLE (
  expired_count INTEGER,
  decayed_count INTEGER
) AS $$
DECLARE
  v_expired INTEGER;
  v_decayed INTEGER;
BEGIN
  -- Archive expired memories
  WITH archived AS (
    UPDATE user_entities
    SET status = 'archived', updated_at = NOW()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired FROM archived;

  -- Archive very low importance memories older than 90 days with no recent access
  WITH decayed AS (
    UPDATE user_entities
    SET status = 'archived', updated_at = NOW()
    WHERE status = 'active'
      AND importance = 'trivial'
      AND COALESCE(importance_score, 0.5) < 0.1
      AND updated_at < NOW() - INTERVAL '90 days'
      AND COALESCE(last_accessed_at, updated_at) < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_decayed FROM decayed;

  RETURN QUERY SELECT v_expired, v_decayed;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5.4 Apply Memory Decay
-- Weekly job to gradually reduce importance scores
-- =====================================================

CREATE OR REPLACE FUNCTION apply_memory_decay()
RETURNS TABLE (
  decayed_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH decayed AS (
    UPDATE user_entities
    SET importance_score = GREATEST(0.05, COALESCE(importance_score, 0.5) *
      CASE
        -- Critical: never decay
        WHEN importance = 'critical' THEN 1.0
        -- High: start after 90 days, -5% per week
        WHEN importance = 'high' AND updated_at < NOW() - INTERVAL '90 days' THEN 0.95
        -- Medium: start after 30 days, -10% per week
        WHEN importance = 'medium' AND updated_at < NOW() - INTERVAL '30 days' THEN 0.90
        -- Low: start after 14 days, -15% per week
        WHEN importance = 'low' AND updated_at < NOW() - INTERVAL '14 days' THEN 0.85
        -- Trivial: start after 7 days, -20% per week
        WHEN importance = 'trivial' AND updated_at < NOW() - INTERVAL '7 days' THEN 0.80
        ELSE 1.0
      END
    )
    WHERE status = 'active'
      AND importance != 'critical'
      AND COALESCE(last_accessed_at, updated_at) < NOW() - INTERVAL '7 days' -- Don't decay recently accessed
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM decayed;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5.5 Per-User Decay Function (for async jobs)
-- =====================================================

CREATE OR REPLACE FUNCTION apply_memory_decay_for_user(p_user_id UUID)
RETURNS TABLE (count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH decayed AS (
    UPDATE user_entities
    SET importance_score = GREATEST(0.05, COALESCE(importance_score, 0.5) *
      CASE
        WHEN importance = 'critical' THEN 1.0
        WHEN importance = 'high' AND updated_at < NOW() - INTERVAL '90 days' THEN 0.95
        WHEN importance = 'medium' AND updated_at < NOW() - INTERVAL '30 days' THEN 0.90
        WHEN importance = 'low' AND updated_at < NOW() - INTERVAL '14 days' THEN 0.85
        WHEN importance = 'trivial' AND updated_at < NOW() - INTERVAL '7 days' THEN 0.80
        ELSE 1.0
      END
    )
    WHERE user_id = p_user_id
      AND status = 'active'
      AND importance != 'critical'
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM decayed;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5.6 Cron Jobs (if pg_cron is available)
-- NOTE: These require pg_cron extension to be enabled
-- =====================================================

-- Check if pg_cron is available and schedule jobs
DO $$
BEGIN
  -- Only attempt to schedule if pg_cron exists
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Daily cleanup at 3 AM UTC
    PERFORM cron.schedule(
      'cleanup-memories',
      '0 3 * * *',
      'SELECT * FROM cleanup_expired_memories()'
    );

    -- Weekly decay on Sunday at 4 AM UTC
    PERFORM cron.schedule(
      'decay-memories',
      '0 4 * * 0',
      'SELECT * FROM apply_memory_decay()'
    );

    RAISE NOTICE 'Cron jobs scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron not available - cron jobs not scheduled. Run cleanup/decay manually or via Edge Functions.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cron jobs: %', SQLERRM;
END $$;

-- =====================================================
-- 5.7 Simple match_entities for backward compatibility
-- (if it doesn't already exist with the right signature)
-- =====================================================

CREATE OR REPLACE FUNCTION match_entities(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INTEGER,
  p_user_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  entity_type TEXT,
  summary TEXT,
  importance TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.entity_type,
    e.summary,
    e.importance,
    (1 - (e.embedding <=> query_embedding))::FLOAT as similarity
  FROM user_entities e
  WHERE e.user_id = p_user_id
    AND e.status = 'active'
    AND e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON FUNCTION match_entities_enhanced IS 'Advanced entity search with composite scoring: 50% semantic, 20% importance, 15% recency, 15% access frequency';
COMMENT ON FUNCTION update_memory_access IS 'Increment access count when memories are retrieved';
COMMENT ON FUNCTION cleanup_expired_memories IS 'Archive expired memories and decay trivial old ones';
COMMENT ON FUNCTION apply_memory_decay IS 'Weekly decay of importance scores based on importance level and age';
COMMENT ON FUNCTION apply_memory_decay_for_user IS 'Per-user decay for async job processing';

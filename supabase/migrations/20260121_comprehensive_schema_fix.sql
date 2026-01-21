-- =====================================================
-- COMPREHENSIVE SCHEMA FIX
-- Run this in Supabase SQL Editor to fix all schema gaps
-- Date: January 21, 2026
-- =====================================================

-- =====================================================
-- STEP 1: Enable pgvector Extension
-- Required for semantic search with embeddings
-- =====================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================
-- STEP 2: Add Missing Columns to user_entities
-- These columns are referenced by Mem0 code but never created
-- =====================================================

-- 2.1 Status column (active, archived, deleted)
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'
CHECK (status IN ('active', 'archived', 'deleted'));

-- 2.2 Summary column for entity description
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS summary TEXT;

-- 2.3 Importance tier (trivial, low, medium, high, critical)
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS importance TEXT DEFAULT 'medium'
CHECK (importance IN ('trivial', 'low', 'medium', 'high', 'critical'));

-- 2.4 Importance score (0.0 to 1.0)
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS importance_score FLOAT DEFAULT 0.5
CHECK (importance_score >= 0 AND importance_score <= 1);

-- 2.5 Embedding vector for semantic search (1536 dimensions for OpenAI text-embedding-3-small)
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 2.6 Created/Updated timestamps if missing
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- STEP 3: Create Indexes for Vector Search
-- =====================================================

-- Index for vector similarity search (IVFFlat for performance)
-- Only create if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_entities_embedding'
  ) THEN
    CREATE INDEX idx_user_entities_embedding
    ON user_entities
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- If IVFFlat fails (not enough data), use default index
    RAISE NOTICE 'IVFFlat index failed, using default: %', SQLERRM;
    CREATE INDEX IF NOT EXISTS idx_user_entities_embedding_default
    ON user_entities (embedding);
END $$;

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_user_entities_status
ON user_entities(user_id, status)
WHERE status = 'active';

-- Index for importance filtering
CREATE INDEX IF NOT EXISTS idx_user_entities_importance
ON user_entities(user_id, importance, importance_score DESC)
WHERE status = 'active';

-- =====================================================
-- STEP 4: Create entity_relationships Table
-- This table was never created, only ALTER TABLE existed
-- =====================================================

CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- The two entities being related
  subject_entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE,
  object_entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE,

  -- The relationship type
  predicate TEXT NOT NULL,

  -- Relationship metadata
  strength FLOAT DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
  confidence FLOAT DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  is_active BOOLEAN DEFAULT TRUE,

  -- Temporal tracking
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,

  -- Additional metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint for relationship type between entities
  CONSTRAINT unique_relationship UNIQUE (subject_entity_id, object_entity_id, predicate)
);

-- Indexes for graph traversal
CREATE INDEX IF NOT EXISTS idx_relationships_subject
ON entity_relationships(subject_entity_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_object
ON entity_relationships(object_entity_id)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_predicate
ON entity_relationships(predicate);

CREATE INDEX IF NOT EXISTS idx_relationships_user
ON entity_relationships(user_id);

-- RLS for entity_relationships
ALTER TABLE entity_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own relationships" ON entity_relationships;
CREATE POLICY "Users can manage own relationships" ON entity_relationships
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage all relationships" ON entity_relationships;
CREATE POLICY "Service role can manage all relationships" ON entity_relationships
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- STEP 5: Create category_summaries Table (if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS category_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  category TEXT NOT NULL CHECK (category IN (
    'work_life', 'personal_life', 'health_wellness', 'relationships',
    'goals_aspirations', 'preferences', 'beliefs_values', 'skills_expertise',
    'projects', 'challenges', 'general'
  )),

  summary TEXT NOT NULL,

  -- Tracking
  entity_count INT DEFAULT 0,
  last_entities JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, category)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_category_summaries_user ON category_summaries(user_id);

-- Enable RLS
ALTER TABLE category_summaries ENABLE ROW LEVEL SECURITY;

-- User policy
DROP POLICY IF EXISTS "Users can manage own summaries" ON category_summaries;
CREATE POLICY "Users can manage own summaries" ON category_summaries
  FOR ALL USING (auth.uid() = user_id);

-- Service role policy
DROP POLICY IF EXISTS "Service role can manage all summaries" ON category_summaries;
CREATE POLICY "Service role can manage all summaries" ON category_summaries
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- STEP 6: Create entity_sentiment_history Table (if not exists)
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

-- RLS policy for entity_sentiment_history
ALTER TABLE entity_sentiment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own entity sentiment history" ON entity_sentiment_history;
CREATE POLICY "Users can view own entity sentiment history"
ON entity_sentiment_history FOR SELECT
USING (
  entity_id IN (
    SELECT id FROM user_entities WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role can manage all sentiment history" ON entity_sentiment_history;
CREATE POLICY "Service role can manage all sentiment history"
ON entity_sentiment_history FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- STEP 7: Create/Update Functions for Vector Search
-- =====================================================

-- Simple match_entities function
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
-- STEP 8: Graph Traversal Function
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
      WHEN r.subject_entity_id = gt.entity_id THEN r.object_entity_id
      ELSE r.subject_entity_id
    END as entity_id,
    e.name as entity_name,
    e.entity_type,
    gt.relationship_path || e.name,
    gt.relationship_types || r.predicate,
    gt.total_strength * COALESCE(r.strength, 0.5),
    gt.depth + 1
  FROM graph_traversal gt
  JOIN entity_relationships r ON (
    r.subject_entity_id = gt.entity_id OR r.object_entity_id = gt.entity_id
  )
  JOIN user_entities e ON (
    e.id = CASE
      WHEN r.subject_entity_id = gt.entity_id THEN r.object_entity_id
      ELSE r.subject_entity_id
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
-- STEP 9: Verify Setup
-- =====================================================

-- Check if all required columns exist
DO $$
DECLARE
  missing_columns TEXT := '';
BEGIN
  -- Check user_entities columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'embedding') THEN
    missing_columns := missing_columns || 'user_entities.embedding, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'status') THEN
    missing_columns := missing_columns || 'user_entities.status, ';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'importance') THEN
    missing_columns := missing_columns || 'user_entities.importance, ';
  END IF;

  IF missing_columns != '' THEN
    RAISE WARNING 'Missing columns: %', missing_columns;
  ELSE
    RAISE NOTICE '✅ All required columns exist';
  END IF;
END $$;

-- Check if all required tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entity_relationships') THEN
    RAISE WARNING '❌ entity_relationships table missing';
  ELSE
    RAISE NOTICE '✅ entity_relationships table exists';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_summaries') THEN
    RAISE WARNING '❌ category_summaries table missing';
  ELSE
    RAISE NOTICE '✅ category_summaries table exists';
  END IF;
END $$;

-- Check if pgvector is enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE WARNING '❌ pgvector extension not enabled';
  ELSE
    RAISE NOTICE '✅ pgvector extension enabled';
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE entity_relationships IS 'Graph of relationships between entities';
COMMENT ON TABLE category_summaries IS 'Evolving prose summaries per category';
COMMENT ON COLUMN user_entities.embedding IS 'Vector embedding for semantic search (1536 dims)';
COMMENT ON COLUMN user_entities.status IS 'Entity status: active, archived, deleted';
COMMENT ON COLUMN user_entities.importance IS 'Importance tier: trivial, low, medium, high, critical';
COMMENT ON COLUMN user_entities.importance_score IS 'Numeric importance 0-1 for decay calculations';

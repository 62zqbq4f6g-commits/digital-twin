-- =====================================================
-- MEM0 BUILD 1: MEMORY CATEGORIES + TYPES
-- Adds memory classification, temporal tracking, sensitivity, and versioning
-- =====================================================

-- =====================================================
-- PHASE 1A: Add memory_type classification
-- =====================================================

-- Memory type: what kind of information is this?
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'entity'
CHECK (memory_type IN (
  'entity',      -- People, places, projects, things
  'fact',        -- Objective information about entities
  'preference',  -- User likes, dislikes, preferences
  'event',       -- Time-bound occurrences
  'goal',        -- Objectives, desired outcomes
  'procedure',   -- How-to knowledge, processes
  'decision',    -- Decisions the user made
  'action'       -- Actions completed, outcomes
));

-- =====================================================
-- PHASE 1B: Add temporal tracking
-- =====================================================

-- Historical marker: "used to", "previously", "no longer"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;

-- Future start date: "starting next month", "beginning January"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ;

-- Expiration date: "until Friday", "for the next week"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Recurrence pattern: "every Monday", "weekly standup"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB;
-- Example values:
-- {"type": "weekly", "day": "Monday", "time": "09:00"}
-- {"type": "monthly", "day": 15}
-- {"type": "yearly", "month": 6, "day": 15}
-- {"type": "daily", "time": "08:00"}

-- =====================================================
-- PHASE 1C: Add sensitivity and privacy
-- =====================================================

-- Sensitivity level for privacy edge cases
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS sensitivity_level TEXT DEFAULT 'normal'
CHECK (sensitivity_level IN (
  'normal',     -- Standard memories
  'sensitive',  -- Health, death, loss, relationships
  'private'     -- Financial, passwords (should rarely store)
));

-- =====================================================
-- PHASE 1D: Add versioning and access tracking
-- =====================================================

-- Version number for tracking updates
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Access count for popularity/decay calculation
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Last accessed timestamp
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- PHASE 1E: Add decision/action specific fields
-- =====================================================

-- For decision/action memories: what was the outcome?
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Outcome sentiment: was the decision good or bad?
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS outcome_sentiment FLOAT CHECK (outcome_sentiment >= -1 AND outcome_sentiment <= 1);

-- When was outcome recorded?
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ;

-- =====================================================
-- INDEXES for new columns
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_entities_memory_type
ON user_entities(user_id, memory_type)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_expires
ON user_entities(expires_at)
WHERE expires_at IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_historical
ON user_entities(user_id, is_historical)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_sensitivity
ON user_entities(user_id, sensitivity_level)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_effective
ON user_entities(effective_from)
WHERE effective_from IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_recurrence
ON user_entities(user_id)
WHERE recurrence_pattern IS NOT NULL AND status = 'active';

-- =====================================================
-- COMMENTS for documentation
-- =====================================================

COMMENT ON COLUMN user_entities.memory_type IS 'Classification: entity, fact, preference, event, goal, procedure, decision, action';
COMMENT ON COLUMN user_entities.is_historical IS 'True if this is historical info (used to, previously, no longer)';
COMMENT ON COLUMN user_entities.effective_from IS 'Future date when this memory becomes active';
COMMENT ON COLUMN user_entities.expires_at IS 'Date when this memory expires (events, temporary states)';
COMMENT ON COLUMN user_entities.recurrence_pattern IS 'JSON pattern for recurring items: {type, day?, time?, month?}';
COMMENT ON COLUMN user_entities.sensitivity_level IS 'Privacy level: normal, sensitive (health/loss), private (financial)';
COMMENT ON COLUMN user_entities.version IS 'Incremented on each update for tracking changes';
COMMENT ON COLUMN user_entities.access_count IS 'Number of times this memory was retrieved';
COMMENT ON COLUMN user_entities.last_accessed_at IS 'Last time this memory was retrieved';
COMMENT ON COLUMN user_entities.outcome IS 'For decisions/actions: the result';
COMMENT ON COLUMN user_entities.outcome_sentiment IS 'For decisions/actions: sentiment of outcome (-1 to 1)';
COMMENT ON COLUMN user_entities.outcome_recorded_at IS 'When the outcome was recorded';

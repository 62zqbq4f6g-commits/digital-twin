-- ============================================
-- BI-TEMPORAL EDGE INVALIDATION
-- Date: January 30, 2026
--
-- Temporal knowledge tracking for Inscript:
-- 1. Bi-temporal: when facts were TRUE vs when we LEARNED them
-- 2. Version history: track fact evolution over time
-- 3. Contradiction detection: auto-invalidate conflicting facts
-- 4. Point-in-time queries: "what did I know on date X?"
-- ============================================

-- ============================================
-- PART 1: SCHEMA ENHANCEMENTS
-- ============================================

-- Add bi-temporal columns to entity_facts
ALTER TABLE entity_facts
  -- When the fact was TRUE in the real world
  ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ,  -- NULL = still valid

  -- When we learned/invalidated this fact (system time)
  ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalidated_by UUID,  -- The fact that superseded this
  ADD COLUMN IF NOT EXISTS invalidation_reason TEXT,  -- 'contradiction', 'source_deleted', 'user_corrected', 'expired', 'merged'

  -- Version tracking
  ADD COLUMN IF NOT EXISTS version INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS previous_version_id UUID,
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT TRUE;

-- Add foreign key constraint for previous_version_id (self-reference)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_facts_previous_version_fkey'
  ) THEN
    ALTER TABLE entity_facts
    ADD CONSTRAINT entity_facts_previous_version_fkey
    FOREIGN KEY (previous_version_id) REFERENCES entity_facts(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add foreign key for invalidated_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_facts_invalidated_by_fkey'
  ) THEN
    ALTER TABLE entity_facts
    ADD CONSTRAINT entity_facts_invalidated_by_fkey
    FOREIGN KEY (invalidated_by) REFERENCES entity_facts(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Indexes for temporal queries
CREATE INDEX IF NOT EXISTS idx_entity_facts_valid_range
ON entity_facts(entity_id, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_entity_facts_invalidated
ON entity_facts(user_id, invalidated_at) WHERE invalidated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_facts_current
ON entity_facts(user_id, entity_id, is_current) WHERE is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_entity_facts_predicate_object
ON entity_facts(user_id, entity_id, predicate, object_text);

-- ============================================
-- PART 2: CONTRADICTION DETECTION
-- ============================================

-- Function to detect and handle contradictions when inserting new facts
CREATE OR REPLACE FUNCTION handle_fact_contradiction()
RETURNS TRIGGER AS $$
DECLARE
  conflicting_fact RECORD;
  conflict_predicates TEXT[] := ARRAY[
    'works_at', 'lives_in', 'job_title', 'reports_to',
    'married_to', 'dating', 'age', 'birthday',
    'company', 'role', 'location', 'employer'
  ];
BEGIN
  -- Only check for contradictions on certain predicates (single-value facts)
  IF NEW.predicate = ANY(conflict_predicates) THEN
    -- Find existing active facts with same entity + predicate but different object
    FOR conflicting_fact IN
      SELECT id, object_text, version, created_at
      FROM entity_facts
      WHERE user_id = NEW.user_id
        AND entity_id = NEW.entity_id
        AND predicate = NEW.predicate
        AND LOWER(TRIM(object_text)) != LOWER(TRIM(NEW.object_text))
        AND is_current = TRUE
        AND status = 'active'
        AND invalidated_at IS NULL
    LOOP
      -- Invalidate the old fact (superseded by new one)
      UPDATE entity_facts
      SET
        is_current = FALSE,
        invalidated_at = NOW(),
        invalidated_by = NEW.id,
        invalidation_reason = 'contradiction',
        valid_to = COALESCE(NEW.valid_from, NOW()),
        updated_at = NOW()
      WHERE id = conflicting_fact.id;

      -- Link the new fact to the old one as its predecessor
      NEW.previous_version_id := conflicting_fact.id;
      NEW.version := conflicting_fact.version + 1;

      RAISE NOTICE 'Fact contradiction detected: "% % %" superseded by "% % %"',
        (SELECT name FROM user_entities WHERE id = NEW.entity_id),
        NEW.predicate,
        conflicting_fact.object_text,
        (SELECT name FROM user_entities WHERE id = NEW.entity_id),
        NEW.predicate,
        NEW.object_text;
    END LOOP;
  END IF;

  -- Set valid_from if not provided
  IF NEW.valid_from IS NULL THEN
    NEW.valid_from := COALESCE(NEW.first_mentioned, NOW());
  END IF;

  -- Ensure is_current is true for new facts
  NEW.is_current := TRUE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for contradiction detection
DROP TRIGGER IF EXISTS trigger_fact_contradiction ON entity_facts;

CREATE TRIGGER trigger_fact_contradiction
  BEFORE INSERT ON entity_facts
  FOR EACH ROW
  EXECUTE FUNCTION handle_fact_contradiction();

-- ============================================
-- PART 3: POINT-IN-TIME QUERY FUNCTIONS
-- ============================================

-- Get facts as they were known at a specific point in time
CREATE OR REPLACE FUNCTION get_facts_at_time(
  p_user_id UUID,
  p_entity_id UUID,
  p_as_of TIMESTAMPTZ
)
RETURNS TABLE (
  id UUID,
  predicate TEXT,
  object_text TEXT,
  confidence FLOAT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  version INT,
  was_current BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ef.id,
    ef.predicate,
    ef.object_text,
    ef.confidence,
    ef.valid_from,
    ef.valid_to,
    ef.version,
    -- Was this fact current at that point in time?
    (ef.created_at <= p_as_of AND (ef.invalidated_at IS NULL OR ef.invalidated_at > p_as_of)) AS was_current
  FROM entity_facts ef
  WHERE ef.user_id = p_user_id
    AND ef.entity_id = p_entity_id
    AND ef.created_at <= p_as_of  -- We knew about it by then
    AND (ef.invalidated_at IS NULL OR ef.invalidated_at > p_as_of)  -- It wasn't invalidated yet
    AND ef.status = 'active'
  ORDER BY ef.predicate, ef.version DESC;
END;
$$ LANGUAGE plpgsql;

-- Get the full history of a specific fact (all versions)
CREATE OR REPLACE FUNCTION get_fact_history(
  p_user_id UUID,
  p_entity_id UUID,
  p_predicate TEXT
)
RETURNS TABLE (
  id UUID,
  object_text TEXT,
  confidence FLOAT,
  version INT,
  valid_from TIMESTAMPTZ,
  valid_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  invalidated_at TIMESTAMPTZ,
  invalidation_reason TEXT,
  is_current BOOLEAN,
  source_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ef.id,
    ef.object_text,
    ef.confidence,
    ef.version,
    ef.valid_from,
    ef.valid_to,
    ef.created_at,
    ef.invalidated_at,
    ef.invalidation_reason,
    ef.is_current,
    ef.source_type
  FROM entity_facts ef
  WHERE ef.user_id = p_user_id
    AND ef.entity_id = p_entity_id
    AND ef.predicate = p_predicate
  ORDER BY ef.version DESC, ef.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Get all current facts for an entity (excluding invalidated)
CREATE OR REPLACE FUNCTION get_current_facts(
  p_user_id UUID,
  p_entity_id UUID
)
RETURNS TABLE (
  id UUID,
  predicate TEXT,
  object_text TEXT,
  confidence FLOAT,
  valid_from TIMESTAMPTZ,
  version INT,
  mention_count INT,
  last_mentioned TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ef.id,
    ef.predicate,
    ef.object_text,
    ef.confidence,
    ef.valid_from,
    ef.version,
    ef.mention_count,
    ef.last_mentioned
  FROM entity_facts ef
  WHERE ef.user_id = p_user_id
    AND ef.entity_id = p_entity_id
    AND ef.is_current = TRUE
    AND ef.status = 'active'
    AND ef.invalidated_at IS NULL
  ORDER BY ef.confidence DESC, ef.mention_count DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 4: MANUAL INVALIDATION FUNCTION
-- ============================================

-- Manually invalidate a fact (for user corrections)
CREATE OR REPLACE FUNCTION invalidate_fact(
  p_fact_id UUID,
  p_reason TEXT DEFAULT 'user_corrected',
  p_valid_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE entity_facts
  SET
    is_current = FALSE,
    invalidated_at = NOW(),
    invalidation_reason = p_reason,
    valid_to = p_valid_to,
    updated_at = NOW()
  WHERE id = p_fact_id
    AND invalidated_at IS NULL;  -- Don't re-invalidate

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 5: UPDATE CASCADE SOFT-DELETE
-- ============================================

-- Enhanced cascade that uses invalidation instead of simple status change
CREATE OR REPLACE FUNCTION cascade_note_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Note is being deleted
  IF NEW.status IN ('deleted', 'archived') AND (OLD.status IS NULL OR OLD.status NOT IN ('deleted', 'archived')) THEN

    -- Invalidate entity_facts from this note (not just mark inactive)
    UPDATE entity_facts
    SET
      is_current = FALSE,
      invalidated_at = NOW(),
      invalidation_reason = 'source_deleted',
      valid_to = NOW(),
      status = 'inactive',
      updated_at = NOW()
    WHERE source_id = NEW.id
      AND user_id = NEW.user_id
      AND invalidated_at IS NULL;

    -- Invalidate entities from this note
    UPDATE user_entities
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Invalidate behaviors from this note
    UPDATE user_behaviors
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Invalidate topics from this note
    UPDATE user_topics
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id::uuid = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    RAISE NOTICE 'Cascade soft-delete with invalidation for note %', NEW.id;

  -- Note is being UN-deleted
  ELSIF OLD.status IN ('deleted', 'archived') AND (NEW.status IS NULL OR NEW.status NOT IN ('deleted', 'archived')) THEN

    -- Restore facts (but keep invalidation history)
    UPDATE entity_facts
    SET
      is_current = TRUE,
      status = 'active',
      -- Don't clear invalidated_at - keep the history
      -- But clear invalidation_reason to mark as restored
      updated_at = NOW()
    WHERE source_id = NEW.id
      AND user_id = NEW.user_id
      AND invalidation_reason = 'source_deleted';

    -- Restore entities
    UPDATE user_entities
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    -- Restore behaviors
    UPDATE user_behaviors
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    -- Restore topics
    UPDATE user_topics
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id::uuid = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    RAISE NOTICE 'Restored knowledge for un-deleted note %', NEW.id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_cascade_note_soft_delete ON notes;

CREATE TRIGGER trigger_cascade_note_soft_delete
  AFTER UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION cascade_note_soft_delete();

-- ============================================
-- PART 6: BACKFILL EXISTING DATA
-- ============================================

-- Set valid_from for existing facts that don't have it
UPDATE entity_facts
SET valid_from = COALESCE(created_at, NOW())
WHERE valid_from IS NULL;

-- Set is_current for existing active facts
UPDATE entity_facts
SET is_current = TRUE
WHERE status = 'active'
  AND invalidated_at IS NULL
  AND is_current IS NULL;

-- Set is_current = FALSE for inactive facts
UPDATE entity_facts
SET is_current = FALSE
WHERE (status = 'inactive' OR invalidated_at IS NOT NULL)
  AND is_current IS NULL;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
  col_count INT;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'entity_facts'
    AND column_name IN ('valid_from', 'valid_to', 'invalidated_at', 'invalidated_by',
                        'invalidation_reason', 'version', 'previous_version_id', 'is_current');

  RAISE NOTICE '✅ Bi-temporal edge invalidation complete:';
  RAISE NOTICE '   - Added % temporal columns to entity_facts', col_count;
  RAISE NOTICE '   - Contradiction detection trigger installed';
  RAISE NOTICE '   - Point-in-time query functions created';
  RAISE NOTICE '   - Cascade soft-delete updated with invalidation';
  RAISE NOTICE '   - Existing data backfilled';
END $$;

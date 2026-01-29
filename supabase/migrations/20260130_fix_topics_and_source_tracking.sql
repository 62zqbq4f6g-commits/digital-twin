-- ============================================
-- FIX: TOPICS SCHEMA + ENTITY SOURCE TRACKING
-- Date: January 30, 2026
--
-- Fixes:
-- 1. Issue 7.2: Add missing columns to user_topics for extraction
-- 2. Issue 6.1/6.2: Add source_note_id to user_entities for cascade delete
-- ============================================

-- ============================================
-- FIX 1: user_topics schema mismatch
-- The code expects: normalized_name, last_mentioned
-- Some migrations created: last_mentioned_at (no normalized_name)
-- ============================================

-- Add normalized_name column if missing
ALTER TABLE user_topics
ADD COLUMN IF NOT EXISTS normalized_name TEXT;

-- Add last_mentioned column if missing (code expects this name)
ALTER TABLE user_topics
ADD COLUMN IF NOT EXISTS last_mentioned TIMESTAMPTZ DEFAULT NOW();

-- Backfill normalized_name from name
UPDATE user_topics
SET normalized_name = LOWER(TRIM(name))
WHERE normalized_name IS NULL;

-- Make normalized_name NOT NULL after backfill
ALTER TABLE user_topics
ALTER COLUMN normalized_name SET NOT NULL;

-- Create unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_topics_user_id_normalized_name_key'
  ) THEN
    ALTER TABLE user_topics
    ADD CONSTRAINT user_topics_user_id_normalized_name_key
    UNIQUE (user_id, normalized_name);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create index for normalized_name lookups
CREATE INDEX IF NOT EXISTS idx_user_topics_normalized
ON user_topics(user_id, normalized_name);

-- ============================================
-- FIX 2: Add source_note_id to user_entities
-- Needed for cascade soft-delete to work
-- ============================================

-- Add source_note_id column to user_entities
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS source_note_id UUID;

-- Add source_type column if missing
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'note';

-- Create index for source lookups (used by cascade trigger)
CREATE INDEX IF NOT EXISTS idx_user_entities_source
ON user_entities(user_id, source_note_id);

CREATE INDEX IF NOT EXISTS idx_user_entities_source_type
ON user_entities(user_id, source_type);

-- ============================================
-- FIX 3: Update cascade soft-delete trigger
-- Now entities AND their facts will be marked inactive
-- ============================================

CREATE OR REPLACE FUNCTION cascade_note_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger on soft delete (status changed to 'deleted' or 'archived')
  IF NEW.status IN ('deleted', 'archived') AND (OLD.status IS NULL OR OLD.status NOT IN ('deleted', 'archived')) THEN

    -- Mark entities from this note as inactive
    UPDATE user_entities
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Mark facts from this note as inactive
    UPDATE entity_facts
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Mark topics from this note as inactive
    UPDATE user_topics
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id::uuid = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Mark behaviors from this note as inactive
    UPDATE user_behaviors
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    RAISE NOTICE 'Cascade soft-delete triggered for note %', NEW.id;
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
-- VERIFICATION
-- ============================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '✅ Fix complete:';
  RAISE NOTICE '   - user_topics: normalized_name + last_mentioned columns added';
  RAISE NOTICE '   - user_entities: source_note_id + source_type columns added';
  RAISE NOTICE '   - Cascade soft-delete trigger updated';
END $$;

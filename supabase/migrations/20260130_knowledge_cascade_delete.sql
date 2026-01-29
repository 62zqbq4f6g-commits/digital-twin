-- ============================================
-- KNOWLEDGE CASCADE SOFT-DELETE
--
-- When a note is deleted (deleted_at is set), cascade to:
-- - entity_facts: mark as status = 'inactive'
-- - user_behaviors: mark as status = 'inactive'
--
-- This ensures deleted content doesn't affect user experience.
-- ============================================

-- 1. Ensure entity_facts has status column
ALTER TABLE entity_facts
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_entity_facts_status
ON entity_facts(user_id, status);

-- 2. Ensure user_behaviors has status column (should already exist)
ALTER TABLE user_behaviors
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_user_behaviors_status
ON user_behaviors(user_id, status);

-- 3. Ensure user_topics has status column
ALTER TABLE user_topics
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_user_topics_status
ON user_topics(user_id, status);

-- 4. Create function to cascade soft-delete to knowledge tables
CREATE OR REPLACE FUNCTION cascade_note_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when deleted_at is being SET (not when it's being cleared)
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN

    -- Mark entity_facts from this note as inactive
    UPDATE entity_facts
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Mark user_behaviors from this note as inactive
    UPDATE user_behaviors
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Log the cascade
    RAISE NOTICE 'Cascaded soft-delete for note %', NEW.id;

  -- If note is being UN-deleted (deleted_at cleared), restore knowledge
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN

    -- Restore entity_facts from this note
    UPDATE entity_facts
    SET status = 'active',
        updated_at = NOW()
    WHERE source_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    -- Restore user_behaviors from this note
    UPDATE user_behaviors
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    RAISE NOTICE 'Restored knowledge for un-deleted note %', NEW.id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Create trigger on notes table
DROP TRIGGER IF EXISTS trigger_cascade_note_soft_delete ON notes;

CREATE TRIGGER trigger_cascade_note_soft_delete
  AFTER UPDATE OF deleted_at ON notes
  FOR EACH ROW
  EXECUTE FUNCTION cascade_note_soft_delete();

-- 6. Also handle MIRROR conversation deletion (if conversations can be deleted)
CREATE OR REPLACE FUNCTION cascade_conversation_soft_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN

    -- Mark entity_facts from this conversation as inactive
    UPDATE entity_facts
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_id = NEW.id
      AND source_type = 'mirror'
      AND status = 'active';

    -- Mark user_behaviors from this conversation as inactive
    UPDATE user_behaviors
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND source_type = 'mirror'
      AND status = 'active';

  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN

    UPDATE entity_facts
    SET status = 'active',
        updated_at = NOW()
    WHERE source_id = NEW.id
      AND source_type = 'mirror'
      AND status = 'inactive';

    UPDATE user_behaviors
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND source_type = 'mirror'
      AND status = 'inactive';

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Only create if mirror_conversations has deleted_at column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mirror_conversations'
    AND column_name = 'deleted_at'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_cascade_conversation_soft_delete ON mirror_conversations;

    CREATE TRIGGER trigger_cascade_conversation_soft_delete
      AFTER UPDATE OF deleted_at ON mirror_conversations
      FOR EACH ROW
      EXECUTE FUNCTION cascade_conversation_soft_delete();
  END IF;
END $$;

-- 7. Backfill: Mark existing facts/behaviors from deleted notes as inactive
UPDATE entity_facts ef
SET status = 'inactive',
    updated_at = NOW()
FROM notes n
WHERE ef.source_id = n.id
  AND n.deleted_at IS NOT NULL
  AND ef.status = 'active';

UPDATE user_behaviors ub
SET status = 'inactive',
    updated_at = NOW()
FROM notes n
WHERE ub.source_note_id = n.id
  AND n.deleted_at IS NOT NULL
  AND ub.status = 'active';

-- ============================================
-- SUMMARY:
-- - entity_facts.status = 'active'/'inactive'
-- - user_behaviors.status = 'active'/'inactive'
-- - user_topics.status = 'active'/'inactive'
-- - Trigger auto-cascades when note.deleted_at is set
-- - Backfill marks existing orphaned knowledge as inactive
-- ============================================

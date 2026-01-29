-- ============================================
-- KNOWLEDGE SCHEMA FIXES
-- Date: January 30, 2026
--
-- Fixes:
-- 1. Add source_type to entity_facts (for MIRROR cascade)
-- 2. Create user_topics table
-- 3. Fix cascade trigger to use correct column names
-- 4. Backfill orphaned knowledge
-- ============================================

-- 1. Add source_type to entity_facts (if not exists)
ALTER TABLE entity_facts
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'note';

CREATE INDEX IF NOT EXISTS idx_entity_facts_source_type
ON entity_facts(source_type);

-- 2. Create user_topics table
CREATE TABLE IF NOT EXISTS user_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Topic info
  name TEXT NOT NULL,
  description TEXT,

  -- Scoring
  importance_score FLOAT DEFAULT 0.5,
  mention_count INT DEFAULT 1,

  -- Source tracking
  source_note_id TEXT,
  source_type TEXT DEFAULT 'note',

  -- Status
  status TEXT DEFAULT 'active',

  -- Timestamps
  first_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  last_mentioned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint per user+topic
  UNIQUE(user_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_topics_user ON user_topics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_topics_status ON user_topics(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_topics_importance ON user_topics(user_id, importance_score DESC);

-- Enable RLS
ALTER TABLE user_topics ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own topics" ON user_topics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own topics" ON user_topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own topics" ON user_topics
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own topics" ON user_topics
  FOR DELETE USING (auth.uid() = user_id);

-- 3. Fix cascade trigger function (use source_note_id, not source_id)
CREATE OR REPLACE FUNCTION cascade_note_soft_delete()
RETURNS TRIGGER AS $cascade_note_soft_delete$
BEGIN
  -- Only run when deleted_at is being SET (not when it's being cleared)
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN

    -- Mark entity_facts from this note as inactive
    UPDATE entity_facts
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Mark user_behaviors from this note as inactive
    UPDATE user_behaviors
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    -- Mark user_topics from this note as inactive
    UPDATE user_topics
    SET status = 'inactive',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'active';

    RAISE NOTICE 'Cascaded soft-delete for note %', NEW.id;

  -- If note is being UN-deleted, restore knowledge
  ELSIF NEW.deleted_at IS NULL AND OLD.deleted_at IS NOT NULL THEN

    UPDATE entity_facts
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    UPDATE user_behaviors
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    UPDATE user_topics
    SET status = 'active',
        updated_at = NOW()
    WHERE source_note_id = NEW.id
      AND user_id = NEW.user_id
      AND status = 'inactive';

    RAISE NOTICE 'Restored knowledge for un-deleted note %', NEW.id;

  END IF;

  RETURN NEW;
END;
$cascade_note_soft_delete$ LANGUAGE plpgsql;

-- 4. Re-create trigger (in case it needs updating)
DROP TRIGGER IF EXISTS trigger_cascade_note_soft_delete ON notes;

CREATE TRIGGER trigger_cascade_note_soft_delete
  AFTER UPDATE OF deleted_at ON notes
  FOR EACH ROW
  EXECUTE FUNCTION cascade_note_soft_delete();

-- 5. Backfill: Mark existing facts/behaviors/topics from deleted notes as inactive
UPDATE entity_facts ef
SET status = 'inactive',
    updated_at = NOW()
FROM notes n
WHERE ef.source_note_id = n.id
  AND n.deleted_at IS NOT NULL
  AND ef.status = 'active';

UPDATE user_behaviors ub
SET status = 'inactive',
    updated_at = NOW()
FROM notes n
WHERE ub.source_note_id = n.id
  AND n.deleted_at IS NOT NULL
  AND ub.status = 'active';

UPDATE user_topics ut
SET status = 'inactive',
    updated_at = NOW()
FROM notes n
WHERE ut.source_note_id = n.id
  AND n.deleted_at IS NOT NULL
  AND ut.status = 'active';

-- ============================================
-- SUMMARY:
-- ✅ entity_facts.source_type column added
-- ✅ user_topics table created with RLS
-- ✅ cascade_note_soft_delete() fixed to use source_note_id
-- ✅ Trigger re-created
-- ✅ Backfill run for orphaned knowledge
-- ============================================

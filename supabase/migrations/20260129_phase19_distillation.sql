-- Phase 19: Semantic Distillation Support
-- OWNER: T1
-- PURPOSE: Track which notes have been distilled into permanent knowledge

-- Add distillation tracking columns to notes table
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS is_distilled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS distilled_summary TEXT,
ADD COLUMN IF NOT EXISTS distilled_at TIMESTAMPTZ;

-- Index for finding notes to distill
CREATE INDEX IF NOT EXISTS idx_notes_distillation
ON notes(user_id, is_distilled, created_at)
WHERE deleted_at IS NULL;

-- Add source_type to entity_facts if not exists
ALTER TABLE entity_facts
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'extraction';

-- Update unique constraint for user_behaviors to include entity_name
-- First drop the old constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_behaviors_user_id_predicate_entity_id_key'
  ) THEN
    ALTER TABLE user_behaviors
    DROP CONSTRAINT user_behaviors_user_id_predicate_entity_id_key;
  END IF;
END $$;

-- Create new unique constraint including entity_name
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_behaviors_unique
ON user_behaviors(user_id, predicate, entity_name);

-- Update unique constraint for entity_qualities
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'entity_qualities_user_id_entity_name_predicate_key'
  ) THEN
    -- Constraint already exists, which is fine
    RAISE NOTICE 'entity_qualities unique constraint already exists';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_qualities_unique
ON entity_qualities(user_id, entity_name, predicate);

-- Add unique constraint for category_summaries
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_summaries_unique
ON category_summaries(user_id, category);

COMMENT ON COLUMN notes.is_distilled IS 'Whether this note has been distilled into permanent knowledge';
COMMENT ON COLUMN notes.distilled_summary IS 'One-sentence summary extracted during distillation';
COMMENT ON COLUMN notes.distilled_at IS 'When distillation occurred';

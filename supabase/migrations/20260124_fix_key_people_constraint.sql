-- Migration: 20260124_fix_key_people_constraint.sql
-- Fix: Add unique constraint on user_key_people (user_id, name)
-- This is required for upsert operations to work correctly

-- Add unique constraint on (user_id, name) if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_key_people_user_id_name_key'
  ) THEN
    ALTER TABLE user_key_people
    ADD CONSTRAINT user_key_people_user_id_name_key
    UNIQUE (user_id, name);

    RAISE NOTICE 'Added unique constraint user_key_people_user_id_name_key';
  ELSE
    RAISE NOTICE 'Unique constraint user_key_people_user_id_name_key already exists';
  END IF;
END $$;

-- Also add index for case-insensitive lookups
CREATE INDEX IF NOT EXISTS idx_user_key_people_name_lower
  ON user_key_people (user_id, LOWER(name));

-- Grant necessary permissions
GRANT ALL ON user_key_people TO authenticated;
GRANT ALL ON user_key_people TO service_role;

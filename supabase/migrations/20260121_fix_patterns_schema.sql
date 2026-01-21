-- Fix migration: Add missing columns to user_patterns table
-- The original migration may have failed partially or table was created differently

-- Add description column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_patterns' AND column_name = 'description'
  ) THEN
    ALTER TABLE user_patterns ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add short_description column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_patterns' AND column_name = 'short_description'
  ) THEN
    ALTER TABLE user_patterns ADD COLUMN short_description TEXT;
  END IF;
END $$;

-- Add detection_method column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_patterns' AND column_name = 'detection_method'
  ) THEN
    ALTER TABLE user_patterns ADD COLUMN detection_method TEXT;
  END IF;
END $$;

-- Add evidence column if missing (JSONB type)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_patterns' AND column_name = 'evidence'
  ) THEN
    ALTER TABLE user_patterns ADD COLUMN evidence JSONB;
  END IF;
END $$;

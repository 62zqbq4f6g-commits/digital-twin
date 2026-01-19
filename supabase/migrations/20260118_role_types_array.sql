-- Phase 9.4: Migrate role_type from TEXT to TEXT[] for multi-select support
-- Migration: 20260118_role_types_array.sql

-- Step 1: Add new column for array of roles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS role_types TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing single role data to array
UPDATE user_profiles
SET role_types = ARRAY[role_type]
WHERE role_type IS NOT NULL AND (role_types IS NULL OR role_types = '{}');

-- Step 3: Drop the old CHECK constraint (need to find its name first)
-- Note: The constraint name may vary, so we use a safe approach

-- Step 4: Make role_types the primary column (role_type becomes legacy)
-- We'll keep both for backwards compatibility

-- Add comment
COMMENT ON COLUMN user_profiles.role_types IS 'Array of roles: BUILDING, LEADING, MAKING, LEARNING, JUGGLING, TRANSITIONING (1-3 selections)';

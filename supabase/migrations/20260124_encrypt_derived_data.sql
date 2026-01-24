-- Phase 14: Add encryption to derived data tables
-- All user-derived data will be encrypted with the user's key (same as notes)
-- This ensures complete data privacy for user trust

-- Add encrypted_data column to user_entities
-- Stores encrypted: name, entity_type, summary, sentiment, context_notes
-- Keeps unencrypted: mention_count, last_mentioned_at (for queries)
ALTER TABLE user_entities ADD COLUMN IF NOT EXISTS encrypted_data TEXT;

-- Add encrypted_data column to user_patterns
-- Stores encrypted: pattern_type, description, short_description, evidence
-- Keeps unencrypted: confidence, status (for queries)
ALTER TABLE user_patterns ADD COLUMN IF NOT EXISTS encrypted_data TEXT;

-- Add encrypted_data column to category_summaries
-- Stores encrypted: summary, themes
-- Keeps unencrypted: category (for queries)
ALTER TABLE category_summaries ADD COLUMN IF NOT EXISTS encrypted_data TEXT;

-- Add encrypted_data column to user_key_people
-- Stores encrypted: name, relationship
-- Keeps unencrypted: id, user_id, created_at (for queries)
ALTER TABLE user_key_people ADD COLUMN IF NOT EXISTS encrypted_data TEXT;

-- Note: Run this migration in Supabase SQL Editor
-- After running, update the API endpoints to use encryption
-- The client must send x-encryption-key header with API calls

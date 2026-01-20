-- =====================================================
-- MEM0 BUILD 6: MEMORY PREFERENCES
-- User-configurable memory preferences
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Custom extraction instructions
  custom_instructions TEXT,
  -- Example: "Focus on my fitness goals and ignore casual work chat"

  -- Enabled memory categories
  enabled_categories TEXT[] DEFAULT ARRAY['entity', 'fact', 'preference', 'event', 'goal', 'procedure', 'decision', 'action'],

  -- Topics to auto-mark as sensitive
  auto_mark_sensitive TEXT[] DEFAULT ARRAY['health', 'medical', 'financial', 'death', 'mental health', 'therapy'],

  -- Topics to never store
  never_store TEXT[] DEFAULT ARRAY[],
  -- Example: ['work meetings', 'client names']

  -- Default expiry for certain memory types (days, null = never)
  default_expiry_days INTEGER,

  -- Event memories auto-expire after the event
  events_auto_expire BOOLEAN DEFAULT TRUE,

  -- Retrieval preferences
  prefer_recent BOOLEAN DEFAULT TRUE,
  include_historical_by_default BOOLEAN DEFAULT FALSE,
  default_sensitivity_level TEXT DEFAULT 'normal'
    CHECK (default_sensitivity_level IN ('normal', 'sensitive', 'private')),

  -- Minimum confidence to store
  min_confidence FLOAT DEFAULT 0.6 CHECK (min_confidence >= 0 AND min_confidence <= 1),

  -- Notification preferences
  notify_on_consolidation BOOLEAN DEFAULT FALSE,
  notify_on_conflict BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_memory_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS memory_preferences_updated ON memory_preferences;
CREATE TRIGGER memory_preferences_updated
BEFORE UPDATE ON memory_preferences
FOR EACH ROW EXECUTE FUNCTION update_memory_preferences_timestamp();

-- RLS policies
ALTER TABLE memory_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
ON memory_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
ON memory_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
ON memory_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all preferences"
ON memory_preferences FOR ALL
USING (auth.role() = 'service_role');

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE memory_preferences IS 'User-configurable memory extraction and retrieval preferences';
COMMENT ON COLUMN memory_preferences.custom_instructions IS 'Custom instructions for extraction, e.g., focus on fitness goals';
COMMENT ON COLUMN memory_preferences.enabled_categories IS 'Which memory types to extract and store';
COMMENT ON COLUMN memory_preferences.auto_mark_sensitive IS 'Topics that should be automatically marked as sensitive';
COMMENT ON COLUMN memory_preferences.never_store IS 'Topics to never store (e.g., work meetings, client names)';
COMMENT ON COLUMN memory_preferences.min_confidence IS 'Minimum confidence score (0-1) required to store a memory';

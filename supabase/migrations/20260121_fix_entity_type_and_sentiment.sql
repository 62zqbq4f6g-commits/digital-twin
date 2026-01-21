-- =====================================================
-- STEP 3: Fix entity_type Constraint
-- =====================================================

-- Drop old constraints
ALTER TABLE user_entities DROP CONSTRAINT IF EXISTS user_entities_entity_type_check;
ALTER TABLE user_entities DROP CONSTRAINT IF EXISTS entity_type_check;

-- Add expanded constraint with all valid types
ALTER TABLE user_entities ADD CONSTRAINT user_entities_entity_type_check
CHECK (entity_type IN ('person', 'project', 'place', 'pet', 'organization', 'concept', 'event', 'activity', 'other'));

-- =====================================================
-- STEP 4: Create entity_sentiment_history table if needed
-- =====================================================

CREATE TABLE IF NOT EXISTS entity_sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE,
  sentiment FLOAT,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sentiment_history_entity ON entity_sentiment_history(entity_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_created ON entity_sentiment_history(created_at);

-- Enable RLS
ALTER TABLE entity_sentiment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy (users can only see sentiment for their entities)
DROP POLICY IF EXISTS "Users can view own entity sentiment" ON entity_sentiment_history;
CREATE POLICY "Users can view own entity sentiment" ON entity_sentiment_history
FOR ALL USING (
  entity_id IN (SELECT id FROM user_entities WHERE user_id = auth.uid())
);

-- =====================================================
-- STEP 5: Backfill Sentiment History from Existing Data
-- =====================================================

INSERT INTO entity_sentiment_history (entity_id, sentiment, context, created_at)
SELECT
  id,
  sentiment_average,
  summary,
  created_at
FROM user_entities
WHERE sentiment_average IS NOT NULL
  AND status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM entity_sentiment_history h WHERE h.entity_id = user_entities.id
  );

-- Report results
SELECT 'Sentiment history backfill complete' as status, COUNT(*) as records_created
FROM entity_sentiment_history;

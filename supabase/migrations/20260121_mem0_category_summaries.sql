-- =====================================================
-- MEM0 GAP 1: Category Summaries Table
-- Evolving prose summaries per category that get rewritten
-- =====================================================

CREATE TABLE IF NOT EXISTS category_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  category TEXT NOT NULL CHECK (category IN (
    'work_life', 'personal_life', 'health_wellness', 'relationships',
    'goals_aspirations', 'preferences', 'beliefs_values', 'skills_expertise',
    'projects', 'challenges', 'general'
  )),

  summary TEXT NOT NULL,

  -- Tracking
  entity_count INT DEFAULT 0,
  last_entities JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, category)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_category_summaries_user ON category_summaries(user_id);

-- Enable RLS
ALTER TABLE category_summaries ENABLE ROW LEVEL SECURITY;

-- User policy
DROP POLICY IF EXISTS "Users can manage own summaries" ON category_summaries;
CREATE POLICY "Users can manage own summaries" ON category_summaries
  FOR ALL USING (auth.uid() = user_id);

-- Service role policy
DROP POLICY IF EXISTS "Service role can manage all summaries" ON category_summaries;
CREATE POLICY "Service role can manage all summaries" ON category_summaries
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE category_summaries IS 'Evolving prose summaries per category that get rewritten when new info arrives';

-- Phase 13A: Pattern Foundation
-- User Patterns table for detecting and tracking user behavioral patterns

-- Create user_patterns table
CREATE TABLE IF NOT EXISTS user_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern definition
  pattern_type TEXT NOT NULL, -- 'temporal', 'entity_context', 'frequency'
  description TEXT NOT NULL,
  short_description TEXT,

  -- Detection
  confidence FLOAT DEFAULT 0.5,
  evidence JSONB,
  detection_method TEXT,

  -- Status
  status TEXT DEFAULT 'detected', -- 'detected', 'surfaced', 'confirmed', 'rejected'

  -- Surfacing
  surfaced_count INT DEFAULT 0,
  last_surfaced_at TIMESTAMP WITH TIME ZONE,

  -- User feedback
  confirmed_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,

  -- Timestamps
  first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_patterns_user ON user_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_patterns_status ON user_patterns(user_id, status);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON user_patterns(user_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_surfaceable ON user_patterns(user_id, status, confidence, last_surfaced_at);

-- Enable RLS
ALTER TABLE user_patterns ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own patterns" ON user_patterns
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own patterns" ON user_patterns
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own patterns" ON user_patterns
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own patterns" ON user_patterns
  FOR DELETE USING (auth.uid() = user_id);

-- Service role policy for API
CREATE POLICY "Service role full access to patterns" ON user_patterns
  FOR ALL USING (auth.role() = 'service_role');

-- Inscript Phase 11: Onboarding Data Table
-- Run this migration in Supabase SQL Editor

-- Create onboarding_data table
CREATE TABLE IF NOT EXISTS onboarding_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  name TEXT NOT NULL,
  life_seasons TEXT[] DEFAULT '{}',
  mental_focus TEXT[] DEFAULT '{}',
  depth_question TEXT,
  depth_answer TEXT,
  seeded_people JSONB DEFAULT '[]',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE onboarding_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own onboarding data"
ON onboarding_data FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding data"
ON onboarding_data FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding data"
ON onboarding_data FOR UPDATE
USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_onboarding_user_id ON onboarding_data(user_id);

-- Updated_at trigger (only create if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    CREATE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ language 'plpgsql';
  END IF;
END
$$;

-- Create trigger for onboarding_data
DROP TRIGGER IF EXISTS update_onboarding_updated_at ON onboarding_data;
CREATE TRIGGER update_onboarding_updated_at
  BEFORE UPDATE ON onboarding_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

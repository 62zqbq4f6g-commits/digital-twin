-- Phase 1 Build 2: Value Alignment Onboarding
-- Add value_priorities column to onboarding_data table

ALTER TABLE onboarding_data ADD COLUMN IF NOT EXISTS value_priorities JSONB DEFAULT '[]';

-- Create index for querying by value priorities
CREATE INDEX IF NOT EXISTS idx_onboarding_value_priorities ON onboarding_data USING GIN (value_priorities);

COMMENT ON COLUMN onboarding_data.value_priorities IS 'User-ranked priorities: [{domain, rank, label}]';

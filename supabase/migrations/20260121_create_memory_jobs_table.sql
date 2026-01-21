-- =====================================================
-- Create memory_jobs table (needed for consolidation cron)
-- Run this BEFORE creating cron jobs
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('consolidate', 'decay', 'cleanup', 'reindex')),
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority INTEGER DEFAULT 5,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient job processing
CREATE INDEX IF NOT EXISTS idx_memory_jobs_status ON memory_jobs(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_memory_jobs_user ON memory_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_jobs_type ON memory_jobs(job_type);

-- Enable RLS
ALTER TABLE memory_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Users can view own jobs" ON memory_jobs;
CREATE POLICY "Users can view own jobs" ON memory_jobs
FOR SELECT USING (user_id = auth.uid());

-- Service role can manage all jobs
DROP POLICY IF EXISTS "Service role can manage jobs" ON memory_jobs;
CREATE POLICY "Service role can manage jobs" ON memory_jobs
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Comment
COMMENT ON TABLE memory_jobs IS 'Async job queue for memory maintenance tasks (consolidation, decay, cleanup)';

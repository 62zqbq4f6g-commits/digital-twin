-- =====================================================
-- MEM0 BUILD 2: ASYNC PROCESSING + AUDIT
-- Memory Jobs Queue and Operations Audit Trail
-- =====================================================

-- =====================================================
-- Memory Jobs Queue for Async Processing
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Job specification
  job_type TEXT NOT NULL CHECK (job_type IN (
    'extract',       -- Extract entities from note
    'update',        -- Run UPDATE phase on extracted fact
    'consolidate',   -- Merge similar memories
    'decay',         -- Apply decay to old memories
    'cleanup',       -- Remove expired memories
    'graph_update',  -- Update entity relationships graph
    'summary'        -- Generate conversation summary
  )),

  -- Job data (varies by job_type)
  payload JSONB NOT NULL,
  /*
    For 'extract': {note_id, content, context}
    For 'update': {fact, similar_memories, source_note_id}
    For 'consolidate': {entity_ids, force: boolean}
    For 'decay': {user_id}
    For 'cleanup': {user_id}
    For 'graph_update': {source_entity_id, target_entity_id, relationship}
    For 'summary': {conversation_id, messages}
  */

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  )),

  -- Priority (1=highest, 10=lowest)
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  -- Retry handling
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  error_stack TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),

  -- Dependencies (for job chaining)
  depends_on UUID REFERENCES memory_jobs(id),

  -- Result
  result JSONB
);

-- Indexes for efficient job processing
CREATE INDEX IF NOT EXISTS idx_jobs_pending
ON memory_jobs(scheduled_for, priority)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_jobs_user
ON memory_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_status
ON memory_jobs(status, job_type);

CREATE INDEX IF NOT EXISTS idx_jobs_dependencies
ON memory_jobs(depends_on)
WHERE depends_on IS NOT NULL;

-- RLS policy for memory_jobs
ALTER TABLE memory_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own jobs"
ON memory_jobs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs"
ON memory_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all jobs"
ON memory_jobs FOR ALL
USING (auth.role() = 'service_role');

-- =====================================================
-- Memory Operations Audit Trail
-- Complete history of all memory changes
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What operation was performed
  operation TEXT NOT NULL CHECK (operation IN ('ADD', 'UPDATE', 'DELETE', 'NOOP', 'CONSOLIDATE')),

  -- The candidate fact being processed
  candidate_fact TEXT NOT NULL,
  candidate_memory_type TEXT,
  candidate_embedding vector(1536),

  -- Similar memories that were considered
  similar_memories JSONB,
  -- Format: [{id, content, similarity, memory_type}]

  -- LLM decision details
  llm_reasoning TEXT,
  llm_model TEXT DEFAULT 'claude-sonnet-4-20250514',
  llm_tokens_used INTEGER,

  -- Affected entity
  entity_id UUID REFERENCES user_entities(id),

  -- For UPDATE operations: what changed
  merge_strategy TEXT CHECK (merge_strategy IN ('replace', 'append', 'supersede')),
  old_content TEXT,
  new_content TEXT,
  old_version INTEGER,
  new_version INTEGER,

  -- For DELETE operations: preserve what was deleted
  hard_delete BOOLEAN DEFAULT FALSE,
  deleted_entity_snapshot JSONB,

  -- For CONSOLIDATE operations
  merged_entity_ids UUID[],
  kept_entity_id UUID,

  -- Source tracking
  job_id UUID REFERENCES memory_jobs(id),
  source_note_id UUID,

  -- Metadata
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_operations_user
ON memory_operations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operations_entity
ON memory_operations(entity_id)
WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operations_type
ON memory_operations(operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operations_note
ON memory_operations(source_note_id)
WHERE source_note_id IS NOT NULL;

-- RLS policy for memory_operations
ALTER TABLE memory_operations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own operations"
ON memory_operations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all operations"
ON memory_operations FOR ALL
USING (auth.role() = 'service_role');

-- =====================================================
-- Helper function to create memory jobs
-- =====================================================

CREATE OR REPLACE FUNCTION create_memory_job(
  p_user_id UUID,
  p_job_type TEXT,
  p_payload JSONB,
  p_priority INTEGER DEFAULT 5,
  p_depends_on UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_job_id UUID;
BEGIN
  INSERT INTO memory_jobs (user_id, job_type, payload, priority, depends_on)
  VALUES (p_user_id, p_job_type, p_payload, p_priority, p_depends_on)
  RETURNING id INTO v_job_id;

  RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Helper function to get next pending job
-- =====================================================

CREATE OR REPLACE FUNCTION get_next_pending_job(p_limit INTEGER DEFAULT 10)
RETURNS SETOF memory_jobs AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM memory_jobs j
  WHERE j.status = 'pending'
    AND j.scheduled_for <= NOW()
    AND (j.depends_on IS NULL OR EXISTS (
      SELECT 1 FROM memory_jobs d
      WHERE d.id = j.depends_on
        AND d.status = 'completed'
    ))
  ORDER BY j.priority ASC, j.created_at ASC
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE memory_jobs IS 'Async job queue for memory processing operations';
COMMENT ON TABLE memory_operations IS 'Complete audit trail of all memory changes (ADD/UPDATE/DELETE/NOOP/CONSOLIDATE)';
COMMENT ON COLUMN memory_jobs.job_type IS 'Type of job: extract, update, consolidate, decay, cleanup, graph_update, summary';
COMMENT ON COLUMN memory_jobs.payload IS 'Job-specific data in JSONB format';
COMMENT ON COLUMN memory_jobs.priority IS 'Priority 1-10, lower is higher priority';
COMMENT ON COLUMN memory_jobs.depends_on IS 'Optional dependency on another job completing first';
COMMENT ON COLUMN memory_operations.operation IS 'What was done: ADD, UPDATE, DELETE, NOOP, CONSOLIDATE';
COMMENT ON COLUMN memory_operations.merge_strategy IS 'For UPDATE: replace (overwrite), append (add to), supersede (archive old)';
COMMENT ON COLUMN memory_operations.llm_reasoning IS 'The LLM explanation for why this operation was chosen';

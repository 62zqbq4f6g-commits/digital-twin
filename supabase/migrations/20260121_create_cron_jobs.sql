-- =====================================================
-- STEP 2: Create Automated Decay & Cleanup Cron Jobs
-- Run this AFTER pg_cron is enabled
-- =====================================================

-- DAILY CLEANUP (3 AM UTC) - Archive expired memories
SELECT cron.schedule(
  'cleanup-expired-memories',
  '0 3 * * *',
  $$
  UPDATE user_entities
  SET status = 'archived',
      updated_at = NOW()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
  $$
);

-- WEEKLY DECAY (Sunday 4 AM UTC) - Decay importance scores
SELECT cron.schedule(
  'weekly-memory-decay',
  '0 4 * * 0',
  $$
  -- Decay trivial memories (start after 7 days, -20%/week)
  UPDATE user_entities
  SET importance_score = GREATEST(0, importance_score * 0.80),
      updated_at = NOW()
  WHERE status = 'active'
    AND importance = 'trivial'
    AND updated_at < NOW() - INTERVAL '7 days'
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '7 days');

  -- Decay low memories (start after 14 days, -15%/week)
  UPDATE user_entities
  SET importance_score = GREATEST(0, importance_score * 0.85),
      updated_at = NOW()
  WHERE status = 'active'
    AND importance = 'low'
    AND updated_at < NOW() - INTERVAL '14 days'
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '7 days');

  -- Decay medium memories (start after 30 days, -10%/week)
  UPDATE user_entities
  SET importance_score = GREATEST(0, importance_score * 0.90),
      updated_at = NOW()
  WHERE status = 'active'
    AND importance = 'medium'
    AND updated_at < NOW() - INTERVAL '30 days'
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '7 days');

  -- Decay high memories (start after 90 days, -5%/week)
  UPDATE user_entities
  SET importance_score = GREATEST(0, importance_score * 0.95),
      updated_at = NOW()
  WHERE status = 'active'
    AND importance = 'high'
    AND updated_at < NOW() - INTERVAL '90 days'
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '7 days');

  -- Critical memories NEVER decay
  $$
);

-- NIGHTLY CONSOLIDATION (2 AM UTC) - Flag potential duplicates
SELECT cron.schedule(
  'nightly-consolidation',
  '0 2 * * *',
  $$
  -- Log potential duplicates for review (similarity > 90%)
  INSERT INTO memory_jobs (user_id, job_type, payload, status, priority)
  SELECT DISTINCT a.user_id,
         'consolidate',
         jsonb_build_object(
           'entity_a_id', a.id,
           'entity_b_id', b.id,
           'similarity', 1 - (a.embedding <=> b.embedding)
         ),
         'pending',
         3
  FROM user_entities a
  JOIN user_entities b ON a.user_id = b.user_id AND a.id < b.id
  WHERE a.embedding IS NOT NULL
    AND b.embedding IS NOT NULL
    AND a.status = 'active'
    AND b.status = 'active'
    AND 1 - (a.embedding <=> b.embedding) > 0.90
    AND a.created_at > NOW() - INTERVAL '24 hours';
  $$
);

-- MONTHLY RE-INDEX (1st of month, 5 AM UTC)
SELECT cron.schedule(
  'monthly-reindex',
  '0 5 1 * *',
  $$
  -- Archive memories not accessed in 180 days
  UPDATE user_entities
  SET status = 'archived',
      updated_at = NOW()
  WHERE status = 'active'
    AND importance IN ('trivial', 'low')
    AND (last_accessed_at IS NULL OR last_accessed_at < NOW() - INTERVAL '180 days')
    AND updated_at < NOW() - INTERVAL '180 days';

  -- Update access statistics
  UPDATE user_entities
  SET access_count = COALESCE(access_count, 0)
  WHERE access_count IS NULL;
  $$
);

-- Verify crons are scheduled
SELECT jobid, schedule, command, jobname FROM cron.job ORDER BY jobid;

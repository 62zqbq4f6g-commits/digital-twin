-- =====================================================
-- VERIFICATION: Run this after all migrations
-- =====================================================

-- 1. Check pg_cron is enabled
SELECT 'pg_cron extension' as check_name,
       CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
            THEN 'ENABLED' ELSE 'NOT ENABLED' END as status;

-- 2. Check cron jobs are scheduled
SELECT 'Cron jobs scheduled' as check_name, COUNT(*)::text as status
FROM cron.job;

-- 3. List all cron jobs
SELECT jobid, jobname, schedule, active
FROM cron.job
ORDER BY jobid;

-- 4. Check entity_type constraint
SELECT 'entity_type constraint' as check_name,
       pg_get_constraintdef(oid) as status
FROM pg_constraint
WHERE conrelid = 'user_entities'::regclass
AND conname LIKE '%entity_type%';

-- 5. Check memory_jobs table exists
SELECT 'memory_jobs table' as check_name,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_jobs')
            THEN 'EXISTS' ELSE 'NOT FOUND' END as status;

-- 6. Check entity_sentiment_history table exists
SELECT 'entity_sentiment_history table' as check_name,
       CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entity_sentiment_history')
            THEN 'EXISTS' ELSE 'NOT FOUND' END as status;

-- 7. Count sentiment history records
SELECT 'Sentiment history records' as check_name, COUNT(*)::text as status
FROM entity_sentiment_history;

-- 8. Check entities that would be affected by decay
SELECT 'Entities eligible for decay' as check_name, COUNT(*)::text as status
FROM user_entities
WHERE status = 'active'
  AND importance IN ('trivial', 'low', 'medium', 'high')
  AND updated_at < NOW() - INTERVAL '7 days';

-- =====================================================
-- SCHEMA DIAGNOSTIC QUERY
-- Run this to check what's missing in your database
-- Copy/paste into Supabase SQL Editor and run
-- =====================================================

-- 1. Check pgvector extension
SELECT
  '1. pgvector Extension' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
    THEN '✅ Enabled'
    ELSE '❌ NOT ENABLED - Run: CREATE EXTENSION IF NOT EXISTS vector;'
  END as status;

-- 2. Check user_entities columns
SELECT
  '2. user_entities.embedding' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'embedding')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '2. user_entities.status' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'status')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '2. user_entities.importance' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'importance')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '2. user_entities.importance_score' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'importance_score')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '2. user_entities.summary' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'summary')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status;

-- 3. Check required tables
SELECT
  '3. entity_relationships table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entity_relationships')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '3. category_summaries table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_summaries')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '3. entity_sentiment_history table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'entity_sentiment_history')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '3. memory_jobs table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_jobs')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '3. memory_operations table' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_operations')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status;

-- 4. Check pg_cron extension
SELECT
  '4. pg_cron Extension' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
    THEN '✅ Enabled'
    ELSE '⚠️ NOT ENABLED - Requires Supabase Pro plan and manual setup'
  END as status;

-- 5. Check if cron jobs are scheduled (only works if pg_cron is enabled)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '5. Cron Jobs:';
    PERFORM * FROM cron.job;
  ELSE
    RAISE NOTICE '5. Cron Jobs: Skipped (pg_cron not enabled)';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '5. Cron Jobs: Could not check - %', SQLERRM;
END $$;

-- 6. Check functions
SELECT
  '6. match_entities function' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'match_entities')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status
UNION ALL
SELECT
  '6. traverse_entity_graph function' as check_name,
  CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'traverse_entity_graph')
    THEN '✅ Exists'
    ELSE '❌ MISSING'
  END as status;

-- 7. Sample data counts
SELECT
  '7. user_entities count' as check_name,
  COUNT(*)::TEXT || ' records' as status
FROM user_entities;

SELECT
  '7. Entities with embeddings' as check_name,
  COALESCE(
    (SELECT COUNT(*)::TEXT || ' records' FROM user_entities WHERE embedding IS NOT NULL),
    '0 records (or embedding column missing)'
  ) as status;

-- 8. Summary
SELECT '========================================' as check_name, '' as status;
SELECT 'SUMMARY: If any items show ❌, run:' as check_name, '' as status;
SELECT '20260121_comprehensive_schema_fix.sql' as check_name, '' as status;
SELECT '========================================' as check_name, '' as status;

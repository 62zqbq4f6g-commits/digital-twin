-- Migration: 20260125_phase16_performance_indexes.sql
-- Phase 16: Performance Optimization - Database Indexes
-- Run in Supabase SQL Editor

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================

-- Notes: Optimize user lookups sorted by creation date
CREATE INDEX IF NOT EXISTS idx_notes_user_created
  ON notes(user_id, created_at DESC);

-- Entities: Optimize user lookups filtered by status
CREATE INDEX IF NOT EXISTS idx_entities_user_status
  ON user_entities(user_id, status);

-- Entities: Optimize importance-based queries for active entities
CREATE INDEX IF NOT EXISTS idx_entities_importance
  ON user_entities(user_id, importance_score DESC)
  WHERE status = 'active';

-- Notes: Optimize lookups for non-deleted notes
CREATE INDEX IF NOT EXISTS idx_notes_user_active
  ON notes(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- Key People: Optimize lookups by user
CREATE INDEX IF NOT EXISTS idx_key_people_user
  ON user_key_people(user_id);

-- Patterns: Optimize status-based queries
CREATE INDEX IF NOT EXISTS idx_patterns_user_status
  ON user_patterns(user_id, status);

-- Category Summaries: Optimize user lookups
CREATE INDEX IF NOT EXISTS idx_category_summaries_user
  ON category_summaries(user_id);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

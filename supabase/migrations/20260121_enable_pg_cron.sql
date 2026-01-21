-- =====================================================
-- STEP 1: Enable pg_cron Extension
-- Run this in Supabase SQL Editor (Database → SQL Editor)
-- =====================================================

-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage to postgres role
GRANT USAGE ON SCHEMA cron TO postgres;

-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'pg_cron';

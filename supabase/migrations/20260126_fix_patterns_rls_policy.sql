-- Fix user_patterns RLS policy for service role access
-- The original policy uses auth.role() which may not work with service key
-- This migration uses the same robust pattern as ambient_recordings

-- Drop the old service role policy if it exists
DROP POLICY IF EXISTS "Service role full access to patterns" ON user_patterns;

-- Create a more robust service role policy that works with service key
CREATE POLICY "Service role has full access to patterns"
  ON user_patterns FOR ALL
  USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

-- Also ensure the insert policy works correctly
DROP POLICY IF EXISTS "Users can insert own patterns" ON user_patterns;
CREATE POLICY "Users can insert own patterns" ON user_patterns
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    OR current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

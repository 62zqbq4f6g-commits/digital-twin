-- ============================================
-- INSCRIPT ZERO-KNOWLEDGE ENCRYPTION SCHEMA
-- ============================================
-- Date: January 28, 2026
-- Owner: T1 (Encryption Foundation)
--
-- This migration adds encryption support columns to all content tables.
-- Client-side encryption with AES-256-GCM.
-- Keys NEVER leave the browser.
--
-- Tables modified:
--   - user_profiles (encryption metadata)
--   - notes
--   - user_entities
--   - entity_facts
--   - user_patterns
--   - mirror_conversations
--   - mirror_messages
--   - category_summaries
--   - meeting_history
--   - ambient_recordings
--
-- Tables created:
--   - user_settings (key-value store)
--   - encryption_audit_log (security audit trail)
-- ============================================

-- ============================================
-- 1. USER PROFILES: Add encryption metadata
-- ============================================
-- Note: We add to user_profiles, not auth.users (Supabase managed)

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS encryption_salt TEXT,
ADD COLUMN IF NOT EXISTS encryption_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS recovery_key_hash TEXT,
ADD COLUMN IF NOT EXISTS encryption_setup_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles.encryption_salt IS 'Base64-encoded salt for PBKDF2 key derivation (stored on server for multi-device sync)';
COMMENT ON COLUMN user_profiles.encryption_version IS 'Encryption schema version (for future migrations)';
COMMENT ON COLUMN user_profiles.recovery_key_hash IS 'SHA-256 hash of recovery key for verification';
COMMENT ON COLUMN user_profiles.encryption_setup_at IS 'When encryption was first set up';

-- ============================================
-- 2. NOTES: Add ciphertext columns
-- ============================================

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS content_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN notes.content_encrypted IS 'AES-256-GCM encrypted content (base64, IV prepended)';
COMMENT ON COLUMN notes.is_encrypted IS 'Whether this note is encrypted';

-- Index for finding unencrypted notes (migration helper)
CREATE INDEX IF NOT EXISTS idx_notes_unencrypted
ON notes(user_id, is_encrypted)
WHERE is_encrypted = FALSE;

-- ============================================
-- 3. USER ENTITIES: Add ciphertext columns
-- ============================================

ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS name_encrypted TEXT,
ADD COLUMN IF NOT EXISTS summary_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_entities.name_encrypted IS 'Encrypted entity name';
COMMENT ON COLUMN user_entities.summary_encrypted IS 'Encrypted entity summary';
COMMENT ON COLUMN user_entities.is_encrypted IS 'Whether this entity is encrypted';

CREATE INDEX IF NOT EXISTS idx_user_entities_unencrypted
ON user_entities(user_id, is_encrypted)
WHERE is_encrypted = FALSE;

-- ============================================
-- 4. ENTITY FACTS: Add ciphertext column
-- ============================================
-- Note: predicate stays plaintext for querying, only object is encrypted

ALTER TABLE entity_facts
ADD COLUMN IF NOT EXISTS object_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN entity_facts.object_encrypted IS 'Encrypted object text';
COMMENT ON COLUMN entity_facts.is_encrypted IS 'Whether this fact is encrypted';

CREATE INDEX IF NOT EXISTS idx_entity_facts_unencrypted
ON entity_facts(user_id, is_encrypted)
WHERE is_encrypted = FALSE;

-- ============================================
-- 5. USER PATTERNS: Add ciphertext column
-- ============================================

ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS description_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN user_patterns.description_encrypted IS 'Encrypted pattern description';
COMMENT ON COLUMN user_patterns.is_encrypted IS 'Whether this pattern is encrypted';

CREATE INDEX IF NOT EXISTS idx_user_patterns_unencrypted
ON user_patterns(user_id, is_encrypted)
WHERE is_encrypted = FALSE;

-- ============================================
-- 6. MIRROR CONVERSATIONS: Add ciphertext column
-- ============================================

ALTER TABLE mirror_conversations
ADD COLUMN IF NOT EXISTS title_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN mirror_conversations.title_encrypted IS 'Encrypted conversation title/summary';
COMMENT ON COLUMN mirror_conversations.is_encrypted IS 'Whether this conversation is encrypted';

-- ============================================
-- 7. MIRROR MESSAGES: Add ciphertext column
-- ============================================

ALTER TABLE mirror_messages
ADD COLUMN IF NOT EXISTS content_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN mirror_messages.content_encrypted IS 'Encrypted message content';
COMMENT ON COLUMN mirror_messages.is_encrypted IS 'Whether this message is encrypted';

CREATE INDEX IF NOT EXISTS idx_mirror_messages_unencrypted
ON mirror_messages(user_id, is_encrypted)
WHERE is_encrypted = FALSE;

-- ============================================
-- 8. CATEGORY SUMMARIES: Add ciphertext column
-- ============================================

ALTER TABLE category_summaries
ADD COLUMN IF NOT EXISTS summary_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN category_summaries.summary_encrypted IS 'Encrypted category summary';
COMMENT ON COLUMN category_summaries.is_encrypted IS 'Whether this summary is encrypted';

-- ============================================
-- 9. MEETING HISTORY: Add ciphertext columns
-- ============================================

ALTER TABLE meeting_history
ADD COLUMN IF NOT EXISTS title_encrypted TEXT,
ADD COLUMN IF NOT EXISTS notes_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN meeting_history.title_encrypted IS 'Encrypted meeting title';
COMMENT ON COLUMN meeting_history.notes_encrypted IS 'Encrypted meeting notes';
COMMENT ON COLUMN meeting_history.is_encrypted IS 'Whether this meeting is encrypted';

-- ============================================
-- 10. AMBIENT RECORDINGS: Add ciphertext column
-- ============================================

ALTER TABLE ambient_recordings
ADD COLUMN IF NOT EXISTS transcript_encrypted TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN ambient_recordings.transcript_encrypted IS 'Encrypted transcript';
COMMENT ON COLUMN ambient_recordings.is_encrypted IS 'Whether this recording is encrypted';

-- ============================================
-- 11. USER SETTINGS TABLE (Key-Value Store)
-- ============================================

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setting_key TEXT NOT NULL,
  setting_value TEXT,
  setting_value_encrypted TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Each user can have only one value per key
  UNIQUE(user_id, setting_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(user_id, setting_key);

-- RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts on re-run)
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;
DROP POLICY IF EXISTS "Service role has full access to user_settings" ON user_settings;

-- Create policies
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own settings" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to user_settings" ON user_settings
  FOR ALL USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

COMMENT ON TABLE user_settings IS 'Key-value store for user preferences and settings';
COMMENT ON COLUMN user_settings.setting_key IS 'Setting identifier (e.g., theme, tier, notification_prefs)';
COMMENT ON COLUMN user_settings.setting_value IS 'Plaintext setting value';
COMMENT ON COLUMN user_settings.setting_value_encrypted IS 'Encrypted setting value (for sensitive settings)';

-- ============================================
-- 12. ENCRYPTION AUDIT LOG
-- ============================================
-- Tracks encryption-related events for security auditing

CREATE TABLE IF NOT EXISTS encryption_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  error_code TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_encryption_audit_user ON encryption_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_action ON encryption_audit_log(user_id, action);
CREATE INDEX IF NOT EXISTS idx_encryption_audit_created ON encryption_audit_log(user_id, created_at DESC);

-- RLS
ALTER TABLE encryption_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own audit log" ON encryption_audit_log;
DROP POLICY IF EXISTS "Users can insert own audit log" ON encryption_audit_log;
DROP POLICY IF EXISTS "Service role has full access to encryption_audit_log" ON encryption_audit_log;

-- Users can only view their own audit logs (read-only)
CREATE POLICY "Users can view own audit log" ON encryption_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own audit entries
CREATE POLICY "Users can insert own audit log" ON encryption_audit_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to encryption_audit_log" ON encryption_audit_log
  FOR ALL USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

COMMENT ON TABLE encryption_audit_log IS 'Security audit trail for encryption events';
COMMENT ON COLUMN encryption_audit_log.action IS 'Action type: setup, unlock, lock, password_change, recovery_used, failed_unlock';
COMMENT ON COLUMN encryption_audit_log.success IS 'Whether the action succeeded';
COMMENT ON COLUMN encryption_audit_log.error_code IS 'Error code if action failed';

-- ============================================
-- 13. UPDATED_AT TRIGGER FOR NEW TABLES
-- ============================================

-- Trigger function (create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to user_settings
DROP TRIGGER IF EXISTS user_settings_updated_at ON user_settings;
CREATE TRIGGER user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 14. HELPER FUNCTION: Get unencrypted counts
-- ============================================
-- Useful for migration progress tracking

CREATE OR REPLACE FUNCTION get_unencrypted_counts(p_user_id UUID)
RETURNS TABLE (
  table_name TEXT,
  unencrypted_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'notes'::TEXT, COUNT(*)::BIGINT FROM notes WHERE user_id = p_user_id AND is_encrypted = FALSE
  UNION ALL
  SELECT 'user_entities'::TEXT, COUNT(*)::BIGINT FROM user_entities WHERE user_id = p_user_id AND is_encrypted = FALSE
  UNION ALL
  SELECT 'entity_facts'::TEXT, COUNT(*)::BIGINT FROM entity_facts WHERE user_id = p_user_id AND is_encrypted = FALSE
  UNION ALL
  SELECT 'user_patterns'::TEXT, COUNT(*)::BIGINT FROM user_patterns WHERE user_id = p_user_id AND is_encrypted = FALSE
  UNION ALL
  SELECT 'mirror_messages'::TEXT, COUNT(*)::BIGINT FROM mirror_messages WHERE user_id = p_user_id AND is_encrypted = FALSE
  UNION ALL
  SELECT 'category_summaries'::TEXT, COUNT(*)::BIGINT FROM category_summaries WHERE user_id = p_user_id AND is_encrypted = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_unencrypted_counts TO authenticated;

-- ============================================
-- 15. VERIFICATION
-- ============================================

DO $$
DECLARE
  missing_columns TEXT := '';
BEGIN
  -- Check notes columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notes' AND column_name = 'content_encrypted') THEN
    missing_columns := missing_columns || 'notes.content_encrypted, ';
  END IF;

  -- Check user_entities columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_entities' AND column_name = 'name_encrypted') THEN
    missing_columns := missing_columns || 'user_entities.name_encrypted, ';
  END IF;

  -- Check user_settings table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings') THEN
    missing_columns := missing_columns || 'user_settings table, ';
  END IF;

  -- Check encryption_audit_log table
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'encryption_audit_log') THEN
    missing_columns := missing_columns || 'encryption_audit_log table, ';
  END IF;

  IF missing_columns != '' THEN
    RAISE WARNING 'Missing: %', missing_columns;
  ELSE
    RAISE NOTICE '✅ Encryption schema migration complete';
  END IF;
END $$;

-- ============================================
-- FIX: Meeting Tables + Ambient Recordings
-- ============================================
-- Issues addressed:
-- 1. ambient_recordings table may not exist
-- 2. meeting_history requires entity_id (should be optional)
-- 3. Encryption columns may be missing
--
-- Created: January 28, 2026
-- ============================================

-- ============================================
-- 1. AMBIENT RECORDINGS TABLE
-- ============================================

-- Create if not exists
CREATE TABLE IF NOT EXISTS ambient_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recording metadata
  mode VARCHAR(20) NOT NULL DEFAULT 'room',
  status VARCHAR(20) NOT NULL DEFAULT 'recording',

  -- Chunked upload tracking
  total_chunks INTEGER DEFAULT 1,
  chunks_received INTEGER DEFAULT 0,
  transcripts JSONB DEFAULT '{}',

  -- Content (with encryption support)
  transcript TEXT,
  transcript_encrypted TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  user_notes TEXT,
  duration_seconds INTEGER,

  -- Generated note link
  note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
  meeting_id UUID,

  -- Timestamps
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add missing columns if table already exists
DO $$
BEGIN
  -- transcript_encrypted
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ambient_recordings' AND column_name = 'transcript_encrypted') THEN
    ALTER TABLE ambient_recordings ADD COLUMN transcript_encrypted TEXT;
  END IF;

  -- is_encrypted
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ambient_recordings' AND column_name = 'is_encrypted') THEN
    ALTER TABLE ambient_recordings ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE;
  END IF;

  -- meeting_id
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ambient_recordings' AND column_name = 'meeting_id') THEN
    ALTER TABLE ambient_recordings ADD COLUMN meeting_id UUID;
  END IF;

  -- started_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ambient_recordings' AND column_name = 'started_at') THEN
    ALTER TABLE ambient_recordings ADD COLUMN started_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- ended_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ambient_recordings' AND column_name = 'ended_at') THEN
    ALTER TABLE ambient_recordings ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ambient_user_id ON ambient_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_ambient_status ON ambient_recordings(status);
CREATE INDEX IF NOT EXISTS idx_ambient_created ON ambient_recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ambient_note_id ON ambient_recordings(note_id);
CREATE INDEX IF NOT EXISTS idx_ambient_meeting_id ON ambient_recordings(meeting_id);

-- RLS
ALTER TABLE ambient_recordings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own ambient recordings" ON ambient_recordings;
DROP POLICY IF EXISTS "Users can create own ambient recordings" ON ambient_recordings;
DROP POLICY IF EXISTS "Users can update own ambient recordings" ON ambient_recordings;
DROP POLICY IF EXISTS "Users can delete own ambient recordings" ON ambient_recordings;
DROP POLICY IF EXISTS "Service role has full access to ambient recordings" ON ambient_recordings;

-- Create policies
CREATE POLICY "Users can view own ambient recordings"
  ON ambient_recordings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own ambient recordings"
  ON ambient_recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ambient recordings"
  ON ambient_recordings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ambient recordings"
  ON ambient_recordings FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to ambient recordings"
  ON ambient_recordings FOR ALL
  USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

-- ============================================
-- 2. FIX MEETING_HISTORY TABLE
-- ============================================
-- Make entity_id optional (meetings can exist without a specific entity)

-- First check if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_history') THEN
    -- Drop the NOT NULL constraint on entity_id if it exists
    -- We need to check if the constraint exists first
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history'
      AND column_name = 'entity_id'
      AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE meeting_history ALTER COLUMN entity_id DROP NOT NULL;
      RAISE NOTICE 'Made meeting_history.entity_id nullable';
    END IF;

    -- Add title column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'title') THEN
      ALTER TABLE meeting_history ADD COLUMN title TEXT;
    END IF;

    -- Add title_encrypted column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'title_encrypted') THEN
      ALTER TABLE meeting_history ADD COLUMN title_encrypted TEXT;
    END IF;

    -- Add notes_encrypted column if missing (for raw notes)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'notes_encrypted') THEN
      ALTER TABLE meeting_history ADD COLUMN notes_encrypted TEXT;
    END IF;

    -- Add is_encrypted column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'is_encrypted') THEN
      ALTER TABLE meeting_history ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add raw_transcript column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'raw_transcript') THEN
      ALTER TABLE meeting_history ADD COLUMN raw_transcript TEXT;
    END IF;

    -- Add enhanced_notes column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'enhanced_notes') THEN
      ALTER TABLE meeting_history ADD COLUMN enhanced_notes TEXT;
    END IF;

    -- Add attendees column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'attendees') THEN
      ALTER TABLE meeting_history ADD COLUMN attendees JSONB DEFAULT '[]';
    END IF;

    -- Add meeting_type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'meeting_type') THEN
      ALTER TABLE meeting_history ADD COLUMN meeting_type TEXT DEFAULT 'general';
    END IF;

    -- Add duration_seconds column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name = 'meeting_history' AND column_name = 'duration_seconds') THEN
      ALTER TABLE meeting_history ADD COLUMN duration_seconds INTEGER;
    END IF;

  ELSE
    -- Create meeting_history table if it doesn't exist
    CREATE TABLE meeting_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      entity_id UUID REFERENCES user_entities(id) ON DELETE SET NULL, -- Now nullable
      note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,

      -- Content
      title TEXT,
      title_encrypted TEXT,
      raw_transcript TEXT,
      enhanced_notes TEXT,
      notes_encrypted TEXT,
      is_encrypted BOOLEAN DEFAULT FALSE,

      -- Meeting metadata
      meeting_type TEXT DEFAULT 'general',
      meeting_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_seconds INTEGER,
      attendees JSONB DEFAULT '[]',

      -- Structured data
      topics TEXT[] DEFAULT '{}',
      sentiment VARCHAR(20),
      key_points TEXT[] DEFAULT '{}',
      action_items TEXT[] DEFAULT '{}',

      -- Timestamps
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    RAISE NOTICE 'Created meeting_history table';
  END IF;
END $$;

-- Drop unique constraint if it prevents meetings without entities
DO $$
BEGIN
  -- The old constraint was: UNIQUE(user_id, entity_id, note_id)
  -- This prevents saving meetings without entity_id
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meeting_history_user_id_entity_id_note_id_key'
  ) THEN
    ALTER TABLE meeting_history DROP CONSTRAINT meeting_history_user_id_entity_id_note_id_key;
    RAISE NOTICE 'Dropped old unique constraint';
  END IF;
END $$;

-- Create new indexes (if not exist)
CREATE INDEX IF NOT EXISTS idx_meeting_history_user ON meeting_history(user_id);
CREATE INDEX IF NOT EXISTS idx_meeting_history_note ON meeting_history(note_id);
CREATE INDEX IF NOT EXISTS idx_meeting_history_date ON meeting_history(user_id, meeting_date DESC);

-- RLS
ALTER TABLE meeting_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own meeting history" ON meeting_history;
DROP POLICY IF EXISTS "Users can insert own meeting history" ON meeting_history;
DROP POLICY IF EXISTS "Users can update own meeting history" ON meeting_history;
DROP POLICY IF EXISTS "Users can delete own meeting history" ON meeting_history;
DROP POLICY IF EXISTS "Service role has full access to meeting_history" ON meeting_history;

-- Create policies
CREATE POLICY "Users can view own meeting history"
  ON meeting_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meeting history"
  ON meeting_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meeting history"
  ON meeting_history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meeting history"
  ON meeting_history FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to meeting_history"
  ON meeting_history FOR ALL
  USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

-- ============================================
-- 3. ENSURE NOTES TABLE HAS MEETING COLUMNS
-- ============================================

DO $$
BEGIN
  -- note_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'note_type') THEN
    ALTER TABLE notes ADD COLUMN note_type VARCHAR(20) DEFAULT 'note';
  END IF;

  -- meeting_metadata column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'meeting_metadata') THEN
    ALTER TABLE notes ADD COLUMN meeting_metadata JSONB;
  END IF;

  -- enhanced_content column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'enhanced_content') THEN
    ALTER TABLE notes ADD COLUMN enhanced_content TEXT;
  END IF;

  -- raw_input column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'raw_input') THEN
    ALTER TABLE notes ADD COLUMN raw_input TEXT;
  END IF;
END $$;

-- Index for note_type queries
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_user_type ON notes(user_id, note_type);

-- ============================================
-- 4. VERIFICATION
-- ============================================

DO $$
DECLARE
  issues TEXT := '';
BEGIN
  -- Check ambient_recordings
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ambient_recordings') THEN
    issues := issues || 'ambient_recordings table missing; ';
  END IF;

  -- Check meeting_history
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meeting_history') THEN
    issues := issues || 'meeting_history table missing; ';
  END IF;

  -- Check entity_id is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'meeting_history'
    AND column_name = 'entity_id'
    AND is_nullable = 'NO'
  ) THEN
    issues := issues || 'meeting_history.entity_id still NOT NULL; ';
  END IF;

  IF issues = '' THEN
    RAISE NOTICE '✅ Meeting tables fix migration complete';
  ELSE
    RAISE WARNING 'Issues found: %', issues;
  END IF;
END $$;

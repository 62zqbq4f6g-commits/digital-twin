-- Hotfix: Delete notes functionality + Ambient recordings table
-- Bug #1: deleted_at column missing from notes
-- Bug #2: ambient_recordings table not created

-- ============================================
-- BUG #1: Add deleted_at column to notes
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE notes ADD COLUMN deleted_at TIMESTAMPTZ;
    COMMENT ON COLUMN notes.deleted_at IS 'Soft delete timestamp';
    CREATE INDEX IF NOT EXISTS idx_notes_deleted_at ON notes(deleted_at) WHERE deleted_at IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- BUG #2: Create ambient_recordings table
-- ============================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ambient_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recording metadata
  mode VARCHAR(20) NOT NULL DEFAULT 'room',
  status VARCHAR(20) NOT NULL DEFAULT 'recording',

  -- Chunked upload tracking
  total_chunks INTEGER DEFAULT 1,
  chunks_received INTEGER DEFAULT 0,
  transcripts JSONB DEFAULT '{}',

  -- Final content
  transcript TEXT,
  user_notes TEXT,
  duration_seconds INTEGER,

  -- Generated note link
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ambient_user_id ON ambient_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_ambient_status ON ambient_recordings(status);
CREATE INDEX IF NOT EXISTS idx_ambient_created ON ambient_recordings(created_at DESC);

-- RLS Policies
ALTER TABLE ambient_recordings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own ambient recordings" ON ambient_recordings;
DROP POLICY IF EXISTS "Users can create own ambient recordings" ON ambient_recordings;
DROP POLICY IF EXISTS "Users can update own ambient recordings" ON ambient_recordings;
DROP POLICY IF EXISTS "Users can delete own ambient recordings" ON ambient_recordings;

-- Create fresh policies
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

-- Add source column to notes if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'source'
  ) THEN
    ALTER TABLE notes ADD COLUMN source VARCHAR(20) DEFAULT 'manual';
  END IF;
END $$;

-- Success message
DO $$ BEGIN RAISE NOTICE 'Hotfix applied: deleted_at column + ambient_recordings table'; END $$;

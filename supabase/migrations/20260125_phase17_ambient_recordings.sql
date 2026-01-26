-- Phase 17: Ambient Recordings Table
-- TASK-022: Processing Pipeline for ambient listening

-- Create ambient_recordings table
CREATE TABLE IF NOT EXISTS ambient_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Recording metadata
  mode VARCHAR(20) NOT NULL DEFAULT 'room', -- 'room' | 'tab_audio' | 'mic_and_tab'
  status VARCHAR(20) NOT NULL DEFAULT 'recording', -- recording | uploading | transcribed | processing | completed | failed

  -- Chunked upload tracking
  total_chunks INTEGER DEFAULT 1,
  chunks_received INTEGER DEFAULT 0,
  transcripts JSONB DEFAULT '{}', -- { "0": { "text": "...", "duration": 300 }, "1": { ... } }

  -- Final content
  transcript TEXT, -- Combined transcript after all chunks processed
  user_notes TEXT, -- Notes added by user during recording
  duration_seconds INTEGER, -- Total audio duration

  -- Generated note link
  note_id UUID REFERENCES notes(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ambient_user_id ON ambient_recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_ambient_status ON ambient_recordings(status);
CREATE INDEX IF NOT EXISTS idx_ambient_created ON ambient_recordings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ambient_note_id ON ambient_recordings(note_id);

-- RLS Policies
ALTER TABLE ambient_recordings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own recordings
CREATE POLICY "Users can view own ambient recordings"
  ON ambient_recordings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own recordings
CREATE POLICY "Users can create own ambient recordings"
  ON ambient_recordings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own recordings
CREATE POLICY "Users can update own ambient recordings"
  ON ambient_recordings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own recordings
CREATE POLICY "Users can delete own ambient recordings"
  ON ambient_recordings FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass for API access
-- Note: Service role key bypasses RLS automatically, but this policy
-- ensures access when using auth headers with service_role claim
CREATE POLICY "Service role has full access to ambient recordings"
  ON ambient_recordings FOR ALL
  USING (
    current_setting('request.jwt.claim.role', true) = 'service_role'
    OR auth.jwt() ->> 'role' = 'service_role'
    OR current_setting('role', true) = 'service_role'
  );

-- Add source column to notes if not exists (for tracking ambient vs manual)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'source'
  ) THEN
    ALTER TABLE notes ADD COLUMN source VARCHAR(20) DEFAULT 'manual';
    COMMENT ON COLUMN notes.source IS 'Source of note: manual | voice | ambient | meeting';
  END IF;
END $$;

-- Add raw_input column to notes if not exists (for original transcript)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'raw_input'
  ) THEN
    ALTER TABLE notes ADD COLUMN raw_input TEXT;
    COMMENT ON COLUMN notes.raw_input IS 'Original raw input before enhancement';
  END IF;
END $$;

-- Add enhancement_metadata column to notes if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'enhancement_metadata'
  ) THEN
    ALTER TABLE notes ADD COLUMN enhancement_metadata JSONB;
    COMMENT ON COLUMN notes.enhancement_metadata IS 'Metadata about enhancement: version, mode, timing';
  END IF;
END $$;

COMMENT ON TABLE ambient_recordings IS 'Phase 17: Ambient listening sessions with chunked upload support';

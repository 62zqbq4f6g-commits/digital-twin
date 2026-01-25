-- ============================================
-- PHASE 16: Enhancement System Schema
-- ============================================
-- Adds database tables and columns for:
-- - Meeting enhancement support
-- - Inscript Context (meeting history, open loops)
--
-- Created: 2026-01-25
-- Note: note_id columns use TEXT to match notes.id type
-- ============================================

-- ============================================
-- 1. MODIFY NOTES TABLE
-- ============================================
-- Add columns for enhancement support

ALTER TABLE notes
ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'note',
ADD COLUMN IF NOT EXISTS raw_input TEXT,
ADD COLUMN IF NOT EXISTS enhanced_content TEXT,
ADD COLUMN IF NOT EXISTS enhancement_metadata JSONB,
ADD COLUMN IF NOT EXISTS meeting_metadata JSONB;

-- Add comment for clarity
COMMENT ON COLUMN notes.note_type IS 'Type of note: note, meeting, reflection';
COMMENT ON COLUMN notes.raw_input IS 'Original user input before enhancement';
COMMENT ON COLUMN notes.enhanced_content IS 'AI-enhanced output (structured)';
COMMENT ON COLUMN notes.enhancement_metadata IS 'Enhancement details: {enhanced, enhancedAt, mode, promptVersion}';
COMMENT ON COLUMN notes.meeting_metadata IS 'Meeting-specific data: {title, attendees[], topics[], meetingDate}';

-- Create indexes for note_type queries
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_user_type ON notes(user_id, note_type);
CREATE INDEX IF NOT EXISTS idx_notes_user_type_created ON notes(user_id, note_type, created_at DESC);

-- ============================================
-- 2. CREATE MEETING_HISTORY TABLE
-- ============================================
-- Tracks meeting history per entity for Inscript Context

CREATE TABLE IF NOT EXISTS meeting_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  meeting_date TIMESTAMPTZ NOT NULL,
  topics TEXT[] DEFAULT '{}',
  sentiment VARCHAR(20),
  key_points TEXT[] DEFAULT '{}',
  action_items TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate entries
  UNIQUE(user_id, entity_id, note_id)
);

-- Add comments
COMMENT ON TABLE meeting_history IS 'Tracks meeting history per entity for Inscript Context';
COMMENT ON COLUMN meeting_history.entity_id IS 'The person/entity this meeting was with';
COMMENT ON COLUMN meeting_history.topics IS 'Topics discussed in this meeting';
COMMENT ON COLUMN meeting_history.sentiment IS 'Overall meeting sentiment: positive, neutral, negative';
COMMENT ON COLUMN meeting_history.key_points IS 'Key points from the meeting';
COMMENT ON COLUMN meeting_history.action_items IS 'Action items from this meeting';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_meeting_history_user_entity
ON meeting_history(user_id, entity_id);

CREATE INDEX IF NOT EXISTS idx_meeting_history_user_date
ON meeting_history(user_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_history_entity_date
ON meeting_history(entity_id, meeting_date DESC);

-- RLS Policy
ALTER TABLE meeting_history ENABLE ROW LEVEL SECURITY;

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

-- Service role bypass
CREATE POLICY "Service role has full access to meeting_history"
ON meeting_history FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 3. CREATE OPEN_LOOPS TABLE
-- ============================================
-- Tracks unresolved topics/issues that keep coming up

CREATE TABLE IF NOT EXISTS open_loops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  first_noted_at TIMESTAMPTZ NOT NULL,
  first_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
  mention_count INTEGER DEFAULT 1,
  last_mentioned_at TIMESTAMPTZ NOT NULL,
  last_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'archived')),
  related_entities UUID[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  context_snippets TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE open_loops IS 'Tracks unresolved topics/issues that keep coming up';
COMMENT ON COLUMN open_loops.description IS 'What the open loop is about';
COMMENT ON COLUMN open_loops.mention_count IS 'How many times this has been mentioned';
COMMENT ON COLUMN open_loops.status IS 'Current status: open, resolved, archived';
COMMENT ON COLUMN open_loops.related_entities IS 'Entity IDs related to this loop';
COMMENT ON COLUMN open_loops.keywords IS 'Keywords for matching new mentions';
COMMENT ON COLUMN open_loops.context_snippets IS 'Recent context snippets mentioning this loop';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_open_loops_user_status
ON open_loops(user_id, status);

CREATE INDEX IF NOT EXISTS idx_open_loops_user_updated
ON open_loops(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_open_loops_keywords
ON open_loops USING GIN(keywords);

-- RLS Policy
ALTER TABLE open_loops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own open loops"
ON open_loops FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own open loops"
ON open_loops FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own open loops"
ON open_loops FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own open loops"
ON open_loops FOR DELETE
USING (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "Service role has full access to open_loops"
ON open_loops FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================
-- 4. DATABASE FUNCTIONS
-- ============================================

-- Function: Get meeting count and stats with specific entity
CREATE OR REPLACE FUNCTION get_meeting_count(
  p_user_id UUID,
  p_entity_id UUID
) RETURNS TABLE (
  meeting_count BIGINT,
  first_meeting TIMESTAMPTZ,
  last_meeting TIMESTAMPTZ,
  recent_topics TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as meeting_count,
    MIN(mh.meeting_date) as first_meeting,
    MAX(mh.meeting_date) as last_meeting,
    ARRAY(
      SELECT DISTINCT unnest(mh2.topics)
      FROM meeting_history mh2
      WHERE mh2.user_id = p_user_id
        AND mh2.entity_id = p_entity_id
        AND mh2.meeting_date > NOW() - INTERVAL '90 days'
      ORDER BY 1
      LIMIT 10
    ) as recent_topics
  FROM meeting_history mh
  WHERE mh.user_id = p_user_id
    AND mh.entity_id = p_entity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get entity meeting context for Inscript Context
CREATE OR REPLACE FUNCTION get_entity_meeting_context(
  p_user_id UUID,
  p_entity_names TEXT[]
) RETURNS TABLE (
  entity_name TEXT,
  entity_id UUID,
  meeting_count BIGINT,
  first_meeting TIMESTAMPTZ,
  last_meeting TIMESTAMPTZ,
  days_since_last INTEGER,
  recent_topics TEXT[],
  last_sentiment VARCHAR(20)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ue.name as entity_name,
    ue.id as entity_id,
    COUNT(mh.id)::BIGINT as meeting_count,
    MIN(mh.meeting_date) as first_meeting,
    MAX(mh.meeting_date) as last_meeting,
    EXTRACT(DAY FROM NOW() - MAX(mh.meeting_date))::INTEGER as days_since_last,
    ARRAY(
      SELECT DISTINCT unnest(mh2.topics)
      FROM meeting_history mh2
      WHERE mh2.entity_id = ue.id
        AND mh2.meeting_date > NOW() - INTERVAL '90 days'
      ORDER BY 1
      LIMIT 5
    ) as recent_topics,
    (
      SELECT mh3.sentiment
      FROM meeting_history mh3
      WHERE mh3.entity_id = ue.id
      ORDER BY mh3.meeting_date DESC
      LIMIT 1
    ) as last_sentiment
  FROM user_entities ue
  LEFT JOIN meeting_history mh ON mh.entity_id = ue.id
  WHERE ue.user_id = p_user_id
    AND ue.entity_type = 'person'
    AND ue.name = ANY(p_entity_names)
  GROUP BY ue.id, ue.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get open loops for context
CREATE OR REPLACE FUNCTION get_open_loops_context(
  p_user_id UUID,
  p_keywords TEXT[] DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  description TEXT,
  mention_count INTEGER,
  days_open INTEGER,
  last_mentioned_at TIMESTAMPTZ,
  keywords TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ol.id,
    ol.description,
    ol.mention_count,
    EXTRACT(DAY FROM NOW() - ol.first_noted_at)::INTEGER as days_open,
    ol.last_mentioned_at,
    ol.keywords
  FROM open_loops ol
  WHERE ol.user_id = p_user_id
    AND ol.status = 'open'
    AND (
      p_keywords IS NULL
      OR ol.keywords && p_keywords
    )
  ORDER BY ol.mention_count DESC, ol.last_mentioned_at DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update open loop on new mention
CREATE OR REPLACE FUNCTION update_open_loop_mention(
  p_loop_id UUID,
  p_note_id TEXT,
  p_context_snippet TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  UPDATE open_loops
  SET
    mention_count = mention_count + 1,
    last_mentioned_at = NOW(),
    last_note_id = p_note_id,
    context_snippets = CASE
      WHEN p_context_snippet IS NOT NULL
      THEN array_append(
        CASE WHEN array_length(context_snippets, 1) >= 5
             THEN context_snippets[2:5]
             ELSE context_snippets
        END,
        p_context_snippet
      )
      ELSE context_snippets
    END,
    updated_at = NOW()
  WHERE id = p_loop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. TRIGGER FOR UPDATED_AT
-- ============================================

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to open_loops
DROP TRIGGER IF EXISTS open_loops_updated_at ON open_loops;
CREATE TRIGGER open_loops_updated_at
BEFORE UPDATE ON open_loops
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify columns added to notes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notes' AND column_name = 'note_type'
  ) THEN
    RAISE EXCEPTION 'notes.note_type column not created';
  END IF;

  RAISE NOTICE 'Phase 16 Enhancement Schema: All columns and tables created successfully';
END $$;

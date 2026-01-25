# TASK-010: Database Schema Changes

## Overview
Add database tables and columns needed for meeting enhancement and Inscript Context.

## Priority
P0 — Week 3, Day 1

## Dependencies
- None (can start Week 3)

## Outputs
- SQL migrations in Supabase

## Schema Changes

### Modify: notes table

```sql
-- Add columns for enhancement support
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'note',
ADD COLUMN IF NOT EXISTS raw_input TEXT,
ADD COLUMN IF NOT EXISTS enhanced_content TEXT,
ADD COLUMN IF NOT EXISTS enhancement_metadata JSONB,
ADD COLUMN IF NOT EXISTS meeting_metadata JSONB;

-- Create index for note_type queries
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(note_type);
CREATE INDEX IF NOT EXISTS idx_notes_user_type ON notes(user_id, note_type);
```

#### Column Definitions

| Column | Type | Purpose |
|--------|------|---------|
| note_type | VARCHAR(20) | 'note', 'meeting', 'reflection' |
| raw_input | TEXT | Original user input before enhancement |
| enhanced_content | TEXT | AI-enhanced output |
| enhancement_metadata | JSONB | { enhanced: bool, enhancedAt, mode, promptVersion } |
| meeting_metadata | JSONB | { title, attendees[], topics[], meetingDate } |

### New: meeting_history table

```sql
CREATE TABLE IF NOT EXISTS meeting_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  meeting_date TIMESTAMPTZ NOT NULL,
  topics TEXT[] DEFAULT '{}',
  sentiment VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, entity_id, note_id)
);

CREATE INDEX idx_meeting_history_user_entity 
ON meeting_history(user_id, entity_id);

CREATE INDEX idx_meeting_history_user_date 
ON meeting_history(user_id, meeting_date DESC);
```

### New: open_loops table

```sql
CREATE TABLE IF NOT EXISTS open_loops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  first_noted_at TIMESTAMPTZ NOT NULL,
  first_note_id UUID REFERENCES notes(id),
  mention_count INTEGER DEFAULT 1,
  last_mentioned_at TIMESTAMPTZ NOT NULL,
  last_note_id UUID REFERENCES notes(id),
  status VARCHAR(20) DEFAULT 'open',
  related_entities UUID[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_open_loops_user_status 
ON open_loops(user_id, status);

CREATE INDEX idx_open_loops_keywords 
ON open_loops USING GIN(keywords);
```

### Database Functions

```sql
-- Get meeting count with specific entity
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
    MIN(meeting_date) as first_meeting,
    MAX(meeting_date) as last_meeting,
    ARRAY(
      SELECT DISTINCT unnest(mh.topics)
      FROM meeting_history mh
      WHERE mh.user_id = p_user_id 
        AND mh.entity_id = p_entity_id
      ORDER BY 1
      LIMIT 10
    ) as recent_topics
  FROM meeting_history
  WHERE user_id = p_user_id 
    AND entity_id = p_entity_id;
END;
$$ LANGUAGE plpgsql;
```

## Acceptance Criteria

- [ ] notes table has new columns
- [ ] meeting_history table created
- [ ] open_loops table created
- [ ] Indexes created for performance
- [ ] get_meeting_count function works
- [ ] Existing data unaffected
- [ ] RLS policies applied

## Test Checklist

- [ ] Can insert meeting note with metadata
- [ ] Can query notes by type
- [ ] Can insert meeting_history record
- [ ] Can query meeting count per entity
- [ ] Can insert open_loop
- [ ] Existing notes still work

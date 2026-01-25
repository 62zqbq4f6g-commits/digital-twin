# Phase 17 Build Instructions

## Overview

Phase 17 adds three major capabilities to Inscript:
1. **Personal Notes Enhancement** — Auto-enhance every note with subtle, voice-preserving improvements
2. **Ambient Listening** — Capture real-world and video call meetings
3. **Meetings Tab** — Beautiful interface for browsing and querying across all meetings

## Prerequisites

- Phase 16 complete and stable
- Sonnet restored (~3.5s enhancement time)
- Save button working
- Voice input working

## File Setup

Place these files in your project:

```
/Users/airoxthebox/Projects/digital-twin/
├── INSCRIPT-PHASE17-SPEC.md          # Master spec
└── tasks/
    ├── TASK-015-personal-note-api.md
    ├── TASK-016-auto-enhance.md
    ├── TASK-017-personal-prompt.md    # Create from spec
    ├── TASK-018-threads-section.md    # Create from spec
    ├── TASK-019-ambient-recording-ui.md
    ├── TASK-020-long-audio.md         # Create from spec
    ├── TASK-021-tab-audio.md          # Create from spec
    ├── TASK-022-processing-pipeline.md # Create from spec
    ├── TASK-023-inline-notes.md       # Create from spec
    ├── TASK-024-meetings-tab-ui.md
    ├── TASK-025-meeting-cards.md      # Create from spec
    ├── TASK-026-search-meetings.md    # Create from spec
    ├── TASK-027-query-meetings-api.md
    └── TASK-028-query-response-ui.md  # Create from spec
```

## Terminal Workflow

### Terminal 1 (Frontend)
Owns: UI components, CSS, client-side logic

### Terminal 2 (Backend)
Owns: API endpoints, database, server-side logic

## Task Sequence

### Week 1: Personal Notes Enhancement

| Day | Terminal 1 | Terminal 2 |
|-----|------------|------------|
| 1-2 | — | TASK-015: Personal note API |
| 2-3 | TASK-016: Auto-enhance on save | TASK-017: Enhancement prompt v2.0 |
| 3-4 | — | TASK-018: Threads section |

**Week 1 Prompt (Terminal 2):**
```
Read CLAUDE.md and INSCRIPT-PHASE17-SPEC.md first.
Then read tasks/TASK-015-personal-note-api.md and build it.
```

**Week 1 Prompt (Terminal 1):**
```
After TASK-015 is deployed, read tasks/TASK-016-auto-enhance.md and build it.
```

### Week 2: Ambient Listening

| Day | Terminal 1 | Terminal 2 |
|-----|------------|------------|
| 1-2 | TASK-019: Ambient recording UI | TASK-020: Long audio handling |
| 2-3 | TASK-021: Tab audio capture | TASK-022: Processing pipeline |
| 3-4 | TASK-023: Inline notes | Integration test |

**Week 2 Prompt (Terminal 1):**
```
Read tasks/TASK-019-ambient-recording-ui.md and build it.
Follow the design system strictly (Inscript Design System.html reference).
```

**Week 2 Prompt (Terminal 2):**
```
Read tasks/TASK-020-long-audio.md (chunked upload handling for recordings up to 2 hours).
Then read tasks/TASK-022-processing-pipeline.md (upload → transcribe → enhance flow).
```

### Week 3: Meetings Tab

| Day | Terminal 1 | Terminal 2 |
|-----|------------|------------|
| 1-2 | TASK-024: Meetings tab UI | TASK-025: Meeting cards API |
| 2-3 | TASK-026: Search UI | TASK-027: Query meetings API |
| 3-4 | TASK-028: Query response UI | Final integration |

**Week 3 Prompt (Terminal 1):**
```
Read tasks/TASK-024-meetings-tab-ui.md and build it.
This is a new sub-tab in the YOU main tab.
Follow the design system strictly — SoHo editorial aesthetic.
```

**Week 3 Prompt (Terminal 2):**
```
Read tasks/TASK-027-query-meetings-api.md and build it.
This powers natural language queries across all meeting notes.
```

## Design System Reminders

| Element | Rule |
|---------|------|
| **Black** | Buttons ONLY, never backgrounds |
| **Borders** | 1px only, never heavier |
| **Transitions** | 200ms ease-out |
| **Loading** | Shimmer, no spinners |
| **Fonts** | Inter (UI), Cormorant Garamond italic (AI/loading) |
| **Touch targets** | ≥44px |

## Performance Targets

| Operation | Target |
|-----------|--------|
| Personal note enhancement | < 3s |
| Audio upload (per chunk) | < 2s |
| Meeting query response | < 2s |
| Meetings tab load | < 500ms |

## Integration Test Checklist

After each week, verify:

### Week 1
- [ ] Save a note → auto-enhancement triggers
- [ ] Enhanced content appears within 3s
- [ ] THREADS section shows connections
- [ ] Tone preserved in output

### Week 2
- [ ] Room mode captures microphone audio
- [ ] Video Call mode captures tab audio
- [ ] Recording indicator and timer work
- [ ] Inline notes can be added
- [ ] End & Enhance produces meeting note

### Week 3
- [ ] Meetings tab shows in YOU navigation
- [ ] Meeting cards display correctly grouped
- [ ] Search filters meetings
- [ ] Natural language query returns AI answer
- [ ] Sources link to actual meetings

## Database Migrations

Run before Week 3:

```sql
-- Personal notes enhancement tracking
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS auto_enhanced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enhancement_version VARCHAR(10);

-- Ambient recordings table
CREATE TABLE IF NOT EXISTS ambient_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  mode VARCHAR(20) NOT NULL,
  duration_seconds INTEGER,
  audio_url TEXT,
  transcript TEXT,
  user_notes TEXT,
  status VARCHAR(20) DEFAULT 'recording',
  note_id UUID REFERENCES notes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Query function for semantic search
CREATE OR REPLACE FUNCTION match_meeting_notes(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id text,
  content text,
  enhanced_content text,
  meeting_metadata jsonb,
  created_at timestamptz,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.content,
    n.enhanced_content,
    n.meeting_metadata,
    n.created_at,
    1 - (n.embedding <=> query_embedding) AS similarity
  FROM notes n
  WHERE n.user_id = p_user_id
    AND n.note_type = 'meeting'
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

## Quality Checklist

Before marking Phase 17 complete:

- [ ] Does it feel like a SoHo design magazine editorial?
- [ ] Are touch targets ≥44px?
- [ ] Is black used ONLY for primary buttons/actions?
- [ ] Are all transitions 200ms ease-out?
- [ ] Loading states use shimmer, not spinners?
- [ ] 1px borders only?
- [ ] Would a minimalist agency approve this?

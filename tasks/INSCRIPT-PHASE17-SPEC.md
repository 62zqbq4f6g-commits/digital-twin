# Inscript Phase 17: Personal Notes + Ambient Listening + Meetings Tab

## Overview

Phase 17 extends Inscript's enhancement system beyond meetings to cover all personal note-taking, adds ambient audio capture for real-world and video call recording, and introduces a beautiful Meetings sub-tab with cross-meeting query capabilities.

**North Star:** *Every thought captured becomes structured insight, effortlessly.*

---

## Three Pillars

### 1. Personal Notes Enhancement (Auto-enhance)
Every note gets automatically enhanced after saving — subtle, meaningful, preserving voice.

### 2. Ambient Listening
Leave Inscript on during real meetings or video calls. Capture → Transcribe → Enhance.

### 3. Meetings Tab
A dedicated space in the YOU tab to browse, search, and query across all meetings.

---

## Design Principles (from Design System)

| Principle | Implementation |
|-----------|----------------|
| **SoHo editorial aesthetic** | Clean, architectural, museum-like |
| **Typography creates hierarchy** | Inter for UI, Cormorant Garamond italic for AI/loading |
| **Black for buttons ONLY** | Never black backgrounds |
| **Shimmer loading** | No spinners, skeleton + shimmer |
| **1px borders** | Never heavier |
| **200ms ease-out** | All transitions |
| **≥44px touch targets** | Mobile-first |

---

## Pillar 1: Personal Notes Enhancement

### Behavior

| Trigger | Action |
|---------|--------|
| User saves a note (type: note/idea/reflection) | Auto-enhancement begins in background |
| Enhancement completes | Note updates with enhanced content |
| User sees | Subtle "enhanced" indicator, no disruption |

### Enhancement Style (Subtle Mode)

**Input:** User's raw thought
**Output:** Cleaned prose + connections (NOT restructured like meetings)

```
RAW:
"feeling stuck on the product again. talked to sarah yesterday she said focus on one thing but idk what that one thing is. maybe voice? maybe the memory stuff?"

ENHANCED:
"Feeling stuck on the product direction. After talking with Sarah yesterday, her advice was to focus on one thing — but the question remains: which one? Current candidates: voice input or the memory system.

THREADS
→ You mentioned feeling stuck on Jan 12 and Jan 18 — this is a recurring theme
→ Sarah has advised "focus" in 3 of your last 5 conversations with her
→ Voice input was also mentioned in your Dec 28 note about priorities"
```

### Key Differences from Meeting Enhancement

| Aspect | Meeting | Personal Note |
|--------|---------|---------------|
| Structure | Rigid sections (DISCUSSED, ACTION ITEMS) | Flexible, follows user's flow |
| Tone | Professional, third-person | Preserves user's voice |
| Additions | Context items, attendee history | Threads, reflective questions |
| Length | Expanded | Similar to original |

### Enhancement Prompt (v2.0 - Personal)

```
You are Inscript, a personal AI memory system. You're enhancing a personal note.

RULES:
- Preserve the user's voice and tone exactly
- Clean up grammar/clarity without changing meaning
- Keep similar length to original (±20%)
- Add a THREADS section showing connections to past notes
- Optionally add 1 reflective question if natural
- Never restructure into bullet points unless the user used them
- Never add corporate/formal language

INPUT:
{raw_note}

CONTEXT FROM MEMORY:
{related_notes}
{patterns}

OUTPUT FORMAT:
[Enhanced note in user's voice]

THREADS
→ [Connection 1]
→ [Connection 2]

REFLECT (optional)
[One thoughtful question]
```

---

## Pillar 2: Ambient Listening

### Modes

| Mode | Input | Use Case |
|------|-------|----------|
| **Room** | Device microphone | Phone on table during in-person meeting |
| **Tab Audio** | Browser getDisplayMedia | Zoom/Meet in browser tab |
| **Mic + Tab** | Both combined | You + others in video call |

### Technical Approach

**Room Mode (Mobile + Desktop):**
- Standard MediaRecorder API
- Same as current voice input, but longer duration
- Max 2 hours with chunked recording

**Tab Audio Mode (Desktop Browser):**
```javascript
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: true,  // Required by API
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  }
});
// Extract audio track only
const audioTrack = stream.getAudioTracks()[0];
```

**User Flow:**
1. User clicks "Start Listening"
2. Mode selector: "Room" or "Video Call"
3. If Video Call → browser prompts to share tab
4. Recording indicator shows duration
5. User can add notes while listening (like Granola)
6. Click "Stop" → processing begins
7. Enhanced meeting note appears

### Recording UI

```
┌─────────────────────────────────────────┐
│                                         │
│          🔴 LISTENING                   │
│                                         │
│            45:23                        │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │ Add notes while listening...    │   │
│   │                                 │   │
│   │ - sarah mentioned Q2 concerns   │   │
│   │ - need to follow up on mobile   │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│         [ ⏹️ End & Enhance ]            │
│                                         │
└─────────────────────────────────────────┘
```

### Processing Pipeline

```
[Audio Recording]
      ↓
[Chunked Upload] → R2/Blob Storage
      ↓
[Whisper Transcription] → Full text
      ↓
[User Notes] → Combined context
      ↓
[Enhancement] → Structured meeting note
      ↓
[Background Processing] → Entities, embeddings, history
```

---

## Pillar 3: Meetings Tab

### Location
YOU tab → Meetings sub-tab (alongside existing sub-tabs)

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  YOU                                                         │
├──────────────────────────────────────────────────────────────┤
│  OVERVIEW  │  PEOPLE  │  MEETINGS  │  PATTERNS              │
│            │          │     ●      │                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search meetings or ask a question...               │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ASK ACROSS MEETINGS                                   │  │
│  │                                                        │  │
│  │  "What did Sarah say about the budget?"                │  │
│  │  "When did we last discuss the mobile project?"        │  │
│  │  "What action items do I have from this week?"         │  │
│  │                                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│  THIS WEEK                          [ + New Meeting ]        │
│  ─────────────────────────────────────────────────────────   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  1:1 with Sarah                          Jan 24     │     │
│  │  Roadmap, budget concerns, mobile blocked           │     │
│  │  2 action items                                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  Team Standup                            Jan 23     │     │
│  │  Sprint review, hiring update                       │     │
│  │  5 action items                                     │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  LAST WEEK                                                   │
│  ─────────────────────────────────────────────────────────   │
│  ...                                                         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Meeting Card Design

```css
.meeting-card {
  background: #FAFAFA;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 20px 24px;
  transition: border-color 200ms ease-out;
}

.meeting-card:hover {
  border-color: #000000;
}

.meeting-card-title {
  font-family: 'Inter', sans-serif;
  font-size: 16px;
  font-weight: 500;
  color: #1A1A1A;
}

.meeting-card-date {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #6B6B6B;
}

.meeting-card-summary {
  font-family: 'Inter', sans-serif;
  font-size: 14px;
  color: #6B6B6B;
  margin-top: 8px;
}

.meeting-card-meta {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  color: #6B6B6B;
  margin-top: 12px;
}
```

### Query Interface

**Search Box Behavior:**
- Typing triggers search across meeting titles, content, attendees
- Natural language questions trigger AI query
- Results show as cards or AI-generated answer

**AI Query Response:**

```
┌──────────────────────────────────────────────────────────────┐
│  Q: What did Sarah say about the budget?                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Sarah mentioned budget concerns in 2 recent meetings:       │
│                                                              │
│  • Jan 24 — "Q2 budget is tight, need to prioritize"        │
│    She suggested cutting the contractor spend first.         │
│                                                              │
│  • Jan 18 — "Budget approval delayed until Feb"              │
│    Waiting on finance team sign-off.                         │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                   │
│  │ View: Jan 24    │  │ View: Jan 18    │                   │
│  └─────────────────┘  └─────────────────┘                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Task Breakdown

### Week 1: Personal Notes Enhancement

| Task | Description | Priority |
|------|-------------|----------|
| TASK-015 | Personal note enhancement API | P0 |
| TASK-016 | Auto-enhance on save (background) | P0 |
| TASK-017 | Enhancement prompt v2.0 (subtle mode) | P0 |
| TASK-018 | Threads section (related notes) | P1 |

### Week 2: Ambient Listening

| Task | Description | Priority |
|------|-------------|----------|
| TASK-019 | Ambient recording UI | P0 |
| TASK-020 | Long audio recording (chunked) | P0 |
| TASK-021 | Tab audio capture (getDisplayMedia) | P0 |
| TASK-022 | Processing pipeline (upload → transcribe → enhance) | P0 |
| TASK-023 | Inline notes during recording | P1 |

### Week 3: Meetings Tab

| Task | Description | Priority |
|------|-------------|----------|
| TASK-024 | Meetings sub-tab UI | P0 |
| TASK-025 | Meeting cards list | P0 |
| TASK-026 | Search across meetings | P0 |
| TASK-027 | Query API (natural language) | P1 |
| TASK-028 | AI query response UI | P1 |

---

## API Specifications

### POST /api/enhance-note (Personal Notes)

```javascript
// Request
{
  "noteId": "uuid",
  "content": "raw note text",
  "noteType": "note|idea|reflection",
  "userId": "uuid"
}

// Response (SSE stream)
data: {"type":"metadata","noteType":"note","title":"..."}
data: {"type":"content","text":"enhanced text chunk"}
data: {"type":"threads","items":[{"text":"...","noteId":"..."}]}
data: {"type":"done","noteId":"...","processingTime":...}
```

### POST /api/transcribe-long-audio

```javascript
// Request (multipart)
{
  "audio": File,           // Audio chunk
  "chunkIndex": 0,
  "totalChunks": 5,
  "sessionId": "uuid",
  "userId": "uuid"
}

// Response
{
  "success": true,
  "transcript": "chunk transcription",
  "chunkIndex": 0,
  "processingTime": 2340
}
```

### GET /api/query-meetings

```javascript
// Request
?q=what did sarah say about budget&userId=uuid

// Response
{
  "type": "ai_answer",
  "answer": "Sarah mentioned budget concerns in 2 meetings...",
  "sources": [
    {"noteId": "uuid", "title": "1:1 with Sarah", "date": "Jan 24", "snippet": "..."},
    {"noteId": "uuid", "title": "Team Standup", "date": "Jan 18", "snippet": "..."}
  ],
  "processingTime": 1200
}
```

---

## Database Changes

### Modify: notes table

```sql
-- Add personal note enhancement tracking
ALTER TABLE notes 
ADD COLUMN IF NOT EXISTS auto_enhanced BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS enhancement_version VARCHAR(10);
```

### New: ambient_recordings table

```sql
CREATE TABLE ambient_recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  mode VARCHAR(20) NOT NULL, -- 'room' | 'tab_audio' | 'mic_and_tab'
  duration_seconds INTEGER,
  audio_url TEXT,
  transcript TEXT,
  user_notes TEXT, -- Notes added during recording
  status VARCHAR(20) DEFAULT 'recording', -- recording | processing | completed | failed
  note_id UUID REFERENCES notes(id), -- Link to generated meeting note
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_ambient_user ON ambient_recordings(user_id);
CREATE INDEX idx_ambient_status ON ambient_recordings(status);
```

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| Personal note enhancement | < 3s |
| Audio upload (per chunk) | < 2s |
| Long audio transcription (per minute) | < 5s |
| Meeting query response | < 2s |
| Meetings tab load | < 500ms |

---

## Quality Checklist (from Design System)

- [ ] Does it feel like a SoHo design magazine editorial?
- [ ] Are touch targets ≥44px?
- [ ] Is black used ONLY for primary buttons/actions?
- [ ] Are all transitions 200ms ease-out?
- [ ] Loading states use shimmer, not spinners?
- [ ] 1px borders only?
- [ ] Would a minimalist agency approve this?

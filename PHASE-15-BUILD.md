# PHASE 15: Experience Transformation Build

## Master Prompt for Claude Code

**Version:** 1.1.0 (Critical Fixes Applied)
**Created:** January 23, 2026
**Updated:** January 24, 2026
**Build Target:** 3 High-Impact Features
**Task List ID:** `phase15-experience-transform`

---

# CRITICAL FIXES APPLIED

| Fix | Description | Status |
|-----|-------------|--------|
| FIX 1 | Add RLS Policies Task (#0) | ✅ Applied |
| FIX 2 | Fix Whispers Table Schema (E2E encryption) | ✅ Applied |
| FIX 3 | Remove Voice from Whispers V1 (text-only) | ✅ Applied |
| FIX 4 | Split Task #5 (state-of-you.js) into 5a-e | ✅ Applied |
| FIX 5 | Add Empty States Task (#13.5) | ✅ Applied |
| FIX 6 | Add Timezone Column | ✅ Applied |
| FIX 7 | Add Analytics Task (#30) | ✅ Applied |
| FIX 8 | Memory Moments = Overlay/Drawer | ✅ Applied |

---

# PHASE 15 BUILD INSTRUCTIONS

## Overview

You are building Phase 15 of Inscript — three high-impact features designed to multiply user value by making accumulated knowledge visible and reducing friction.

**The Three Features:**

| # | Feature | Impact | Primary Owner |
|---|---------|--------|---------------|
| 1 | Monthly "State of You" Report | 10X | Terminal 1 (Backend) + Terminal 2 (Frontend) |
| 2 | Quick Capture Mode ("Whispers") | 5X | Terminal 2 (Frontend) + Terminal 1 (Backend) |
| 3 | Proactive Memory Surfacing | 10X | Terminal 1 (Backend) + Terminal 2 (Frontend) |

---

## CRITICAL: Terminal Ownership Rules

To prevent code conflicts and backward progress, each terminal owns specific files. **NEVER edit files owned by the other terminal.**

### Terminal 1 (Backend) — Owns:

```
api/
├── state-of-you.js          ← NEW: Monthly report generation
├── whisper.js               ← NEW: Quick capture processing
├── memory-moments.js        ← NEW: Proactive surfacing logic
├── cron/
│   ├── monthly-report.js    ← NEW: Cron for monthly reports
│   └── memory-moments.js    ← NEW: Cron for proactive surfacing
└── (existing api/*.js files for modifications)

Database migrations (Supabase)
├── user_reports table
├── whispers table
├── memory_moments table
└── user_notification_preferences table
```

### Terminal 2 (Frontend) — Owns:

```
js/
├── state-of-you-ui.js       ← NEW: Report display UI
├── whisper-ui.js            ← NEW: Quick capture UI
├── memory-moments-ui.js     ← NEW: Proactive surfacing UI
├── notifications.js         ← NEW: Notification handling
└── (modifications to existing ui.js, app.js for integration points only)

css/
├── state-of-you.css         ← NEW
├── whisper.css              ← NEW
└── memory-moments.css       ← NEW

index.html (for new UI sections)
```

### Shared Files (Coordinate Before Editing):

```
js/app.js          ← Only add imports/initialization
js/ui.js           ← Only add integration hooks (mark with // PHASE 15)
index.html         ← Only add new sections (mark with <!-- PHASE 15 -->)
```

**Rule:** If you need to modify a shared file, add a comment with your terminal number and feature name. Example:
```javascript
// PHASE 15 - T1 - State of You: Initialize report fetching
// PHASE 15 - T2 - Whispers: Add quick capture button
```

---

## STEP 1: Documentation Updates (Run First)

Before writing any code, update all documentation files to reflect Phase 15 goals.

### Files to Update:

1. **`CLAUDE.md`** — Add Phase 15 section with file ownership rules
2. **`docs/STATUS.md`** — Update current status to "Phase 15: Experience Transformation"
3. **`docs/PRD.md`** — Add feature specifications for the 3 new features
4. **`docs/ROADMAP.md`** — Update roadmap with Phase 15 details

### Documentation Update Checklist:

```markdown
- [ ] CLAUDE.md: Add Phase 15 section
- [ ] CLAUDE.md: Add new file references
- [ ] CLAUDE.md: Add terminal ownership rules
- [ ] STATUS.md: Update to Phase 15
- [ ] STATUS.md: Add Phase 15 task breakdown
- [ ] PRD.md: Add State of You spec
- [ ] PRD.md: Add Whispers spec
- [ ] PRD.md: Add Memory Moments spec
- [ ] ROADMAP.md: Update Phase 15 details
```

---

## STEP 2: Database Schema Setup (Terminal 1 First)

### ⚠️ CRITICAL: Task #0 - RLS Policies First

**Before creating ANY table, add RLS policies:**

```sql
-- Enable RLS on all new tables
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policy for user_reports
CREATE POLICY "Users can only access own reports"
ON user_reports FOR ALL
USING (auth.uid() = user_id);

-- RLS Policy for whispers
CREATE POLICY "Users can only access own whispers"
ON whispers FOR ALL
USING (auth.uid() = user_id);

-- RLS Policy for memory_moments
CREATE POLICY "Users can only access own moments"
ON memory_moments FOR ALL
USING (auth.uid() = user_id);

-- RLS Policy for user_notification_preferences
CREATE POLICY "Users can only access own preferences"
ON user_notification_preferences FOR ALL
USING (auth.uid() = user_id);
```

### New Tables Required:

```sql
-- 1. Monthly Reports
CREATE TABLE user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,  -- First day of the month
  report_data JSONB NOT NULL,  -- Full report content
  generated_at TIMESTAMP DEFAULT NOW(),
  viewed_at TIMESTAMP,
  UNIQUE(user_id, report_month)
);

-- 2. Whispers (Quick Capture) - FIX 2: E2E Encrypted, No plaintext content
CREATE TABLE whispers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,  -- E2E encrypted content (NO plaintext)
  iv TEXT NOT NULL,                  -- Initialization vector for decryption
  source TEXT DEFAULT 'text',        -- FIX 3: V1 is text-only
  processed BOOLEAN DEFAULT FALSE,
  entities_extracted JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Memory Moments (Proactive Surfacing)
CREATE TABLE memory_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_type TEXT NOT NULL,  -- 'anniversary', 'dormant_entity', 'progress', 'pattern'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_entity_id UUID REFERENCES user_entities(id),
  related_note_ids UUID[],
  priority INTEGER DEFAULT 5,  -- 1-10, higher = more important
  shown_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  engaged_at TIMESTAMP,  -- User clicked/interacted
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Notification Preferences - FIX 6: Added timezone
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  timezone TEXT DEFAULT 'UTC',  -- FIX 6: Infer from browser on first visit
  memory_moments_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_day INTEGER DEFAULT 1,  -- Day of month to send
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_reports_user_month ON user_reports(user_id, report_month);
CREATE INDEX idx_whispers_user_processed ON whispers(user_id, processed);
CREATE INDEX idx_memory_moments_user_shown ON memory_moments(user_id, shown_at);
CREATE INDEX idx_memory_moments_priority ON memory_moments(user_id, priority DESC);
```

---

## STEP 3: Feature Specifications

### Feature 1: Monthly "State of You" Report

**Purpose:** Auto-generated monthly digest that synthesizes patterns, trends, and insights.

**API Endpoint:** `POST /api/state-of-you`

**Report Structure:**
```json
{
  "month": "2026-01",
  "themes": [
    { "name": "Work transition", "mentions": 12, "trend": "up" },
    { "name": "Health focus", "mentions": 8, "trend": "stable" }
  ],
  "people": [
    { "name": "Marcus", "mentions": 9, "change": 2, "sentiment": 0.65 },
    { "name": "Sarah", "mentions": 4, "change": -1, "sentiment": 0.42 }
  ],
  "sentiment_trajectory": {
    "work": { "start": 0.42, "end": 0.61, "trend": "improving" },
    "health": { "start": 0.35, "end": 0.55, "trend": "improving" }
  },
  "patterns_detected": [
    "You write about work decisions on Sundays",
    "Marcus appears when you're processing uncertainty"
  ],
  "reflection_question": "You mentioned 'should' 23 times this month. Whose expectations are you carrying?",
  "stats": {
    "notes_count": 47,
    "whispers_count": 23,
    "entities_learned": 5,
    "streak_days": 18
  }
}
```

**UI Components:**
- Full-page report view (modal or dedicated route)
- Report history list
- Share capability (privacy-preserving summary only)

**Backend Tasks (FIX 4: Split into 5a-e):**
1. **Task 5a:** Report data aggregation (query notes, entities)
2. **Task 5b:** Sentiment calculation
3. **Task 5c:** Pattern detection for reports
4. **Task 5d:** LLM reflection question generation
5. **Task 5e:** Report storage and retrieval API
6. Create `/api/cron/monthly-report.js` — Scheduled generation

**Frontend Tasks:**
1. Create `js/state-of-you-ui.js` — Report display
2. Create `css/state-of-you.css` — Report styling
3. Add "Reports" section to TWIN tab
4. Add notification for new report

---

### Feature 2: Quick Capture Mode ("Whispers")

**Purpose:** Frictionless capture without triggering full reflection.

**⚠️ FIX 3: V1 is TEXT-ONLY (Voice is Phase 15.5)**

**UX Flow:**
1. User swipes left on input OR taps whisper icon
2. Minimal UI appears (just input + send)
3. Content saved (E2E encrypted), entities extracted in background
4. Simple "✓ Heard" confirmation
5. Optional: "Reflect on this later" queue

**API Endpoint:** `POST /api/whisper`

**Request:**
```json
{
  "content_encrypted": "base64-encrypted-string",
  "iv": "base64-initialization-vector"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "saved",
  "entities_detected": ["Marcus"],
  "queued_for_reflection": false
}
```

**Backend Tasks:**
1. Create `/api/whisper.js` — Quick save + background entity extraction
2. Modify entity extraction to work with whispers
3. Add whisper aggregation for monthly reports

**Frontend Tasks:**
1. Create `js/whisper-ui.js` — Quick capture UI (text-only)
2. Create `css/whisper.css` — Minimal styling
3. Add whisper input mode to NOTES tab
4. Add whisper history view (collapsible)
5. Add "Reflect on whispers" batch mode

---

### Feature 3: Proactive Memory Surfacing ("Memory Moments")

**Purpose:** Transform Inscript from reactive to proactive companion.

**⚠️ FIX 8: Memory Moments Surface = Overlay/Drawer (not section)**
- Triggered by icon tap in NOTES tab
- Non-intrusive, dismissible overlay/drawer
- Does NOT take permanent space in NOTES tab

**Moment Types:**

| Type | Trigger | Example |
|------|---------|---------|
| `anniversary` | Date from notes + 1 year | "This time last year, you were stressed about the reorg" |
| `dormant_entity` | Key person not mentioned in 21+ days | "It's been 3 weeks since you mentioned Marcus" |
| `progress` | Sentiment improvement detected | "You mentioned imposter syndrome 8x in Oct, only 1x in Nov" |
| `pattern` | Pattern threshold reached | "Sunday stress is becoming a pattern — 4 weeks in a row" |
| `callback` | Related to recent note | "This connects to what you shared about [X] last week" |

**API Endpoints:**

`GET /api/memory-moments` — Fetch pending moments
```json
{
  "moments": [
    {
      "id": "uuid",
      "type": "dormant_entity",
      "title": "Checking in on Marcus",
      "content": "It's been 3 weeks since you mentioned Marcus. Everything okay there?",
      "priority": 7,
      "related_entity": { "name": "Marcus", "relationship": "close friend" },
      "created_at": "2026-01-23T10:00:00Z"
    }
  ]
}
```

`POST /api/memory-moments/:id/engage` — User interacted
`POST /api/memory-moments/:id/dismiss` — User dismissed

**Cron Job:** `/api/cron/memory-moments.js`
- Runs daily at 9 AM user local time
- Generates new moments based on triggers
- Respects quiet hours

**Backend Tasks:**
1. Create `/api/memory-moments.js` — Moment generation logic
2. Create `/api/cron/memory-moments.js` — Scheduled generation
3. Add moment triggers for each type
4. Add engagement tracking

**Frontend Tasks:**
1. Create `js/memory-moments-ui.js` — Overlay/drawer display
2. Create `css/memory-moments.css` — Moment styling
3. Add "Moments" icon trigger to NOTES tab
4. Add notification badge for pending moments
5. Add moment interaction (engage/dismiss)

---

## FIX 5: Empty States (Task #13.5)

All new features must have graceful empty states:

| Feature | Empty State Message |
|---------|---------------------|
| State of You | "Keep writing, insights coming after 5+ notes" |
| Memory Moments | "Moments appear after 14+ days of notes" |
| Whispers | "Your whispers will appear here" |

**Implementation:**
- Each UI component must check for empty data
- Display friendly, encouraging message
- Use editorial typography (Cormorant Garamond italic)
- No error states for "no data yet"

---

## FIX 7: Analytics Events (Task #30)

Track these events for product analytics:

| Event | Trigger | Properties |
|-------|---------|------------|
| `report_viewed` | User opens State of You report | `{ month, time_on_page }` |
| `report_shared` | User shares report | `{ month, share_method }` |
| `whisper_created` | User saves whisper | `{ source: 'text' }` |
| `whisper_reflected` | User reflects on whispers | `{ whisper_count }` |
| `moment_engaged` | User engages with moment | `{ moment_type, priority }` |
| `moment_dismissed` | User dismisses moment | `{ moment_type, priority }` |

**Implementation:**
- Create `/api/analytics.js` for event tracking
- Frontend calls analytics API on each event
- Respect user privacy (no PII in events)

---

## STEP 4: Revised Task Structure

### Task List Setup

```bash
# Set shared task list for both terminals
export CLAUDE_CODE_TASK_LIST_ID=phase15-experience-transform
```

### REVISED Task Hierarchy (All Fixes Applied)

```
PHASE 15: Experience Transformation
│
├── Task #0: Add RLS Policies to All New Tables [T1] ⚠️ MUST BE FIRST
│
├── EPIC 1: Documentation Updates
│   ├── Task 1.1: Update CLAUDE.md [T1]
│   ├── Task 1.2: Update STATUS.md [T1]
│   ├── Task 1.3: Update PRD.md [T1]
│   └── Task 1.4: Update ROADMAP.md [T1]
│
├── EPIC 2: Database Setup
│   ├── Task 2.1: Create user_reports table [T1]
│   │   └── blockedBy: [0]
│   ├── Task 2.2: Create whispers table (E2E encrypted, no voice) [T1]
│   │   └── blockedBy: [0]
│   ├── Task 2.3: Create memory_moments table [T1]
│   │   └── blockedBy: [0]
│   └── Task 2.4: Create notification_preferences table (with timezone) [T1]
│       └── blockedBy: [0]
│
├── EPIC 3: State of You (Monthly Report)
│   ├── Task 5a: Report data aggregation [T1]
│   │   └── blockedBy: [2.1]
│   ├── Task 5b: Sentiment calculation [T1]
│   │   └── blockedBy: [5a]
│   ├── Task 5c: Pattern detection for reports [T1]
│   │   └── blockedBy: [5a]
│   ├── Task 5d: LLM reflection question generation [T1]
│   │   └── blockedBy: [5b, 5c]
│   ├── Task 5e: Report storage and retrieval API [T1]
│   │   └── blockedBy: [5d]
│   ├── Task 3.2: Create api/cron/monthly-report.js [T1]
│   │   └── blockedBy: [5e]
│   ├── Task 3.3: Create js/state-of-you-ui.js [T2]
│   │   └── blockedBy: [5e]
│   ├── Task 3.4: Create css/state-of-you.css [T2]
│   ├── Task 3.5: Integrate into TWIN tab [T2]
│   │   └── blockedBy: [3.3, 3.4]
│   └── Task 3.6: Add report notification [T2]
│       └── blockedBy: [3.5]
│
├── EPIC 4: Whispers (Quick Capture - TEXT ONLY)
│   ├── Task 4.1: Create api/whisper.js (E2E encrypted) [T1]
│   │   └── blockedBy: [2.2]
│   ├── Task 4.2: Create js/whisper-ui.js (text-only) [T2]
│   │   └── blockedBy: [4.1]
│   ├── Task 4.3: Create css/whisper.css [T2]
│   ├── Task 4.4: Add whisper input mode [T2]
│   │   └── blockedBy: [4.2, 4.3]
│   ├── Task 4.5: Add whisper history view [T2]
│   │   └── blockedBy: [4.4]
│   └── Task 4.6: Add batch reflection mode [T2]
│       └── blockedBy: [4.5]
│
├── EPIC 5: Memory Moments (Proactive Surfacing)
│   ├── Task 5.1: Create api/memory-moments.js [T1]
│   │   └── blockedBy: [2.3]
│   ├── Task 5.2: Create api/cron/memory-moments.js [T1]
│   │   └── blockedBy: [5.1]
│   ├── Task 5.3: Implement anniversary triggers [T1]
│   │   └── blockedBy: [5.1]
│   ├── Task 5.4: Implement dormant entity triggers [T1]
│   │   └── blockedBy: [5.1]
│   ├── Task 5.5: Implement progress triggers [T1]
│   │   └── blockedBy: [5.1]
│   ├── Task 5.6: Create js/memory-moments-ui.js (overlay/drawer) [T2]
│   │   └── blockedBy: [5.1]
│   ├── Task 5.7: Create css/memory-moments.css [T2]
│   ├── Task 5.8: Add moments overlay trigger to NOTES tab [T2]
│   │   └── blockedBy: [5.6, 5.7]
│   └── Task 5.9: Add engagement tracking UI [T2]
│       └── blockedBy: [5.8]
│
├── Task #13.5: Define Empty State UI [T2]
│   └── blockedBy: [3.3, 4.2, 5.6]
│
├── EPIC 6: Integration & Testing
│   ├── Task 6.1: Integration testing - State of You [T1+T2]
│   │   └── blockedBy: [3.6]
│   ├── Task 6.2: Integration testing - Whispers [T1+T2]
│   │   └── blockedBy: [4.6]
│   ├── Task 6.3: Integration testing - Memory Moments [T1+T2]
│   │   └── blockedBy: [5.9]
│   └── Task 6.4: Deploy to production [T1]
│       └── blockedBy: [6.1, 6.2, 6.3]
│
└── Task #30: Add Analytics Events [T1+T2]
    └── blockedBy: [6.4]
```

---

## STEP 5: Terminal-Specific Prompts

### Terminal 1 Prompt (Backend)

```
You are Terminal 1 (Backend) for Inscript Phase 15 build.

TASK LIST ID: phase15-experience-transform

YOUR OWNERSHIP:
- All files in api/ directory
- Database migrations
- Cron jobs
- Backend logic

YOU MUST NOT EDIT:
- js/*.js (except adding exports if needed)
- css/*.css
- index.html (UI sections)

CRITICAL FIXES TO REMEMBER:
- FIX 1: Add RLS policies BEFORE creating any table
- FIX 2: Whispers table uses content_encrypted + iv (NO plaintext content)
- FIX 3: Whispers V1 is text-only (no voice)
- FIX 4: state-of-you.js is split into 5a-e subtasks
- FIX 6: notification_preferences has timezone column

WORKFLOW:
1. Check TaskList for your next available task
2. Mark task as in_progress before starting
3. Complete the task
4. Mark task as completed
5. Check if any blocked tasks are now unblocked
6. Repeat

START BY:
1. Task #0: Add RLS policies to all new tables
2. Then Epic 2: Create database tables
3. Then Epic 3-5 backend tasks

CRITICAL RULES:
- Always check blockedBy before starting a task
- Commit after each completed task with message: "T1: [task description]"
- If you need frontend integration, create a clear interface and document it
- Never modify files owned by Terminal 2
```

### Terminal 2 Prompt (Frontend)

```
You are Terminal 2 (Frontend) for Inscript Phase 15 build.

TASK LIST ID: phase15-experience-transform

YOUR OWNERSHIP:
- All new js/*.js files for Phase 15 features
- All new css/*.css files for Phase 15 features
- UI components and interactions
- index.html UI sections

YOU MUST NOT EDIT:
- api/*.js
- Database schemas
- Cron jobs

CRITICAL FIXES TO REMEMBER:
- FIX 3: Whispers V1 is text-only (no voice input)
- FIX 5: Must implement empty states for all features
- FIX 8: Memory Moments is an overlay/drawer, NOT a section

EMPTY STATES TO IMPLEMENT:
- State of You: "Keep writing, insights coming after 5+ notes"
- Memory Moments: "Moments appear after 14+ days of notes"
- Whispers: "Your whispers will appear here"

WORKFLOW:
1. Check TaskList for your next available task
2. Mark task as in_progress before starting
3. Complete the task
4. Mark task as completed
5. Check if any blocked tasks are now unblocked
6. Repeat

START BY:
1. Reading PHASE-15-BUILD.md for full context
2. Calling TaskList to see available tasks
3. Wait for backend tasks to complete before starting dependent frontend tasks

CRITICAL RULES:
- Always check blockedBy before starting a task
- Commit after each completed task with message: "T2: [task description]"
- Consume APIs created by Terminal 1 (check api/ for interfaces)
- Never modify files owned by Terminal 1
- Follow the existing design system (black, white, silver, editorial typography)
```

---

## STEP 6: API Interface Contracts

To ensure Terminal 1 and Terminal 2 can work independently, these are the agreed-upon API interfaces:

### State of You API

```javascript
// GET /api/state-of-you?month=2026-01
// Response: { report: ReportObject, generated: boolean }

// POST /api/state-of-you/generate
// Triggers report generation for current month
// Response: { report: ReportObject }
```

### Whisper API (FIX 2: E2E Encrypted)

```javascript
// POST /api/whisper
// Body: { content_encrypted: string, iv: string }  // NO plaintext content
// Response: { id: string, status: 'saved', entities_detected: string[] }

// GET /api/whispers?limit=50&offset=0
// Response: { whispers: WhisperObject[], total: number }

// POST /api/whispers/reflect
// Body: { whisper_ids: string[] }
// Triggers reflection on selected whispers
// Response: { note_id: string, reflection: string }
```

### Memory Moments API

```javascript
// GET /api/memory-moments?status=pending
// Response: { moments: MomentObject[] }

// POST /api/memory-moments/:id/engage
// Response: { success: true }

// POST /api/memory-moments/:id/dismiss
// Response: { success: true }

// GET /api/memory-moments/preferences
// Response: { preferences: PreferencesObject }

// PUT /api/memory-moments/preferences
// Body: PreferencesObject (includes timezone)
// Response: { preferences: PreferencesObject }
```

### Analytics API (FIX 7)

```javascript
// POST /api/analytics
// Body: { event: string, properties: object }
// Response: { success: true }

// Events: report_viewed, report_shared, whisper_created,
//         whisper_reflected, moment_engaged, moment_dismissed
```

---

## Success Criteria

### Feature 1: State of You
- [ ] Report generates correctly for any given month
- [ ] Report displays in TWIN tab
- [ ] Report includes all required sections (themes, people, sentiment, patterns, question)
- [ ] Historical reports accessible
- [ ] Monthly cron generates report on schedule
- [ ] Empty state shows for users with <5 notes

### Feature 2: Whispers
- [ ] Quick capture mode accessible from NOTES tab
- [ ] Whispers save without triggering reflection (E2E encrypted)
- [ ] Entities extracted from whispers
- [ ] Whisper history viewable
- [ ] Batch reflection works on selected whispers
- [ ] Text-only in V1 (no voice)
- [ ] Empty state shows for users with no whispers

### Feature 3: Memory Moments
- [ ] Moments generate based on triggers
- [ ] Moments display in overlay/drawer (not section)
- [ ] Engage/dismiss actions work
- [ ] Engagement tracked
- [ ] Preferences respected (quiet hours, enabled/disabled, timezone)
- [ ] Empty state shows for users with <14 days of notes

### Analytics (FIX 7)
- [ ] All events tracked correctly
- [ ] No PII in event data

---

## Git Commit Convention

All commits should follow this format:

```
T[1|2]: [Feature] - [Description]

Examples:
T1: State of You - Create report generation API
T2: Whispers - Add quick capture UI component
T1: Memory Moments - Implement dormant entity triggers
T2: State of You - Integrate report into TWIN tab
```

---

## Dependency Graph (Visual)

```
Task #0 (RLS Policies)
    │
    ├──► Task 2.1 (user_reports) ──► Task 5a-e ──► Task 3.2 ──► Task 3.3-3.6
    │
    ├──► Task 2.2 (whispers) ──► Task 4.1 ──► Task 4.2-4.6
    │
    ├──► Task 2.3 (memory_moments) ──► Task 5.1-5.5 ──► Task 5.6-5.9
    │
    └──► Task 2.4 (preferences)
                                                    │
                                                    ▼
                                            Task #13.5 (Empty States)
                                                    │
                                                    ▼
                                            Task 6.1-6.4 (Integration)
                                                    │
                                                    ▼
                                            Task #30 (Analytics)
```

---

## Getting Started Checklist

1. [ ] Both terminals read this document
2. [ ] Set `CLAUDE_CODE_TASK_LIST_ID=phase15-experience-transform`
3. [ ] Terminal 1: Start with Task #0 (RLS Policies)
4. [ ] Terminal 1: Then Epic 2 (Database tables)
5. [ ] Terminal 2: Wait for Epic 2 completion, then start frontend tasks
6. [ ] Both terminals: Check TaskList before starting any work
7. [ ] Both terminals: Mark tasks in_progress before starting
8. [ ] Both terminals: Commit after each completed task

---

*Phase 15 Build Document*
*Version: 1.1.0 (Critical Fixes Applied)*
*Created: January 23, 2026*
*Updated: January 24, 2026*
*Task List ID: phase15-experience-transform*

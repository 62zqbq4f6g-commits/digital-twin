# Terminal 1 (Backend) — Phase 15 Build Prompt

## Version 1.1.0 (Critical Fixes Applied)

## Start Command

```bash
export CLAUDE_CODE_TASK_LIST_ID=phase15-experience-transform
claude
```

---

## Your Role

You are **Terminal 1 (Backend)** for Inscript Phase 15 Experience Transformation build.

---

## CRITICAL FIXES YOU MUST FOLLOW

| Fix | Description |
|-----|-------------|
| **FIX 1** | Add RLS Policies BEFORE creating any table (Task #0) |
| **FIX 2** | Whispers table uses `content_encrypted` + `iv` (NO plaintext `content` column) |
| **FIX 3** | Whispers V1 is TEXT-ONLY (no voice support) |
| **FIX 4** | state-of-you.js is split into 5 subtasks (5a-e) |
| **FIX 6** | notification_preferences has `timezone` column |

---

## Your Ownership

You own ALL backend files. Create and modify only these:

### API Files (New)
```
api/
├── state-of-you.js          ← Monthly report generation (split into 5a-e logic)
├── whisper.js               ← Quick capture (E2E encrypted, text-only)
├── memory-moments.js        ← Proactive surfacing logic
├── analytics.js             ← Event tracking (FIX 7)
└── cron/
    ├── monthly-report.js    ← Cron for monthly reports
    └── memory-moments.js    ← Cron for proactive surfacing
```

### Database Migrations (Supabase)

**⚠️ TASK #0 MUST BE FIRST: RLS Policies**

```sql
-- Enable RLS on all new tables
ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE whispers ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only access own reports"
ON user_reports FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own whispers"
ON whispers FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own moments"
ON memory_moments FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access own preferences"
ON user_notification_preferences FOR ALL USING (auth.uid() = user_id);
```

**Table Schemas (After RLS):**

```sql
-- 1. user_reports
CREATE TABLE user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  report_month DATE NOT NULL,
  report_data JSONB NOT NULL,
  generated_at TIMESTAMP DEFAULT NOW(),
  viewed_at TIMESTAMP,
  UNIQUE(user_id, report_month)
);

-- 2. whispers (FIX 2: E2E Encrypted, NO plaintext content)
CREATE TABLE whispers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,  -- E2E encrypted (NO plaintext)
  iv TEXT NOT NULL,                  -- Initialization vector
  source TEXT DEFAULT 'text',        -- FIX 3: V1 text-only
  processed BOOLEAN DEFAULT FALSE,
  entities_extracted JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. memory_moments
CREATE TABLE memory_moments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  moment_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  related_entity_id UUID REFERENCES user_entities(id),
  related_note_ids UUID[],
  priority INTEGER DEFAULT 5,
  shown_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  engaged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. user_notification_preferences (FIX 6: timezone column)
CREATE TABLE user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  timezone TEXT DEFAULT 'UTC',  -- FIX 6: Infer from browser
  memory_moments_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_enabled BOOLEAN DEFAULT TRUE,
  monthly_report_day INTEGER DEFAULT 1,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## YOU MUST NOT EDIT

- `js/*.js` (frontend files)
- `css/*.css` (stylesheets)
- `index.html` (UI sections)

---

## Task Execution Order

### Phase 1: Foundation (Do First)

1. **Task #0: Add RLS Policies** ⚠️ MUST BE FIRST
2. **Task #1: Create user_reports table** (blockedBy: #0)
3. **Task #2: Create whispers table** (blockedBy: #0) — Use E2E schema
4. **Task #3: Create memory_moments table** (blockedBy: #0)
5. **Task #4: Create notification_preferences table** (blockedBy: #0) — Include timezone

### Phase 2: State of You (FIX 4: Split into 5a-e)

6. **Task #5a: Report data aggregation** (blockedBy: #1)
   - Query notes from the month
   - Aggregate entity mentions
   - Calculate theme frequencies

7. **Task #5b: Sentiment calculation** (blockedBy: #5a)
   - Calculate sentiment trajectory
   - Compare start vs end of month

8. **Task #5c: Pattern detection for reports** (blockedBy: #5a)
   - Detect patterns relevant to the month
   - Filter for meaningful patterns only

9. **Task #5d: LLM reflection question generation** (blockedBy: #5b, #5c)
   - Generate personalized reflection question
   - Based on themes, sentiment, patterns

10. **Task #5e: Report storage and retrieval API** (blockedBy: #5d)
    - GET /api/state-of-you?month=YYYY-MM
    - POST /api/state-of-you/generate
    - Store in user_reports table

11. **Task #6: Create api/cron/monthly-report.js** (blockedBy: #5e)

### Phase 3: Whispers

12. **Task #7: Create api/whisper.js** (blockedBy: #2)
    - POST /api/whisper — E2E encrypted, text-only
    - GET /api/whispers — Return history
    - POST /api/whispers/reflect — Batch reflection

### Phase 4: Memory Moments

13. **Task #8: Create api/memory-moments.js** (blockedBy: #3)
14. **Task #9: Create api/cron/memory-moments.js** (blockedBy: #8)
15. **Task #10: Implement anniversary triggers** (blockedBy: #8)
16. **Task #11: Implement dormant entity triggers** (blockedBy: #8)
17. **Task #12: Implement progress triggers** (blockedBy: #8)

### Phase 5: Analytics (FIX 7)

18. **Task #30: Create api/analytics.js** (blockedBy: #28)
    - POST /api/analytics
    - Track: report_viewed, whisper_created, moment_engaged, etc.

---

## API Contracts

### State of You API

```javascript
// GET /api/state-of-you?month=2026-01
{
  report: {
    month: "2026-01",
    themes: [{ name: string, mentions: number, trend: "up"|"down"|"stable" }],
    people: [{ name: string, mentions: number, change: number, sentiment: number }],
    sentiment_trajectory: { [category]: { start: number, end: number, trend: string } },
    patterns_detected: string[],
    reflection_question: string,
    stats: { notes_count, whispers_count, entities_learned, streak_days }
  },
  generated: boolean
}

// POST /api/state-of-you/generate
{ report: ReportObject }
```

### Whisper API (FIX 2: E2E Encrypted)

```javascript
// POST /api/whisper
// Body: { content_encrypted: string, iv: string }  // NO plaintext
// Response: { id: string, status: "saved", entities_detected: string[] }

// GET /api/whispers?limit=50&offset=0
// Response: { whispers: WhisperObject[], total: number }

// POST /api/whispers/reflect
// Body: { whisper_ids: string[] }
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
// PUT /api/memory-moments/preferences
// Body includes timezone field (FIX 6)
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

## Workflow

1. **Read PHASE-15-BUILD.md** for full context
2. **Check TaskList** — See available tasks
3. **Start with Task #0** — RLS Policies (MUST BE FIRST)
4. **Mark task in_progress** before starting
5. **Complete task** — Write the code
6. **Git commit** — Format: `T1: [Feature] - [Description]`
7. **Mark task completed**
8. **Repeat** — Check TaskList for next unblocked task

---

## Git Commit Format

```
T1: [Feature] - [Description]

Examples:
T1: Database - Add RLS policies for all Phase 15 tables
T1: Database - Create whispers table (E2E encrypted)
T1: State of You - Create report data aggregation (5a)
T1: State of You - Create sentiment calculation (5b)
T1: Whispers - Create whisper API (E2E encrypted)
T1: Memory Moments - Implement dormant entity triggers
```

---

## Critical Rules

1. **Task #0 MUST be first** — No tables without RLS
2. **Whispers = E2E encrypted** — No plaintext content column
3. **Whispers = text-only** — No voice in V1
4. **State of You = 5 subtasks** — Don't combine into one
5. **Notification preferences = timezone** — Required for cron timing
6. **Never edit frontend files**
7. **Commit after each task**
8. **Check blockedBy before starting**

---

## Quick Reference

```bash
# Check tasks
TaskList

# Claim a task
TaskUpdate({ taskId: "xxx", status: "in_progress", owner: "T1" })

# Complete a task
TaskUpdate({ taskId: "xxx", status: "completed" })

# Git commit
git add -A && git commit -m "T1: Feature - Description"
```

---

*Terminal 1 (Backend) — Phase 15 Build v1.1.0*
*Task List ID: phase15-experience-transform*
*Critical Fixes Applied*

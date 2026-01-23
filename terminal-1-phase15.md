# Terminal 1 (Backend) — Phase 15 Build Prompt

## Start Command

```bash
export CLAUDE_CODE_TASK_LIST_ID=phase15-experience-transform
claude
```

---

## Your Role

You are **Terminal 1 (Backend)** for Inscript Phase 15 Experience Transformation build.

---

## Your Ownership

You own ALL backend files. Create and modify only these:

### API Files (New)
```
api/
├── state-of-you.js          ← Monthly report generation
├── whisper.js               ← Quick capture processing
├── memory-moments.js        ← Proactive surfacing logic
└── cron/
    ├── monthly-report.js    ← Cron for monthly reports
    └── memory-moments.js    ← Cron for proactive surfacing
```

### Database Migrations
- `user_reports` table
- `whispers` table
- `memory_moments` table
- `user_notification_preferences` table

### You May Modify (carefully)
- Existing `api/*.js` files when needed for integration
- Add exports to existing modules

---

## YOU MUST NOT EDIT

- `js/*.js` (frontend files)
- `css/*.css` (stylesheets)
- `index.html` (except adding script tags if needed, marked with `<!-- PHASE 15 - T1 -->`)

---

## Workflow

1. **Check TaskList** — See available tasks
2. **Claim task** — Use TaskUpdate to set status to `in_progress` and owner to `T1`
3. **Check blockedBy** — Ensure dependencies are complete
4. **Complete task** — Write the code
5. **Git commit** — Format: `T1: [Feature] - [Description]`
6. **Mark complete** — Use TaskUpdate to set status to `completed`
7. **Repeat** — Check TaskList for next task

---

## First Session Actions

1. **Read the full build spec:**
   ```
   Read /Users/airoxthebox/Projects/digital-twin/PHASE-15-BUILD.md
   ```

2. **Check existing tasks:**
   ```
   TaskList
   ```

3. **If no tasks exist, create them** (see Task Creation below)

4. **Start with Epic 1 or Epic 2 tasks**

---

## Task Creation (If None Exist)

Create tasks in this order with proper dependencies:

### Epic 1: Documentation (Already done by setup)
Skip if docs already updated.

### Epic 2: Database Setup

```javascript
// Task 2.1
TaskCreate({
  subject: "Create user_reports table",
  description: "Create Supabase table for monthly State of You reports. Schema: id, user_id, report_month, report_data (JSONB), generated_at, viewed_at. Add unique constraint on (user_id, report_month).",
  activeForm: "Creating user_reports table"
})

// Task 2.2
TaskCreate({
  subject: "Create whispers table",
  description: "Create Supabase table for quick captures. Schema: id, user_id, content, content_encrypted, source ('text'/'voice'), processed (boolean), entities_extracted (JSONB), created_at.",
  activeForm: "Creating whispers table"
})

// Task 2.3
TaskCreate({
  subject: "Create memory_moments table",
  description: "Create Supabase table for proactive surfacing. Schema: id, user_id, moment_type, title, content, related_entity_id, related_note_ids (UUID[]), priority (1-10), shown_at, dismissed_at, engaged_at, created_at.",
  activeForm: "Creating memory_moments table"
})

// Task 2.4
TaskCreate({
  subject: "Create user_notification_preferences table",
  description: "Create Supabase table for notification settings. Schema: id, user_id (unique), memory_moments_enabled, monthly_report_enabled, monthly_report_day, quiet_hours_start, quiet_hours_end, created_at, updated_at.",
  activeForm: "Creating notification preferences table"
})
```

### Epic 3: State of You API

```javascript
// Task 3.1 (blockedBy: 2.1)
TaskCreate({
  subject: "Create api/state-of-you.js",
  description: "Create main State of You API endpoint. GET /api/state-of-you?month=YYYY-MM returns report or generates if missing. POST /api/state-of-you/generate forces regeneration. Report includes: themes, people, sentiment_trajectory, patterns_detected, reflection_question, stats.",
  activeForm: "Creating State of You API"
})

// Task 3.2 (blockedBy: 3.1)
TaskCreate({
  subject: "Create api/cron/monthly-report.js",
  description: "Create Vercel Cron job that runs on 1st of each month. Generates State of You reports for all active users. Should be idempotent.",
  activeForm: "Creating monthly report cron"
})
```

### Epic 4: Whispers API

```javascript
// Task 4.1 (blockedBy: 2.2)
TaskCreate({
  subject: "Create api/whisper.js",
  description: "Create Whisper API. POST /api/whisper saves quick capture, extracts entities in background, returns {id, status, entities_detected}. GET /api/whispers?limit=50&offset=0 returns history. POST /api/whispers/reflect triggers reflection on selected whispers.",
  activeForm: "Creating Whisper API"
})
```

### Epic 5: Memory Moments API

```javascript
// Task 5.1 (blockedBy: 2.3)
TaskCreate({
  subject: "Create api/memory-moments.js",
  description: "Create Memory Moments API. GET /api/memory-moments?status=pending returns pending moments. POST /api/memory-moments/:id/engage tracks engagement. POST /api/memory-moments/:id/dismiss dismisses moment.",
  activeForm: "Creating Memory Moments API"
})

// Task 5.2 (blockedBy: 5.1)
TaskCreate({
  subject: "Create api/cron/memory-moments.js",
  description: "Create Vercel Cron job that runs daily at 9 AM. Generates new memory moments based on triggers. Respects user quiet hours.",
  activeForm: "Creating memory moments cron"
})

// Task 5.3 (blockedBy: 5.1)
TaskCreate({
  subject: "Implement anniversary triggers",
  description: "Add logic to detect anniversaries from notes (dates mentioned + 1 year). Create memory moments for significant anniversaries.",
  activeForm: "Implementing anniversary triggers"
})

// Task 5.4 (blockedBy: 5.1)
TaskCreate({
  subject: "Implement dormant entity triggers",
  description: "Add logic to detect dormant entities (Key People not mentioned in 21+ days). Create gentle check-in memory moments.",
  activeForm: "Implementing dormant entity triggers"
})

// Task 5.5 (blockedBy: 5.1)
TaskCreate({
  subject: "Implement progress triggers",
  description: "Add logic to detect sentiment improvements (e.g., 'imposter syndrome' mentioned less often). Create progress celebration moments.",
  activeForm: "Implementing progress triggers"
})
```

---

## API Interface Contracts

Terminal 2 will consume these APIs. Ensure you follow these contracts:

### State of You API

```javascript
// GET /api/state-of-you?month=2026-01
// Response:
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
// Response: { report: ReportObject }
```

### Whisper API

```javascript
// POST /api/whisper
// Body: { content: string, source: "text"|"voice" }
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
```

---

## Git Commit Format

```
T1: [Feature] - [Description]

Examples:
T1: State of You - Create report generation API
T1: Database - Create user_reports table
T1: Memory Moments - Implement dormant entity triggers
```

---

## Critical Rules

1. **Always check blockedBy** before starting a task
2. **Never edit frontend files** (js/, css/)
3. **Commit after each completed task**
4. **Follow API contracts exactly** — Terminal 2 depends on them
5. **Mark tasks completed** when done
6. **Create clear error handling** in all APIs

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

*Terminal 1 (Backend) — Phase 15 Build*
*Task List ID: phase15-experience-transform*

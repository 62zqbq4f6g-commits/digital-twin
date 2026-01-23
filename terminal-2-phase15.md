# Terminal 2 (Frontend) — Phase 15 Build Prompt

## Start Command

```bash
export CLAUDE_CODE_TASK_LIST_ID=phase15-experience-transform
claude
```

---

## Your Role

You are **Terminal 2 (Frontend)** for Inscript Phase 15 Experience Transformation build.

---

## Your Ownership

You own ALL frontend files. Create and modify only these:

### JavaScript Files (New)
```
js/
├── state-of-you-ui.js       ← Report display and history
├── whisper-ui.js            ← Quick capture UI
├── memory-moments-ui.js     ← Moment display and interaction
└── notifications.js         ← Notification handling
```

### CSS Files (New)
```
css/
├── state-of-you.css         ← Report styling
├── whisper.css              ← Whisper mode styling
└── memory-moments.css       ← Moment card styling
```

### HTML Sections (in index.html)
- Add new UI sections marked with `<!-- PHASE 15 - T2 -->`

### You May Modify (carefully)
- `js/ui.js` — Only add integration hooks, marked with `// PHASE 15 - T2`
- `js/app.js` — Only add imports/initialization, marked with `// PHASE 15 - T2`
- `index.html` — Only add new sections, marked with `<!-- PHASE 15 - T2 -->`

---

## YOU MUST NOT EDIT

- `api/*.js` (backend files)
- Database schemas
- Cron jobs

---

## Workflow

1. **Check TaskList** — See available tasks
2. **Check blockedBy** — Many frontend tasks depend on backend APIs being ready
3. **Claim task** — Use TaskUpdate to set status to `in_progress` and owner to `T2`
4. **Complete task** — Write the code
5. **Git commit** — Format: `T2: [Feature] - [Description]`
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

3. **Wait for backend tasks** — Many frontend tasks are blocked by API creation

4. **Start with unblocked tasks** (CSS files can be created early)

---

## Task Creation (If None Exist)

Create these tasks (backend tasks should already exist):

### Epic 3: State of You Frontend

```javascript
// Task 3.3 (blockedBy: 3.1 - State of You API)
TaskCreate({
  subject: "Create js/state-of-you-ui.js",
  description: "Create State of You UI module. Functions: fetchReport(month), renderReport(data), renderReportHistory(), showReport(). Use existing design system (black, white, silver, editorial typography).",
  activeForm: "Creating State of You UI"
})

// Task 3.4 (no dependencies)
TaskCreate({
  subject: "Create css/state-of-you.css",
  description: "Create State of You styles. Report card layout, theme bars, sentiment indicators, reflection question styling. Follow editorial design system.",
  activeForm: "Creating State of You styles"
})

// Task 3.5 (blockedBy: 3.3, 3.4)
TaskCreate({
  subject: "Integrate State of You into TWIN tab",
  description: "Add Reports section to TWIN tab. Show current month report with history link. Add report notification badge.",
  activeForm: "Integrating State of You into TWIN tab"
})

// Task 3.6 (blockedBy: 3.5)
TaskCreate({
  subject: "Add State of You notification",
  description: "Create notification when new monthly report is available. Badge on TWIN tab. Dismissible.",
  activeForm: "Adding State of You notification"
})
```

### Epic 4: Whispers Frontend

```javascript
// Task 4.2 (blockedBy: 4.1 - Whisper API)
TaskCreate({
  subject: "Create js/whisper-ui.js",
  description: "Create Whisper UI module. Functions: showWhisperMode(), hideWhisperMode(), saveWhisper(content), renderWhisperHistory(). Minimal UI, just input + send.",
  activeForm: "Creating Whisper UI"
})

// Task 4.3 (no dependencies)
TaskCreate({
  subject: "Create css/whisper.css",
  description: "Create Whisper mode styles. Minimal input, subtle animations, '✓ Heard' confirmation. Dark overlay optional.",
  activeForm: "Creating Whisper styles"
})

// Task 4.4 (blockedBy: 4.2, 4.3)
TaskCreate({
  subject: "Add Whisper input mode to NOTES tab",
  description: "Add whisper toggle/swipe gesture to note input area. When active, switch to whisper mode UI.",
  activeForm: "Adding Whisper input mode"
})

// Task 4.5 (blockedBy: 4.4)
TaskCreate({
  subject: "Add Whisper history view",
  description: "Create collapsible whisper history in NOTES tab or separate section. Show recent whispers with timestamp.",
  activeForm: "Adding Whisper history"
})

// Task 4.6 (blockedBy: 4.5)
TaskCreate({
  subject: "Add batch reflection mode for Whispers",
  description: "Allow users to select multiple whispers and trigger reflection. Creates a combined note.",
  activeForm: "Adding batch reflection mode"
})
```

### Epic 5: Memory Moments Frontend

```javascript
// Task 5.6 (blockedBy: 5.1 - Memory Moments API)
TaskCreate({
  subject: "Create js/memory-moments-ui.js",
  description: "Create Memory Moments UI module. Functions: fetchMoments(), renderMoment(data), engageMoment(id), dismissMoment(id), showMomentsPanel(). Card-based UI.",
  activeForm: "Creating Memory Moments UI"
})

// Task 5.7 (no dependencies)
TaskCreate({
  subject: "Create css/memory-moments.css",
  description: "Create Memory Moments styles. Moment cards, engage/dismiss buttons, priority indicators. Warm, inviting design.",
  activeForm: "Creating Memory Moments styles"
})

// Task 5.8 (blockedBy: 5.6, 5.7)
TaskCreate({
  subject: "Add Memory Moments surface to NOTES tab",
  description: "Add moments panel/section to NOTES tab. Shows pending moments. Collapsible. Badge count.",
  activeForm: "Adding Memory Moments to NOTES tab"
})

// Task 5.9 (blockedBy: 5.8)
TaskCreate({
  subject: "Add Memory Moments engagement tracking",
  description: "Wire up engage/dismiss buttons to API. Track interactions. Remove moment from UI after action.",
  activeForm: "Adding engagement tracking"
})
```

---

## API Contracts (What Terminal 1 Provides)

### State of You API

```javascript
// GET /api/state-of-you?month=2026-01
const response = await fetch('/api/state-of-you?month=2026-01');
const { report, generated } = await response.json();

// report structure:
{
  month: "2026-01",
  themes: [{ name: "Work transition", mentions: 12, trend: "up" }],
  people: [{ name: "Marcus", mentions: 9, change: 2, sentiment: 0.65 }],
  sentiment_trajectory: {
    work: { start: 0.42, end: 0.61, trend: "improving" }
  },
  patterns_detected: ["You write about work decisions on Sundays"],
  reflection_question: "You mentioned 'should' 23 times...",
  stats: { notes_count: 47, whispers_count: 23, entities_learned: 5, streak_days: 18 }
}
```

### Whisper API

```javascript
// Save whisper
const response = await fetch('/api/whisper', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ content: "Quick thought", source: "text" })
});
const { id, status, entities_detected } = await response.json();

// Get history
const response = await fetch('/api/whispers?limit=50&offset=0');
const { whispers, total } = await response.json();

// Batch reflect
const response = await fetch('/api/whispers/reflect', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ whisper_ids: ["id1", "id2"] })
});
const { note_id, reflection } = await response.json();
```

### Memory Moments API

```javascript
// Get pending moments
const response = await fetch('/api/memory-moments?status=pending');
const { moments } = await response.json();

// moment structure:
{
  id: "uuid",
  type: "dormant_entity",
  title: "Checking in on Marcus",
  content: "It's been 3 weeks since you mentioned Marcus...",
  priority: 7,
  related_entity: { name: "Marcus", relationship: "close friend" },
  created_at: "2026-01-23T10:00:00Z"
}

// Engage
await fetch('/api/memory-moments/abc123/engage', { method: 'POST' });

// Dismiss
await fetch('/api/memory-moments/abc123/dismiss', { method: 'POST' });
```

---

## Design System Reference

Follow the existing design system strictly:

### Colors
```css
--paper: #FFFFFF;
--paper-warm: #FAFAFA;
--ink: #000000;
--ink-soft: #333333;
--silver-100: #F5F5F5;
--silver-200: #E5E5E5;
--silver-300: #D4D4D4;
```

### Typography
```css
/* Headlines */
font-family: 'Playfair Display', serif;

/* AI/Editorial content */
font-family: 'Cormorant Garamond', serif;
font-style: italic;

/* UI elements */
font-family: 'Inter', sans-serif;

/* Data/timestamps */
font-family: 'JetBrains Mono', monospace;
```

### Principles
1. Black, white, silver only
2. Typography-first
3. Thin 1px borders, no shadows
4. Generous whitespace
5. Subtle motion (fade in, don't bounce)

---

## Git Commit Format

```
T2: [Feature] - [Description]

Examples:
T2: State of You - Create report display UI
T2: Whispers - Add quick capture input mode
T2: Memory Moments - Add engagement tracking
```

---

## Critical Rules

1. **Always check blockedBy** before starting a task
2. **Never edit backend files** (api/)
3. **Wait for APIs to be ready** before implementing frontend
4. **Commit after each completed task**
5. **Follow design system exactly** — editorial, black/white/silver
6. **Mark tasks completed** when done
7. **Test mobile responsiveness** for all new UI

---

## Quick Reference

```bash
# Check tasks
TaskList

# Claim a task
TaskUpdate({ taskId: "xxx", status: "in_progress", owner: "T2" })

# Complete a task
TaskUpdate({ taskId: "xxx", status: "completed" })

# Git commit
git add -A && git commit -m "T2: Feature - Description"
```

---

## Starting Unblocked Tasks

These tasks have NO dependencies and can be started immediately:

1. **Task 3.4:** Create `css/state-of-you.css`
2. **Task 4.3:** Create `css/whisper.css`
3. **Task 5.7:** Create `css/memory-moments.css`

Start with CSS while waiting for backend APIs to be ready.

---

*Terminal 2 (Frontend) — Phase 15 Build*
*Task List ID: phase15-experience-transform*

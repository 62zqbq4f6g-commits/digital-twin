# Terminal 2 (Frontend) — Phase 15 Build Prompt

## Version 1.1.0 (Critical Fixes Applied)

## Start Command

```bash
export CLAUDE_CODE_TASK_LIST_ID=phase15-experience-transform
claude
```

---

## Your Role

You are **Terminal 2 (Frontend)** for Inscript Phase 15 Experience Transformation build.

---

## CRITICAL FIXES YOU MUST FOLLOW

| Fix | Description |
|-----|-------------|
| **FIX 3** | Whispers V1 is TEXT-ONLY (no voice input UI) |
| **FIX 5** | Must implement empty states for all features (Task #13.5) |
| **FIX 8** | Memory Moments is an OVERLAY/DRAWER, NOT a section |

---

## Empty States (FIX 5) — Required for All Features

| Feature | Condition | Message |
|---------|-----------|---------|
| **State of You** | <5 notes in month | "Keep writing, insights coming after 5+ notes" |
| **Memory Moments** | <14 days of usage | "Moments appear after 14+ days of notes" |
| **Whispers** | No whispers yet | "Your whispers will appear here" |

**Style:** Cormorant Garamond italic, centered, silver-400 text

---

## Your Ownership

You own ALL frontend files. Create and modify only these:

### JavaScript Files (New)
```
js/
├── state-of-you-ui.js       ← Report display and history
├── whisper-ui.js            ← Quick capture UI (TEXT-ONLY)
├── memory-moments-ui.js     ← Overlay/drawer display
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

## Task Execution Order

### Phase 1: CSS Files (No Dependencies — Start Here)

1. **Task #13: Create css/state-of-you.css**
2. **Task #14: Create css/whisper.css**
3. **Task #15: Create css/memory-moments.css**

### Phase 2: JavaScript UI (Wait for Backend APIs)

4. **Task #16: Create js/state-of-you-ui.js** (blockedBy: Backend Task #5e)
5. **Task #17: Create js/whisper-ui.js** (blockedBy: Backend Task #7)
   - **TEXT-ONLY** — No voice input
6. **Task #18: Create js/memory-moments-ui.js** (blockedBy: Backend Task #8)
   - **OVERLAY/DRAWER** — Not a section

### Phase 3: Empty States (FIX 5)

7. **Task #13.5: Define Empty State UI** (blockedBy: #16, #17, #18)
   - Add empty state handling to all 3 UI modules
   - Use editorial typography
   - Encouraging, not error-like

### Phase 4: Integration

8. **Task #19: Integrate State of You into TWIN tab** (blockedBy: #13, #16)
9. **Task #20: Add Whisper input mode to NOTES tab** (blockedBy: #14, #17)
10. **Task #21: Add Whisper history view** (blockedBy: #20)
11. **Task #22: Add batch reflection for Whispers** (blockedBy: #21)
12. **Task #23: Add Memory Moments overlay trigger** (blockedBy: #15, #18)
    - **Icon trigger in NOTES tab**
    - **Opens overlay/drawer, NOT a section**
13. **Task #24: Add Memory Moments engagement tracking** (blockedBy: #23)

---

## Design System Reference

Follow the SoHo Editorial Aesthetic strictly:

### Colors
```css
--paper: #FFFFFF;
--paper-warm: #FAFAFA;
--ink: #000000;
--ink-soft: #333333;
--silver-100: #F5F5F5;
--silver-200: #E5E5E5;
--silver-300: #D4D4D4;
--silver-400: #A3A3A3;
```

### Typography
```css
/* Headlines */
font-family: 'Playfair Display', serif;

/* AI/Editorial content, Empty states */
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

## API Contracts (What Backend Provides)

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

// Empty state: If report is null or notes_count < 5, show empty state
```

### Whisper API (E2E Encrypted)

```javascript
// Save whisper (encrypt on client before sending)
const encrypted = await encryptContent(content);  // Use existing PIN encryption
const response = await fetch('/api/whisper', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content_encrypted: encrypted.content,
    iv: encrypted.iv
  })
});
const { id, status, entities_detected } = await response.json();

// Get history
const response = await fetch('/api/whispers?limit=50&offset=0');
const { whispers, total } = await response.json();
// Decrypt on client using existing PIN decryption

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

// Empty state: If moments array is empty, show empty state
```

---

## Component Specifications

### State of You Report

```
┌─────────────────────────────────────────────┐
│  JANUARY 2026                               │
│  ← prev                           next →    │
├─────────────────────────────────────────────┤
│                                             │
│  TOP THEMES                                 │
│  ─────────────────────────────────────────  │
│  Work transition ████████████ 12            │
│  Health focus    ████████░░░░ 8             │
│  Family          ██████░░░░░░ 6             │
│                                             │
│  PEOPLE YOU ENGAGED WITH                    │
│  ─────────────────────────────────────────  │
│  ◆ Marcus — 9 mentions (+2) ▲              │
│  ◆ Sarah — 4 mentions (-1) ▼               │
│                                             │
│  REFLECTION                                 │
│  ─────────────────────────────────────────  │
│  "You mentioned 'should' 23 times this     │
│   month. Whose expectations are you        │
│   carrying?"                                │
│                         — Cormorant italic  │
│                                             │
│  STATS                                      │
│  47 notes · 23 whispers · 18 day streak    │
│                                             │
└─────────────────────────────────────────────┘
```

### Whisper Mode

```
┌─────────────────────────────────────────────┐
│                                             │
│  [×]                      WHISPER MODE      │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Quick thought...                    │    │
│  └─────────────────────────────────────┘    │
│                                             │
│               [✓ Heard]                     │
│                                             │
│  No reflection. Just captured.              │
│                   — Cormorant italic        │
│                                             │
└─────────────────────────────────────────────┘

After save:
┌─────────────────────────────────────────────┐
│               ✓ Heard                       │
│                                             │
│     (fade out after 1.5s)                  │
└─────────────────────────────────────────────┘
```

### Memory Moments Overlay (FIX 8)

```
┌─────────────────────────────────────────────┐
│  MOMENTS                              [×]   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Checking in on Marcus               │    │
│  │ ───────────────────────────────────  │    │
│  │ It's been 3 weeks since you         │    │
│  │ mentioned Marcus. Everything okay?  │    │
│  │                                      │    │
│  │ [Engage]              [Dismiss]      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │ Progress                            │    │
│  │ ───────────────────────────────────  │    │
│  │ You mentioned imposter syndrome 8x  │    │
│  │ in Oct, only 1x in Nov. That's a   │    │
│  │ shift.                              │    │
│  │                                      │    │
│  │ [Engage]              [Dismiss]      │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘

Trigger: Small icon in NOTES tab header
         Badge shows count of pending moments
```

---

## Workflow

1. **Read PHASE-15-BUILD.md** for full context
2. **Check TaskList** — See available tasks
3. **Start with CSS tasks** (#13, #14, #15) — No dependencies
4. **Wait for backend APIs** before JS tasks
5. **Mark task in_progress** before starting
6. **Complete task** — Write the code
7. **Git commit** — Format: `T2: [Feature] - [Description]`
8. **Mark task completed**
9. **Repeat** — Check TaskList for next unblocked task

---

## Git Commit Format

```
T2: [Feature] - [Description]

Examples:
T2: State of You - Create report styles (CSS)
T2: Whispers - Create quick capture UI (text-only)
T2: Memory Moments - Create overlay/drawer UI
T2: Empty States - Add graceful empty state handling
T2: Integration - Add Memory Moments trigger to NOTES tab
```

---

## Critical Rules

1. **Whispers = text-only** — No voice input UI in V1
2. **Memory Moments = overlay/drawer** — NOT a permanent section
3. **Empty states required** — All features need graceful fallbacks
4. **Never edit backend files**
5. **Follow SoHo design system** — Editorial, black/white/silver
6. **Test mobile responsiveness** — 375px minimum
7. **Commit after each task**
8. **Check blockedBy before starting**

---

## Immediate Start (Unblocked Tasks)

These tasks have NO dependencies — start now:

| Task | Description |
|------|-------------|
| **#13** | Create `css/state-of-you.css` |
| **#14** | Create `css/whisper.css` |
| **#15** | Create `css/memory-moments.css` |

Start with CSS while waiting for backend APIs.

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

*Terminal 2 (Frontend) — Phase 15 Build v1.1.0*
*Task List ID: phase15-experience-transform*
*Critical Fixes Applied*

# INSCRIPT ENHANCEMENT SYSTEM — CLAUDE CODE BUILD INSTRUCTIONS

## Project Root
```
/Users/airoxthebox/Projects/digital-twin
```

---

# STEP 1: FILE SETUP

Run these commands in your terminal to set up the build files:

```bash
cd /Users/airoxthebox/Projects/digital-twin

# Backup your current CLAUDE.md
cp CLAUDE.md CLAUDE.md.backup

# Replace with updated CLAUDE.md (rename the downloaded file)
mv ~/Downloads/CLAUDE-UPDATED.md ./CLAUDE.md

# Add the master specification
mv ~/Downloads/INSCRIPT-ENHANCEMENT-MASTER-SPEC.md ./

# Create tasks directory
mkdir -p tasks

# Add task files
mv ~/Downloads/TASK-001-meeting-capture-ui.md ./tasks/
mv ~/Downloads/TASK-002-enhancement-api.md ./tasks/
mv ~/Downloads/TASK-003-enhancement-prompt.md ./tasks/

# Verify setup
ls -la CLAUDE.md INSCRIPT-ENHANCEMENT-MASTER-SPEC.md tasks/
```

### Expected Output:
```
-rw-r--r--  CLAUDE.md
-rw-r--r--  INSCRIPT-ENHANCEMENT-MASTER-SPEC.md
tasks/:
  TASK-001-meeting-capture-ui.md
  TASK-002-enhancement-api.md
  TASK-003-enhancement-prompt.md
```

---

# STEP 2: TERMINAL SETUP

Open **3 terminal windows/tabs**, all in the project directory:

```bash
# In each terminal:
cd /Users/airoxthebox/Projects/digital-twin
```

| Terminal | Purpose | Focus |
|----------|---------|-------|
| **Terminal 1** | Frontend/UI | Meeting capture UI, voice input, display components |
| **Terminal 2** | Backend/API | Enhancement API, transcription, context endpoints |
| **Terminal 3** | QA/Testing | Run tests, verify integration, check mobile |

---

# STEP 3: START CLAUDE CODE

## Terminal 1 — Frontend (Start First)

```bash
claude
```

**Then paste this EXACT prompt:**

```
I'm building the Inscript Enhancement System, Phase 16.

Please read these files in order:
1. CLAUDE.md — Project context and design system
2. tasks/TASK-001-meeting-capture-ui.md — Your specific task

Build the meeting capture UI component following the spec exactly.

Key constraints from Sasha (Head of Design):
- Black, white, silver ONLY
- Black for buttons ONLY (no black backgrounds)
- No shadows
- No rounded corners > 2px
- Border: 1px solid #E5E5E5

Key constraints from Maya (CPO):
- No more than 2 clicks to start capturing
- Enhancement must complete in < 3 seconds
- Every feature must integrate with entity extraction

Start by reading the files, then implement TASK-001.
```

---

## Terminal 2 — Backend (Start in Parallel)

```bash
claude
```

**Then paste this EXACT prompt:**

```
I'm building the Inscript Enhancement System, Phase 16.

Please read these files in order:
1. CLAUDE.md — Project context and technical guidelines
2. tasks/TASK-002-enhancement-api.md — Your specific task

Build the enhancement API endpoint following the spec exactly.

Key constraints from David (Principal Engineer):
- Use Edge Runtime (export const config = { runtime: 'edge' })
- Streaming SSE response
- < 3 second response time (p95)
- Background processing via ctx.waitUntil()

Key constraints from Maya (CPO):
- Never lose user input on error
- Graceful degradation

Start by reading the files, then implement TASK-002.
```

---

## Terminal 3 — QA (Start After T1 & T2 Have Progress)

```bash
claude
```

**Then paste this EXACT prompt:**

```
I'm QA for the Inscript Enhancement System, Phase 16.

Please read CLAUDE.md for project context.

Your job is to help me test the components being built:

1. When Terminal 1 completes UI work:
   - Verify styling matches design system (black/white/silver only)
   - Check mobile responsiveness at 375px width
   - Verify state machine transitions work

2. When Terminal 2 completes API work:
   - Test with curl commands
   - Verify streaming response format
   - Check error handling

3. Integration testing:
   - Full flow from input → enhance → display
   - Performance timing (< 3 seconds)

Start by reviewing CLAUDE.md, then wait for me to tell you what to test.
```

---

# STEP 4: TASK SEQUENCE

## Week 1 Build Order

| Order | Task | Terminal | Prompt to Use |
|-------|------|----------|---------------|
| 1 | TASK-001 | T1 | "Read tasks/TASK-001-meeting-capture-ui.md and build it" |
| 2 | TASK-002 | T2 | "Read tasks/TASK-002-enhancement-api.md and build it" |
| 3 | TASK-003 | T2 | "Read tasks/TASK-003-enhancement-prompt.md and create the prompt" |
| 4 | Integration | T3 | "Test the integration between UI and API" |
| 5 | TASK-004 | T1 | "Build the enhanced output display component" |
| 6 | TASK-005 | T1 | "Add loading states with rotating messages" |

## When Moving to Next Task

Tell Claude Code:
```
TASK-001 is complete. All acceptance criteria met.

Now read tasks/TASK-002-enhancement-api.md and build it.
```

---

# STEP 5: HANDLING COMMON SITUATIONS

## When Claude Code Needs More Context

```
Check INSCRIPT-ENHANCEMENT-MASTER-SPEC.md Section [X] for more details.
```

| Topic | Section |
|-------|---------|
| UI Layout | Section 8.1 |
| API Contracts | Section 9 |
| Enhancement Prompts | Section 10 |
| Database Schema | Section 11 |
| Testing Requirements | Section 13 |

---

## When There's a Design Question

```
What would Sasha (Head of Design) say about this?

Her rules:
- Black, white, silver ONLY
- Black for buttons ONLY
- No shadows
- No rounded corners > 2px
- Typography creates hierarchy, not boxes
```

---

## When There's an Architecture Question

```
What would David (Principal Engineer) say about this?

His rules:
- Edge Runtime for all API routes
- Parallel fetches for context
- Streaming responses
- Background processing via ctx.waitUntil()
```

---

## When There's a Scope Question

```
What would Maya (CPO) say about this?

Her rules:
- Does this serve the core job-to-be-done?
- No feature without entity integration
- No UI > 2 clicks to start
- No enhancement > 3 seconds
```

---

## When Claude Code Tries to Read ui.js

```
STOP. Never read ui.js in full — it's 4,800+ lines.

Use grep instead:
grep -n "functionName" js/ui.js
```

---

## When There's a File Conflict Between Terminals

```
Check CLAUDE.md Terminal Ownership Rules.

Terminal 1 owns: js/meeting-capture.js, js/voice-input.js, js/enhance-display.js
Terminal 2 owns: api/enhance-meeting.js, api/transcribe-voice.js, prompts/

If you need to modify a shared file (ui.js, index.html), coordinate with the other terminal first.
```

---

# STEP 6: VERIFICATION CHECKLIST

## After TASK-001 (Meeting Capture UI)

```bash
# In browser, check:
- [ ] Large text area renders (min 200px height)
- [ ] Placeholder text: "what happened? type freely or use voice..."
- [ ] Title field has no label, only placeholder
- [ ] Enhance button is black with white text
- [ ] Enhance button disabled when textarea empty
- [ ] Enhance button enabled when textarea has content
- [ ] Voice button visible (44x44px)
- [ ] No shadows anywhere
- [ ] No rounded corners > 2px
- [ ] Mobile responsive at 375px
```

## After TASK-002 (Enhancement API)

```bash
# Test with curl:
curl -X POST http://localhost:3001/api/enhance-meeting \
  -H "Content-Type: application/json" \
  -d '{"rawInput": "sarah 1:1, talked roadmap, q2 budget", "userId": "test"}' \
  --no-buffer

# Verify:
- [ ] Returns streaming SSE (Content-Type: text/event-stream)
- [ ] First event is metadata
- [ ] Content events stream text
- [ ] Last event is done with noteId
- [ ] Empty input returns 400 error
- [ ] Missing userId returns 401 error
- [ ] Total time < 3 seconds
```

## After Integration

```bash
# Full flow test:
- [ ] Type in meeting capture → click Enhance → see structured output
- [ ] Output has DISCUSSED section
- [ ] Output has ACTION ITEMS if mentioned
- [ ] Loading message shows during processing
- [ ] Total time < 3 seconds
```

---

# STEP 7: GIT COMMITS

Use this format for all commits:

```bash
# Terminal 1 (Frontend)
git add js/meeting-capture.js
git commit -m "T1: Enhancement - Create meeting capture UI component"

# Terminal 2 (Backend)  
git add api/enhance-meeting.js
git commit -m "T2: Enhancement - Add streaming enhancement API"
```

---

# QUICK REFERENCE CARD

## File Locations

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Entry point — Claude Code reads first |
| `INSCRIPT-ENHANCEMENT-MASTER-SPEC.md` | Full 4,500-line spec (reference as needed) |
| `tasks/TASK-001-meeting-capture-ui.md` | Frontend task |
| `tasks/TASK-002-enhancement-api.md` | Backend task |
| `tasks/TASK-003-enhancement-prompt.md` | Prompt engineering task |

## Design System (Memorize This)

```css
/* Colors - ONLY THESE */
--ink: #000000;           /* Buttons ONLY */
--paper: #FFFFFF;         /* Backgrounds */
--silver-200: #E5E5E5;    /* Borders */
--silver-400: #A3A3A3;    /* Placeholders */
--silver-600: #525252;    /* AI text */
--silver-900: #171717;    /* User text */
```

## Performance Targets

| Metric | Target |
|--------|--------|
| Enhancement API | < 3000ms |
| Voice transcription | < 5000ms |
| Context fetch | < 500ms |

## Personas

| Persona | Role | Invoke For |
|---------|------|------------|
| Maya | CPO | Scope, features, priorities |
| David | Principal Eng | Architecture, performance |
| Sasha | Head of Design | UI, styling, aesthetics |

---

# TROUBLESHOOTING

## "Claude Code is going off track"

```
STOP. Let's refocus.

Read the acceptance criteria in the task file again.
Only implement what's in the spec. Nothing more.
```

## "The UI doesn't match the design"

```
Check CLAUDE.md Design System section.
Check INSCRIPT-ENHANCEMENT-MASTER-SPEC.md Section 8 for pixel specs.

Key rules:
- Black for buttons ONLY
- No shadows
- 1px borders only
- 2px max border radius
```

## "The API is slow"

```
David says: What's on the critical path?

1. Use Edge Runtime (no cold starts)
2. Parallel fetch for context (Promise.all)
3. Stream response (don't wait for completion)
4. Background processing (ctx.waitUntil)
```

## "Should we add feature X?"

```
Maya says: Does it serve the core job-to-be-done?

The core job is: Transform messy input into clean output with Inscript Context.

If feature X doesn't directly serve this, it's out of scope for Phase 16.
```

---

# SUCCESS CRITERIA

By end of Week 1, you should have:

- [ ] Meeting capture UI working (text input)
- [ ] Enhancement API returning structured output
- [ ] Streaming display in UI
- [ ] Loading states with rotating messages
- [ ] < 3 second enhancement time
- [ ] Mobile responsive
- [ ] All styling matches design system

By end of Week 3, you should have:

- [ ] Voice input working
- [ ] Inscript Context section generating
- [ ] Attendee auto-suggest
- [ ] Background entity extraction
- [ ] Full integration with memory system

---

*Good luck with the build! 🚀*

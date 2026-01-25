# CLAUDE.md — Inscript Developer Guide

## Version 9.4.0 | January 25, 2026

> **Phase:** 17 — Experience Transformation (Complete)
> **Status:** Phase 17 complete, ambient recording pipeline fixed
> **Last Updated:** January 25, 2026 (Night)

---

# QUICK REFERENCE

| Item | Value |
|------|-------|
| **App Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory (PAMP Protocol) |
| **Vision** | Portable AI Memory Protocol — memory that follows you |
| **Version** | 9.4.0 |
| **Production URL** | https://digital-twin-ecru.vercel.app |
| **Working Directory** | `/Users/airoxthebox/Projects/digital-twin` |
| **Beta Status** | Production (Phase 17 complete, voice features deployed) |

---

# STRATEGIC DIRECTION

> **Core Thesis:** Inscript is building PAMP — the Portable AI Memory Protocol.
> Your memory. Your data. Portable across any AI.

## The PAMP Vision

**What is PAMP?**
PAMP (Portable AI Memory Protocol) is the user-owned memory layer for the AI age. Instead of every AI app building siloed memory systems, PAMP provides a universal, encrypted, portable memory that:

1. **You own** — Your memories are encrypted with your keys, stored in your cloud
2. **Any AI can access (with permission)** — ChatGPT, Claude, Gemini, your company's internal tools
3. **Follows you everywhere** — Switch apps, keep your memory
4. **Gets smarter over time** — The more you use AI, the better all AI knows you

**Why PAMP matters:**
- Today: Every AI app starts from zero. You repeat yourself constantly.
- With PAMP: Every AI already knows your world — the people, patterns, preferences.

**Inscript's role:** The first consumer app built on PAMP. We prove the value, build the user base, then open the protocol.

## Strategic Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Consumer Love | Current — Build an app people can't live without |
| **Phase 2** | Platform APIs | Next — Let developers build on PAMP |
| **Phase 3** | Protocol | Future — Open standard for portable AI memory |

## Guiding Principles

1. **Consumer-first** — The app must be magical before the protocol matters
2. **Platform-second** — APIs come after consumer love is proven
3. **Trust-always** — Privacy is non-negotiable. User owns their data. Period.

| Document | Purpose |
|----------|---------|
| **`/docs/STATUS.md`** | Current project status and next priorities |
| **`/docs/PRD.md`** | Product requirements document |
| **`/docs/ROADMAP.md`** | Development roadmap |
| **`INSCRIPT-ENHANCEMENT-MASTER-SPEC.md`** | Phase 16 full specification (4,500 lines) |
| **`tasks/TASK-XXX.md`** | Individual task specs for Phase 16 |

**Current Phase:** Phase 17 Complete — Consumer experience polished

**Next Milestone:** Phase 18 — PAMP foundation (export, API design)

---

# PRODUCT TEAM PERSONAS

**Use these personas when facing ambiguity. Ask: "What would [Persona] say?"**

## Maya Chen — CPO (Product Decisions)

**Background:** Ex-Notion, ex-Linear. Ruthless prioritization.

**Decision framework:**
- "Does this serve the core job-to-be-done?"
- "What's the minimum version that delivers the 'aha' moment?"

**Maya's Red Lines:**
- No feature that doesn't integrate with entity extraction
- No UI requiring > 2 clicks to start
- No enhancement > 3 seconds
- No settings screens — smart defaults only

**When to invoke:** Scope decisions, "should we build X?" questions

---

## David Okonkwo — Principal Engineer (Technical Decisions)

**Background:** Ex-Vercel, ex-Stripe. Performance obsessed.

**Decision framework:**
- "What's the critical path? What can happen in background?"
- "How does this perform at 10x scale?"

**David's Principles:**
- Edge Runtime for all API routes (no cold starts)
- Parallel fetches for context gathering
- Streaming responses for perceived speed
- Background processing via `ctx.waitUntil()`
- Prompt versioning for reproducibility

**When to invoke:** Architecture decisions, performance concerns, API design

---

## Sasha Volkov — Head of Design (UI Decisions)

**Background:** Ex-Apple HI team, ex-Figma. Editorial obsessed.

**Decision framework:**
- "Does this feel like Inscript, or could it be any app?"
- "What would Vogue's digital team think of this?"

**Sasha's Red Lines:**
- Black, white, silver ONLY
- Black for buttons ONLY — no black backgrounds
- No shadows on cards
- No rounded corners > 2px
- Typography creates hierarchy, not boxes

**When to invoke:** UI decisions, visual design, "how should this look?"

---

# PHASE 16: ENHANCEMENT SYSTEM

## Strategic Context

**The Input Motivation Loop:**
```
User creates note/meeting
         │
         ▼
Gets immediate utility (clean output) ← GRANOLA PARITY
         │
         ▼
Sees Inscript Context (patterns, history) ← "WHOA" MOMENT
         │
         ▼
Inputs more data ← BEHAVIOR CHANGE
         │
         ▼
Memory system enriches ← COMPOUNDING VALUE
         │
         ▼
User becomes dependent on Inscript Context ← MOAT
```

**Core Principle:** Utility gets users in the door. Context keeps them building.

## Build Overview

| Feature | Description | Target |
|---------|-------------|--------|
| **Meeting Enhancement** | Transform messy notes into structured minutes | Granola-parity |
| **Voice Input** | Speak notes, AI transcribes and enhances | Whisper API |
| **Inscript Context** | Memory-powered context section | Our differentiator |
| **Note Enhancement** | Optional structure mode for notes | Hybrid reflect/enhance |

**Full Specification:** `INSCRIPT-ENHANCEMENT-MASTER-SPEC.md`

## Performance Targets (NON-NEGOTIABLE)

| Metric | Target |
|--------|--------|
| Enhancement API (p95) | < 3000ms |
| Voice transcription (60s) | < 5000ms |
| Context fetch | < 500ms |
| UI render | < 100ms |

## Terminal Ownership Rules (Phase 16)

**CRITICAL:** To prevent conflicts, each terminal owns specific files.

### Terminal 1 (Frontend) — Owns:

| Directory | Files |
|-----------|-------|
| `js/` | `meeting-capture.js`, `voice-input.js`, `enhance-display.js`, `attendee-suggest.js`, `loading-messages.js` |
| `css/` | Enhancement-related styles |

### Terminal 2 (Backend) — Owns:

| Directory | Files |
|-----------|-------|
| `api/` | `enhance-meeting.js`, `enhance-note.js`, `transcribe-voice.js`, `inscript-context.js` |
| `prompts/` | All enhancement prompts |
| Database | Schema migrations |

### Terminal 3 (QA/Testing):

| Focus | Tasks |
|-------|-------|
| Testing | Run tests, manual verification, integration |
| Performance | Latency testing, mobile testing |

### Shared Files (Coordinate First):

- `js/ui.js` — Only add integration hooks (mark with `// PHASE 16 - T[1|2]`)
- `index.html` — Only add new sections (mark with `<!-- PHASE 16 - T[1|2] -->`)

## Task Management (Phase 16)

```bash
# Start Claude Code with task file
"Read CLAUDE.md and tasks/TASK-001-meeting-capture-ui.md. Build this."

# Reference master spec when needed
"Check INSCRIPT-ENHANCEMENT-MASTER-SPEC.md Section 8 for UI details."
```

### Week 1 Tasks

| Task | Description | Owner |
|------|-------------|-------|
| TASK-001 | Meeting capture UI component | Terminal 1 |
| TASK-002 | Enhancement API endpoint | Terminal 2 |
| TASK-003 | Enhancement prompt v1.0 | Terminal 2 |
| TASK-004 | Streaming response display | Terminal 1 |
| TASK-005 | Loading states | Terminal 1 |

### Week 2 Tasks

| Task | Description | Owner |
|------|-------------|-------|
| TASK-006 | Voice recording (browser) | Terminal 1 |
| TASK-007 | Transcription API (Whisper) | Terminal 2 |
| TASK-008 | Voice → enhance integration | Both |
| TASK-009 | Mobile responsive | Terminal 1 |

### Week 3 Tasks

| Task | Description | Owner |
|------|-------------|-------|
| TASK-010 | Database schema changes | Terminal 2 |
| TASK-011 | Inscript Context fetch | Terminal 2 |
| TASK-012 | Context in enhancement | Terminal 2 |
| TASK-013 | Attendee auto-suggest | Terminal 1 |
| TASK-014 | Background entity extraction | Terminal 2 |

## New API Endpoints (Phase 16)

| Endpoint | Purpose | Runtime |
|----------|---------|---------|
| `POST /api/enhance-meeting` | Meeting enhancement (streaming SSE) | Edge |
| `POST /api/enhance-note` | Note enhancement (streaming SSE) | Edge |
| `POST /api/transcribe-voice` | Voice → text via Whisper | Edge |
| `GET /api/inscript-context` | Fetch user context for enhancement | Edge |

## New Database Tables (Phase 16)

| Table | Purpose |
|-------|---------|
| `meeting_history` | Meeting count per entity, topics, sentiment |
| `open_loops` | Unresolved items tracking |

### Schema Changes to `notes` Table

```sql
ALTER TABLE notes 
ADD COLUMN note_type VARCHAR(20) DEFAULT 'note',  -- 'note', 'meeting', 'reflection'
ADD COLUMN raw_input TEXT,
ADD COLUMN enhanced_content TEXT,
ADD COLUMN enhancement_metadata JSONB,
ADD COLUMN meeting_metadata JSONB;
```

## New Frontend Files (Phase 16)

| File | Purpose |
|------|---------|
| `js/meeting-capture.js` | Meeting capture UI (state machine) |
| `js/voice-input.js` | Browser audio recording |
| `js/enhance-display.js` | Enhanced output display |
| `js/attendee-suggest.js` | Entity auto-suggest |
| `js/loading-messages.js` | Contextual rotating messages |

---

# RECENT QUALITY FIXES (January 25, 2026)

**Version:** 9.4.0 — Ambient Recording Pipeline Fixed

### Ambient Recording Pipeline (Night)

| Issue | Fix | Impact |
|-------|-----|--------|
| **Empty screen on AmbientRecorder open** | Fixed modal rendering in `ambient-recorder.js` v1.2.0 | Modal displays correctly |
| **Missing "Start Listening" button** | Added ambient button HTML + click handler in `meeting-capture.js` | Users can access ambient recording |
| **"this.close is not a function"** | Changed to `UI.closeMeetingCapture()` in meeting-capture.js | No runtime errors on ambient open |
| **500 error on chunk upload** | Added detailed logging + table existence check in `upload-audio-chunk.js` | Better error messages |
| **Session fetch failing** | Added env validation + session logging in `process-ambient.js` | Clearer debug output |
| **Missing ambient_recordings table** | Ran Phase 17 migration in Supabase SQL Editor | Table created with RLS policies |
| **Video Call option on mobile** | Added `isMobile()` detection, hide tab_audio mode on mobile | No broken UI on phones |
| **RLS policy blocking service role** | Fixed policy with multiple service role checks | API can write to table |

### Files Modified (Ambient Recording)
- `js/ambient-recorder.js` — v1.2.0: Mobile detection, mode selection, better error handling
- `js/meeting-capture.js` — Ambient button HTML + click handler using `UI.closeMeetingCapture()`
- `js/meetings-tab.js` — Added `openAmbientRecorder()` method
- `api/upload-audio-chunk.js` — Detailed logging, table existence check, better error responses
- `api/process-ambient.js` — Environment validation, session fetch logging
- `css/styles.css` — Ambient button styles
- `supabase/migrations/20260125_phase17_ambient_recordings.sql` — Fixed RLS policy for service role

### UX Polish + Performance (Late Evening)

| Issue | Fix | Impact |
|-------|-----|--------|
| **MIRROR Mobile Viewport (BUG #5)** | Changed 100vh → 100dvh, added safe-area-inset-bottom | Input field no longer cut off on mobile Safari |
| **Delete Without Undo** | Added 5-second undo toast before permanent delete | Users can recover accidentally deleted notes |
| **No Sync Feedback** | Added sync status indicator in header | Users see "Syncing..." / "✓ Synced" status |
| **Vercel Fluid Compute** | Enabled dynamic resource allocation in vercel.json | Better performance under load |
| **Claude Prompt Caching** | Added cache_control to enhance/mirror/analyze APIs | ~90% cost reduction on repeat calls |

### Files Modified (UX Polish + Performance)
- `css/mirror.css` — 100dvh + safe-area-inset-bottom for mobile viewport
- `js/toast.js` — **NEW**: UndoToast + SyncStatus components
- `js/sync.js` — Dispatch sync events, call SyncStatus
- `js/ui.js` — Use deleteNoteWithUndo for note deletion
- `index.html` — Sync indicator in header, preconnect hints
- `api/enhance-meeting.js` — Claude prompt caching
- `api/mirror.js` — Claude prompt caching
- `api/analyze-edge.js` — Claude prompt caching
- `prompts/meeting-enhance.js` — Separated static system prompt
- `vercel.json` — Fluid Compute + functions config

### Polish Sprint (Evening)

| Issue | Fix | Impact |
|-------|-----|--------|
| **MIRROR No Streaming Cursor (#5)** | Added `StreamingCursor` utility with blinking cursor during AI response | Better feedback during response generation |
| **Image Upload No Progress (#9)** | Added `UploadProgress` component with progress bar + XHR tracking | Users see upload/processing status |
| **Query Response UI (TASK-028)** | Integrated `/api/query-meetings` with `meetings-tab.js` | AI-powered meeting search with sources |

### Performance Sprint (Evening)

| Issue | Fix | Impact |
|-------|-----|--------|
| **Redundant DB Calls** | Added `NotesManager` singleton cache with 5-second TTL | Reduced redundant `getAllNotes()` calls |
| **Sequential API Calls** | Parallelized `Refiner.refine()` and `Analyzer.analyze()` | Faster note processing |
| **Missing DB Indexes** | Created indexes for notes, entities, patterns tables | Faster queries |

### Files Modified (Polish + Performance)
- `js/mirror.js` — NEW: `StreamingCursor` utility for AI response feedback
- `css/mirror.css` — NEW: `.streaming-cursor` animation (0.8s ease-in-out blink)
- `js/camera.js` — NEW: `UploadProgress` component + XHR with progress events
- `css/styles.css` — NEW: `.upload-progress`, `.upload-progress-bar`, `.upload-progress-fill`
- `js/meetings-tab.js` — Integrated `/api/query-meetings` API with `renderQueryResponse()`
- `js/notes-manager.js` — NEW: Singleton cache for getAllNotes with 5s TTL
- `js/db.js` — Cache invalidation on save/delete
- `js/app.js` — Parallel Refiner + Analyzer calls
- `supabase/migrations/20260125_phase16_performance_indexes.sql` — NEW: DB indexes

### Infrastructure Fixes (Afternoon)

| Issue | Fix | Impact |
|-------|-----|--------|
| **Event Listener Memory Leaks** | Refactored to event delegation pattern with `_listenerAttached` flags | No more memory leaks from repeated renders |
| **Invalid Date in MEETINGS** | Added `extractTimestamp()` helper function | Meeting dates display correctly |
| **Job Titles as People** | Enhanced filter with 80+ keywords and "X of Y" pattern detection | "Product Manager" no longer classified as person |
| **confirm()/alert() Blocking** | Replaced with async UI.confirm()/UI.alert() modals | Non-blocking, themed dialogs |
| **Analytics Not Wired** | Created analytics.js module with event tracking | Track note_created, meeting_saved, etc. |
| **Button Double-Click** | Added button disable during async operations | Prevents duplicate saves |

### Files Modified (Infrastructure)
- `js/ui.js` — Event delegation for note cards (line 1283-1297)
- `js/actions-ui.js` — Event delegation for action listeners
- `js/work-ui.js` — Event delegation for tabs + extractTimestamp() + analytics
- `js/settings.js` — Async confirm() for destructive actions
- `js/pin.js` — Async confirm() for PIN reset
- `api/extract-entities.js` — Enhanced job title filter
- `js/analytics.js` — NEW: Event tracking module
- `js/ui-profile.js` — Notification preferences UI

### Previous Fixes (January 24, 2026)

| Issue | Fix |
|-------|-----|
| Key People in MIRROR | Strengthened system prompt |
| Pattern Quality | Temporal filter, post-processing rejection |
| TWIN Stats Loading | Added `loadStatsImmediately()` |
| Action Extraction | Added `isActionable()` filter |

---

# PHASE 15: EXPERIENCE TRANSFORMATION

## Build Overview

Phase 15 adds three features designed to make accumulated value visible and reduce capture friction.

| Feature | Description | Impact |
|---------|-------------|--------|
| **State of You** | Monthly auto-generated report with themes, people, sentiment, patterns | 10X |
| **Whispers** | Quick capture mode without triggering full reflection | 5X |
| **Memory Moments** | Proactive surfacing of memories, anniversaries, dormant entities | 10X |

**Full Specification:** `/PHASE-15-BUILD.md`

## Terminal Ownership Rules (Phase 15)

**CRITICAL:** To prevent conflicts, each terminal owns specific files.

### Terminal 1 (Backend) — Owns:

| Directory | Files |
|-----------|-------|
| `api/` | `state-of-you.js`, `whisper.js`, `memory-moments.js` |
| `api/cron/` | `monthly-report.js`, `memory-moments.js` |
| Database | All new table migrations |

### Terminal 2 (Frontend) — Owns:

| Directory | Files |
|-----------|-------|
| `js/` | `state-of-you-ui.js`, `whisper-ui.js`, `memory-moments-ui.js`, `notifications.js` |
| `css/` | `state-of-you.css`, `whisper.css`, `memory-moments.css` |

### Shared Files (Coordinate First):

- `js/app.js` — Only add imports/initialization (mark with `// PHASE 15 - T[1|2]`)
- `js/ui.js` — Only add integration hooks (mark with `// PHASE 15 - T[1|2]`)
- `index.html` — Only add new sections (mark with `<!-- PHASE 15 - T[1|2] -->`)

## Task Management

```bash
# Start Claude Code with shared task list
export CLAUDE_CODE_TASK_LIST_ID=phase15-experience-transform
claude
```

## New Database Tables (Phase 15)

| Table | Purpose |
|-------|---------|
| `user_reports` | Monthly State of You reports |
| `whispers` | Quick capture entries |
| `memory_moments` | Proactive memory surfacing |
| `user_notification_preferences` | Notification settings |

## New API Endpoints (Phase 15)

| Endpoint | Purpose |
|----------|---------|
| `GET/POST /api/state-of-you` | Monthly report generation and retrieval |
| `POST /api/whisper` | Quick capture save |
| `GET /api/whispers` | Retrieve whisper history |
| `GET /api/memory-moments` | Get pending moments |
| `POST /api/memory-moments/:id/engage` | Track engagement |
| `POST /api/memory-moments/:id/dismiss` | Dismiss moment |

## New Frontend Files (Phase 15)

| File | Purpose |
|------|---------|
| `js/state-of-you-ui.js` | Report display and history |
| `js/whisper-ui.js` | Quick capture UI |
| `js/memory-moments-ui.js` | Moment display and interaction |
| `js/notifications.js` | Notification handling |
| `css/state-of-you.css` | Report styling |
| `css/whisper.css` | Whisper mode styling |
| `css/memory-moments.css` | Moment card styling |

---

# PROJECT STATUS

## Completed Milestones

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 8 | Intelligent Twin | ✅ Complete |
| Phase 9 | Personalization | ✅ Complete |
| Phase 10 | Entity Extraction & Relationships | ✅ Complete |
| Phase 11 | Inscript Rebrand + Onboarding | ✅ Complete |
| Phase 13A | Pattern Foundation | ✅ Complete |
| Phase 13B | MIRROR Tab | ✅ Complete |
| Phase 13C | MIRROR Intelligence | ✅ Complete |
| Phase 13D | Pattern Verification UI | ✅ Complete |
| Phase 13E | Polish & Bug Fixes | ✅ Complete |
| Phase 14 | Bug Fixes & Production Hardening | ✅ Complete |
| **Mem0 Parity** | Full Memory Architecture | ✅ **~95% Complete** |
| **Phase 15** | Experience Transformation (SoY, Whispers, Moments) | ✅ Complete |
| **Phase 16** | Enhancement System | ✅ Complete |
| **Phase 17** | Infrastructure & Quality | ✅ **Complete** |

## What's Working in Production (January 25, 2026)

| Feature | Status |
|---------|--------|
| Login / Sign up | ✅ Live |
| 8-screen onboarding flow | ✅ Live |
| Note creation (text, voice, image) | ✅ Live |
| AI reflection with memory context | ✅ Live |
| Key People system (explicit + extracted) | ✅ Live |
| Entity extraction (ADD/UPDATE/DELETE/NOOP) | ✅ Live |
| Category summaries (Tier 1) | ✅ Live |
| Tiered memory retrieval | ✅ Live |
| Sentiment tracking | ✅ Live |
| Feedback loop | ✅ Live |
| **WORK tab** (Pulse, Actions, Meetings, Commitments) | ✅ Live |
| **TWIN tab** (Stats, Patterns) | ✅ Live |
| **MIRROR tab** (Conversational AI) | ✅ Live |
| LLM hybrid pattern detection | ✅ Live |
| Cloud sync (E2E encrypted) | ✅ Live |
| PIN authentication | ✅ Live |
| **Whispers** (Quick capture mode) | ✅ Live |
| **State of You** (Monthly reports) | ✅ Live |
| **Memory Moments** (Proactive surfacing) | ✅ Live |
| **Ambient Recording** (Background capture) | ✅ Live |
| **Notification Preferences** | ✅ Live |
| **Analytics Tracking** | ✅ Live |

## Beta Readiness Test Results (January 25, 2026)

| Category | Pass Rate | Notes |
|----------|-----------|-------|
| Authentication | 3/3 | App loads, user authenticated |
| Notes & Reflections | 5/5 | HEARD/NOTICED/QUESTION structure |
| WORK Tab | 5/5 | Invalid Date bug fixed |
| TWIN Tab | 5/5 | Stats load, patterns work |
| MIRROR Tab | 4/4 | Key People recognized (including pets) |
| UI/UX | 3/3 | Mobile responsive, dark mode, themed dialogs |
| Performance | 3/3 | LCP < 2.5s, memory leak fixes deployed |

**Overall: 100% (28/28 tests passed)**

---

# APPLICATION TABS

## NOTES Tab (Primary)
- Main note capture (text, voice, image)
- AI reflections with HEARD/NOTICED/QUESTION structure
- Meeting mode and Decision mode entry points
- Entity extraction and memory updates

## WORK Tab (Phase 13)

| Sub-Tab | Purpose |
|---------|---------|
| PULSE | Real-time activity feed, recent notes |
| ACTIONS | Extracted action items from notes |
| MEETINGS | Meeting summaries with attendees |
| COMMITMENTS | Tracked decisions and commitments |

## TWIN Tab

| Section | Purpose |
|---------|---------|
| Stats | Note count, streak, entities learned |
| Patterns | LLM-detected behavioral/emotional patterns |
| Profile | User's digital twin overview |

## MIRROR Tab (Conversational AI)
- Ongoing conversation with context
- References Key People naturally
- Four modes: clarify, expand, challenge, decide
- Memory context injection for personalization

---

# ARCHITECTURE OVERVIEW

## Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS, mobile-responsive PWA |
| **Backend** | Vercel serverless functions (Node.js) |
| **Database** | Supabase (Postgres + pgvector) |
| **AI** | Anthropic Claude (Sonnet) + OpenAI embeddings |
| **Memory System** | Full Mem0 architecture (~95% parity) |
| **Auth** | Supabase Auth + PIN encryption |

## System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                    │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    index.html + js/*.js                         │
│    (NOTES | WORK | TWIN | MIRROR)                               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  api/analyze.js │    │  api/mirror.js  │    │  api/detect-    │
│  (Reflection)   │    │  (Conversation) │    │  patterns.js    │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Memory System                                 │
│  tiered-retrieval | hybrid-retrieval | assemble-context         │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Supabase       │    │  Anthropic      │    │  OpenAI         │
│  PostgreSQL     │    │  Claude API     │    │  Embeddings     │
│  + pgvector     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

---

# KEY FILES

## Frontend (js/)

| File | Purpose |
|------|---------|
| `js/app.js` | Application entry point, version (9.2.0) |
| `js/ui.js` | Main UI (4,800+ lines - needs split) |
| `js/work-ui.js` | WORK tab UI |
| `js/twin-ui.js` | TWIN tab UI |
| `js/mirror.js` | MIRROR tab UI |
| `js/entities.js` | Entity management and display |
| `js/entity-memory.js` | Memory operations (CRUD) |
| `js/context.js` | Context building for AI |
| `js/embeddings.js` | Semantic search client |
| `js/analyzer.js` | Analysis orchestration |
| `js/onboarding.js` | 8-screen onboarding flow |
| `js/extractor.js` | Client-side extraction (actions, sentiment, people) |
| `js/actions-ui.js` | Actions tab |
| `js/signal-tracker.js` | Pattern signal tracking |
| `js/pattern-verification.js` | Pattern verification UI |
| `js/sync.js` | Cloud sync (E2E encrypted) |
| `js/pin.js` | PIN authentication |
| `js/auth.js` | Supabase auth wrapper |
| `js/knowledge-pulse.js` | Learning feedback UI |
| `js/entity-cards.js` | Entity detail cards |
| `js/analytics.js` | Event tracking (note_created, meeting_saved, etc.) |
| `js/ui-profile.js` | Profile settings and notification preferences |

## Backend (api/)

### Core Analysis

| File | Purpose |
|------|---------|
| `api/analyze.js` | Main reflection + memory context injection (~3,600 lines) |
| `api/chat.js` | Socratic dialogue with memory context |
| `api/mirror.js` | MIRROR conversation with Key People |
| `api/vision.js` | Image analysis (Claude Vision) |

### Memory System (Mem0 Architecture)

| File | Purpose |
|------|---------|
| `api/memory-retrieve.js` | **Unified retrieval orchestration** - THE entry point |
| `api/tiered-retrieval.js` | Category summaries → entities → full retrieval |
| `api/assemble-context.js` | Token-limited context with time decay scoring |
| `api/synthesize-query.js` | Query understanding and entity detection |
| `api/hybrid-retrieval.js` | Vector + keyword search fusion |
| `api/evolve-summary.js` | LLM-powered summary rewriting |
| `api/memory-update.js` | Memory CRUD operations |
| `api/memory-search.js` | Semantic memory search |
| `api/memory-consolidate.js` | Duplicate detection and merging |

### Pattern Detection

| File | Purpose |
|------|---------|
| `api/detect-patterns.js` | LLM hybrid pattern detection |
| `api/patterns.js` | Pattern management |
| `api/signals.js` | Signal processing |
| `api/user-patterns.js` | User pattern management |

### Entity Processing

| File | Purpose |
|------|---------|
| `api/extract-entities.js` | LLM entity extraction |
| `api/classify-importance.js` | Entity importance scoring |
| `api/infer-connections.js` | Cross-memory reasoning |
| `api/compress-memory.js` | LLM memory compression |

---

# DATABASE TABLES

## Core Tables

| Table | Purpose |
|-------|---------|
| `notes` | Encrypted note storage |
| `onboarding_data` | User onboarding (name, seasons, focus, people) |
| `user_entities` | Extracted entities with importance/sentiment |
| `user_key_people` | **Explicitly added people** (highest priority) |
| `note_embeddings` | pgvector embeddings for semantic search |
| `entity_relationships` | Relationship graph between entities |
| `category_summaries` | Pre-computed summaries per category |
| `user_feedback` | Thumbs up/down on reflections |
| `user_learning_profile` | Learned preferences |

## Memory System Tables

| Table | Purpose |
|-------|---------|
| `memory_operations` | ADD/UPDATE/NOOP audit log |
| `memory_inferences` | Cross-memory reasoning results |
| `entity_sentiment_history` | Sentiment tracking over time |
| `memory_jobs` | Async processing queue |

## Phase 13 Tables

| Table | Purpose |
|-------|---------|
| `user_patterns` | User behavioral patterns (LLM detected) |
| `mirror_conversations` | MIRROR chat history |
| `mirror_sessions` | MIRROR session tracking |
| `meetings` | Meeting summaries |
| `decisions` | Captured decisions |

## Phase 17 Tables

| Table | Purpose |
|-------|---------|
| `whispers` | Quick capture entries |
| `user_reports` | Monthly State of You reports |
| `memory_moments` | Proactive memory surfacing |
| `ambient_recordings` | Background capture sessions |
| `user_notification_preferences` | Notification settings |
| `analytics_events` | Event tracking data |

---

# KEY PEOPLE SYSTEM

## Priority Order

1. **Key People** (`user_key_people`) — Explicitly added by user (HIGHEST PRIORITY)
2. **Entities** (`user_entities`) — Extracted from notes (auto-detected)

## Schema

```sql
CREATE TABLE user_key_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,  -- "close friend", "dog", "cofounder"
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Context Injection

Key People are injected into AI prompts with highest priority:

```
KEY PEOPLE (user explicitly told you about these):
- Marcus: close friend
- Sarah: cofounder
- Seri: dog

Other people/things from their notes:
- Jamie (colleague)
- Q1 Roadmap (project)
```

**CRITICAL:** The `relationship` column can include pets ("dog", "cat"), not just human relationships.

---

# PATTERN DETECTION

## LLM Hybrid Approach (api/detect-patterns.js)

1. **Database gathers raw data** — entities, notes, categories
2. **LLM interprets data** — finds MEANINGFUL patterns

## Good Patterns
- Emotional: "You process work stress through..."
- Relational: "Marcus and Sarah appear together in your thinking..."
- Behavioral: "When you write about X, Y often comes up..."
- Thematic: "There's tension between A and B across your notes..."

## Bad Patterns (NEVER output)
- "You write on Sundays" — temporal, boring
- "You mention [person] often" — just restating data
- "You have work notes" — obvious from categories

## Minimum Requirements
- 10 notes minimum for pattern detection
- 2+ mentions for entity inclusion
- Patterns scored by confidence (0.7+)

---

# REFLECTION QUALITY

## The Three-Layer Structure

### HEARD (Always)
Prove you understood. Be specific. Quote their words.
- BAD: "Sounds like a busy day"
- GOOD: "The product launch delay and friction with Jamie — that's a lot for one day"

### NOTICED (When memory is relevant)
Connect to what you know about their world.
- "This is the third time this month the launch has slipped"
- "You usually mention Marcus when processing career decisions"

### OFFERED (When valuable)
A question, connection, or gentle observation.
- "What made the conversation with Jamie feel different this time?"

## Forbidden Phrases

Never use: "I can see...", "It seems like...", "Based on my analysis...", "As an AI...", "I understand that...", "Based on my records..."

---

# KNOWN ISSUES

## Recently Fixed (January 24, 2026)

| Issue | Fix | Commit |
|-------|-----|--------|
| Key People not recognized by MIRROR | Strengthened system prompt | `1da6dda` |
| Patterns showing "Sunday notes" | LLM prompt + temporal filter | `1da6dda` |
| TWIN stats not loading immediately | Added `loadStatsImmediately()` | `1da6dda` |
| Action extraction too permissive | Added `isActionable()` filter | `1da6dda` |

## Active Bugs (P2)

| Issue | Severity | Location |
|-------|----------|----------|
| 500 errors on TwinProfile sync | Low | api/twin-profile.js |

## Recently Fixed (v9.2.0)

| Issue | Fix |
|-------|-----|
| Invalid Date in MEETINGS | Added extractTimestamp() helper |
| Job titles as People | Enhanced filter with 80+ keywords |
| Event listener memory leaks | Refactored to event delegation |
| Blocking confirm()/alert() | Replaced with async modals |

## Technical Debt

| File | Lines | Issue |
|------|-------|-------|
| `js/ui.js` | 4,800+ | Must split into modules |
| `api/analyze.js` | 3,600+ | Extract prompts to separate files |
| `css/styles.css` | 8,400+ | Modularize by feature |

---

# COMMANDS

```bash
# Production URL
https://digital-twin-ecru.vercel.app

# Local development
vercel dev --listen 3001

# Deploy to production
git add -A && git commit -m "message" && git push origin main

# Force deploy
vercel --prod

# Check version (browser console)
APP_VERSION  // "9.2.0"

# Cleanup duplicate meetings (browser console)
await WorkUI.cleanupDuplicates()

# Search codebase (avoid reading large files)
grep -rn "functionName" js/*.js api/*.js

# Git status
git status
git log --oneline -5
```

---

# DESIGN SYSTEM

## Philosophy

**"The love child of Linear's precision and Vogue's editorial elegance."**

## Colors (STRICT — Sasha's Rules)

```css
:root {
  /* Paper */
  --paper: #FFFFFF;
  --paper-warm: #FAFAFA;
  --paper-cream: #F7F7F5;

  /* Ink */
  --ink: #000000;           /* BUTTONS ONLY — no black backgrounds */
  --ink-rich: #1A1A1A;
  --ink-soft: #333333;

  /* Silver scale */
  --silver-50: #FAFAFA;
  --silver-100: #F5F5F5;
  --silver-200: #E5E5E5;    /* Borders */
  --silver-400: #A3A3A3;    /* Placeholders */
  --silver-500: #737373;    /* Secondary text */
  --silver-600: #525252;    /* AI-generated text */
  --silver-900: #171717;    /* Primary text */

  /* Semantic (minimal — color is earned) */
  --error: #8B0000;
  --success: #065F46;
}
```

## Typography

| Use Case | Font |
|----------|------|
| Large headlines, app name | Playfair Display |
| AI reflections, insights | Cormorant Garamond (italic) |
| UI elements, buttons | Inter |
| Timestamps, data | JetBrains Mono |

## Design Principles (Sasha's Red Lines)

1. **Black, white, silver only** — No color accents
2. **Black for buttons ONLY** — No black backgrounds
3. **Typography-first** — Let the words carry the design
4. **Thin lines** — 1px borders, no shadows
5. **No rounded corners > 2px** — Sharp is sophisticated
6. **Generous whitespace** — Thoughts need room to breathe
7. **Subtle motion** — Things appear, they don't bounce

---

# UI GUIDELINES

## Accessibility (A11y)

### MUST
- Add `role="button"` `tabindex="0"` to clickable non-button elements
- Add `keydown` handler (Enter/Space) on elements with `onclick`
- Add `aria-label` to icon-only buttons
- Add Escape key listener to close all modals
- Ensure 4.5:1 color contrast ratio

### NEVER
- Remove focus outline without visible replacement
- Use color alone to convey information
- Create touch targets smaller than 44×44px

---

# CRITICAL REMINDERS

1. **NEVER read ui.js in full** — Use grep only
2. **Always use onboarding data** in first reflection
3. **Key People have highest priority** — Reference by name with relationship
4. **Callbacks are critical** — Reference previous notes by note 2-3
5. **Entity mentions must feel natural** — Never "Based on my database..."
6. **Privacy is non-negotiable** — Enterprise LLM, no training, user owns data
7. **Design is editorial** — Black, white, silver. Typography-first.
8. **Test mobile** — Responsive design is required
9. **Enhancement < 3 seconds** — Performance is non-negotiable (Phase 16)
10. **Consult personas** — Maya (product), David (tech), Sasha (design)
11. **PAMP-first thinking** — Every feature should support future portability

---

# VERSION HISTORY

| Version | Phase | Key Changes |
|---------|-------|-------------|
| **9.4.0** | 17 | Ambient recording pipeline fixed: table migration, RLS policy, mobile detection, error logging |
| 9.3.0 | 17 | Voice features: Whisper input, real-time transcription, modal consistency |
| 9.2.0 | 17 | Perf optimization (Fluid Compute, prompt caching), Query Meetings API, delete undo toast, sync indicator, MIRROR mobile viewport fix |
| 9.1.0 | 17 | Phase 17 features: Whispers, State of You, Ambient Recording, Memory Moments, Notification Prefs |
| 8.6.0 | 16 | Enhancement System spec complete, product team personas added |
| 8.5.0 | 15 | Quality fixes: Key People in MIRROR, pattern quality, immediate stats, action filtering |
| 8.4.0 | 15 | SoHo design refinement, PHASE-15-BUILD.md v1.1 |
| 8.3.0 | 15 | Experience Transformation: State of You, Whispers, Memory Moments |
| 8.2.1 | 14 | Bug fixes (406/500 errors), parallel terminal setup |
| 8.2.0 | 13E | Pre-beta testing (93%), Key People fix (pets), full documentation update |
| 8.1.1 | 13D | Category summaries fix (.single() → .maybeSingle()) |
| 8.1.0 | Mem0 | Full Mem0 architecture integration, tiered retrieval |
| 8.0.0 | 13.0 | Phase 13: Patterns, MIRROR tab, WORK tab |
| 7.8.0 | 11.0 | Inscript rebrand, 8-screen onboarding |
| 7.5.0 | 10.3 | Semantic search with pgvector |

---

# GIT COMMIT CONVENTION

## Phase 16
```
T[1|2]: [Feature] - [Description]

Examples:
T1: Enhancement - Create meeting capture UI
T2: Enhancement - Add streaming API endpoint
T1: Enhancement - Implement voice recording
```

## Phase 15
```
T[1|2]: [Feature] - [Description]

Examples:
T1: State of You - Create report generation API
T2: Whispers - Add quick capture UI component
T1: Memory Moments - Implement dormant entity triggers
```

---

*CLAUDE.md — Inscript Developer Guide*
*Last Updated: January 25, 2026*
*Production: https://digital-twin-ecru.vercel.app*

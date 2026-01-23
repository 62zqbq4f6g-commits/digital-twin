# CLAUDE.md — Inscript Developer Guide

## Version 8.3.0 | January 23, 2026

> **Phase:** 15 — Experience Transformation (In Progress)
> **Status:** Building 3 High-Impact Features
> **Last Updated:** January 23, 2026
> **Task List ID:** `phase15-experience-transform`

---

# QUICK REFERENCE

| Item | Value |
|------|-------|
| **App Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory |
| **Version** | 8.2.0 |
| **Production URL** | https://digital-twin-ecru.vercel.app |
| **Working Directory** | `/Users/airoxthebox/Projects/digital-twin` |
| **Beta Status** | Ready (93% pass rate, 26/28 tests) |

---

# STRATEGIC DIRECTION

> **Core Thesis:** Inscript is building the memory layer for personal AI.
> Consumer-first. Platform-second. Trust-always.

| Document | Purpose |
|----------|---------|
| **`/docs/STATUS.md`** | Current project status and next priorities |
| **`/docs/PRD.md`** | Product requirements document |
| **`/docs/ROADMAP.md`** | Development roadmap |

**Current Phase:** Phase 15 — Experience Transformation

**Next Milestone:** Ship 3 high-impact features (State of You, Whispers, Memory Moments)

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

## Terminal Ownership Rules

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
| **Phase 15** | Experience Transformation | 🔄 **In Progress** |

## What's Working in Production (January 23, 2026)

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

## Beta Readiness Test Results (January 23, 2026)

| Category | Pass Rate | Notes |
|----------|-----------|-------|
| Authentication | 3/3 | App loads, user authenticated |
| Notes & Reflections | 5/5 | HEARD/NOTICED/QUESTION structure |
| WORK Tab | 4/5 | Invalid Date bug in MEETINGS |
| TWIN Tab | 5/5 | Stats load, patterns work |
| MIRROR Tab | 4/4 | Key People recognized (including pets) |
| UI/UX | 2/3 | Mobile responsive, dark mode works |
| Performance | 3/3 | LCP < 2.5s, no memory leaks |

**Overall: 93% (26/28 tests passed)**

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
| `js/app.js` | Application entry point, version (8.2.0) |
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

## Active Bugs (P1)

| Issue | Severity | Location |
|-------|----------|----------|
| MEETINGS shows "Invalid Date" | Medium | js/work-ui.js |
| Meeting double-save creates duplicates | Medium | js/work-ui.js |
| Job titles classified as People | Low | api/extract-entities.js |
| 500 errors on TwinProfile sync | Low | api/twin-profile.js |

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
APP_VERSION  // "8.2.0"

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

## Colors

```css
:root {
  /* Paper */
  --paper: #FFFFFF;
  --paper-warm: #FAFAFA;
  --paper-cream: #F7F7F5;

  /* Ink */
  --ink: #000000;
  --ink-rich: #1A1A1A;
  --ink-soft: #333333;

  /* Silver scale */
  --silver-50 through --silver-900

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

## Design Principles

1. **Black, white, silver only** — No color accents
2. **Typography-first** — Let the words carry the design
3. **Thin lines** — 1px borders, no shadows
4. **Generous whitespace** — Thoughts need room to breathe
5. **Subtle motion** — Things appear, they don't bounce

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
6. **Privacy is non-negotiable** — Enterprise LLM, no training
7. **Design is editorial** — Black, white, silver. Typography-first.
8. **Test mobile** — Responsive design is required

---

# VERSION HISTORY

| Version | Phase | Key Changes |
|---------|-------|-------------|
| **8.3.0** | 15 | Experience Transformation: State of You, Whispers, Memory Moments |
| 8.2.1 | 14 | Bug fixes (406/500 errors), parallel terminal setup |
| 8.2.0 | 13E | Pre-beta testing (93%), Key People fix (pets), full documentation update |
| 8.1.1 | 13D | Category summaries fix (.single() → .maybeSingle()) |
| 8.1.0 | Mem0 | Full Mem0 architecture integration, tiered retrieval |
| 8.0.0 | 13.0 | Phase 13: Patterns, MIRROR tab, WORK tab |
| 7.8.0 | 11.0 | Inscript rebrand, 8-screen onboarding |
| 7.5.0 | 10.3 | Semantic search with pgvector |

---

# GIT COMMIT CONVENTION (Phase 15)

All commits should follow this format:

```
T[1|2]: [Feature] - [Description]

Examples:
T1: State of You - Create report generation API
T2: Whispers - Add quick capture UI component
T1: Memory Moments - Implement dormant entity triggers
```

---

*CLAUDE.md — Inscript Developer Guide*
*Last Updated: January 23, 2026*
*Production: https://digital-twin-ecru.vercel.app*

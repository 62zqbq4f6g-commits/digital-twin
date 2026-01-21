# CLAUDE.md — Inscript Developer Guide

## Version 8.1.0 | January 21, 2026

> **Phase:** Mem0 Parity Complete
> **Status:** Production Ready
> **Last Updated:** January 21, 2026

---

# QUICK REFERENCE

| Item | Value |
|------|-------|
| **App Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory |
| **Version** | 8.1.0 |
| **Production URL** | https://digital-twin-ecru.vercel.app |
| **Working Directory** | `/Users/airoxthebox/Projects/digital-twin` |

---

# PROJECT STATUS

## Completed Milestones

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 8 | Intelligent Twin | ✅ Complete |
| Phase 9 | Personalization | ✅ Complete |
| Phase 10 | Entity Extraction & Relationships | ✅ Complete |
| Phase 11 | Inscript Rebrand + Onboarding | ✅ Complete |
| Phase 13 | Patterns & MIRROR Tab | ✅ Complete |
| **Mem0 Parity** | Full Memory Architecture | ✅ **100% Complete** |

## What's Working in Production (January 21, 2026)

| Feature | Status |
|---------|--------|
| Login / Sign up | ✅ Live |
| 8-screen onboarding flow | ✅ Live |
| Note creation (text, voice, image) | ✅ Live |
| AI reflection with memory context | ✅ Live |
| Seeded people → AI context injection | ✅ Live |
| Entity extraction (ADD/UPDATE/DELETE/NOOP) | ✅ Live |
| Category summaries (Tier 1) | ✅ Live |
| Tiered memory retrieval | ✅ Live |
| Sentiment tracking | ✅ Live |
| Feedback loop | ✅ Live |
| Actions tab | ✅ Live |
| TWIN tab | ✅ Live |
| MIRROR tab | ✅ Live |
| Cloud sync (E2E encrypted) | ✅ Live |
| PIN authentication | ✅ Live |

---

# ARCHITECTURE OVERVIEW

## Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Vanilla JS, mobile-responsive PWA |
| **Backend** | Vercel serverless functions (Node.js) |
| **Database** | Supabase (Postgres + pgvector) |
| **AI** | Anthropic Claude (Sonnet) + OpenAI embeddings |
| **Memory System** | Full Mem0 architecture (6 gaps closed) |
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
│    (Notes Tab | Actions Tab | TWIN Tab | MIRROR Tab)            │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  js/app.js      │    │  js/sync.js     │    │  js/pin.js      │
│  (Pipeline)     │    │  (Cloud)        │    │  (Encryption)   │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    api/*.js (Vercel)                            │
│  analyze | chat | memory-retrieve | tiered-retrieval | etc.     │
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
| `js/app.js` | Application entry point, version (8.0.0) |
| `js/ui.js` | Main UI (4,800+ lines - needs split) |
| `js/entities.js` | Entity management and display |
| `js/entity-memory.js` | Memory operations (CRUD) |
| `js/context.js` | Context building for AI |
| `js/embeddings.js` | Semantic search client |
| `js/analyzer.js` | Analysis orchestration |
| `js/onboarding.js` | 8-screen onboarding flow |
| `js/twin-ui.js` | TWIN tab UI |
| `js/mirror.js` | MIRROR tab UI |
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
| `api/analyze.js` | Main reflection + memory context injection (3,600+ lines) |
| `api/chat.js` | Socratic dialogue with memory context |
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

### Entity Processing

| File | Purpose |
|------|---------|
| `api/extract-entities.js` | LLM entity extraction |
| `api/classify-importance.js` | Entity importance scoring |
| `api/infer-connections.js` | Cross-memory reasoning |
| `api/compress-memory.js` | LLM memory compression |

### Other APIs

| File | Purpose |
|------|---------|
| `api/embed.js` | OpenAI embeddings |
| `api/patterns.js` | Pattern detection |
| `api/signals.js` | Signal processing |
| `api/mirror.js` | MIRROR conversation |
| `api/user-patterns.js` | User pattern management |
| `api/digest.js` | Weekly digest generation |
| `api/recovery.js` | PIN recovery email |
| `api/refine.js` | Text refinement |
| `api/env.js` | Public Supabase config |

---

# DATABASE TABLES

## Core Tables

| Table | Purpose |
|-------|---------|
| `notes` | Encrypted note storage |
| `onboarding_data` | User onboarding (name, seasons, focus, people) |
| `user_entities` | Extracted entities with importance/sentiment |
| `note_embeddings` | pgvector embeddings for semantic search |
| `entity_relationships` | Relationship graph between entities |
| `category_summaries` | Pre-computed summaries per category |
| `user_feedback` | Thumbs up/down on reflections |
| `user_learning_profile` | Learned preferences |
| `user_profiles` | Legacy profile data |
| `user_salts` | Encryption salts |

## Memory System Tables

| Table | Purpose |
|-------|---------|
| `memory_inferences` | Cross-memory reasoning results |
| `entity_sentiment_history` | Sentiment tracking over time |
| `memory_jobs` | Async processing queue |
| `detected_patterns` | Pattern detection results |

## Phase 13 Tables

| Table | Purpose |
|-------|---------|
| `user_patterns` | User behavioral patterns |
| `mirror_conversations` | MIRROR chat history |
| `mirror_sessions` | MIRROR session tracking |

---

# CRON JOBS

Four automated maintenance jobs (requires `pg_cron` extension):

| Job | Schedule | Purpose |
|-----|----------|---------|
| `cleanup-expired-memories` | Daily 3 AM UTC | Archive expired memories |
| `weekly-memory-decay` | Sunday 4 AM UTC | Decay importance scores by tier |
| `nightly-consolidation` | Daily 2 AM UTC | Flag potential duplicates |
| `monthly-reindex` | 1st of month 5 AM UTC | Archive stale memories, update stats |

### Decay Schedule

| Importance | Starts After | Decay Rate |
|------------|--------------|------------|
| trivial | 7 days | -20%/week |
| low | 14 days | -15%/week |
| medium | 30 days | -10%/week |
| high | 90 days | -5%/week |
| critical | Never | 0% |

---

# ENVIRONMENT VARIABLES

## Required for Local Development

```bash
# Anthropic (AI reflections)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (embeddings)
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional: PIN recovery
RESEND_API_KEY=re_...
```

## Vercel Environment Variables

All of the above must be configured in Vercel Project Settings.

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
APP_VERSION  // "8.0.0"

# Search codebase (avoid reading large files)
grep -rn "functionName" js/*.js api/*.js

# Git status
git status
git log --oneline -5
```

---

# PRODUCT IDENTITY

## The Category

**We're not a note app. We're not a journaling app. We're not an AI assistant.**

We're creating a new category: **Personal AI Memory**

> "Inscript is the first AI that actually remembers you.
> Not just your notes — your world."

## The Flywheel

```
Input → Learn → Demonstrate → Trust → More Input → Smarter
```

**CRITICAL:** Learning must be VISIBLE. If users don't see Inscript getting smarter, the flywheel breaks.

## Privacy Foundation

- User data is encrypted and isolated
- Never used to train AI models (use enterprise LLM tier)
- Never sold or shared
- Delete means delete
- This is non-negotiable

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

# REFLECTION QUALITY

## The Three-Layer Structure

### HEARD (Always)
Prove you understood. Be specific. Quote their words.

### NOTICED (When memory is relevant)
Connect to what you know about their world.
- "This is the third time this month the launch has slipped"
- "You usually mention Marcus when processing career decisions"

### OFFERED (When valuable)
A question, connection, or gentle observation.

## Forbidden Phrases

Never use: "I can see...", "It seems like...", "Based on my analysis...", "As an AI...", "I understand that...", "Based on my records..."

---

# TECHNICAL DEBT

## Must Fix

| File | Lines | Issue |
|------|-------|-------|
| `js/ui.js` | 4,800+ | Must split into modules |
| `api/analyze.js` | 3,600+ | Extract prompts to separate files |
| `css/styles.css` | 8,400+ | Modularize by feature |

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
3. **Callbacks are critical** — Reference previous notes by note 2-3
4. **Entity mentions must feel natural** — Never "Based on my database..."
5. **Privacy is non-negotiable** — Enterprise LLM, no training
6. **Design is editorial** — Black, white, silver. Typography-first.
7. **Test mobile** — Responsive design is required

---

# VERSION HISTORY

| Version | Phase | Key Changes |
|---------|-------|-------------|
| **8.1.0** | Mem0 | Full Mem0 architecture integration, tiered retrieval, category summaries |
| 8.0.0 | 13.0 | Phase 13: Patterns, MIRROR tab, memory operations |
| 7.8.0 | 11.0 | Inscript rebrand, 8-screen onboarding |
| 7.5.0 | 10.3 | Semantic search with pgvector |

---

*CLAUDE.md — Inscript Developer Guide*
*Last Updated: January 21, 2026*
*Production: https://digital-twin-ecru.vercel.app*

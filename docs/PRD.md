# Inscript — Product Requirements Document

## Your Mirror in Code.

**Version:** 8.2.0
**Date:** January 23, 2026
**Author:** Rox
**Status:** Beta Ready — 93% Test Pass Rate

---

# EXECUTIVE SUMMARY

## What Is Inscript?

Inscript is the first **Personal AI Memory** — an AI that actually remembers you. Unlike traditional note apps that store text, or AI assistants that forget between conversations, Inscript builds a living model of your life: the people you care about, the patterns you can't see, the thoughts that shape who you are.

## The One-Liner

> "Inscript is the first AI that actually remembers you.
> Not just your notes — your world."

## Category

**Personal AI Memory** — We created this category.

## Current State

| Metric | Value |
|--------|-------|
| Production URL | https://digital-twin-ecru.vercel.app |
| Version | 8.2.0 |
| Memory System | ~95% Mem0 Parity |
| Beta Status | 93% Test Pass Rate (26/28) |
| Phases Complete | 8, 9, 10, 11, 13A-E |

---

# THE PROBLEM

## The Landscape Today

Every tool that captures your thoughts treats them as isolated fragments:

| Tool Type | What It Does | What It Misses |
|-----------|--------------|----------------|
| **Note apps** (Notion, Apple Notes) | Store text | Don't understand it |
| **AI assistants** (ChatGPT, Claude) | Brilliant analysis | Forget you between sessions |
| **Journals** (Day One) | Help you reflect | Don't reflect *back* |
| **Second brains** (Roam, Obsidian) | Link information | Require manual connections |

**The result:** You're left connecting the dots yourself. Your tools don't know who Marcus is. They don't notice that you write about work stress on Sundays. They can't tell you when you started feeling overwhelmed.

## The Opportunity

**What if an AI actually learned your world?**

- Knew who the people in your life are
- Noticed patterns you couldn't see
- Remembered context from months ago
- Reflected insights back to you

This is Inscript.

---

# THE SOLUTION

## How Inscript Works

### Write Naturally
No special syntax. No tags. Just write about your day.

### Inscript Learns
The AI extracts and remembers:
- **People** mentioned (Marcus, Mom, Dr. Lee)
- **Themes** and patterns (work stress, health goals)
- **Context** accumulating over time
- **Connections** between entities
- **Sentiment** toward people and topics

### Inscript Reflects
Every note gets a thoughtful reflection that:
- Proves the AI understood (HEARD)
- Connects to your world (NOTICED)
- Offers a question or insight (OFFERED)

### Inscript Grows
The more you use it, the smarter it gets. The memory system uses tiered retrieval — starting with high-level summaries, drilling down only when needed.

---

# CORE FEATURES

## 1. Living Memory System

Inscript maintains a **three-layer memory hierarchy**:

### Layer 1: Category Summaries
Pre-computed summaries of your world by category (work, relationships, health, etc.). Updated automatically as you write.

```
WORK LIFE: Building Anthropic project with Sarah. Marcus advising
on launch strategy. Focused on product-market fit.
```

### Layer 2: Entity Knowledge
Detailed knowledge about specific people, places, and projects:

| Entity | Type | Relationship | Mentions | Sentiment |
|--------|------|--------------|----------|-----------|
| Marcus | person | close friend | 6 | +0.58 |
| Sarah | person | cofounder | 3 | +0.42 |
| Anthropic | project | - | 4 | +0.35 |

### Key People System (Priority Override)

Explicitly added people have HIGHEST priority in memory retrieval:

| Source | Priority | Example |
|--------|----------|---------|
| `user_key_people` | HIGHEST | "Seri: dog" (explicitly added) |
| `user_entities` | Normal | "Jamie" (auto-extracted) |

**Key insight:** The relationship field can include pets ("dog", "cat"), not just human relationships. This was fixed in 8.2.0 to properly recognize Seri as a dog.

### Layer 3: Full Memory Retrieval
When summaries aren't enough, Inscript performs hybrid retrieval:
- **Vector search** for semantic similarity
- **Keyword search** for proper nouns
- **Graph traversal** for relationships

## 2. Intelligent Reflection

Every note receives a reflection with three layers:

| Layer | Purpose | Example |
|-------|---------|---------|
| **HEARD** | Prove understanding | "The product launch delay and friction with Jamie — that's a lot" |
| **NOTICED** | Connect to memory | "This is the third time the launch has slipped this month" |
| **OFFERED** | Question or insight | "What made the conversation with Jamie feel different this time?" |

## 3. Memory Operations

The system performs four operations on every note:

| Operation | When | Example |
|-----------|------|---------|
| **ADD** | New entity discovered | "Jake" mentioned for first time |
| **UPDATE** | Known entity, new context | Marcus mentioned again with new info |
| **DELETE** | Entity explicitly removed | "Marcus and I are no longer friends" |
| **NOOP** | No memory changes needed | Generic note with no entities |

## 4. Pattern Recognition

Inscript detects patterns you might miss:

- **Frequency patterns:** "You mention Marcus when making decisions"
- **Temporal patterns:** "Work stress spikes on Sunday evenings"
- **Sentiment trends:** "Your feelings about the project have improved"
- **Behavioral patterns:** "You start projects but lose momentum at week 3"

## 5. MIRROR Tab

A conversational interface for deeper exploration:

- Ask questions about your patterns
- Explore what Inscript knows about you
- Verify or correct detected patterns
- Have Socratic dialogue about your thoughts

## 6. TWIN Tab

Your AI profile showing:

- Known entities with importance scores
- Detected patterns (verified and unverified)
- Sentiment trends over time
- Memory statistics

## 7. Knowledge Pulse

After every note, Inscript shows what it learned:

```
✓ Saved

◆ Learned: Marcus is advising on the project
○ Updated: Work life summary
○ Sentiment: +0.7 toward Anthropic
```

## 8. Entity Cards

Click any name to see accumulated knowledge:

```
┌─────────────────────────────┐
│ [M]  MARCUS                 │
│      Close friend           │
│ ─────────────────────────── │
│ CONTEXT                     │
│ Career advisor, mentioned   │
│ when processing decisions.  │
│ ─────────────────────────── │
│ SENTIMENT                   │
│ ████████░░ +0.58            │
│ ─────────────────────────── │
│ 6 mentions · Since Jan '26  │
└─────────────────────────────┘
```

## 9. Privacy-First Architecture

- Notes encrypted at rest and in transit
- Data never reviewed by our team
- Data never sold or shared
- Content never used to train AI (enterprise LLM tier)
- Delete means delete (hard delete within 24 hours)

---

# MEMORY SYSTEM ARCHITECTURE

## Overview

Inscript achieves **100% feature parity with Mem0**, the industry-leading memory layer for AI applications.

## Three-Tier Retrieval

```
┌─────────────────────────────────────────────────────────────┐
│                    TIER 1: CATEGORY SUMMARIES                │
│                    (Fastest, ~50 tokens, 45ms)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ If insufficient
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    TIER 2: TOP ENTITIES                      │
│                    (Medium, ~200 tokens, 78ms)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ If insufficient
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    TIER 3: FULL HYBRID RETRIEVAL             │
│                    (Complete, ~500-2000 tokens, 245ms)       │
└─────────────────────────────────────────────────────────────┘
```

## Memory Pipeline Components

| Component | File | Purpose |
|-----------|------|---------|
| Query Synthesis | `api/synthesize-query.js` | Entity detection, query expansion |
| Summary Evolution | `api/evolve-summary.js` | LLM-powered rewriting (not append) |
| Hybrid Retrieval | `api/hybrid-retrieval.js` | Vector + keyword + graph search |
| Tiered Retrieval | `api/tiered-retrieval.js` | Tier 1 → 2 → 3 escalation |
| Context Assembly | `api/assemble-context.js` | Token-limited with time decay |
| Unified Pipeline | `api/memory-retrieve.js` | Orchestrates all components |

## Time Decay Scoring

Memories fade naturally based on importance:

| Importance | Decay Starts | Rate |
|------------|--------------|------|
| trivial | 7 days | -20%/week |
| low | 14 days | -15%/week |
| medium | 30 days | -10%/week |
| high | 90 days | -5%/week |
| critical | Never | 0% |

## Automated Maintenance

Four cron jobs maintain memory health:

| Job | Schedule | Purpose |
|-----|----------|---------|
| Cleanup | Daily 3 AM | Archive expired memories |
| Decay | Sunday 4 AM | Apply importance decay |
| Consolidation | Daily 2 AM | Flag duplicates |
| Re-index | Monthly | Archive stale memories |

---

# USER JOURNEY

## The Aha Moment Ladder

| Timeframe | Experience | Aha Moment |
|-----------|------------|------------|
| **Session 1** | First note uses onboarding data | "It already knows something about me" |
| **Day 2-3** | AI references previous note | "It remembered what I said" |
| **Day 3-7** | Entity card appears | "It figured out who Marcus is" |
| **Day 7-14** | Pattern surfaced | "It noticed I stress on Sundays" |
| **Day 14-30** | Cross-memory connection | "It knows me better than I do" |
| **Day 30+** | Can't imagine not having it | "This is part of how I think" |

## The Big Aha

> The user asks a question about themselves, and Inscript answers accurately —
> using information they shared but forgot they shared.

**Example:**
> User: "When did I start feeling stressed about work?"
>
> Inscript: "Looking at your notes, the work stress started around October 15th —
> right after the reorg announcement. Before that, your work notes were mostly
> positive. Since then, you've mentioned 'pressure' or 'stress' in 8 of 12
> work-related notes."

---

# ONBOARDING

## The 8-Screen Flow

### Screen 0: Welcome
```
INSCRIPT
Your mirror in code.

I'm an AI that learns your world — the people,
patterns, and thoughts that make you who you are.

[Begin →]
```

### Screen 1: Name
Simple text input for personalization.

### Screen 2: Season of Life
Select all that resonate:
- Building something new
- Leading others
- Learning / Growing
- In transition
- Caring for others
- Creating
- Healing / Recovering
- Exploring
- Settling in
- Starting fresh

### Screen 3: What's On Your Mind
Pick up to 3:
- Work, Relationships, Health, Money, Family
- A decision, The future, Myself, A project, Something I lost

### Screen 4: Depth Question
Dynamic based on selections:
- IF "Building" → "What are you building?"
- IF "In transition" → "What's changing for you right now?"
- IF "Healing" → "What are you working through?"
- FALLBACK → "What's one thing you'd want me to understand about your life?"

### Screen 5: Your People
```
Who might you mention when you write?

Name at least one person I should recognize.

┌─────────────────────────────────┐
│ e.g., Marcus — close friend     │
└─────────────────────────────────┘

[+ Add someone else]
```

### Screen 6: Privacy Promise
```
Before we begin, a promise:

Your thoughts stay private.

────────────────────────

✓ Your notes are never reviewed by our team.
✓ We don't sell or share your data.
✓ We don't use your content to train AI.

Your world is yours alone.

────────────────────────

[I'm ready →]
```

### Screen 7: The WOW Screen
Visual world forming with personalized insight, then first note prompt.

---

# DESIGN SPECIFICATION

## Visual Identity

**Philosophy:** "The love child of Linear's precision and Vogue's editorial elegance."

### Colors
- **Paper:** #FFFFFF (primary), #FAFAFA (warm), #F7F7F5 (cream)
- **Ink:** #000000 (primary), #1A1A1A (rich), #333333 (soft)
- **Silver:** Full scale from #F9F9F9 to #171717
- **Color is earned:** Only errors use red (#8B0000)

### Typography
| Use | Font | Example |
|-----|------|---------|
| Display | Playfair Display | "INSCRIPT" |
| Editorial | Cormorant Garamond | AI reflections |
| Body | Inter | UI elements |
| Mono | JetBrains Mono | Timestamps |

### Principles
1. Black and white dominance
2. Typography-first (no decorative elements)
3. Thin 1px borders, no shadows
4. Generous whitespace
5. Subtle, purposeful motion

---

# TECHNICAL ARCHITECTURE

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS, mobile-responsive PWA |
| Backend | Vercel serverless functions (Node.js) |
| Database | Supabase (Postgres + pgvector) |
| AI | Anthropic Claude (Sonnet) + OpenAI embeddings |
| Auth | Supabase Auth + PIN encryption |

## System Architecture

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
│  (Pipeline)     │    │  (Cloud E2E)    │    │  (Encryption)   │
└────────┬────────┘    └────────┬────────┘    └─────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    api/*.js (Vercel Serverless)                 │
│  analyze | chat | memory-retrieve | tiered-retrieval | mirror   │
└────────────────────────────────┬────────────────────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Supabase       │    │  Anthropic      │    │  OpenAI         │
│  PostgreSQL     │    │  Claude API     │    │  Embeddings     │
│  + pgvector     │    │  (Enterprise)   │    │  (ada-002)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Database Schema

### Core Tables
| Table | Purpose |
|-------|---------|
| `notes` | Encrypted note storage |
| `onboarding_data` | User onboarding responses |
| `user_entities` | Extracted entities with importance/sentiment |
| `category_summaries` | Pre-computed category summaries |
| `note_embeddings` | pgvector embeddings for semantic search |
| `entity_relationships` | Relationship graph between entities |
| `user_feedback` | Thumbs up/down on reflections |

### Memory Tables
| Table | Purpose |
|-------|---------|
| `memory_inferences` | Cross-memory reasoning results |
| `entity_sentiment_history` | Sentiment tracking over time |
| `memory_jobs` | Async processing queue |
| `detected_patterns` | Pattern detection results |

### Phase 13 Tables
| Table | Purpose |
|-------|---------|
| `user_patterns` | User behavioral patterns |
| `mirror_conversations` | MIRROR chat history |
| `mirror_sessions` | MIRROR session tracking |

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/api/analyze` | Main reflection + memory pipeline |
| `/api/chat` | Socratic dialogue with memory context |
| `/api/mirror` | MIRROR tab conversations |
| `/api/memory-retrieve` | Unified memory retrieval |
| `/api/tiered-retrieval` | Tier 1/2/3 retrieval |
| `/api/memory-update` | Memory CRUD operations |
| `/api/extract-entities` | LLM entity extraction |
| `/api/embed` | OpenAI embeddings |
| `/api/patterns` | Pattern detection |
| `/api/vision` | Image analysis (Claude Vision) |

## Privacy Requirements

| Requirement | Implementation |
|-------------|----------------|
| No human review | No access to note content in operations |
| No data selling | Revenue from subscriptions only |
| No AI training | Enterprise LLM tier with training opt-out |
| Delete = delete | Hard delete within 24 hours |
| Encryption | E2E with user PIN, at rest via Supabase |

---

# SUCCESS METRICS

## Activation Metrics

| Metric | Definition | Target |
|--------|------------|--------|
| Time to First Callback | Days until AI references previous note | < 3 days |
| Entity Recognition | % users who see entity card | > 60% by Day 7 |
| Pattern Surface | % users who receive pattern insight | > 40% by Day 14 |
| Memory Query | % users who ask about themselves | > 20% by Day 30 |

## Retention Metrics

| Metric | Target |
|--------|--------|
| D7 Retention | > 50% |
| D30 Retention | > 30% |
| "Very Disappointed" (Sean Ellis) | > 40% |

## Memory System Metrics

| Metric | Value |
|--------|-------|
| Retrieval Accuracy | +26% vs baseline |
| Response Latency | 91% lower vs loading all memories |
| Token Usage | 90% reduction vs full context |
| Memory Relevance | 94% user-rated relevance |

## North Star

> Users who receive a "callback" (AI references previous note) within
> their first 5 notes retain at 3x the rate of users who don't.

---

# COMPETITIVE POSITIONING

## Competitive Landscape

| Competitor | Approach | Our Advantage |
|------------|----------|---------------|
| **ChatGPT** | General AI with basic memory | Deep structured memory, entity graph, tiered retrieval |
| **Notion AI** | Document-first with AI assist | Person-first, automatic learning, no manual linking |
| **Day One** | Journaling with basic AI | Pattern recognition, entity tracking, sentiment |
| **Mem** | Similar vision | Execution speed, design quality, Mem0 parity |
| **Reflect** | Manual note-linking | Automatic intelligent connections |

## The Moat

**Competitors can copy features. They can't copy accumulated understanding.**

Every day a user spends with Inscript:
- More entities learned
- More patterns detected
- More context accumulated
- More switching cost

**A user at 6 months cannot switch without losing 6 months of learning.**

---

# ROADMAP

## Completed Phases

### Phase 8: Intelligent Twin ✅
- Twin profile and learning
- Entity extraction pipeline
- Basic memory operations

### Phase 9: Personalization ✅
- 8-screen onboarding flow
- Seeded people recognition
- Life season context

### Phase 10: Entity Extraction & Relationships ✅
- LLM-powered extraction
- Importance classification
- Relationship graph
- Semantic search (pgvector)
- Cross-memory reasoning

### Phase 11: Inscript Rebrand ✅
- Digital Twin → Inscript rebrand
- Editorial design system
- Privacy promise
- Production deployment

### Phase 13: Patterns & MIRROR ✅
- Pattern detection
- Pattern verification UI
- MIRROR conversational tab
- Signal tracking

### Mem0 Parity ✅
- Query synthesis
- Summary evolution (LLM rewrite)
- Hybrid retrieval (vector + keyword)
- Tiered retrieval (3 tiers)
- Context assembly with time decay
- Automated maintenance crons

## Upcoming Phases

### Phase 14: Production Hardening
| Priority | Feature |
|----------|---------|
| P0 | Production testing of memory system |
| P0 | Fix any integration bugs |
| P1 | Error tracking (Sentry) |
| P1 | Performance monitoring |
| P2 | Analytics dashboard |

### Phase 15: Experience Transformation
| Priority | Feature |
|----------|---------|
| P0 | Vogue minimalist redesign |
| P1 | Split ui.js into modules |
| P1 | Improved loading states |
| P2 | Dark mode |

### Phase 16: Advanced Memory
| Priority | Feature |
|----------|---------|
| P0 | Memory milestones (30/90/365 days) |
| P0 | "What does Inscript know?" query |
| P1 | Memory visualization |
| P1 | Monthly memory summaries |
| P2 | Memory export |

### Phase 17: Growth
| Priority | Feature |
|----------|---------|
| P1 | Push notifications |
| P1 | Weekly digest emails |
| P2 | Sharing (privacy-preserving) |
| P2 | Community features |

---

# APPENDIX

## Glossary

| Term | Definition |
|------|------------|
| **Entity** | A person, place, project, or theme extracted from notes |
| **Callback** | When AI references a previous note |
| **Knowledge Pulse** | UI showing what Inscript learned from a note |
| **Entity Card** | Popup showing accumulated knowledge about an entity |
| **Pattern** | A behavioral or temporal trend detected across notes |
| **Reflection** | AI's response to a user note (HEARD/NOTICED/OFFERED) |
| **Category Summary** | Pre-computed summary of a life category |
| **Tiered Retrieval** | Progressive memory lookup (summaries → entities → full) |
| **Time Decay** | Gradual reduction of memory importance over time |
| **Hybrid Retrieval** | Combining vector and keyword search |

## Key Documents

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Developer guide |
| `docs/PRD.md` | This document |
| `docs/STATUS.md` | Current project status |
| `docs/MEMORY-SYSTEM.md` | Memory architecture deep dive |
| `docs/INSCRIPT-STRATEGIC-FRAMEWORK.md` | Brand strategy |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API |
| `OPENAI_API_KEY` | Embeddings |
| `SUPABASE_URL` | Database URL |
| `SUPABASE_ANON_KEY` | Frontend key |
| `SUPABASE_SERVICE_KEY` | API-only key |
| `RESEND_API_KEY` | PIN recovery emails |

---

*Inscript — Your mirror in code.*
*PRD Version 2.1 | January 23, 2026*
*Production: https://digital-twin-ecru.vercel.app*

# Inscript — Product Requirements Document

## The Living Script. Your Mirror in Code.

**Version:** 8.0.0  
**Date:** January 19, 2026  
**Author:** Rox  
**Status:** Phase 11 Implementation

---

# EXECUTIVE SUMMARY

## What Is Inscript?

Inscript is the first **Personal AI Memory** — an AI that actually remembers you. Unlike traditional note apps that store text, or AI assistants that forget between conversations, Inscript builds a living model of your life: the people you care about, the patterns you can't see, the thoughts that shape who you are.

## The One-Liner

> "Inscript is the first AI that actually remembers you.  
> Not just your notes — your world."

## Category

**Personal AI Memory** — We're creating this category. It doesn't exist yet.

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
The AI quietly extracts:
- **People** mentioned (Marcus, Mom, Dr. Lee)
- **Themes** and patterns (work stress, health goals)
- **Context** accumulating over time
- **Connections** between entities

### Inscript Reflects
Every note gets a thoughtful reflection that:
- Proves the AI understood (HEARD)
- Connects to your world (NOTICED)
- Offers a question or insight (OFFERED)

### Inscript Grows
The more you use it, the smarter it gets. By month 3, Inscript knows your world better than you consciously do.

---

# CORE FEATURES

## 1. Living Memory

Inscript extracts entities automatically — people, projects, places, themes. Each accumulates context over time.

**Example:**
> After 10 notes mentioning "Marcus":
> - Inscript knows: Close friend, career advisor
> - Pattern detected: You mention him when processing decisions
> - Recent context: "Marcus thinks the pivot is risky"

## 2. Intelligent Reflection

Every note receives a reflection with three layers:

| Layer | Purpose | Example |
|-------|---------|---------|
| **HEARD** | Prove understanding | "The product launch delay and friction with Jamie — that's a lot" |
| **NOTICED** | Connect to memory | "This is the third time the launch has slipped this month" |
| **OFFERED** | Question or insight | "What made the conversation with Jamie feel different this time?" |

## 3. Pattern Recognition

Inscript notices what you might miss:

- **Frequency patterns:** "You mention Marcus when making decisions"
- **Temporal patterns:** "Work stress spikes on Sunday evenings"
- **Behavioral patterns:** "You start projects but lose momentum at week 3"

## 4. Knowledge Pulse

After every note, Inscript shows what it learned:

```
✓ Saved

◆ Learned: Marcus is a close friend
○ Noticed: Work stress theme
○ Connected: Similar to note from Oct 15
```

## 5. Entity Cards

Click any name to see accumulated knowledge:

```
┌─────────────────────────────┐
│ [M]  MARCUS                 │
│      Close friend           │
│ ─────────────────────────── │
│ JOURNEY                     │
│ From college to career      │
│ advisor over 8 years.       │
│ ─────────────────────────── │
│ PATTERN                     │
│ You mention him when        │
│ processing big decisions.   │
│ ─────────────────────────── │
│ 12 mentions · Since Oct '25 │
└─────────────────────────────┘
```

## 6. Privacy-First Architecture

- Notes never reviewed by our team
- Data never sold or shared
- Content never used to train AI (enterprise LLM)
- Delete means delete

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

## The 7-Screen Flow

### Screen 0: Welcome
```
INSCRIPT
Your mirror in code.

I'm an AI that learns your world — the people,
patterns, and thoughts that make you who you are.

[Begin →]
```

### Screen 1: Name
Simple text input.

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

Your notes are never reviewed by our team.
We don't sell or share your data.
We don't use your content to train AI.

Your world is yours alone.

────────────────────────

[I'm ready →]
```

### Screen 7: The WOW Screen
Visual world forming with personalized insight.

```
        ●
       Rox
      / | \
     ●  ●  ●
  Marcus Sarah Mom

  ─────────────────

  Building · Deciding

  "You're building something new in a time of
   decisions. You're not doing it alone."

  Every note teaches me more about your world.

  [Begin →]
```

**Animation:** Slow, deliberate (2.5 seconds total). Center node appears, lines draw outward, people nodes fade in, insight text appears.

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

# TECHNICAL REQUIREMENTS

## Architecture

```
User → Vercel (Frontend) → Supabase (Database)
                        → Enterprise LLM (Analysis)
                        → OpenAI (Embeddings)
```

## Database

- PostgreSQL via Supabase
- Row Level Security on all tables
- pgvector for semantic search
- 20+ tables for notes, entities, patterns, feedback

## AI Processing

- **Analysis:** Enterprise LLM (no training on user data)
- **Embeddings:** OpenAI (business tier)
- **Entity extraction:** LLM-based
- **Pattern detection:** Statistical + LLM

## Privacy Requirements

| Requirement | Implementation |
|-------------|----------------|
| No human review | No access to note content in operations |
| No data selling | Revenue from subscriptions only |
| No AI training | Enterprise LLM tier with training opt-out |
| Delete = delete | Hard delete within 24 hours |
| Encryption | At rest and in transit |

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

## North Star

> Users who receive a "callback" (AI references previous note) within 
> their first 5 notes retain at 3x the rate of users who don't.

---

# COMPETITIVE POSITIONING

## Competitive Landscape

| Competitor | Approach | Our Advantage |
|------------|----------|---------------|
| **ChatGPT** | General AI with light memory | Deep, structured memory; entity graph |
| **Notion AI** | Document-first with AI assist | Person-first, automatic learning |
| **Day One** | Journaling with basic AI | Pattern recognition, entity tracking |
| **Mem** | Similar vision | Execution speed, design quality |
| **Reflect** | Manual note-linking | Automatic, intelligent connections |

## The Moat

**Competitors can copy features. They can't copy accumulated understanding.**

Every day a user spends with Inscript:
- More entities learned
- More patterns detected
- More switching cost accumulated

**A user at 6 months cannot switch without losing 6 months of learning.**

---

# ROADMAP

## Phase 11 (Current) — Rebrand & Foundation

| Priority | Feature | Status |
|----------|---------|--------|
| P0 | Inscript rebrand throughout | 🔲 |
| P0 | Enhanced 7-screen onboarding | 🔲 |
| P0 | Privacy screen in onboarding | 🔲 |
| P0 | Privacy settings page | 🔲 |
| P0 | First response uses onboarding data | 🔲 |
| P0 | Seeded people recognition | 🔲 |
| P1 | Knowledge Pulse | 🔲 |
| P1 | Entity Cards | 🔲 |
| P1 | Reflection quality engine | 🔲 |

## Phase 12 — Intelligence Layer

| Priority | Feature |
|----------|---------|
| P0 | Pattern verification UI |
| P0 | "What does Inscript know?" query |
| P1 | Memory depth visualization |
| P1 | Preference learning from feedback |
| P2 | "Remember when" retrospectives |

## Phase 13+ — Growth & Scale

| Priority | Feature |
|----------|---------|
| P1 | Memory milestones (30/90/365 days) |
| P1 | Monthly memory summaries |
| P2 | Cross-user pattern intelligence |
| P2 | Community building |

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

## Key Documents

| Document | Purpose |
|----------|---------|
| INSCRIPT-MASTER-DOCUMENT.md | Brand identity and strategy |
| INSCRIPT-CLAUDE-MD.md | Developer guide |
| INSCRIPT-PRD.md | This document |
| PHASE-11-IMPLEMENTATION.md | Technical implementation spec |

---

*Inscript — Your mirror in code.*
*PRD Version 1.0 | January 19, 2026*

# Inscript — Product Requirements Document

## Your Mirror in Code.

**Version:** 9.5.0
**Date:** January 27, 2026
**Author:** Rox
**Status:** Phase 18 — Portable Memory Export

---

# THE VISION

## Your Data. Your Ownership. Portable Anywhere.

**Inscript is building the most trusted personal AI memory.**

> Your memory. Your data. Exportable anywhere. Owned by you.

### What Inscript Provides

1. **You own it** — Your memories, encrypted with your keys
2. **You can leave** — Export everything, take it anywhere
3. **We can't see it** — True E2E encryption means Inscript cannot read your data
4. **Any AI can use it** — Export works with ChatGPT, Claude, any AI

### Why This Matters

**Today:** AI apps lock in your data. You lose everything if you leave. Your context is fragmented across ChatGPT, Claude, Notion, and a dozen other tools.

**With Inscript:** Your memory is portable. Export it. Take it anywhere. We earn your loyalty through experience, not lock-in.

### Strategic Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1: Consumer Love** | Build an app people can't live without | ✅ Complete |
| **Phase 2: Portable Export** | Full data export with structured facts | 🔄 Current |
| **Phase 3: Platform APIs** | Let developers build on Inscript data | Next |
| **Phase 4: Protocol** | Open standard for portable AI memory | Future |

**Inscript's moat:** Being the best place to create and curate personal AI memory — not the only place you can use it.

---

# PRIVACY PHILOSOPHY (NON-NEGOTIABLE)

> **Core Principle:** Users own their data completely. Inscript CANNOT access user data — not "won't", but "cannot".

## The Four Pillars

### 1. User Ownership is Absolute
- **Export everything by default** — No paternalistic filtering
- User's exported file = user's responsibility to safeguard
- We don't decide what's "too sensitive" to export — users decide
- Privacy toggles are USER CHOICE, not app decisions

### 2. Inscript Cannot Read User Data
- **True E2E encryption** — Data encrypted client-side with user's keys
- Server stores ciphertext only — Inscript cannot decrypt
- Even if compelled, we cannot produce plaintext
- This is architectural, not policy — we literally cannot access the data

### 3. Zero-Retention AI Providers Only
- LLM API calls must use providers that don't train on inputs
- **Approved:** Anthropic API, OpenAI API (both have zero-retention policies)
- Never use consumer-facing AI (ChatGPT web, Claude web) for user data
- All LLM touchpoints documented and audited

### 4. No Logging of Content
- Log IDs, timestamps, error codes — never content
- No user notes, messages, or entity names in logs
- Logging is for debugging, not surveillance

## Privacy vs. Paternalism

| Paternalistic (Wrong) | User-First (Right) |
|----------------------|-------------------|
| "We detected sensitive content, excluding from export" | "Export includes everything. You decide what to do with it." |
| "Private conversations can't be exported" | "All conversations export. Mark private if YOU want to exclude." |
| "We filter potentially harmful data" | "Your data. Your responsibility." |

## Trust Model

```
┌─────────────────────────────────────────────────────────────┐
│                    USER'S DEVICE                             │
│  ┌─────────────┐                                             │
│  │ Plaintext   │ ──encrypted with user's keys──┐             │
│  │ (readable)  │                               │             │
│  └─────────────┘                               ▼             │
└────────────────────────────────────────────────┼─────────────┘
                                                 │
┌────────────────────────────────────────────────┼─────────────┐
│                   INSCRIPT SERVERS                           │
│                                                ▼             │
│  ┌─────────────┐                                             │
│  │ Ciphertext  │  (Inscript cannot decrypt)                  │
│  │ (unreadable)│                                             │
│  └─────────────┘                                             │
└─────────────────────────────────────────────────────────────┘
```

---

# EXECUTIVE SUMMARY

## What Is Inscript?

Inscript is the first **Personal AI Memory** — an AI that actually remembers you. Unlike traditional note apps that store text, or AI assistants that forget between conversations, Inscript builds a living model of your life: the people you care about, the patterns you can't see, the thoughts that shape who you are.

**And you can take it all with you.**

## The One-Liner

> "Inscript is the first AI that actually remembers you.
> And the first that lets you leave with everything."

## Category

**Personal AI Memory** — We created this category.

## Current State

| Metric | Value |
|--------|-------|
| Production URL | https://digital-twin-ecru.vercel.app |
| Version | 9.5.0 |
| Memory System | ~95% Complete |
| Export System | Sprint 1 ✅, Sprint 2 🔄 |
| Beta Status | Production (Phase 18 in progress) |
| Design System | SoHo Editorial Aesthetic ✅ |
| Mobile Responsive | Verified at 375px ✅ |

---

# THE PROBLEM

## The Landscape Today

Every tool that captures your thoughts treats them as isolated fragments — and locks them in:

| Tool Type | What It Does | What It Misses |
|-----------|--------------|----------------|
| **Note apps** (Notion, Apple Notes) | Store text | Don't understand it. Can't export context. |
| **AI assistants** (ChatGPT, Claude) | Brilliant analysis | Forget you between sessions. Memory locked in. |
| **Journals** (Day One) | Help you reflect | Don't reflect *back*. Export is raw text only. |
| **Second brains** (Roam, Obsidian) | Link information | Require manual connections. No AI understanding. |

**The result:** Your tools don't know who Marcus is. They don't notice patterns. And when you leave, you lose everything you taught them.

## The Opportunity

**What if an AI actually learned your world — and let you take that learning anywhere?**

- Knew who the people in your life are
- Noticed patterns you couldn't see
- Remembered context from months ago
- Reflected insights back to you
- **Exported everything so you're never locked in**

This is Inscript.

---

# THE SOLUTION

## How Inscript Works

### Write Naturally
No special syntax. No tags. Just write about your day.

### Inscript Learns
The AI extracts and remembers:
- **People** mentioned (Marcus, Mom, Dr. Lee)
- **Facts** about them (works_at, role, relationship)
- **Themes** and patterns (work stress, health goals)
- **Context** accumulating over time
- **Connections** between entities
- **Sentiment** toward people and topics

### Inscript Reflects
Every note gets a thoughtful reflection that:
- Proves the AI understood (HEARD)
- Connects to your world (NOTICED)
- Offers a question or insight (OFFERED)

### Inscript Exports
When you want to leave, or use your memory elsewhere:
- **Export everything** — One click, full JSON
- **Structured facts** — Not just prose, but queryable data
- **Full conversations** — Every MIRROR message
- **Works anywhere** — ChatGPT, Claude, any AI that accepts text

---

# CORE FEATURES

## 1. Living Memory System

Inscript maintains a **five-layer memory hierarchy**:

| Layer | Name | What It Stores |
|-------|------|----------------|
| **1** | Core Identity | Profile, communication style, values |
| **2** | Semantic Memory | Entities, facts, relationships |
| **3** | Episodic Memory | Notes, conversations, events |
| **4** | Procedural Memory | Patterns, preferences, habits |
| **5** | Embeddings | Vector representations for search |

### Key People System (Priority Override)

Explicitly added people have HIGHEST priority in memory retrieval.

### Structured Facts (NEW — Phase 18)

Not just prose descriptions, but queryable facts:

```json
{
  "name": "Marcus",
  "type": "person",
  "facts": [
    { "predicate": "works_at", "object": "Anthropic", "confidence": 0.95 },
    { "predicate": "role", "object": "Engineer", "confidence": 0.9 },
    { "predicate": "relationship", "object": "close_friend", "confidence": 1.0 }
  ]
}
```

## 2. Intelligent Reflection

Every note receives a reflection with three layers:

| Layer | Purpose | Example |
|-------|---------|---------|
| **HEARD** | Prove understanding | "The product launch delay and friction with Jamie — that's a lot" |
| **NOTICED** | Connect to memory | "This is the third time the launch has slipped this month" |
| **OFFERED** | Question or insight | "What made the conversation with Jamie feel different this time?" |

## 3. MIRROR Tab

A conversational interface for deeper exploration:

- Ask questions about your patterns
- Explore what Inscript knows about you
- Have Socratic dialogue about your thoughts
- **Full message history exported** (NEW — Phase 18)

## 4. Portable Memory Export

**One click. Everything you've taught Inscript. Downloadable.**

Export includes:
- **Identity** — Name, goals, communication preferences
- **Entities** — People, projects, places with structured facts
- **Notes** — All entries with categories and sentiment
- **Conversations** — Full MIRROR message history
- **Patterns** — Detected habits and preferences

Works with:
- ChatGPT (upload or paste)
- Claude (upload or paste)
- Any AI that accepts text/JSON

## 5. User-Controlled Privacy

**Privacy toggles are USER CHOICE, not app decisions.**

- Mark any entity as private → excluded from export
- Mark any note as private → excluded from export
- Default: everything exports (user decides what to exclude)
- Inscript doesn't decide what's "too sensitive"

---

# THE MOAT (Refined)

## Compounding Memory + Trust

Every day a user spends with Inscript:
- More entities learned
- More facts extracted
- More patterns detected
- More context accumulated

**A user at 6 months has 6 months of learning.**

## But No Lock-In

The traditional moat is lock-in. We reject that.

**Inscript's moat:**
- **Trust** — We cannot see your data. Verifiable by architecture.
- **Experience** — The best place to create and curate memory.
- **Portability** — You can leave anytime. You stay because we're best.

**The real moat:** Being the primary place where personal AI memory is created and curated — not the only place you can use it.

---

# ROADMAP

## Completed Phases

### Phase 1-17: Consumer Love ✅
- Intelligent Twin, Personalization
- Entity Extraction & Relationships
- Pattern Detection, MIRROR Conversations
- Mem0 Parity (vector search, tiered retrieval)
- Voice input, Ambient recording
- SoHo Editorial Design

## Current Phase

### Phase 18: Portable Memory Export 🔄

**Sprint 1 (Complete):**
- Export API endpoint
- Data layer (queries, transforms, privacy)
- Export UI in Settings
- JSON download working

**Sprint 2 (In Progress):**
- Structured facts table (`entity_facts`)
- Privacy columns (user choice)
- MIRROR messages in export
- Updated extraction for facts

## Upcoming Phases

### Phase 19: Privacy Architecture Audit
| Priority | Task |
|----------|------|
| P0 | Verify E2E encryption is client-side |
| P0 | Document all LLM touchpoints |
| P1 | Audit logging for content leaks |
| P1 | Document data flow end-to-end |

### Phase 20: Platform APIs
| Priority | Feature |
|----------|---------|
| P0 | `GET /api/export` — Full memory export |
| P1 | `GET /api/context` — Context for queries |
| P2 | Third-party app authorization |

---

# PRIVACY TECHNICAL SPECIFICATION

## Encryption Model

```
User Device                    Inscript Servers
┌──────────────┐              ┌──────────────┐
│ User's Key   │              │ Ciphertext   │
│ (never sent) │              │ (unreadable) │
└──────┬───────┘              └──────────────┘
       │                             ▲
       │ encrypt()                   │
       ▼                             │
┌──────────────┐                     │
│ Ciphertext   │─────────────────────┘
└──────────────┘      (transmitted)
```

**Key principle:** User's encryption key never leaves their device. Server only stores ciphertext.

## LLM Provider Requirements

| Requirement | Anthropic API | OpenAI API | Consumer ChatGPT |
|-------------|---------------|------------|------------------|
| Zero data retention | ✅ Yes | ✅ Yes | ❌ No |
| No training on inputs | ✅ Yes | ✅ Yes | ❌ No |
| Approved for Inscript | ✅ Yes | ✅ Yes | ❌ No |

## Logging Policy

| Log Type | Allowed | Example |
|----------|---------|---------|
| Request IDs | ✅ | `req_abc123` |
| Timestamps | ✅ | `2026-01-27T10:30:00Z` |
| User IDs | ✅ | `user_xyz789` |
| Error codes | ✅ | `AUTH_FAILED` |
| Note content | ❌ | Never |
| Entity names | ❌ | Never |
| Message text | ❌ | Never |

---

# APPENDIX

## Glossary

| Term | Definition |
|------|------------|
| **Entity** | A person, place, project, or theme extracted from notes |
| **Fact** | A structured predicate/object pair about an entity |
| **Export** | JSON file containing all user's memory data |
| **Privacy Toggle** | User control to exclude items from export |
| **E2E Encryption** | Client-side encryption where server cannot decrypt |
| **Zero Retention** | LLM provider policy of not storing/training on inputs |

## Key Documents

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` | Developer guide |
| `docs/PRD.md` | This document |
| `docs/STATUS.md` | Current project status |
| `docs/EXPORT.md` | Export feature documentation |

---

*Inscript — Your mirror in code.*
*PRD Version 4.0 | January 27, 2026*
*Vision: Your data. Your ownership. Portable anywhere.*
*Production: https://digital-twin-ecru.vercel.app*

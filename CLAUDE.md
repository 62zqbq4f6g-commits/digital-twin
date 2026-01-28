# CLAUDE.md — Inscript Developer Guide

## Version 9.12.0 | January 29, 2026

> **Phase:** 19 — Post-RAG Architecture Complete (Phase 3)
> **Status:** MIRROR Full Context Integration Live
> **Last Updated:** January 29, 2026

---

# QUICK REFERENCE

| Item | Value |
|------|-------|
| **App Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory |
| **Vision** | Your data. Your ownership. Portable anywhere. |
| **Version** | 9.12.0 |
| **Production URL** | https://digital-twin-ecru.vercel.app |
| **Working Directory** | `/Users/airoxthebox/Projects/digital-twin` |
| **Beta Status** | Production (Phase 19 Phase 3 Complete) |

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
- **AUDIT REQUIRED:** Verify current encryption is client-side, not server-side

### 3. Zero-Retention AI Providers Only
- LLM API calls must use providers that don't train on inputs
- **Approved:** Anthropic API, OpenAI API (both have zero-retention policies)
- **AUDIT REQUIRED:** Document all LLM touchpoints and verify retention policies
- Never use consumer-facing AI (ChatGPT web, Claude web) for user data

### 4. No Logging of Content
- Log IDs, timestamps, error codes — never content
- No user notes, messages, or entity names in logs
- **AUDIT REQUIRED:** Review all logging statements

## Privacy Audit Checklist (Verified January 27, 2026)

| Area | Question | Status |
|------|----------|--------|
| Encryption | Is encryption client-side (user keys) or server-side (Inscript keys)? | ✅ AES-256-GCM client-side |
| LLM Providers | Are all LLM calls to zero-retention APIs? | ✅ Anthropic + OpenAI API only |
| Logging | Do any logs contain user content? | ✅ Metadata only (510 calls audited) |
| RLS | Do all tables have row-level security? | ✅ All 37 tables verified |
| Export | Can users export 100% of their data? | ✅ Phase 18 |
| API Keys | Are all secrets in environment variables? | ✅ No hardcoded secrets |

## What This Means for Development

**ALWAYS:**
- Use RLS on every new table
- Use service role key only in API routes, never client
- Encrypt sensitive fields client-side
- Verify LLM provider retention policies

**NEVER:**
- Log user content (notes, messages, entity names)
- Use consumer AI interfaces for user data
- Make privacy decisions for users
- Store plaintext when encryption is possible

**Future Sprint:** Complete Privacy Architecture Audit
- Trace all data flows
- Verify E2E encryption implementation
- Document LLM provider policies
- Audit all logging

---

# STRATEGIC DIRECTION

> **Core Thesis:** Inscript is building portable AI memory.
> Your memory. Your data. Exportable anywhere. Owned by you.

## The Vision (Refined)

**What Inscript provides:**
1. **You own it** — Your memories, encrypted with your keys
2. **You can leave** — Export everything, take it anywhere
3. **We can't see it** — True E2E encryption means we cannot read your data
4. **Any AI can use it** — Export works with ChatGPT, Claude, any AI

**Why this matters:**
- Today: AI apps lock in your data. You lose everything if you leave.
- With Inscript: Your memory is portable. Export it. Take it anywhere. We earn your loyalty through experience, not lock-in.

**Inscript's moat:** Being the best place to create and curate personal AI memory — not the only place you can use it.

## Data Architecture (5 Layers)

| Layer | Name | What It Stores | Inscript Tables |
|-------|------|----------------|-----------------|
| **1** | Core Identity | Profile, communication style, values | `onboarding_data`, `user_profiles`, `user_key_people` |
| **2** | Semantic Memory | Entities, facts, relationships | `user_entities`, `entity_facts`, `entity_relationships` |
| **3** | Episodic Memory | Notes, conversations, events | `notes`, `mirror_conversations`, `mirror_messages`, `meetings` |
| **4** | Procedural Memory | Patterns, preferences, habits | `user_patterns`, `category_summaries` |
| **5** | Embeddings | Vector representations for search | `note_embeddings`, entity embeddings |

## Strategic Phases

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Consumer Love | ✅ Complete — App people can't live without |
| **Phase 2** | Portable Export | 🔄 Current — Full data export with structured facts |
| **Phase 3** | Platform APIs | Next — Let developers build on Inscript |
| **Phase 4** | Protocol | Future — Open standard for portable AI memory |

## Guiding Principles

1. **User ownership is absolute** — Users can export everything, anytime
2. **Privacy by architecture** — We cannot access user data, not just "won't"
3. **Earn loyalty through experience** — Not through lock-in
4. **Consumer-first** — The app must be magical before the protocol matters

---

# PHASE 18: PORTABLE MEMORY EXPORT

## Sprint 1 (Complete) ✅

| Feature | Status |
|---------|--------|
| `/api/export.js` endpoint | ✅ Done |
| `/lib/export/*` data layer | ✅ Done |
| Export button in Settings | ✅ Done |
| Privacy filtering (user choice) | ✅ Done |
| JSON download working | ✅ Done |

## Sprint 2 ✅ COMPLETE

| Feature | Owner | Status |
|---------|-------|--------|
| `entity_facts` table | T1 | ✅ Done |
| `privacy_level` columns | T1 | ✅ Done |
| Structured facts extraction | T1 | ✅ Done |
| MIRROR messages in export | T2 | ✅ Done |
| Entity facts in export | T2 | ✅ Done |
| Privacy UI (user choice) | T3 | ✅ Done |
| Updated tests | T4 | ✅ Done |

## Sprint 3 ✅ COMPLETE

| Feature | Owner | Status |
|---------|-------|--------|
| MIRROR facts integration | T1/T2 | ✅ Done (commit 54b77ed) |
| Fact retrieval layer | T2 | ✅ Done |
| Privacy audit | T3 | ✅ Done (see /docs/PRIVACY-AUDIT.md) |
| RLS verification | T4 | ✅ Verified (37/37 tables) |
| MIRROR testing | T4 | ✅ PASS (commit 08fabba fixed entity detection) |

**Fix Applied:** Added message-based entity detection using `getRelevantFacts` from `lib/mirror/fact-retrieval.js`. Facts now detected from user messages + conversation history.

## Terminal Ownership (Phase 18)

| Terminal | Role | Owns |
|----------|------|------|
| T1 | Database + Extraction | Migrations, `/api/extract-entities.js` |
| T2 | Data Layer | `/lib/export/*` |
| T3 | Frontend | `/js/settings-export.js`, `/js/privacy-controls.js` |
| T4 | QA + Migrations | Tests, Supabase execution |

**Migration Workflow:** T1 writes SQL → T4 executes in Supabase

## Export Structure (v1.1.0)

```json
{
  "inscript_export": {
    "identity": {
      "name": "...",
      "goals": [...],
      "communication": {...},
      "key_people": [...]
    },
    "entities": [
      {
        "name": "Marcus",
        "type": "person",
        "facts": [
          { "predicate": "works_at", "object": "Anthropic", "confidence": 0.95 }
        ],
        "importance": 0.9
      }
    ],
    "episodes": {
      "notes": [...],
      "meetings": [...],
      "conversations": [
        {
          "summary": "...",
          "messages": [
            { "role": "user", "content": "...", "timestamp": "..." },
            { "role": "assistant", "content": "...", "timestamp": "..." }
          ]
        }
      ]
    },
    "patterns": [...],
    "meta": {
      "version": "1.1.0",
      "counts": { "entities": 23, "facts": 87, "messages": 248 }
    }
  }
}
```

---

# KNOWLEDGE GRAPH ARCHITECTURE (v9.9.0)

## Overview

The Knowledge Graph is the unified hub for ALL user data. Every input flows through here, gets connected, and nothing is siloed.

## Core Functions

| Function | Purpose |
|----------|---------|
| `ingestInput(userId, input)` | Process any input (note, meeting, MIRROR, onboarding) |
| `getFullContext(userId, query)` | Retrieve unified context for MIRROR |
| `enhancedExtraction(userId, content)` | LLM-powered intent-aware extraction |
| `getUserBehaviors(userId)` | Get user's behavioral profile |
| `getEntityQualities(userId)` | Get how entities relate to user |

## Input Types

| Type | Source | What Gets Extracted |
|------|--------|---------------------|
| `note` | Quick notes, saved notes | Entities, facts, relationships, **behaviors** |
| `meeting` | Meeting mode | Entities, attendees, action items |
| `mirror_message` | MIRROR conversations | Entities mentioned |
| `onboarding` | Setup flow | User profile, preferences |
| `voice` | Voice recordings | Transcribed entities |

## Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_inputs` | Track ALL inputs | input_type, source_id, content_preview |
| `entity_mentions` | Context where entities appear | entity_id, source_type, context_snippet |
| `entity_links` | Entity co-occurrence | entity_a, entity_b, strength |
| `note_entities` | Link notes to entities | note_id, entity_id |
| `user_behaviors` | **Phase 19** User → Entity relationships | predicate, entity_name, topic, sentiment |
| `entity_qualities` | **Phase 19** Entity → User relationships | entity_name, predicate, object |

## Intent-Aware Extraction (Phase 19)

Goes beyond extracting NOUNS to extract USER'S RELATIONSHIP to entities.

**Current (basic):**
```
"Marcus helped me think through the AI strategy"
→ Marcus (Entity) → works_at → Anthropic (Fact)
```

**Intent-Aware (advanced):**
```
→ Marcus (Entity) → works_at → Anthropic (Fact)
→ User → trusts_opinion_of → Marcus (Behavior)
→ User → seeks_advice_from → Marcus [topic: AI strategy] (Behavior)
→ Marcus → helps_with → strategic_thinking (Quality)
```

### Behavioral Predicates (User → Entity)

| Predicate | Example |
|-----------|---------|
| `trusts_opinion_of` | User trusts Marcus on technical decisions |
| `seeks_advice_from` | User asks Sarah about product strategy |
| `inspired_by` | User inspired by Paul Graham's writing |
| `relies_on` | User relies on Mom for emotional support |
| `conflicted_about` | User conflicted about job offer |
| `learns_from` | User learns ML from Marcus |

### Quality Predicates (Entity → User)

| Predicate | Example |
|-----------|---------|
| `helps_with` | Marcus helps with strategic thinking |
| `challenges` | Sarah challenges assumptions |
| `supports` | Mom supports emotionally |
| `mentors` | Marcus mentors on AI |

## Key Files

- `/js/knowledge-graph.js` — Central knowledge hub
- `/api/extract-entities.js` — LLM extraction with intent-awareness
- `/api/save-behaviors.js` — Persist behaviors and qualities

## Integration Points

- **Note save** (`encrypted-db.js`): Auto-ingests after save
- **Meeting save** (`work-ui.js`): Auto-ingests with attendees
- **Onboarding** (`onboarding.js`): Ingests profile data
- **MIRROR**: Uses `getFullContext()` with behaviors for unified retrieval

---

# PRIVACY ARCHITECTURE (v9.8.3)

## Two-Tier Model

| Tier | Price | Notes | AI | Limits | We See |
|------|-------|-------|-----|--------|--------|
| **Managed** | $10/mo | Encrypted | Proxied (not stored) | 500 MIRROR calls/mo (soft cap) | AI conversations (never logged) |
| **BYOK** | $5/mo + API | Encrypted | Direct to Anthropic | Unlimited | Nothing |

**Messaging:** "Notes are encrypted — we can't read them. AI conversations pass through our servers but are never stored or logged."

## Client-Side Encryption

All user content is encrypted with AES-256-GCM via Web Crypto API before upload.

**Key Derivation:**
- User password → PBKDF2 (100k iterations, SHA-256) → AES-256 key
- Key NEVER leaves browser
- Recovery key generated at setup (XXXX-XXXX-XXXX-XXXX format)

**Encrypted Database Columns:**

All content tables have `*_encrypted` TEXT column + `is_encrypted` BOOLEAN flag.

| Table | Encrypted Columns | Plaintext Kept? |
|-------|-------------------|-----------------|
| notes | content_encrypted | No |
| user_entities | name_encrypted, summary_encrypted | No |
| entity_facts | object_encrypted | predicate stays plaintext |
| user_patterns | description_encrypted | category stays plaintext |
| mirror_messages | content_encrypted | No |
| mirror_conversations | title_encrypted | No |
| category_summaries | summary_encrypted | No |
| meeting_history | title_encrypted, notes_encrypted | No |
| ambient_recordings | transcript_encrypted | No |

**Key Files:**
- `/js/encryption.js` — Core AES-256-GCM functions
- `/js/key-manager.js` — Key lifecycle (setup, unlock, lock, recovery)
- `/js/encrypted-db.js` — Database operations with auto encrypt/decrypt
- `/js/api-client.js` — AI calls (BYOK direct / Managed proxy)
- `/js/tier-manager.js` — Tier info and switching
- `/js/onboarding-encryption.js` — Encryption setup flow
- `/js/privacy-indicator.js` — Header privacy badge
- `/api/lib/cors.js` — Shared CORS utility (allowed origins, preflight handling)

## Zero-Knowledge Guarantees

**Managed Tier:**
1. Notes encrypted client-side before upload
2. We store only ciphertext
3. AI conversations pass through proxy but are NEVER stored or logged
4. We cannot read note content

**BYOK Tier:**
1. Notes encrypted client-side before upload
2. We store only ciphertext
3. AI calls go direct to Anthropic (we don't see them)
4. Complete zero-knowledge — we see nothing

---

# CONTEXT ENGINEERING (RAG 2.0)

## Task Classification

MIRROR classifies messages to load appropriate context:

| Task Type | Triggers | Context Loaded |
|-----------|----------|----------------|
| entity_recall | "what do you know about" | Entity + facts + mentions only |
| decision | "should I", "help me decide" | Values, people, past decisions |
| emotional | "I'm stressed", "feeling" | Patterns, supportive relationships |
| research | "research", "deep dive" | Broad search, all related |
| thinking_partner | "I'm thinking about" | Related notes, thinking patterns |
| factual | "when did", "where does" | Entity + facts only |
| general | (fallback) | Top entities, recent notes |

## Key Files

- `/lib/mirror/task-classifier.js` — Classify messages into task types
- `/lib/mirror/context-strategies.js` — Define what to load per task
- `/lib/mirror/context-loader.js` — Execute context loading
- `/lib/mirror/graph-traversal.js` — Navigate entity relationships
- `/lib/mirror/index.js` — Re-exports

## Graph Traversal

Entities are connected through shared facts:
- Sarah → works_at Anthropic → others at Anthropic
- Person → knows → Other person
- Topic → Notes → Entities mentioned

---

# PHASE 19: POST-RAG ARCHITECTURE (v9.10.0)

## Intent-Aware Extraction

Extract USER'S RELATIONSHIP to entities, not just entity facts.

### Behavioral Predicates (User → Entity)

| Predicate | Meaning |
|-----------|---------|
| `trusts_opinion_of` | User trusts this person's judgment |
| `seeks_advice_from` | User goes to this person for advice |
| `relies_on` | User depends on this entity |
| `learns_from` | User gains knowledge from this entity |
| `inspired_by` | User is inspired by this entity |
| `feels_about` | User has emotional response to entity |
| `conflicted_about` | User has mixed feelings |
| `avoids` | User avoids this entity/topic |
| `collaborates_with` | User works with this entity |
| `competes_with` | User competes with this entity |

### Entity Quality Predicates (Entity → User)

| Predicate | Meaning |
|-----------|---------|
| `helps_with` | Entity helps user with something |
| `challenges` | Entity challenges user |
| `supports` | Entity supports user |
| `mentors` | Entity mentors user |
| `drains` | Entity drains user's energy |
| `energizes` | Entity energizes user |

### Key Files

- `/api/extract-entities.js` — Enhanced extraction with behaviors
- `/api/save-behaviors.js` — Persist behaviors to database
- `/lib/mirror/context-loader.js` — Load behaviors into context
- `/lib/mirror/graph-traversal.js` — Bi-directional relationship inference

## Semantic Distillation

Convert old notes into permanent SPO triples before archiving.

### Why Distillation?

- Old notes become permanent knowledge, not discarded history
- Token budget stays manageable
- Patterns survive beyond the recency window
- "What happened" becomes "what we learned"

### API: `/api/distill-episode.js`

| Action | Purpose |
|--------|---------|
| `list` | Get notes eligible for distillation (older than N days) |
| `distill_note` | Distill a single note by ID |
| `batch` | Distill multiple old notes |
| `preview` | Preview distillation without saving |

### Database Columns (notes table)

- `is_distilled` — Whether note has been distilled
- `distilled_summary` — One-sentence summary from distillation
- `distilled_at` — When distillation occurred

## Full User Profile

Get complete user context for AI systems via `/api/evolve-summary.js`.

### Actions

| Action | Returns |
|--------|---------|
| `get` | Category summaries |
| `full_profile` | Complete user profile (identity, behaviors, patterns, summaries) |
| `evolve_behavioral` | Regenerate behavioral profile from behaviors + qualities |

### Full Profile Structure

```json
{
  "identity": { "name", "role", "goals", "lifeContext", "tone" },
  "keyPeople": [{ "name", "relationship" }],
  "categorySummaries": { "work_life": "...", "relationships": "..." },
  "behavioralProfile": "Prose summary of how user relates to people/things",
  "behaviors": [{ "predicate", "entity", "topic", "sentiment" }],
  "entityQualities": [{ "entity", "predicate", "object" }],
  "patterns": [{ "type", "description", "confidence" }],
  "meta": { "behaviorCount", "qualityCount", "patternCount" }
}
```

## Full Context Loader (Phase 2)

Load entire user memory into context window. No RAG, no retrieval.

### API: GET /api/context/full

| Query Param | Values | Default |
|-------------|--------|---------|
| `format` | `markdown`, `json`, `compact` | `markdown` |
| `focusEntity` | entity name | null |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Token-Estimate` | Estimated token count |
| `X-Load-Time-Ms` | Load time in milliseconds |
| `X-Entity-Count` | Number of entities loaded |
| `X-Note-Count` | Number of notes loaded |

### Key Files

- `/lib/context/full-loader.js` — Load complete memory in parallel
- `/lib/context/document-builder.js` — Convert to markdown
- `/lib/context/agent-format.js` — MCP, GPT, Claude formats
- `/api/context/full.js` — API endpoint

### Agent Formats

| Function | Use Case |
|----------|----------|
| `formatForMCP()` | Model Context Protocol resources |
| `formatAsSystemPrompt()` | Direct LLM system prompt |
| `formatForGPTKnowledge()` | ChatGPT Custom GPT knowledge |
| `formatForClaudeProject()` | Claude Projects knowledge |

## MIRROR Full Context Integration (Phase 3)

MIRROR now supports loading entire user memory instead of RAG retrieval.

### Feature Flag

Set `MIRROR_FULL_CONTEXT=true` in environment to enable full context mode.

```bash
# In .env or Vercel environment
MIRROR_FULL_CONTEXT=true
```

### How It Works

| Mode | Behavior |
|------|----------|
| **RAG (default)** | Task classification → Targeted retrieval → Hybrid context |
| **Full Context** | Load everything → Single markdown document → No retrieval |

### Key Changes (`/api/mirror.js`)

- `loadFullContextForMirror()` — Loads complete memory with configurable limits
- `buildSystemPrompt()` — Uses full context document when enabled
- Backward compatible — RAG mode remains default

### Context Limits (Full Mode)

| Setting | Value |
|---------|-------|
| Notes | 300 max (metadata only, E2E encrypted) |
| Entities | 100 max |
| Conversations | 20 max |
| Patterns | 10 max (confidence > 0.6) |
| Behaviors | 15 max (confidence > 0.5) |

### Cost Implications

| Mode | First Call | Cached | Notes |
|------|------------|--------|-------|
| RAG | ~$0.03-0.05 | N/A | Small, targeted context |
| Full Context | ~$0.30 | ~$0.06 | Large context, benefits from prompt caching |

Prompt caching (Anthropic feature) reduces costs by 90% on subsequent calls with same context prefix.

---

# DATA CAPTURE MODULE (v9.8.1)

New `/js/data-capture.js` tracks user behavior for AI personalization.

## Functions

| Function | Purpose |
|----------|---------|
| `trackFeatureUse(feature, metadata)` | Track feature usage (create_note, mirror_chat, meeting_save) |
| `trackFeedback(messageId, feedback)` | Track AI response feedback (thumbs up/down) |
| `savePreference(key, value)` | Save user preference to Supabase |
| `loadPreference(key)` | Load user preference |
| `trackSessionStart()` | Track session begins |
| `getUserDataSummary()` | Get summary for MIRROR context personalization |

All data stored in `user_settings` table for MIRROR to learn from.

---

# DATABASE MIGRATIONS (January 28, 2026)

## 20260128_encryption_schema.sql

- Added `*_encrypted` columns to all content tables
- Created `user_settings` table (key-value store for preferences)
- Created `encryption_audit_log` table (security audit trail)
- Added encryption metadata to `user_profiles` (salt, version, recovery_key_hash)

## 20260128_meeting_tables_fix.sql

- Created `ambient_recordings` table with encryption support
- Fixed `meeting_history` constraints (entity_id now nullable)
- Added proper indexes and RLS policies

---

# BUG FIXES (v9.8.1)

| Issue | Root Cause | Fix | Commit |
|-------|------------|-----|--------|
| Mirror "unable to connect" | Missing Authorization header | Added Bearer token to all API calls | 4a03dd7 |
| Meeting "table missing" | ambient_recordings not created | Added migration | c4284e8 |
| Meeting reverts to plain text | NotesCache not invalidated | Fixed NotesCache.updateNote() + NotesManager.invalidate() | c4284e8 |
| Meeting click doesn't open | Navigation filter incomplete | Added note_type + enhanced_content checks | c4284e8 |
| Preferences don't persist | Saving to localStorage only | Now saves to Supabase user_settings | 0dd021c |
| Patterns rebuild broken | Wrong container ID | Dual container support | 0dd021c |
| Pricing outdated | Old pricing in TIER_INFO | Updated to $10/$5 model | 51cab59 |

---

# PRODUCT TEAM PERSONAS

**Use these personas when facing ambiguity. Ask: "What would [Persona] say?"**

## Maya Chen — CPO (Product Decisions)

**Background:** Ex-Notion, ex-Linear. Ruthless prioritization.

**Maya's Red Lines:**
- No feature that doesn't integrate with entity extraction
- No UI requiring > 2 clicks to start
- No enhancement > 3 seconds
- No settings screens — smart defaults only
- **NEW:** No paternalistic privacy decisions — let users choose

**When to invoke:** Scope decisions, "should we build X?" questions

---

## David Okonkwo — Principal Engineer (Technical Decisions)

**Background:** Ex-Vercel, ex-Stripe. Performance obsessed.

**David's Principles:**
- Edge Runtime for all API routes (no cold starts)
- Parallel fetches for context gathering
- Streaming responses for perceived speed
- Background processing via `ctx.waitUntil()`
- **NEW:** Zero-retention LLM providers only
- **NEW:** Client-side encryption for sensitive data

**When to invoke:** Architecture decisions, performance concerns, privacy architecture

---

## Sasha Volkov — Head of Design (UI Decisions)

**Background:** Ex-Apple HI team, ex-Figma. Editorial obsessed.

**Sasha's Red Lines:**
- Black, white, silver ONLY
- Black for buttons ONLY — no black backgrounds
- No shadows on cards
- No rounded corners > 2px
- Typography creates hierarchy, not boxes

**When to invoke:** UI decisions, visual design, "how should this look?"

---

# CRITICAL REMINDERS

1. **NEVER read ui.js in full** — Use grep only
2. **Always use onboarding data** in first reflection
3. **Key People have highest priority** — Reference by name with relationship
4. **Callbacks are critical** — Reference previous notes by note 2-3
5. **Entity mentions must feel natural** — Never "Based on my database..."
6. **Privacy is ARCHITECTURAL** — We cannot access user data, not just "won't"
7. **Design is editorial** — Black, white, silver. Typography-first.
8. **Test mobile** — Responsive design is required
9. **Enhancement < 3 seconds** — Performance is non-negotiable
10. **Consult personas** — Maya (product), David (tech), Sasha (design)
11. **Export-first thinking** — Every feature should support data portability
12. **Zero-retention LLMs** — Only use API providers that don't train on inputs
13. **Never log content** — IDs and timestamps only, never user data

---

# VERSION HISTORY

| Version | Phase | Key Changes |
|---------|-------|-------------|
| **9.12.0** | 19 | **Phase 3 Complete**: MIRROR Full Context Integration. Feature flag `MIRROR_FULL_CONTEXT` to toggle modes. Load entire user memory in MIRROR — no RAG, no retrieval. Prompt caching ready. |
| **9.11.0** | 19 | **Phase 2 Complete**: Full Context Loader (/api/context/full), Document Builder (markdown format), Agent formats (MCP, GPT, Claude). Load entire user memory — no RAG, no retrieval. |
| **9.10.0** | 19 | **Phase 1 Complete**: Full User State summaries (evolve-summary.js), Semantic Distillation API (distill-episode.js), Behavioral profile generation, Bi-directional relationship inference. Notes can now be distilled into permanent SPO triples. |
| **9.9.0** | 19 | **Intent-Aware Extraction**: User behaviors (trusts_opinion_of, seeks_advice_from, etc.), Entity qualities (helps_with, challenges, supports), New tables (user_behaviors, entity_qualities), Enhanced extraction prompt, getFullContext with behaviors. Post-RAG architecture foundation. |
| **9.8.3** | 19 | Knowledge Graph: Unified data ingestion hub, entity extraction, fact detection, entity linking. Meeting enhanced format, voice recording improvements. |
| **9.8.2** | 19 | Security hardening: CORS restricted to allowed origins, Auth + IDOR fixes on pulse/signals/digest, Math.random→crypto.getRandomValues. |
| **9.8.1** | 19 | Bug fixes: Mirror auth, Meeting tables/save/navigation, Preferences persistence, Patterns rebuild. Data Capture module. Pricing update ($10/$5). |
| **9.8.0** | 19 | Two-tier model (Managed + BYOK), Client-side AES-256-GCM encryption, Context Engineering (RAG 2.0), Task-aware context loading, Onboarding flow for encryption setup. |
| 9.6.0 | 18 | Sprint 3 complete. MIRROR facts integration, Privacy audit verified (see /docs/PRIVACY-AUDIT.md), RLS 37/37 tables verified. |
| 9.5.0 | 18 | Portable Memory Export: Sprint 2 complete. Structured facts, entity_facts table, export with facts + conversations. |
| 9.4.0 | 17 | Ambient recording pipeline fixed: table migration, RLS policy, mobile detection, error logging |
| 9.3.0 | 17 | Voice features: Whisper input, real-time transcription, modal consistency |
| 9.2.0 | 17 | Perf optimization, Query Meetings API, delete undo toast, sync indicator |
| 9.1.0 | 17 | Phase 17 features: Whispers, State of You, Ambient Recording, Memory Moments |
| 8.6.0 | 16 | Enhancement System spec complete, product team personas added |
| 8.5.0 | 15 | Quality fixes: Key People in MIRROR, pattern quality, immediate stats |

---

*CLAUDE.md — Inscript Developer Guide*
*Version 9.12.0 | Last Updated: January 29, 2026*
*Production: https://digital-twin-ecru.vercel.app*

# CLAUDE.md — Inscript Developer Guide

## Version 9.8.1 | January 28, 2026

> **Phase:** 19 — Zero-Knowledge Architecture + Context Engineering
> **Status:** Two-tier model shipped, Client-side encryption, RAG 2.0, Bug fixes complete
> **Last Updated:** January 28, 2026

---

# QUICK REFERENCE

| Item | Value |
|------|-------|
| **App Name** | Inscript |
| **Tagline** | Your mirror in code |
| **Category** | Personal AI Memory |
| **Vision** | Your data. Your ownership. Portable anywhere. |
| **Version** | 9.8.1 |
| **Production URL** | https://digital-twin-ecru.vercel.app |
| **Working Directory** | `/Users/airoxthebox/Projects/digital-twin` |
| **Beta Status** | Production (Phase 19 in progress) |

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

# PRIVACY ARCHITECTURE (v9.8.1)

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
*Version 9.8.1 | Last Updated: January 28, 2026*
*Production: https://digital-twin-ecru.vercel.app*

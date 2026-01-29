# Inscript Memory Architecture

## Version 9.15.4 | January 30, 2026

> Complete technical reference for Inscript's memory system.

---

## Executive Summary

Inscript's memory system is a **5-layer knowledge graph** that captures, stores, and retrieves user data at multiple levels of abstraction. The system implements:

- **Bi-temporal tracking** (real-world time vs. system time)
- **Contradiction detection** with automatic invalidation
- **Cascade soft-delete** for referential integrity
- **Task-aware retrieval** with context strategies
- **Privacy-first export** (PAMP 2.0 portable format)

---

## Part 1: Database Schema — The 5 Layers

### Layer 1: Core Identity

**Tables**: `user_profiles`, `onboarding_data`, `user_key_people`

Stores explicit user self-definition:
- Personal profile (name, role type)
- Onboarding responses (life seasons, mental focus, tone, boundaries)
- Manually-added key people (relationship type explicit)
- Custom instructions and preferences

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `user_profiles` | User identity | role_type, preferences |
| `onboarding_data` | Onboarding responses | life_seasons, mental_focus, tone |
| `user_key_people` | Explicit relationships | name, relationship |

---

### Layer 2: Semantic Memory (Knowledge Graph)

**Tables**: `user_entities`, `entity_facts`, `entity_relationships`, `entity_links`

#### 2.1: Entity Registry (`user_entities`)

Core entity table tracking **all nouns** mentioned: people, places, projects, products, topics, companies.

```sql
CREATE TABLE user_entities (
  id                    UUID PRIMARY KEY,
  user_id               UUID REFERENCES auth.users,
  name                  TEXT NOT NULL,
  entity_type           TEXT, -- 'person', 'project', 'place', 'company', etc.
  subtype               TEXT, -- e.g., 'mentor' for person
  summary               TEXT,
  importance_score      FLOAT, -- 0-1, rises with mentions
  mention_count         INT,
  first_mentioned       TIMESTAMPTZ,
  last_mentioned        TIMESTAMPTZ,
  sentiment_average     FLOAT, -- -1 to 1
  source_type           TEXT, -- 'note', 'mirror', 'meeting'
  source_note_id        UUID, -- for cascade soft-delete
  status                TEXT DEFAULT 'active',
  aliases               TEXT[], -- name variations
  privacy_level         TEXT DEFAULT 'internal'
);
```

#### 2.2: Structured Facts (`entity_facts`) — Bi-Temporal

**Purpose**: Store Subject-Predicate-Object (SPO) triples about entities.

Example: `Marcus works_at Anthropic`

```sql
CREATE TABLE entity_facts (
  id                    UUID PRIMARY KEY,
  user_id               UUID,
  entity_id             UUID REFERENCES user_entities(id), -- Subject
  predicate             TEXT, -- 'works_at', 'lives_in', 'likes', etc.
  object_text           TEXT, -- 'Anthropic', 'San Francisco'
  object_entity_id      UUID, -- if object is another entity

  -- Confidence & Sourcing
  confidence            FLOAT, -- 0.9+ explicit, 0.7-0.8 implied
  source_type           TEXT,
  source_id             UUID,
  mention_count         INT,

  -- BI-TEMPORAL: Real-world time (when fact was TRUE)
  valid_from            TIMESTAMPTZ, -- when fact became true
  valid_to              TIMESTAMPTZ, -- when it stopped (NULL=ongoing)

  -- BI-TEMPORAL: System time (when WE knew about it)
  created_at            TIMESTAMPTZ,
  invalidated_at        TIMESTAMPTZ, -- when we learned it was wrong
  invalidated_by        UUID, -- reference to contradicting fact
  invalidation_reason   TEXT, -- 'contradiction', 'source_deleted', etc.

  -- Version History
  version               INT DEFAULT 1,
  previous_version_id   UUID REFERENCES entity_facts(id),
  is_current            BOOLEAN DEFAULT TRUE,

  status                TEXT DEFAULT 'active'
);
```

**Automatic Contradiction Detection**: Trigger `handle_fact_contradiction()` fires on INSERT:
- For single-value predicates: `works_at`, `lives_in`, `job_title`, `reports_to`, `married_to`, `dating`, `age`, `birthday`
- Auto-invalidates old fact, links versions, increments version number

#### 2.3: Entity Links (`entity_links`)

Co-occurrence graph for entities mentioned together:

```sql
CREATE TABLE entity_links (
  id              UUID PRIMARY KEY,
  user_id         UUID,
  entity_a        UUID, -- sorted lower ID
  entity_b        UUID, -- sorted higher ID
  relationship_type TEXT DEFAULT 'co_occurred',
  strength        INT, -- co-mention count
  last_seen       TIMESTAMPTZ
);
```

---

### Layer 3: Episodic Memory (Events & Conversations)

**Tables**: `notes`, `mirror_conversations`, `mirror_messages`, `meetings`

#### 3.1: Notes (`notes`)

```sql
CREATE TABLE notes (
  id                    TEXT PRIMARY KEY,
  user_id               UUID,
  title                 TEXT,
  content_encrypted     TEXT, -- E2E encrypted (AES-256-GCM)
  is_encrypted          BOOLEAN,
  note_type             TEXT, -- 'regular', 'meeting', 'voice', 'ambient'
  status                TEXT DEFAULT 'active',
  deleted_at            TIMESTAMPTZ, -- soft delete

  -- Distillation (Phase 19)
  is_distilled          BOOLEAN DEFAULT FALSE,
  distilled_summary     TEXT,
  distilled_at          TIMESTAMPTZ,

  privacy_level         TEXT DEFAULT 'internal',
  sentiment             FLOAT,
  importance_score      FLOAT
);
```

**Cascade Trigger**: When `deleted_at` is SET, all derived knowledge (facts, entities, behaviors) becomes `status = 'inactive'`.

#### 3.2: MIRROR Conversations & Messages

```sql
CREATE TABLE mirror_conversations (
  id              UUID PRIMARY KEY,
  user_id         UUID,
  title_encrypted TEXT,
  deleted_at      TIMESTAMPTZ
);

CREATE TABLE mirror_messages (
  id                UUID PRIMARY KEY,
  conversation_id   UUID REFERENCES mirror_conversations(id),
  role              TEXT, -- 'user' or 'assistant'
  content_encrypted TEXT,
  timestamp         TIMESTAMPTZ
);
```

---

### Layer 4: Procedural Memory (Patterns & Behaviors)

**Tables**: `user_patterns`, `user_behaviors`, `entity_qualities`, `user_topics`

#### 4.1: User Patterns (`user_patterns`)

Recurring themes and behavioral patterns:

```sql
CREATE TABLE user_patterns (
  id                    UUID PRIMARY KEY,
  user_id               UUID,
  category              TEXT, -- 'stress_response', 'decision_pattern', etc.
  name                  TEXT,
  description_encrypted TEXT,
  importance_score      FLOAT,
  mention_count         INT,
  privacy_level         TEXT,
  status                TEXT DEFAULT 'active'
);
```

#### 4.2: User Behaviors (`user_behaviors`)

User's relationship TO entities (e.g., "User trusts Marcus on AI strategy"):

```sql
CREATE TABLE user_behaviors (
  id                UUID PRIMARY KEY,
  user_id           UUID,
  predicate         TEXT, -- 'trusts_opinion_of', 'seeks_advice_from', etc.
  entity_id         UUID,
  entity_name       TEXT,
  topic             TEXT, -- optional context
  sentiment         FLOAT,
  evidence          TEXT,
  confidence        FLOAT,
  reinforcement_count INT,
  status            TEXT DEFAULT 'active'
);
```

#### 4.3: User Topics (`user_topics`)

Interest and topic tracking:

```sql
CREATE TABLE user_topics (
  id                UUID PRIMARY KEY,
  user_id           UUID,
  name              TEXT,
  normalized_name   TEXT, -- LOWER(TRIM(name))
  importance_score  FLOAT,
  mention_count     INT,
  source_note_id    UUID, -- for cascade
  status            TEXT DEFAULT 'active'
);
```

---

### Layer 5: Embeddings (Deprecated)

Vector search is deprecated as of v9.12.0 in favor of full context loading.

---

## Part 2: Memory Capture Pipeline

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USER INPUT (Note / MIRROR / Meeting / Voice)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
            ┌──────────────▼───────────────┐
            │  INPUT ROUTER               │
            │  /lib/extraction/           │
            │  input-router.js            │
            └──────────────┬───────────────┘
                           │
            ┌──────────────▼───────────────┐
            │  AI EXTRACTOR               │
            │  /lib/extraction/           │
            │  extractor.js               │
            │  (Claude Haiku 3.5)         │
            └──────────────┬───────────────┘
                           │
            ┌──────────────▼───────────────┐
            │  KNOWLEDGE STORE            │
            │  /lib/extraction/           │
            │  knowledge-store.js         │
            └──────────────┬───────────────┘
                           │
    ┌──────────┬───────────┼───────────┬──────────┐
    ▼          ▼           ▼           ▼          ▼
Entities    Facts      Behaviors   Topics     Links
```

### Input Types

| Type | Trigger | Processing |
|------|---------|-----------|
| `NOTE` | User creates note | Extract text → AI |
| `MIRROR` | MIRROR message | Extract user message + context |
| `MEETING` | Meeting saved | Extract title + notes → AI |
| `VOICE` | Whisper transcribed | Extract transcript → AI |
| `PROFILE` | YOU tab edit | Extract free-text fields |
| `KEY_PERSON` | Add key person | Convert to facts + behaviors |

### AI Extractor Output

```json
{
  "entities": [
    { "name": "Marcus", "type": "person", "subtype": "mentor", "confidence": 0.95 }
  ],
  "relationships": [
    { "subject": "Marcus", "predicate": "works_at", "object": "Anthropic", "confidence": 0.9 }
  ],
  "behaviors": [
    { "type": "trusts_opinion_of", "target_entity": "Marcus", "topic": "AI strategy", "confidence": 0.8 }
  ],
  "topics": [
    { "name": "machine learning", "confidence": 0.85 }
  ]
}
```

### Knowledge Store Logic

**Deduplication**:

1. **Entities**: Case-insensitive name lookup
   - Existing: `++mention_count`, `importance_score += 0.02`
   - New: create with source tracking

2. **Facts**: Match on `(entity_id, predicate, object_text)`
   - Existing: `++mention_count`, `confidence += 0.02`
   - New: INSERT → trigger detects contradictions

3. **Behaviors**: Upsert by `(user_id, predicate, entity_name, topic)`
   - Existing: `confidence += 0.05`, `++reinforcement_count`
   - New: create

---

## Part 3: Bi-Temporal Tracking

### The Two Timelines

| Timeline | Columns | Question It Answers |
|----------|---------|---------------------|
| **Real-World** | `valid_from`, `valid_to` | "When was this TRUE?" |
| **System** | `created_at`, `invalidated_at` | "When did we KNOW it?" |

### Example: Job Change

```
Day 1: User says "Marcus works at Anthropic"
  → Fact created: works_at = Anthropic
  → valid_from = 2024-01-15 (when he joined)
  → created_at = 2026-01-20 (when user told us)

Day 10: User says "Marcus now works at Mistral"
  → CONTRADICTION DETECTED (single-value predicate)
  → Old fact: invalidated_at = 2026-01-29, is_current = FALSE
  → New fact: version = 2, previous_version_id = old_fact.id
```

### Point-in-Time Queries

```sql
-- What did I know about Marcus on January 25?
SELECT * FROM get_facts_at_time(user_id, entity_id, '2026-01-25');

-- How has Marcus's employer changed over time?
SELECT * FROM get_fact_history(user_id, entity_id, 'works_at');

-- Current facts only
SELECT * FROM get_current_facts(user_id, entity_id);
```

---

## Part 4: Memory Retrieval & Context Loading

### Task Classification

MIRROR classifies messages to load appropriate context:

| Task Type | Patterns | Context Loaded |
|-----------|----------|----------------|
| `entity_recall` | "what do you know about" | Entity + facts + mentions |
| `decision` | "should I", "help me decide" | Values, people, past decisions |
| `emotional` | "I'm stressed", "feeling" | Patterns, supportive relationships |
| `thinking_partner` | "I'm thinking about" | Related notes, thinking patterns |
| `factual` | "when did", "where does" | Entity facts only |
| `general` | (fallback) | Top entities, recent notes |

### Context Loading Flow

```
USER MESSAGE
    ↓
TASK CLASSIFIER → entity_recall
    ↓
CONTEXT STRATEGY → "comprehensive facts"
    ↓
LOAD: Entities (mentioned) + Facts (all current) + Behaviors (always)
    ↓
CONTEXT OBJECT → MIRROR AI
```

### Key Files

| File | Purpose |
|------|---------|
| `/lib/mirror/task-classifier.js` | Classify message into task type |
| `/lib/mirror/context-strategies.js` | Define what to load per task |
| `/lib/mirror/context-loader.js` | Execute context loading |
| `/lib/mirror/fact-retrieval.js` | Optimized fact lookup |
| `/lib/mirror/graph-traversal.js` | Navigate entity relationships |

---

## Part 5: Export & Import (PAMP 2.0)

### Export Flow

```
User clicks EXPORT
    ↓
/api/export.js (auth check)
    ↓
Query all user data (lib/export/queries.js)
    ↓
Apply privacy filters (lib/export/privacy.js)
    ↓
Transform to PAMP format (lib/export/transforms.js)
    ↓
Download JSON file
```

### PAMP Document Structure

```json
{
  "inscript_export": {
    "meta": {
      "version": "2.0.0",
      "format": "pamp",
      "exported_at": "2026-01-30T...",
      "counts": { "entities": 42, "facts": 187 }
    },
    "identity": {
      "name": "User Name",
      "goals": ["..."],
      "key_people": [{ "name": "Marcus", "relationship": "mentor" }]
    },
    "entities": [
      {
        "name": "Marcus",
        "type": "person",
        "facts": [
          { "predicate": "works_at", "object": "Anthropic", "confidence": 0.95 }
        ]
      }
    ],
    "episodes": {
      "notes": [...],
      "conversations": [...]
    },
    "patterns": [...],
    "behaviors": [...]
  }
}
```

### Privacy Levels

| Level | Meaning |
|-------|---------|
| `private` | Never exported |
| `internal` | Personal export only (default) |
| `shared` | Can be shared with third-party apps |

---

## Part 6: Security & Privacy

### Client-Side Encryption

All user content encrypted with AES-256-GCM:

- **Encrypted**: Notes, MIRROR messages, meeting notes, pattern descriptions
- **Key Derivation**: Password → PBKDF2 (100k iterations) → AES-256 key
- **Key Storage**: Browser localStorage only, never sent to server
- **Recovery**: User receives recovery key (XXXX-XXXX-XXXX-XXXX format)

### Row-Level Security (RLS)

All memory tables have RLS policies — users can only access their own rows.

### Zero-Retention LLM

**Approved**: Anthropic API, OpenAI API (both confirmed zero retention)

**Not Allowed**: Consumer AI interfaces (ChatGPT web, Claude web)

---

## Part 7: Key Concepts Reference

### Single-Value vs Multi-Value Predicates

**Single-Value** (contradiction detection applies):
- `works_at`, `lives_in`, `job_title`, `reports_to`, `married_to`, `dating`, `age`, `birthday`

**Multi-Value** (both can be true):
- `likes`, `dislikes`, `knows`, `has_worked_with`

### Confidence Tiers

| Range | Meaning |
|-------|---------|
| 0.9-1.0 | High confidence (explicit or well-reinforced) |
| 0.7-0.8 | Good confidence (implied or multiple mentions) |
| 0.5-0.6 | Low confidence (inferred from context) |
| <0.5 | Rejected (too uncertain) |

### Cascade Soft-Delete

When a note is deleted:
1. `entity_facts` from this note → `status = 'inactive'`, `invalidation_reason = 'source_deleted'`
2. `user_entities` from this note → `status = 'inactive'`
3. `user_behaviors` from this note → `status = 'inactive'`
4. `user_topics` from this note → `status = 'inactive'`

Un-delete restores everything.

---

## Part 8: API Endpoints

### Memory Capture

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/extract-entities.js` | POST | Extract entities from content |
| `/api/extract-knowledge.js` | POST | Extract all knowledge types |

### Memory Retrieval

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/mirror.js` | POST | MIRROR chat with context |
| `/api/temporal-facts.js` | GET/POST | Bi-temporal fact queries |

### Memory Export

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/export.js` | GET | Export in PAMP format |
| `/api/import.js` | POST | Import PAMP data |

---

## Part 9: File Reference

### Extraction Pipeline

```
/lib/extraction/
├── input-router.js      — Route inputs to appropriate extractors
├── extractor.js         — AI extraction (Claude Haiku)
├── knowledge-store.js   — Deduplication + storage + bi-temporal
└── profile-converter.js — Convert profile to SPO triples
```

### Context Loading

```
/lib/mirror/
├── task-classifier.js      — Classify messages into task types
├── context-strategies.js   — Define what to load per task
├── context-loader.js       — Execute context loading
├── fact-retrieval.js       — Optimized fact lookup
└── graph-traversal.js      — Navigate entity relationships
```

### Temporal Facts

```
/lib/knowledge/
└── temporal-facts.js    — Bi-temporal query utilities
```

### Export

```
/lib/export/
├── queries.js           — Database queries for export
├── transforms.js        — Format data for PAMP
└── privacy.js           — Apply privacy filters
```

### Migrations

```
/supabase/migrations/
├── 20260130_bitemporal_edge_invalidation.sql  — Bi-temporal columns + triggers
├── 20260130_fix_topics_and_source_tracking.sql — Topics + source tracking
└── ... (other migrations)
```

---

*Memory Architecture Document | Inscript v9.15.4 | January 30, 2026*

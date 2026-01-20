# INSCRIPT MEMORY SYSTEM: COMPLETE MEM0 PARITY BUILD

**Version**: 3.0 FINAL  
**Date**: January 2026  
**Status**: Comprehensive - All Features Included

---

## MASTER CHECKLIST: EVERYTHING WE'RE BUILDING

### From Mem0 Paper (arxiv.org/abs/2504.19413)
- [x] Two-phase pipeline (Extraction → Update)
- [x] ADD/UPDATE/DELETE/NOOP via LLM tool calling
- [x] Memory types classification
- [x] Vector embeddings + semantic search (you have this)
- [x] Memory consolidation/deduplication
- [x] Asynchronous processing
- [x] Graph-based memory (entities + relationships)
- [x] Temporal reasoning with timestamps
- [x] Conflict detection and resolution
- [x] Top-K similar memory retrieval

### From Gap Analysis
- [x] Memory deduplication (ADD/UPDATE/DELETE/NOOP) — HIGH IMPACT
- [x] Memory types (entity/fact/preference/event/goal/procedure) — MEDIUM
- [x] Emotional patterns over time (sentiment trajectory) — MEDIUM
- [x] Cross-entity graph enhancement (who-knows-who) — LOW
- [x] Decision/action memory — LOW

### From Edge Cases Master List
- [x] Job change detection → UPDATE with supersede
- [x] Name correction → UPDATE with replace
- [x] Duplicate entities → consolidation API
- [x] Relationship change → UPDATE with supersede
- [x] Death/loss → sensitivity_level = 'sensitive'
- [x] "I used to" → is_historical = true
- [x] "Starting next month" → effective_from column
- [x] "Every Monday" → recurrence_pattern JSONB
- [x] Medical/financial → sensitivity_level
- [x] "Don't remember this" → hard_delete = true
- [x] Recurrence pattern detection → extraction enhancement
- [x] "What do you know about me?" → special query handler
- [x] Negation queries → exclusion filter
- [x] Memory jobs queue → async worker

### Additions
- [x] expires_at + cleanup cron
- [x] memory_preferences table for custom prompts
- [x] Graph traversal function
- [x] Relationship strength scoring
- [x] Temporal relationship tracking

---

## YOUR EXISTING INFRASTRUCTURE (PRESERVE ALL)

| Component | Location | Action |
|-----------|----------|--------|
| Entity extraction | `api/extract-entities.js` | ENHANCE |
| Embeddings | `api/embed.js` + pgvector | KEEP |
| Semantic search | `match_entities()` RPC | ENHANCE |
| Importance scoring | `api/classify-importance.js` | KEEP |
| Superseding system | `js/entities.js` | BUILD ON |
| Context injection | `js/context.js` | ENHANCE |
| 7-layer architecture | Multiple files | PRESERVE |
| user_entities table | Supabase | ADD COLUMNS |
| entity_relationships table | Supabase | ENHANCE |
| user_learning_profile | Supabase | KEEP |
| user_patterns | Supabase | KEEP |

---

## ARCHITECTURE OVERVIEW

### Mem0's Two-Phase Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 1: EXTRACTION                              │
│  (Your existing api/extract-entities.js - ENHANCED)                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Inputs:                                                                 │
│    • Current note (mt)                                                   │
│    • Previous message (mt-1)                                             │
│    • Conversation summary (S) - periodically refreshed                   │
│    • Recent messages window (m=10)                                       │
│                                                                          │
│  Outputs:                                                                │
│    • Set of candidate facts Ω = {ω1, ω2, ..., ωn}                        │
│    • Each fact includes: memory_type, is_historical, effective_from,     │
│      expires_at, recurrence_pattern, sensitivity_level                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHASE 2: UPDATE                                  │
│  (NEW: api/memory-update.js)                                             │
├─────────────────────────────────────────────────────────────────────────┤
│  For EACH extracted fact ωi:                                             │
│                                                                          │
│    1. RETRIEVE: Get top-K (K=10) similar memories via vector search      │
│                                                                          │
│    2. PRESENT: Send fact + similar memories to LLM with tool calling     │
│                                                                          │
│    3. DECIDE: LLM selects operation via function call:                   │
│       ┌─────────┬────────────────────────────────────────────────────┐   │
│       │ ADD     │ No semantic equivalent exists → create new memory  │   │
│       ├─────────┼────────────────────────────────────────────────────┤   │
│       │ UPDATE  │ Similar exists → augment/replace/supersede         │   │
│       ├─────────┼────────────────────────────────────────────────────┤   │
│       │ DELETE  │ Contradicts existing → remove (soft or hard)       │   │
│       ├─────────┼────────────────────────────────────────────────────┤   │
│       │ NOOP    │ Already exists or not worth storing                │   │
│       └─────────┴────────────────────────────────────────────────────┘   │
│                                                                          │
│    4. EXECUTE: Perform the operation on user_entities                    │
│                                                                          │
│    5. AUDIT: Log to memory_operations table                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Complete Data Flow

```
USER WRITES NOTE
       │
       ▼
┌──────────────────────────────────────┐
│ 1. Text Extraction (existing)        │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 2. ENHANCED Entity Extraction        │
│    • Extract entities/facts          │
│    • Classify memory_type            │
│    • Detect temporal markers         │
│    • Detect sensitivity level        │
│    • Detect recurrence patterns      │
│    → Output: candidate facts Ω       │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 3. NEW: UPDATE PHASE                 │
│    For each fact in Ω:               │
│    • Vector search for similar (K=10)│
│    • LLM tool call → operation       │
│    • Execute ADD/UPDATE/DELETE/NOOP  │
│    • Log to memory_operations        │
│    • Update sentiment_history        │
│    • Update entity_relationships     │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 4. Embedding Generation (existing)   │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 5. ENHANCED Context Injection        │
│    • Type-aware retrieval            │
│    • Exclude expired memories        │
│    • Respect sensitivity levels      │
│    • Include relevant graph context  │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 6. AI Reflection (existing)          │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 7. Pattern Detection (existing)      │
└──────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│ 8. Learning Profile Update (existing)│
└──────────────────────────────────────┘
```

---

## BUILD 1: MEMORY CATEGORIES + TYPES

### 1.1 Enhance user_entities Table

```sql
-- =====================================================
-- PHASE 1A: Add memory_type classification
-- =====================================================

-- Memory type: what kind of information is this?
ALTER TABLE user_entities 
ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'entity'
CHECK (memory_type IN (
  'entity',      -- People, places, projects, things
  'fact',        -- Objective information about entities
  'preference',  -- User likes, dislikes, preferences
  'event',       -- Time-bound occurrences
  'goal',        -- Objectives, desired outcomes
  'procedure',   -- How-to knowledge, processes
  'decision',    -- Decisions the user made
  'action'       -- Actions completed, outcomes
));

-- =====================================================
-- PHASE 1B: Add temporal tracking
-- =====================================================

-- Historical marker: "used to", "previously", "no longer"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS is_historical BOOLEAN DEFAULT FALSE;

-- Future start date: "starting next month", "beginning January"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ;

-- Expiration date: "until Friday", "for the next week"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Recurrence pattern: "every Monday", "weekly standup"
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS recurrence_pattern JSONB;
-- Example values:
-- {"type": "weekly", "day": "Monday", "time": "09:00"}
-- {"type": "monthly", "day": 15}
-- {"type": "yearly", "month": 6, "day": 15}
-- {"type": "daily", "time": "08:00"}

-- =====================================================
-- PHASE 1C: Add sensitivity and privacy
-- =====================================================

-- Sensitivity level for privacy edge cases
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS sensitivity_level TEXT DEFAULT 'normal'
CHECK (sensitivity_level IN (
  'normal',     -- Standard memories
  'sensitive',  -- Health, death, loss, relationships
  'private'     -- Financial, passwords (should rarely store)
));

-- =====================================================
-- PHASE 1D: Add versioning and access tracking
-- =====================================================

-- Version number for tracking updates
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Access count for popularity/decay calculation
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0;

-- Last accessed timestamp
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ DEFAULT NOW();

-- =====================================================
-- PHASE 1E: Add decision/action specific fields
-- =====================================================

-- For decision/action memories: what was the outcome?
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS outcome TEXT;

-- Outcome sentiment: was the decision good or bad?
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS outcome_sentiment FLOAT CHECK (outcome_sentiment >= -1 AND outcome_sentiment <= 1);

-- When was outcome recorded?
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS outcome_recorded_at TIMESTAMPTZ;

-- =====================================================
-- INDEXES for new columns
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_entities_memory_type 
ON user_entities(user_id, memory_type) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_expires 
ON user_entities(expires_at) 
WHERE expires_at IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_historical 
ON user_entities(user_id, is_historical) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_sensitivity 
ON user_entities(user_id, sensitivity_level) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_effective 
ON user_entities(effective_from) 
WHERE effective_from IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_entities_recurrence 
ON user_entities(user_id) 
WHERE recurrence_pattern IS NOT NULL AND status = 'active';
```

### 1.2 Memory Type Definitions

| Type | Description | Examples | Decay Rate | Special Handling |
|------|-------------|----------|------------|------------------|
| `entity` | People, places, projects | "Marcus", "Tokyo", "Inscript" | Standard | Core entities |
| `fact` | Objective information | "Marcus works at Notion" | Standard | Can be superseded |
| `preference` | User likes/dislikes | "Prefers morning meetings" | Slow | High retrieval priority |
| `event` | Time-bound occurrences | "Wedding on June 15" | Fast after date | Check expires_at |
| `goal` | User objectives | "Wants to launch by Q2" | Medium | Track progress |
| `procedure` | How-to knowledge | "Deploy process: git push..." | Slow | Rarely changes |
| `decision` | Decisions made | "Decided to take the Notion job" | Medium | Track outcome |
| `action` | Actions completed | "Shipped the beta release" | Medium | Track outcome |

### 1.3 Enhanced Extraction Prompt

```javascript
// Enhancement for api/extract-entities.js

const ENHANCED_EXTRACTION_SYSTEM_PROMPT = `You are a Personal Information Organizer extracting memories from notes.

Your job is to extract CRUCIAL, NEW, ACTIONABLE information for memory storage.

## MEMORY TYPE CLASSIFICATION

For each piece of information, classify its memory_type:

| Type | Use When | Examples |
|------|----------|----------|
| entity | A person, place, project, pet, or thing | "Marcus", "Tokyo", "Project Alpha" |
| fact | Objective information about an entity | "Marcus works at Notion", "Tokyo has 14M people" |
| preference | A like, dislike, or preference | "Prefers cold brew", "Hates meetings before 10am" |
| event | Something with a specific time/date | "Wedding on June 15", "Conference next week" |
| goal | An objective or desired outcome | "Wants to launch by Q2", "Aiming for 10k users" |
| procedure | Step-by-step knowledge or processes | "Deploy process: commit, push, verify" |
| decision | A decision the user made | "Decided to take the job", "Chose React over Vue" |
| action | An action completed or outcome | "Shipped the feature", "Closed the deal" |

## TEMPORAL DETECTION

Detect these temporal markers:

1. **is_historical** = true when you see:
   - "used to", "previously", "no longer", "back when", "in the past"
   - Past tense changes: "worked at" (vs "works at")

2. **effective_from** = future date when you see:
   - "starting next month", "beginning January", "from Monday"
   - "will be", "going to", "plans to"

3. **expires_at** = end date when you see:
   - "until Friday", "for the next week", "through December"
   - "temporary", "for now"

4. **recurrence_pattern** = JSON when you see:
   - "every Monday" → {"type": "weekly", "day": "Monday"}
   - "daily standup at 9am" → {"type": "daily", "time": "09:00"}
   - "monthly review" → {"type": "monthly"}
   - "yearly anniversary June 15" → {"type": "yearly", "month": 6, "day": 15}

## SENSITIVITY DETECTION

Set sensitivity_level:
- "sensitive": health conditions, medical info, death, loss, grief, breakups, mental health
- "private": financial details, salary, passwords, SSN (should rarely store these)
- "normal": everything else

## DO NOT EXTRACT

- Conversational filler: "Hi", "Thanks", "Got it", "Okay"
- General knowledge: "What's the capital of France?"
- Already known information (check context)
- Passwords, SSNs, credit card numbers (NEVER store)

## OUTPUT FORMAT

Return JSON:
{
  "memories": [
    {
      "name": "entity or fact name",
      "memory_type": "entity|fact|preference|event|goal|procedure|decision|action",
      "content": "the extracted information in clear language",
      "entity_type": "person|project|place|pet|organization|concept|other",
      "relationship": "relationship to user if person (friend, coworker, family, etc.)",
      "sentiment": -1 to 1 (negative to positive),
      "importance": "critical|high|medium|low|trivial",
      "is_historical": false,
      "effective_from": null or "ISO date",
      "expires_at": null or "ISO date",
      "recurrence_pattern": null or {type, day?, time?, month?},
      "sensitivity_level": "normal|sensitive|private",
      "confidence": 0.0 to 1.0
    }
  ],
  "changes_detected": [
    {
      "entity": "entity name",
      "change_type": "job|location|relationship|status|preference|goal",
      "old_value": "previous value if known from context",
      "new_value": "new value",
      "is_correction": false
    }
  ],
  "decisions": [
    {
      "decision": "what was decided",
      "context": "why/when",
      "alternatives_considered": ["option A", "option B"]
    }
  ],
  "actions": [
    {
      "action": "what was done",
      "outcome": "result if mentioned",
      "outcome_sentiment": -1 to 1 if outcome mentioned
    }
  ]
}`;
```

---

## BUILD 2: ASYNC PROCESSING

### 2.1 Memory Jobs Queue Table

```sql
-- =====================================================
-- Memory Jobs Queue for Async Processing
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job specification
  job_type TEXT NOT NULL CHECK (job_type IN (
    'extract',       -- Extract entities from note
    'update',        -- Run UPDATE phase on extracted fact
    'consolidate',   -- Merge similar memories
    'decay',         -- Apply decay to old memories
    'cleanup',       -- Remove expired memories
    'graph_update',  -- Update entity relationships graph
    'summary'        -- Generate conversation summary
  )),
  
  -- Job data (varies by job_type)
  payload JSONB NOT NULL,
  /*
    For 'extract': {note_id, content, context}
    For 'update': {fact, similar_memories, source_note_id}
    For 'consolidate': {entity_ids, force: boolean}
    For 'decay': {user_id}
    For 'cleanup': {user_id}
    For 'graph_update': {source_entity_id, target_entity_id, relationship}
    For 'summary': {conversation_id, messages}
  */
  
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled'
  )),
  
  -- Priority (1=highest, 10=lowest)
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Retry handling
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  error_stack TEXT,
  
  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  
  -- Dependencies (for job chaining)
  depends_on UUID REFERENCES memory_jobs(id),
  
  -- Result
  result JSONB
);

-- Indexes for efficient job processing
CREATE INDEX IF NOT EXISTS idx_jobs_pending 
ON memory_jobs(scheduled_for, priority) 
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_jobs_user 
ON memory_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_status 
ON memory_jobs(status, job_type);

CREATE INDEX IF NOT EXISTS idx_jobs_dependencies 
ON memory_jobs(depends_on) 
WHERE depends_on IS NOT NULL;
```

### 2.2 Memory Operations Audit Table

```sql
-- =====================================================
-- Memory Operations Audit Trail
-- Complete history of all memory changes
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- What operation was performed
  operation TEXT NOT NULL CHECK (operation IN ('ADD', 'UPDATE', 'DELETE', 'NOOP', 'CONSOLIDATE')),
  
  -- The candidate fact being processed
  candidate_fact TEXT NOT NULL,
  candidate_memory_type TEXT,
  candidate_embedding vector(1536),
  
  -- Similar memories that were considered
  similar_memories JSONB,
  -- Format: [{id, content, similarity, memory_type}]
  
  -- LLM decision details
  llm_reasoning TEXT,
  llm_model TEXT DEFAULT 'claude-sonnet-4-20250514',
  llm_tokens_used INTEGER,
  
  -- Affected entity
  entity_id UUID REFERENCES user_entities(id),
  
  -- For UPDATE operations: what changed
  merge_strategy TEXT CHECK (merge_strategy IN ('replace', 'append', 'supersede')),
  old_content TEXT,
  new_content TEXT,
  old_version INTEGER,
  new_version INTEGER,
  
  -- For DELETE operations: preserve what was deleted
  hard_delete BOOLEAN DEFAULT FALSE,
  deleted_entity_snapshot JSONB,
  
  -- For CONSOLIDATE operations
  merged_entity_ids UUID[],
  kept_entity_id UUID,
  
  -- Source tracking
  job_id UUID REFERENCES memory_jobs(id),
  source_note_id UUID,
  
  -- Metadata
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_operations_user 
ON memory_operations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operations_entity 
ON memory_operations(entity_id) 
WHERE entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operations_type 
ON memory_operations(operation, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operations_note 
ON memory_operations(source_note_id) 
WHERE source_note_id IS NOT NULL;
```

### 2.3 Supabase Edge Function: Memory Worker

```typescript
// supabase/functions/memory-worker/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

serve(async (req) => {
  const startTime = Date.now()
  
  try {
    // Fetch pending jobs (respecting dependencies)
    const { data: jobs, error: fetchError } = await supabase
      .from('memory_jobs')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .is('depends_on', null) // Only jobs with no unmet dependencies
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10)

    if (fetchError) throw fetchError
    if (!jobs?.length) {
      return new Response(JSON.stringify({ processed: 0, message: 'No pending jobs' }), { status: 200 })
    }

    const results = []

    for (const job of jobs) {
      const jobStart = Date.now()
      
      // Mark as processing
      await supabase
        .from('memory_jobs')
        .update({ 
          status: 'processing', 
          started_at: new Date().toISOString(),
          attempts: job.attempts + 1
        })
        .eq('id', job.id)

      try {
        let result

        switch (job.job_type) {
          case 'update':
            result = await processUpdateJob(job)
            break
          case 'consolidate':
            result = await processConsolidateJob(job)
            break
          case 'decay':
            result = await processDecayJob(job)
            break
          case 'cleanup':
            result = await processCleanupJob(job)
            break
          case 'graph_update':
            result = await processGraphUpdateJob(job)
            break
          case 'summary':
            result = await processSummaryJob(job)
            break
          default:
            throw new Error(`Unknown job type: ${job.job_type}`)
        }

        // Mark completed
        await supabase
          .from('memory_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result: {
              ...result,
              processing_time_ms: Date.now() - jobStart
            }
          })
          .eq('id', job.id)

        results.push({ job_id: job.id, status: 'completed', result })

      } catch (error) {
        // Handle failure with exponential backoff retry
        const attempts = job.attempts + 1
        const status = attempts >= job.max_attempts ? 'failed' : 'pending'
        const backoffSeconds = Math.pow(2, attempts) * 1000 // 2s, 4s, 8s...
        const scheduledFor = attempts < job.max_attempts
          ? new Date(Date.now() + backoffSeconds).toISOString()
          : job.scheduled_for

        await supabase
          .from('memory_jobs')
          .update({
            status,
            attempts,
            last_error: error.message,
            error_stack: error.stack,
            scheduled_for: scheduledFor
          })
          .eq('id', job.id)

        results.push({ job_id: job.id, status: 'failed', error: error.message })
      }
    }

    return new Response(JSON.stringify({ 
      processed: results.length,
      results,
      total_time_ms: Date.now() - startTime
    }), { status: 200 })

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), { status: 500 })
  }
})

// =====================================================
// Job Processors
// =====================================================

async function processUpdateJob(job: any) {
  const { fact, similar_memories, user_id, source_note_id } = job.payload
  
  // Call Claude for UPDATE decision
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: UPDATE_SYSTEM_PROMPT,
      tools: MEMORY_UPDATE_TOOLS,
      messages: [{
        role: 'user',
        content: buildUpdatePrompt(fact, similar_memories)
      }]
    })
  })

  const data = await response.json()
  
  // Extract tool use from response
  const toolUse = data.content?.find((c: any) => c.type === 'tool_use')
  
  if (!toolUse) {
    // Log NOOP
    await logOperation(user_id, 'NOOP', fact, similar_memories, 
      { reasoning: 'No tool called by LLM' }, null, job.id, source_note_id)
    return { operation: 'NOOP', reason: 'No tool called' }
  }

  // Execute the operation
  const result = await executeMemoryOperation(
    user_id, 
    toolUse.name, 
    toolUse.input, 
    fact,
    job.id,
    source_note_id,
    similar_memories
  )

  return result
}

async function processConsolidateJob(job: any) {
  const { user_id, force } = job.payload
  
  // Find entities with high similarity
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, summary, embedding, memory_type, importance_score')
    .eq('user_id', user_id)
    .eq('status', 'active')

  if (!entities?.length) return { consolidated: 0 }

  const candidates = []
  
  // Compare pairs
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      if (!entities[i].embedding || !entities[j].embedding) continue
      
      const similarity = cosineSimilarity(entities[i].embedding, entities[j].embedding)
      
      if (similarity > 0.85) {
        candidates.push({
          entity1: entities[i],
          entity2: entities[j],
          similarity
        })
      }
    }
  }

  if (!force) {
    return { 
      candidates: candidates.length,
      message: 'Run with force=true to consolidate'
    }
  }

  // Consolidate
  let consolidated = 0
  for (const candidate of candidates) {
    const keeper = candidate.entity1.importance_score >= candidate.entity2.importance_score
      ? candidate.entity1 : candidate.entity2
    const merged = keeper === candidate.entity1 ? candidate.entity2 : candidate.entity1

    // Merge summaries
    const mergedSummary = `${keeper.summary}. ${merged.summary}`

    await supabase
      .from('user_entities')
      .update({
        summary: mergedSummary,
        importance_score: Math.max(keeper.importance_score, merged.importance_score),
        version: (keeper.version || 1) + 1
      })
      .eq('id', keeper.id)

    await supabase
      .from('user_entities')
      .update({ status: 'archived', superseded_by: keeper.id })
      .eq('id', merged.id)

    await logOperation(user_id, 'CONSOLIDATE', merged.summary, [], 
      { reasoning: `Merged into ${keeper.name} (${(candidate.similarity * 100).toFixed(1)}% similar)` },
      keeper.id, job.id, null)

    consolidated++
  }

  return { consolidated }
}

async function processDecayJob(job: any) {
  const { user_id } = job.payload
  
  const { data, error } = await supabase.rpc('apply_memory_decay_for_user', {
    p_user_id: user_id
  })

  return { decayed: data?.count || 0 }
}

async function processCleanupJob(job: any) {
  const { user_id } = job.payload
  
  // Archive expired memories
  const { data: expired } = await supabase
    .from('user_entities')
    .update({ status: 'archived' })
    .eq('user_id', user_id)
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString())
    .select('id')

  // Archive very low importance memories older than 90 days
  const { data: decayed } = await supabase
    .from('user_entities')
    .update({ status: 'archived' })
    .eq('user_id', user_id)
    .eq('status', 'active')
    .eq('importance', 'trivial')
    .lt('importance_score', 0.1)
    .lt('updated_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .select('id')

  return {
    expired_archived: expired?.length || 0,
    decayed_archived: decayed?.length || 0
  }
}

async function processGraphUpdateJob(job: any) {
  const { source_entity_id, target_entity_id, relationship, strength, user_id } = job.payload
  
  // Upsert relationship
  const { data, error } = await supabase
    .from('entity_relationships')
    .upsert({
      user_id,
      source_entity_id,
      target_entity_id,
      relationship_type: relationship,
      strength: strength || 0.5,
      is_active: true,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'source_entity_id,target_entity_id,relationship_type'
    })

  return { updated: true }
}

async function processSummaryJob(job: any) {
  const { user_id, messages } = job.payload
  
  // Generate summary via Claude
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Summarize this conversation in 2-3 sentences, focusing on key facts and decisions:\n\n${messages}`
      }]
    })
  })

  const data = await response.json()
  const summary = data.content?.[0]?.text || ''

  return { summary }
}

// =====================================================
// Helper Functions
// =====================================================

function cosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// ... (UPDATE_SYSTEM_PROMPT, MEMORY_UPDATE_TOOLS, buildUpdatePrompt, 
//      executeMemoryOperation, logOperation defined in Build 3)
```

---

## BUILD 3: UPDATE PHASE (CORE MEM0 INNOVATION)

### 3.1 Memory Update Tools

```javascript
// Tools for Claude to select memory operations

const MEMORY_UPDATE_TOOLS = [
  {
    name: "add_memory",
    description: "Add a new memory when no semantically equivalent memory exists. Use for genuinely new information that provides unique value.",
    input_schema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The memory content to store, written clearly and concisely"
        },
        memory_type: {
          type: "string",
          enum: ["entity", "fact", "preference", "event", "goal", "procedure", "decision", "action"],
          description: "The type of memory"
        },
        reasoning: {
          type: "string",
          description: "Brief explanation of why this is a new memory worth storing"
        }
      },
      required: ["content", "memory_type", "reasoning"]
    }
  },
  {
    name: "update_memory",
    description: "Update an existing memory with new, more detailed, or corrected information",
    input_schema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the existing memory to update"
        },
        new_content: {
          type: "string",
          description: "The updated memory content"
        },
        merge_strategy: {
          type: "string",
          enum: ["replace", "append", "supersede"],
          description: "How to merge: 'replace' overwrites completely (corrections, job changes), 'append' adds detail (more info about same thing), 'supersede' marks old as historical and creates new (life changes)"
        },
        reasoning: {
          type: "string",
          description: "Why this memory needs updating and what changed"
        }
      },
      required: ["memory_id", "new_content", "merge_strategy", "reasoning"]
    }
  },
  {
    name: "delete_memory",
    description: "Delete a memory that is contradicted by new information or explicitly requested to be forgotten",
    input_schema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "UUID of the memory to delete"
        },
        hard_delete: {
          type: "boolean",
          description: "True ONLY if user explicitly said 'forget', 'don't remember', 'delete'. False for contradiction-based removal (archives instead)"
        },
        reasoning: {
          type: "string",
          description: "Why this memory should be removed"
        }
      },
      required: ["memory_id", "hard_delete", "reasoning"]
    }
  },
  {
    name: "no_operation",
    description: "No change needed - the information already exists in equivalent form, is too trivial, or is conversational noise",
    input_schema: {
      type: "object",
      properties: {
        reasoning: {
          type: "string",
          description: "Why no operation is needed"
        },
        existing_memory_id: {
          type: "string",
          description: "If info already exists, the ID of that memory"
        }
      },
      required: ["reasoning"]
    }
  }
];
```

### 3.2 Update System Prompt

```javascript
const UPDATE_SYSTEM_PROMPT = `You are a memory manager for a personal AI assistant called Inscript.

Your job is to decide how to handle a new piece of information by comparing it to existing memories.

## DECISION FRAMEWORK

### ADD - Use when:
- No similar memory exists (similarity < 50%)
- Information is genuinely new and worth remembering
- The fact provides unique value for future personalization

### UPDATE - Use when similar memory exists:
- **replace**: Direct correction or complete change
  - Name misspelling: "Mike" → "Michael"  
  - Job change: "works at Google" → "works at Notion"
  - Factual correction: "born in March" → "born in May"
  
- **append**: Adding detail to existing memory
  - "likes coffee" → "likes coffee, especially cold brew from Blue Bottle"
  - "has a dog" → "has a golden retriever named Max"
  
- **supersede**: Life change that makes old info historical (not wrong, just past)
  - "lives in NYC" + "moved to SF" → mark NYC as historical, create SF as current
  - "dating Sarah" + "engaged to Sarah" → supersede with new relationship status

### DELETE - Use when:
- New information directly contradicts existing memory
- User explicitly says "forget", "don't remember", "delete this"
- **hard_delete=true** ONLY for explicit user deletion requests
- **hard_delete=false** for contradiction (archives instead of permanent delete)

### NOOP - Use when:
- Information already exists in equivalent form
- Information is too trivial (greetings, acknowledgments, "okay", "thanks")
- It's general knowledge not specific to the user
- Confidence is too low (<50%)

## CRITICAL RULES

1. **NEVER store**: passwords, SSNs, credit card numbers, API keys
2. **Be conservative with DELETE**: Prefer UPDATE with supersede
3. **Detect temporal context**: "used to work at" = historical, not delete
4. **Handle recurrence**: "every Monday" = recurring event pattern
5. **Respect sensitivity**: Health, death, finances need sensitivity_level
6. **Preserve history**: Supersede creates audit trail, don't lose information
7. **Consider importance**: Critical/high importance memories need stronger evidence to change

## OUTPUT

Call exactly ONE tool based on your decision. Include clear reasoning.`;
```

### 3.3 Memory Update API

```javascript
// api/memory-update.js

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, candidateFact, similarMemories, sourceNoteId, jobId } = req.body;
  const startTime = Date.now();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Build prompt with context
  const userPrompt = buildUpdatePrompt(candidateFact, similarMemories);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: UPDATE_SYSTEM_PROMPT,
      tools: MEMORY_UPDATE_TOOLS,
      messages: [{ role: 'user', content: userPrompt }]
    });

    // Extract tool use
    const toolUse = response.content.find(c => c.type === 'tool_use');
    
    if (!toolUse) {
      // Default to NOOP
      await logOperation(supabase, userId, 'NOOP', candidateFact, similarMemories, 
        { reasoning: 'No tool called by LLM' }, null, jobId, sourceNoteId, Date.now() - startTime);
      
      return res.json({ 
        operation: 'NOOP', 
        reasoning: 'No clear action determined',
        processing_time_ms: Date.now() - startTime
      });
    }

    // Execute the operation
    const result = await executeOperation(
      supabase,
      userId, 
      toolUse.name, 
      toolUse.input, 
      candidateFact,
      jobId,
      sourceNoteId,
      similarMemories,
      startTime
    );

    return res.json(result);

  } catch (error) {
    console.error('Memory update error:', error);
    return res.status(500).json({ error: error.message });
  }
}

function buildUpdatePrompt(fact, similarMemories) {
  let prompt = `## NEW INFORMATION TO PROCESS

**Content**: "${fact.content}"
**Type**: ${fact.memory_type || 'unknown'}
**Entity**: ${fact.name || 'N/A'}
**Sentiment**: ${fact.sentiment ?? 'neutral'}
**Importance**: ${fact.importance || 'medium'}
**Confidence**: ${fact.confidence ?? 0.8}
`;

  if (fact.is_historical) prompt += `**Historical**: Yes (past information)\n`;
  if (fact.effective_from) prompt += `**Starts**: ${fact.effective_from}\n`;
  if (fact.expires_at) prompt += `**Expires**: ${fact.expires_at}\n`;
  if (fact.recurrence_pattern) prompt += `**Recurrence**: ${JSON.stringify(fact.recurrence_pattern)}\n`;
  if (fact.sensitivity_level && fact.sensitivity_level !== 'normal') {
    prompt += `**Sensitivity**: ${fact.sensitivity_level}\n`;
  }

  prompt += `\n## EXISTING SIMILAR MEMORIES\n\n`;

  if (similarMemories && similarMemories.length > 0) {
    similarMemories.forEach((mem, i) => {
      prompt += `### Memory ${i + 1}
- **ID**: ${mem.id}
- **Content**: "${mem.summary || mem.name}"
- **Type**: ${mem.memory_type || mem.entity_type || 'entity'}
- **Importance**: ${mem.importance || 'medium'}
- **Last Updated**: ${mem.updated_at || 'unknown'}
- **Similarity**: ${((mem.similarity || 0) * 100).toFixed(1)}%
${mem.is_historical ? '- **Historical**: Yes\n' : ''}
`;
    });
  } else {
    prompt += `No similar existing memories found.\n`;
  }

  prompt += `\n## YOUR TASK

Analyze the new information against existing memories and decide the appropriate operation.
Call exactly ONE tool: add_memory, update_memory, delete_memory, or no_operation.`;

  return prompt;
}

async function executeOperation(supabase, userId, operation, input, candidateFact, jobId, sourceNoteId, similarMemories, startTime) {
  let result;

  switch (operation) {
    case 'add_memory':
      result = await addMemory(supabase, userId, candidateFact, input);
      break;
    
    case 'update_memory':
      result = await updateMemory(supabase, userId, input, candidateFact);
      break;
    
    case 'delete_memory':
      result = await deleteMemory(supabase, userId, input);
      break;
    
    case 'no_operation':
      result = { 
        operation: 'NOOP', 
        reasoning: input.reasoning,
        existing_memory_id: input.existing_memory_id 
      };
      break;
    
    default:
      result = { operation: 'NOOP', reasoning: 'Unknown operation type' };
  }

  // Log to audit trail
  const processingTime = Date.now() - startTime;
  await logOperation(
    supabase, 
    userId, 
    result.operation || operation.replace('_memory', '').toUpperCase(), 
    candidateFact, 
    similarMemories, 
    input, 
    result.entity_id || result.new_id,
    jobId,
    sourceNoteId,
    processingTime,
    result
  );

  // Update sentiment history if entity involved
  if (result.entity_id && candidateFact.sentiment !== undefined) {
    await updateSentimentHistory(supabase, result.entity_id, candidateFact.sentiment, sourceNoteId);
  }

  result.processing_time_ms = processingTime;
  return result;
}

async function addMemory(supabase, userId, fact, input) {
  const { data, error } = await supabase
    .from('user_entities')
    .insert({
      user_id: userId,
      name: fact.name || input.content.slice(0, 100),
      entity_type: fact.entity_type || 'other',
      memory_type: input.memory_type,
      summary: input.content,
      context_notes: [fact.context || input.content],
      importance: fact.importance || 'medium',
      importance_score: getImportanceScore(fact.importance || 'medium'),
      sentiment_average: fact.sentiment || 0,
      is_historical: fact.is_historical || false,
      effective_from: fact.effective_from || null,
      expires_at: fact.expires_at || null,
      recurrence_pattern: fact.recurrence_pattern || null,
      sensitivity_level: fact.sensitivity_level || 'normal',
      status: 'active',
      version: 1,
      confidence: fact.confidence || 0.8
    })
    .select()
    .single();

  if (error) throw error;

  return {
    operation: 'ADD',
    entity_id: data.id,
    content: input.content,
    memory_type: input.memory_type,
    reasoning: input.reasoning
  };
}

async function updateMemory(supabase, userId, input, candidateFact) {
  const { memory_id, new_content, merge_strategy, reasoning } = input;

  // Fetch existing memory
  const { data: existing, error: fetchError } = await supabase
    .from('user_entities')
    .select('*')
    .eq('id', memory_id)
    .single();

  if (fetchError || !existing) {
    throw new Error(`Memory not found: ${memory_id}`);
  }

  const oldContent = existing.summary;
  const oldVersion = existing.version || 1;

  if (merge_strategy === 'supersede') {
    // Mark old as historical, create new
    await supabase
      .from('user_entities')
      .update({ 
        is_historical: true,
        status: 'superseded'
      })
      .eq('id', memory_id);

    // Create new version
    const { data: newEntity, error: insertError } = await supabase
      .from('user_entities')
      .insert({
        user_id: userId,
        name: existing.name,
        entity_type: existing.entity_type,
        memory_type: existing.memory_type,
        summary: new_content,
        context_notes: [...(existing.context_notes || []), new_content].slice(-10),
        importance: existing.importance,
        importance_score: existing.importance_score,
        sentiment_average: candidateFact.sentiment ?? existing.sentiment_average,
        supersedes_id: memory_id,
        is_historical: false,
        effective_from: candidateFact.effective_from,
        expires_at: candidateFact.expires_at,
        recurrence_pattern: candidateFact.recurrence_pattern,
        sensitivity_level: candidateFact.sensitivity_level || existing.sensitivity_level,
        status: 'active',
        version: oldVersion + 1
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update back-reference
    await supabase
      .from('user_entities')
      .update({ superseded_by: newEntity.id })
      .eq('id', memory_id);

    return {
      operation: 'UPDATE',
      strategy: 'supersede',
      old_id: memory_id,
      new_id: newEntity.id,
      entity_id: newEntity.id,
      old_content: oldContent,
      new_content,
      old_version: oldVersion,
      new_version: oldVersion + 1,
      reasoning
    };

  } else if (merge_strategy === 'append') {
    // Add detail to existing
    const mergedContent = `${existing.summary}. ${new_content}`;
    
    const { error: updateError } = await supabase
      .from('user_entities')
      .update({
        summary: mergedContent,
        context_notes: [...(existing.context_notes || []), new_content].slice(-10),
        version: oldVersion + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', memory_id);

    if (updateError) throw updateError;

    return {
      operation: 'UPDATE',
      strategy: 'append',
      entity_id: memory_id,
      old_content: oldContent,
      new_content: mergedContent,
      old_version: oldVersion,
      new_version: oldVersion + 1,
      reasoning
    };

  } else {
    // Replace completely
    const { error: updateError } = await supabase
      .from('user_entities')
      .update({
        summary: new_content,
        context_notes: [...(existing.context_notes || []), new_content].slice(-10),
        version: oldVersion + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', memory_id);

    if (updateError) throw updateError;

    return {
      operation: 'UPDATE',
      strategy: 'replace',
      entity_id: memory_id,
      old_content: oldContent,
      new_content,
      old_version: oldVersion,
      new_version: oldVersion + 1,
      reasoning
    };
  }
}

async function deleteMemory(supabase, userId, input) {
  const { memory_id, hard_delete, reasoning } = input;

  // Fetch for audit
  const { data: existing } = await supabase
    .from('user_entities')
    .select('*')
    .eq('id', memory_id)
    .single();

  if (!existing) {
    throw new Error(`Memory not found: ${memory_id}`);
  }

  if (hard_delete) {
    // Permanent deletion (user explicitly requested)
    await supabase
      .from('user_entities')
      .delete()
      .eq('id', memory_id);
  } else {
    // Soft delete (archive) - preserves history
    await supabase
      .from('user_entities')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', memory_id);
  }

  return {
    operation: 'DELETE',
    entity_id: memory_id,
    hard_delete,
    deleted_content: existing.summary,
    deleted_snapshot: existing,
    reasoning
  };
}

async function logOperation(supabase, userId, operation, fact, similarMemories, input, entityId, jobId, sourceNoteId, processingTime, result = {}) {
  await supabase
    .from('memory_operations')
    .insert({
      user_id: userId,
      operation,
      candidate_fact: typeof fact === 'string' ? fact : fact.content,
      candidate_memory_type: fact.memory_type,
      similar_memories: similarMemories?.map(m => ({ 
        id: m.id, 
        content: m.summary, 
        similarity: m.similarity 
      })),
      llm_reasoning: input.reasoning,
      entity_id: entityId,
      merge_strategy: result.strategy,
      old_content: result.old_content,
      new_content: result.new_content || input.content,
      old_version: result.old_version,
      new_version: result.new_version,
      hard_delete: input.hard_delete,
      deleted_entity_snapshot: result.deleted_snapshot,
      job_id: jobId,
      source_note_id: sourceNoteId,
      processing_time_ms: processingTime
    });
}

async function updateSentimentHistory(supabase, entityId, sentiment, sourceNoteId) {
  await supabase
    .from('entity_sentiment_history')
    .insert({
      entity_id: entityId,
      sentiment,
      source_note_id: sourceNoteId
    });

  // Update average on entity
  const { data: history } = await supabase
    .from('entity_sentiment_history')
    .select('sentiment')
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (history?.length) {
    const avg = history.reduce((sum, h) => sum + h.sentiment, 0) / history.length;
    await supabase
      .from('user_entities')
      .update({ sentiment_average: avg })
      .eq('id', entityId);
  }
}

function getImportanceScore(importance) {
  const scores = {
    critical: 1.0,
    high: 0.8,
    medium: 0.5,
    low: 0.3,
    trivial: 0.1
  };
  return scores[importance] || 0.5;
}
```

### 3.4 Integration with analyze.js

```javascript
// Add to api/analyze.js after entity extraction

// After existing entity extraction...
const extractedEntities = await extractEntities(noteContent, userContext);

// Check if UPDATE phase should run
const shouldRunUpdatePhase = extractedEntities && extractedEntities.length > 0;

if (shouldRunUpdatePhase) {
  // Generate embeddings for extracted facts
  const factsWithEmbeddings = await Promise.all(
    extractedEntities.map(async (entity) => {
      const textToEmbed = entity.summary || entity.content || entity.name;
      const embedding = await generateEmbedding(textToEmbed);
      return { ...entity, embedding };
    })
  );

  // Process each fact through UPDATE phase
  const updateResults = await Promise.all(
    factsWithEmbeddings.map(async (fact) => {
      // Find similar existing memories (K=10)
      const { data: similar } = await supabase.rpc('match_entities', {
        query_embedding: fact.embedding,
        match_threshold: 0.5,
        match_count: 10,
        p_user_id: userId
      });

      // Decide: async or sync processing
      if (process.env.ASYNC_MEMORY_UPDATES === 'true') {
        // Queue for async processing
        return queueMemoryJob(supabase, userId, 'update', {
          fact,
          similar_memories: similar || [],
          source_note_id: noteId
        }, { priority: 3 });
      } else {
        // Process synchronously
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/memory-update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              candidateFact: fact,
              similarMemories: similar || [],
              sourceNoteId: noteId
            })
          });
          return response.json();
        } catch (error) {
          console.error('Memory update error:', error);
          return { operation: 'ERROR', error: error.message };
        }
      }
    })
  );

  // Log summary of update results
  const summary = {
    total: updateResults.length,
    added: updateResults.filter(r => r.operation === 'ADD').length,
    updated: updateResults.filter(r => r.operation === 'UPDATE').length,
    deleted: updateResults.filter(r => r.operation === 'DELETE').length,
    noop: updateResults.filter(r => r.operation === 'NOOP').length
  };
  
  console.log('Memory update summary:', summary);
}

// Continue with rest of analyze.js...
```

---

## BUILD 4: GRAPH RELATIONSHIPS ENHANCEMENT

### 4.1 Enhance entity_relationships Table

```sql
-- =====================================================
-- Enhance entity_relationships for graph memory
-- =====================================================

-- Add temporal tracking to relationships
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- Add relationship strength (0-1)
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS strength FLOAT DEFAULT 0.5 
CHECK (strength >= 0 AND strength <= 1);

-- Add active flag for temporal reasoning
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add relationship metadata
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add confidence score
ALTER TABLE entity_relationships
ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.8
CHECK (confidence >= 0 AND confidence <= 1);

-- Unique constraint for relationship type between entities
ALTER TABLE entity_relationships
ADD CONSTRAINT unique_relationship 
UNIQUE (source_entity_id, target_entity_id, relationship_type);

-- =====================================================
-- Indexes for graph traversal
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_relationships_source 
ON entity_relationships(source_entity_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_target 
ON entity_relationships(target_entity_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_relationships_type 
ON entity_relationships(relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationships_strength 
ON entity_relationships(strength DESC) 
WHERE is_active = true;
```

### 4.2 Entity Sentiment History Table

```sql
-- =====================================================
-- Track sentiment changes over time per entity
-- =====================================================

CREATE TABLE IF NOT EXISTS entity_sentiment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  
  -- Sentiment value (-1 to 1)
  sentiment FLOAT NOT NULL CHECK (sentiment >= -1 AND sentiment <= 1),
  
  -- Context for this sentiment reading
  context TEXT,
  
  -- Source note that triggered this
  source_note_id UUID,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sentiment_history_entity 
ON entity_sentiment_history(entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sentiment_history_time 
ON entity_sentiment_history(created_at DESC);

-- =====================================================
-- Function to get sentiment trajectory
-- =====================================================

CREATE OR REPLACE FUNCTION get_sentiment_trajectory(
  p_entity_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  date DATE,
  avg_sentiment FLOAT,
  min_sentiment FLOAT,
  max_sentiment FLOAT,
  reading_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(created_at) as date,
    AVG(sentiment)::FLOAT as avg_sentiment,
    MIN(sentiment)::FLOAT as min_sentiment,
    MAX(sentiment)::FLOAT as max_sentiment,
    COUNT(*)::INTEGER as reading_count
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Function to detect sentiment trends
-- =====================================================

CREATE OR REPLACE FUNCTION get_sentiment_trend(
  p_entity_id UUID,
  p_days INTEGER DEFAULT 14
)
RETURNS TABLE (
  trend TEXT,
  change_percent FLOAT,
  current_avg FLOAT,
  previous_avg FLOAT
) AS $$
DECLARE
  v_current FLOAT;
  v_previous FLOAT;
  v_change FLOAT;
BEGIN
  -- Current period average
  SELECT AVG(sentiment) INTO v_current
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days || ' days')::INTERVAL;

  -- Previous period average
  SELECT AVG(sentiment) INTO v_previous
  FROM entity_sentiment_history
  WHERE entity_id = p_entity_id
    AND created_at > NOW() - (p_days * 2 || ' days')::INTERVAL
    AND created_at <= NOW() - (p_days || ' days')::INTERVAL;

  -- Calculate change
  IF v_previous IS NOT NULL AND v_previous != 0 THEN
    v_change := ((v_current - v_previous) / ABS(v_previous)) * 100;
  ELSE
    v_change := 0;
  END IF;

  RETURN QUERY SELECT
    CASE
      WHEN v_change > 10 THEN 'improving'
      WHEN v_change < -10 THEN 'declining'
      ELSE 'stable'
    END as trend,
    v_change as change_percent,
    v_current as current_avg,
    v_previous as previous_avg;
END;
$$ LANGUAGE plpgsql;
```

### 4.3 Graph Traversal Function

```sql
-- =====================================================
-- Traverse entity graph to find connections
-- =====================================================

CREATE OR REPLACE FUNCTION traverse_entity_graph(
  p_entity_id UUID,
  p_user_id UUID,
  p_max_depth INTEGER DEFAULT 2,
  p_min_strength FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  entity_id UUID,
  entity_name TEXT,
  entity_type TEXT,
  relationship_path TEXT[],
  relationship_types TEXT[],
  total_strength FLOAT,
  depth INTEGER
) AS $$
WITH RECURSIVE graph_traversal AS (
  -- Base case: start entity
  SELECT 
    e.id as entity_id,
    e.name as entity_name,
    e.entity_type,
    ARRAY[]::TEXT[] as relationship_path,
    ARRAY[]::TEXT[] as relationship_types,
    1.0::FLOAT as total_strength,
    0 as depth
  FROM user_entities e
  WHERE e.id = p_entity_id
    AND e.user_id = p_user_id
    AND e.status = 'active'

  UNION ALL

  -- Recursive case: follow relationships
  SELECT 
    CASE 
      WHEN r.source_entity_id = gt.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END as entity_id,
    e.name as entity_name,
    e.entity_type,
    gt.relationship_path || e.name,
    gt.relationship_types || r.relationship_type,
    gt.total_strength * r.strength,
    gt.depth + 1
  FROM graph_traversal gt
  JOIN entity_relationships r ON (
    r.source_entity_id = gt.entity_id OR r.target_entity_id = gt.entity_id
  )
  JOIN user_entities e ON (
    e.id = CASE 
      WHEN r.source_entity_id = gt.entity_id THEN r.target_entity_id
      ELSE r.source_entity_id
    END
  )
  WHERE gt.depth < p_max_depth
    AND r.is_active = true
    AND r.strength >= p_min_strength
    AND e.status = 'active'
    AND e.user_id = p_user_id
    AND NOT (e.id = ANY(
      SELECT unnest(
        ARRAY(SELECT id FROM user_entities WHERE name = ANY(gt.relationship_path))
      )
    )) -- Prevent cycles
)
SELECT DISTINCT ON (entity_id)
  entity_id,
  entity_name,
  entity_type,
  relationship_path,
  relationship_types,
  total_strength,
  depth
FROM graph_traversal
WHERE depth > 0 -- Exclude start entity
ORDER BY entity_id, total_strength DESC;
$$ LANGUAGE sql;
```

---

## BUILD 5: RERANKING + TIME-BOUND

### 5.1 Enhanced Search Function

```sql
-- =====================================================
-- Enhanced entity matching with full features
-- =====================================================

CREATE OR REPLACE FUNCTION match_entities_enhanced(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INTEGER,
  p_user_id UUID,
  p_memory_types TEXT[] DEFAULT NULL,
  p_include_historical BOOLEAN DEFAULT FALSE,
  p_exclude_expired BOOLEAN DEFAULT TRUE,
  p_min_importance TEXT DEFAULT NULL,
  p_sensitivity_max TEXT DEFAULT 'normal'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  entity_type TEXT,
  memory_type TEXT,
  summary TEXT,
  importance TEXT,
  importance_score FLOAT,
  sentiment_average FLOAT,
  is_historical BOOLEAN,
  effective_from TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  recurrence_pattern JSONB,
  sensitivity_level TEXT,
  similarity FLOAT,
  recency_boost FLOAT,
  access_boost FLOAT,
  final_score FLOAT
) AS $$
DECLARE
  importance_values TEXT[] := ARRAY['critical', 'high', 'medium', 'low', 'trivial'];
  min_importance_idx INTEGER;
BEGIN
  -- Get minimum importance index if specified
  IF p_min_importance IS NOT NULL THEN
    min_importance_idx := array_position(importance_values, p_min_importance);
  ELSE
    min_importance_idx := 5; -- Include all
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.entity_type,
    e.memory_type,
    e.summary,
    e.importance,
    e.importance_score,
    e.sentiment_average,
    e.is_historical,
    e.effective_from,
    e.expires_at,
    e.recurrence_pattern,
    e.sensitivity_level,
    -- Raw similarity
    (1 - (e.embedding <=> query_embedding))::FLOAT as similarity,
    -- Recency boost: exponential decay over weeks (0.95^weeks)
    POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800)::FLOAT as recency_boost,
    -- Access frequency boost (log scale, capped)
    LEAST(1.0, 0.5 + (LN(GREATEST(1, e.access_count)) / 10))::FLOAT as access_boost,
    -- Final composite score
    (
      (1 - (e.embedding <=> query_embedding)) * 0.50 +  -- 50% semantic similarity
      COALESCE(e.importance_score, 0.5) * 0.20 +        -- 20% importance
      POWER(0.95, EXTRACT(EPOCH FROM (NOW() - COALESCE(e.updated_at, e.created_at))) / 604800) * 0.15 +  -- 15% recency
      LEAST(1.0, 0.5 + (LN(GREATEST(1, e.access_count)) / 10)) * 0.15  -- 15% access frequency
    )::FLOAT as final_score
  FROM user_entities e
  WHERE e.user_id = p_user_id
    AND e.status = 'active'
    -- Similarity threshold
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    -- Memory type filter
    AND (p_memory_types IS NULL OR e.memory_type = ANY(p_memory_types))
    -- Historical filter
    AND (p_include_historical OR e.is_historical = FALSE)
    -- Expiration filter
    AND (NOT p_exclude_expired OR e.expires_at IS NULL OR e.expires_at > NOW())
    -- Effective date filter (don't return future-dated memories before their time)
    AND (e.effective_from IS NULL OR e.effective_from <= NOW())
    -- Importance filter
    AND (p_min_importance IS NULL OR array_position(importance_values, e.importance) <= min_importance_idx)
    -- Sensitivity filter
    AND (
      p_sensitivity_max = 'private' OR
      (p_sensitivity_max = 'sensitive' AND e.sensitivity_level IN ('normal', 'sensitive')) OR
      (p_sensitivity_max = 'normal' AND e.sensitivity_level = 'normal')
    )
  ORDER BY final_score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- Update access tracking when memories are retrieved
CREATE OR REPLACE FUNCTION update_memory_access(p_memory_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE user_entities
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = ANY(p_memory_ids);
END;
$$ LANGUAGE plpgsql;
```

### 5.2 Cleanup and Decay Cron Jobs

```sql
-- =====================================================
-- Enable pg_cron extension
-- =====================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =====================================================
-- Daily cleanup function
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_memories()
RETURNS TABLE (
  expired_count INTEGER,
  decayed_count INTEGER
) AS $$
DECLARE
  v_expired INTEGER;
  v_decayed INTEGER;
BEGIN
  -- Archive expired memories
  WITH archived AS (
    UPDATE user_entities
    SET status = 'archived', updated_at = NOW()
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < NOW()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_expired FROM archived;

  -- Archive very low importance memories older than 90 days with no recent access
  WITH decayed AS (
    UPDATE user_entities
    SET status = 'archived', updated_at = NOW()
    WHERE status = 'active'
      AND importance = 'trivial'
      AND importance_score < 0.1
      AND updated_at < NOW() - INTERVAL '90 days'
      AND last_accessed_at < NOW() - INTERVAL '30 days'
    RETURNING id
  )
  SELECT COUNT(*) INTO v_decayed FROM decayed;

  RETURN QUERY SELECT v_expired, v_decayed;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily at 3 AM UTC
SELECT cron.schedule('cleanup-memories', '0 3 * * *', 'SELECT * FROM cleanup_expired_memories()');

-- =====================================================
-- Weekly decay function
-- =====================================================

CREATE OR REPLACE FUNCTION apply_memory_decay()
RETURNS TABLE (
  decayed_count INTEGER
) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH decayed AS (
    UPDATE user_entities
    SET importance_score = GREATEST(0.05, importance_score * 
      CASE
        -- Critical: never decay
        WHEN importance = 'critical' THEN 1.0
        -- High: start after 90 days, -5% per week
        WHEN importance = 'high' AND updated_at < NOW() - INTERVAL '90 days' THEN 0.95
        -- Medium: start after 30 days, -10% per week
        WHEN importance = 'medium' AND updated_at < NOW() - INTERVAL '30 days' THEN 0.90
        -- Low: start after 14 days, -15% per week
        WHEN importance = 'low' AND updated_at < NOW() - INTERVAL '14 days' THEN 0.85
        -- Trivial: start after 7 days, -20% per week
        WHEN importance = 'trivial' AND updated_at < NOW() - INTERVAL '7 days' THEN 0.80
        ELSE 1.0
      END
    )
    WHERE status = 'active'
      AND importance != 'critical'
      AND last_accessed_at < NOW() - INTERVAL '7 days' -- Don't decay recently accessed
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM decayed;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule weekly on Sunday at 4 AM UTC
SELECT cron.schedule('decay-memories', '0 4 * * 0', 'SELECT * FROM apply_memory_decay()');

-- =====================================================
-- Per-user decay function (for async jobs)
-- =====================================================

CREATE OR REPLACE FUNCTION apply_memory_decay_for_user(p_user_id UUID)
RETURNS TABLE (count INTEGER) AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH decayed AS (
    UPDATE user_entities
    SET importance_score = GREATEST(0.05, importance_score * 
      CASE
        WHEN importance = 'critical' THEN 1.0
        WHEN importance = 'high' AND updated_at < NOW() - INTERVAL '90 days' THEN 0.95
        WHEN importance = 'medium' AND updated_at < NOW() - INTERVAL '30 days' THEN 0.90
        WHEN importance = 'low' AND updated_at < NOW() - INTERVAL '14 days' THEN 0.85
        WHEN importance = 'trivial' AND updated_at < NOW() - INTERVAL '7 days' THEN 0.80
        ELSE 1.0
      END
    )
    WHERE user_id = p_user_id
      AND status = 'active'
      AND importance != 'critical'
    RETURNING id
  )
  SELECT COUNT(*)::INTEGER INTO v_count FROM decayed;

  RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;
```

---

## BUILD 6: CUSTOM PROMPTS + SEARCH HANDLERS

### 6.1 Memory Preferences Table

```sql
-- =====================================================
-- User-configurable memory preferences
-- =====================================================

CREATE TABLE IF NOT EXISTS memory_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Custom extraction instructions
  custom_instructions TEXT,
  -- Example: "Focus on my fitness goals and ignore casual work chat"
  
  -- Enabled memory categories
  enabled_categories TEXT[] DEFAULT ARRAY['entity', 'fact', 'preference', 'event', 'goal', 'procedure', 'decision', 'action'],
  
  -- Topics to auto-mark as sensitive
  auto_mark_sensitive TEXT[] DEFAULT ARRAY['health', 'medical', 'financial', 'death', 'mental health', 'therapy'],
  
  -- Topics to never store
  never_store TEXT[] DEFAULT ARRAY[],
  -- Example: ['work meetings', 'client names']
  
  -- Default expiry for certain memory types (days, null = never)
  default_expiry_days INTEGER,
  
  -- Event memories auto-expire after the event
  events_auto_expire BOOLEAN DEFAULT TRUE,
  
  -- Retrieval preferences
  prefer_recent BOOLEAN DEFAULT TRUE,
  include_historical_by_default BOOLEAN DEFAULT FALSE,
  default_sensitivity_level TEXT DEFAULT 'normal' 
    CHECK (default_sensitivity_level IN ('normal', 'sensitive', 'private')),
  
  -- Minimum confidence to store
  min_confidence FLOAT DEFAULT 0.6 CHECK (min_confidence >= 0 AND min_confidence <= 1),
  
  -- Notification preferences
  notify_on_consolidation BOOLEAN DEFAULT FALSE,
  notify_on_conflict BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_memory_preferences_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER memory_preferences_updated
BEFORE UPDATE ON memory_preferences
FOR EACH ROW EXECUTE FUNCTION update_memory_preferences_timestamp();
```

### 6.2 Memory Search API with Special Query Handlers

```javascript
// api/memory-search.js

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  const { userId, query, options = {} } = req.body;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Detect special query patterns
  const specialQuery = detectSpecialQuery(query);

  if (specialQuery) {
    const result = await handleSpecialQuery(supabase, userId, specialQuery, query, options);
    return res.json(result);
  }

  // Standard semantic search
  const result = await standardSearch(supabase, userId, query, options);
  return res.json(result);
}

// =====================================================
// Special Query Detection
// =====================================================

function detectSpecialQuery(query) {
  const normalized = query.toLowerCase().trim();

  // Self-summary queries
  if (
    normalized.includes('what do you know about me') ||
    normalized.includes('what have you learned about me') ||
    normalized.includes('summarize what you know') ||
    normalized.includes('tell me about myself') ||
    normalized.includes('what do you remember about me')
  ) {
    return { type: 'self_summary' };
  }

  // Entity-specific queries
  const entityMatch = normalized.match(/what do you (?:know|remember) about (\w+(?:\s+\w+)?)/);
  if (entityMatch) {
    return { type: 'entity_summary', entity: entityMatch[1] };
  }

  // Relationship queries
  if (
    normalized.includes('who knows') ||
    normalized.includes('how is') && normalized.includes('connected to') ||
    normalized.includes('relationship between')
  ) {
    const entities = extractEntitiesFromQuery(normalized);
    return { type: 'relationship_query', entities };
  }

  // Temporal queries
  if (
    normalized.includes('yesterday') ||
    normalized.includes('last week') ||
    normalized.includes('last month') ||
    normalized.includes('recently') ||
    normalized.includes('this week')
  ) {
    return { type: 'temporal', timeframe: extractTimeframe(normalized) };
  }

  // Historical queries
  if (
    normalized.includes('used to') ||
    normalized.includes('previously') ||
    normalized.includes('in the past') ||
    normalized.includes('history of') ||
    normalized.includes('how has') && normalized.includes('changed')
  ) {
    return { type: 'historical' };
  }

  // Negation queries
  const negationMatch = normalized.match(/(?:not|don't|except|excluding|without)\s+(\w+)/);
  if (negationMatch) {
    return { type: 'negation', exclude: negationMatch[1] };
  }

  // Sentiment/trend queries
  if (
    normalized.includes('how do i feel about') ||
    normalized.includes('sentiment') ||
    normalized.includes('getting better') ||
    normalized.includes('getting worse')
  ) {
    return { type: 'sentiment_trend' };
  }

  // Decision history queries
  if (
    normalized.includes('decisions i made') ||
    normalized.includes('what did i decide') ||
    normalized.includes('choices i made')
  ) {
    return { type: 'decisions' };
  }

  // Goal progress queries
  if (
    normalized.includes('my goals') ||
    normalized.includes('what am i working toward') ||
    normalized.includes('progress on')
  ) {
    return { type: 'goals' };
  }

  return null;
}

// =====================================================
// Special Query Handlers
// =====================================================

async function handleSpecialQuery(supabase, userId, specialQuery, originalQuery, options) {
  switch (specialQuery.type) {
    case 'self_summary':
      return await generateSelfSummary(supabase, userId);

    case 'entity_summary':
      return await generateEntitySummary(supabase, userId, specialQuery.entity);

    case 'relationship_query':
      return await queryRelationships(supabase, userId, specialQuery.entities);

    case 'temporal':
      return await searchByTimeframe(supabase, userId, originalQuery, specialQuery.timeframe);

    case 'historical':
      return await searchHistorical(supabase, userId, originalQuery);

    case 'negation':
      return await searchWithExclusion(supabase, userId, originalQuery, specialQuery.exclude);

    case 'sentiment_trend':
      return await querySentimentTrends(supabase, userId, originalQuery);

    case 'decisions':
      return await queryDecisions(supabase, userId);

    case 'goals':
      return await queryGoals(supabase, userId);

    default:
      return await standardSearch(supabase, userId, originalQuery, options);
  }
}

async function generateSelfSummary(supabase, userId) {
  // Fetch all active memories grouped by type
  const { data: memories } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('importance_score', { ascending: false })
    .limit(200);

  if (!memories?.length) {
    return {
      type: 'self_summary',
      found: false,
      message: "I don't have any memories about you yet. As we chat more, I'll learn about you!"
    };
  }

  // Group by type
  const byType = {};
  memories.forEach(m => {
    const type = m.memory_type || 'entity';
    if (!byType[type]) byType[type] = [];
    byType[type].push(m);
  });

  // Get top entities (people, places, projects)
  const topEntities = memories
    .filter(m => m.memory_type === 'entity' || !m.memory_type)
    .slice(0, 10);

  // Get preferences
  const preferences = byType['preference'] || [];

  // Get active goals
  const goals = (byType['goal'] || []).filter(g => !g.is_historical);

  // Get recent decisions
  const decisions = (byType['decision'] || []).slice(0, 5);

  // Generate summary with Claude
  const summaryPrompt = `Based on these memories about a user, write a warm, personal summary (2-3 paragraphs) of what you know about them. Be conversational, not clinical.

**People in their life (${topEntities.length}):**
${topEntities.map(e => `- ${e.name}: ${e.summary || e.relationship || 'known person'}`).join('\n')}

**Their preferences (${preferences.length}):**
${preferences.map(p => `- ${p.summary}`).join('\n') || 'None recorded yet'}

**Their goals (${goals.length}):**
${goals.map(g => `- ${g.summary}`).join('\n') || 'None recorded yet'}

**Recent decisions (${decisions.length}):**
${decisions.map(d => `- ${d.summary}`).join('\n') || 'None recorded yet'}

Write a summary that feels personal and shows you actually know them.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: summaryPrompt }]
  });

  const summary = response.content[0]?.text || '';

  return {
    type: 'self_summary',
    found: true,
    summary,
    stats: {
      total_memories: memories.length,
      by_type: Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, v.length])
      ),
      top_people: topEntities.filter(e => e.entity_type === 'person').slice(0, 5).map(e => e.name),
      active_goals: goals.length,
      preference_count: preferences.length
    }
  };
}

async function generateEntitySummary(supabase, userId, entityName) {
  // Find the entity (fuzzy match)
  const { data: entities } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${entityName}%`)
    .order('importance_score', { ascending: false });

  if (!entities?.length) {
    return {
      type: 'entity_summary',
      found: false,
      entity: entityName,
      message: `I don't have any memories about "${entityName}".`
    };
  }

  const primary = entities[0];

  // Get historical versions
  const { data: historical } = await supabase
    .from('user_entities')
    .select('*')
    .eq('superseded_by', primary.id);

  // Get relationships
  const { data: relationships } = await supabase
    .from('entity_relationships')
    .select(`
      *,
      source:source_entity_id(name, entity_type),
      target:target_entity_id(name, entity_type)
    `)
    .or(`source_entity_id.eq.${primary.id},target_entity_id.eq.${primary.id}`)
    .eq('is_active', true);

  // Get sentiment trajectory
  const { data: sentimentHistory } = await supabase
    .from('entity_sentiment_history')
    .select('sentiment, created_at')
    .eq('entity_id', primary.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // Get related notes (context)
  const contextNotes = primary.context_notes || [];

  return {
    type: 'entity_summary',
    found: true,
    entity: {
      id: primary.id,
      name: primary.name,
      type: primary.entity_type,
      memory_type: primary.memory_type,
      summary: primary.summary,
      relationship: primary.relationship,
      importance: primary.importance,
      sentiment: primary.sentiment_average,
      first_mentioned: primary.first_mentioned_at,
      last_mentioned: primary.last_mentioned_at,
      mention_count: primary.mention_count
    },
    history: (historical || []).map(h => ({
      summary: h.summary,
      date: h.updated_at,
      was_superseded: true
    })),
    relationships: (relationships || []).map(r => ({
      type: r.relationship_type,
      with: r.source_entity_id === primary.id ? r.target?.name : r.source?.name,
      strength: r.strength,
      started: r.started_at
    })),
    sentiment_trend: sentimentHistory?.length > 1 ? {
      current: sentimentHistory[0]?.sentiment,
      trend: sentimentHistory[0]?.sentiment > sentimentHistory[sentimentHistory.length - 1]?.sentiment 
        ? 'improving' : 'stable'
    } : null,
    recent_context: contextNotes.slice(-5)
  };
}

async function queryRelationships(supabase, userId, entities) {
  if (!entities || entities.length < 1) {
    return { type: 'relationship_query', error: 'No entities specified' };
  }

  // Find the entities
  const { data: foundEntities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('name', entities.map(e => e.toLowerCase()));

  if (!foundEntities?.length) {
    return {
      type: 'relationship_query',
      found: false,
      message: `I don't know about ${entities.join(' or ')}.`
    };
  }

  // Get relationships between them or from the first entity
  const primaryId = foundEntities[0].id;

  const { data: graph } = await supabase.rpc('traverse_entity_graph', {
    p_entity_id: primaryId,
    p_user_id: userId,
    p_max_depth: 2,
    p_min_strength: 0.2
  });

  return {
    type: 'relationship_query',
    found: true,
    primary_entity: foundEntities[0].name,
    connections: graph?.map(g => ({
      entity: g.entity_name,
      type: g.entity_type,
      path: g.relationship_path,
      relationships: g.relationship_types,
      strength: g.total_strength,
      depth: g.depth
    })) || []
  };
}

async function searchByTimeframe(supabase, userId, query, timeframe) {
  const { data: memories } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('updated_at', timeframe.start.toISOString())
    .lte('updated_at', timeframe.end.toISOString())
    .order('updated_at', { ascending: false })
    .limit(20);

  return {
    type: 'temporal',
    timeframe: {
      start: timeframe.start.toISOString(),
      end: timeframe.end.toISOString()
    },
    memories: memories?.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      date: m.updated_at
    })) || [],
    count: memories?.length || 0
  };
}

async function searchHistorical(supabase, userId, query) {
  // Include historical memories
  const embedding = await generateEmbedding(query);
  
  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: 0.4,
    match_count: 20,
    p_user_id: userId,
    p_include_historical: true,
    p_exclude_expired: false
  });

  // Separate current vs historical
  const current = memories?.filter(m => !m.is_historical) || [];
  const historical = memories?.filter(m => m.is_historical) || [];

  return {
    type: 'historical',
    current: current.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type
    })),
    historical: historical.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      superseded_at: m.updated_at
    })),
    timeline: [...current, ...historical].sort((a, b) => 
      new Date(b.updated_at) - new Date(a.updated_at)
    )
  };
}

async function searchWithExclusion(supabase, userId, query, excludeTerm) {
  const embedding = await generateEmbedding(query);
  
  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: 0.4,
    match_count: 30,
    p_user_id: userId
  });

  // Filter out excluded term
  const filtered = memories?.filter(m => 
    !m.name?.toLowerCase().includes(excludeTerm.toLowerCase()) &&
    !m.summary?.toLowerCase().includes(excludeTerm.toLowerCase())
  ) || [];

  return {
    type: 'negation',
    excluded: excludeTerm,
    results: filtered.slice(0, 15).map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      similarity: m.similarity
    })),
    total_before_exclusion: memories?.length || 0,
    total_after_exclusion: filtered.length
  };
}

async function querySentimentTrends(supabase, userId, query) {
  // Get entities with sentiment history
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, sentiment_average')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('entity_type', 'person')
    .order('mention_count', { ascending: false })
    .limit(10);

  const trendsPromises = entities?.map(async (entity) => {
    const { data: trend } = await supabase.rpc('get_sentiment_trend', {
      p_entity_id: entity.id,
      p_days: 14
    });
    return {
      entity: entity.name,
      current_sentiment: entity.sentiment_average,
      ...trend?.[0]
    };
  }) || [];

  const trends = await Promise.all(trendsPromises);

  return {
    type: 'sentiment_trend',
    trends: trends.filter(t => t.trend),
    improving: trends.filter(t => t.trend === 'improving').map(t => t.entity),
    declining: trends.filter(t => t.trend === 'declining').map(t => t.entity),
    stable: trends.filter(t => t.trend === 'stable').map(t => t.entity)
  };
}

async function queryDecisions(supabase, userId) {
  const { data: decisions } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('memory_type', 'decision')
    .order('created_at', { ascending: false })
    .limit(20);

  return {
    type: 'decisions',
    decisions: decisions?.map(d => ({
      id: d.id,
      decision: d.summary,
      date: d.created_at,
      outcome: d.outcome,
      outcome_sentiment: d.outcome_sentiment,
      importance: d.importance
    })) || [],
    total: decisions?.length || 0,
    with_outcomes: decisions?.filter(d => d.outcome).length || 0
  };
}

async function queryGoals(supabase, userId) {
  const { data: goals } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('memory_type', 'goal')
    .order('importance_score', { ascending: false });

  const active = goals?.filter(g => !g.is_historical) || [];
  const achieved = goals?.filter(g => g.is_historical) || [];

  return {
    type: 'goals',
    active: active.map(g => ({
      id: g.id,
      goal: g.summary,
      importance: g.importance,
      created: g.created_at,
      deadline: g.expires_at
    })),
    achieved: achieved.map(g => ({
      id: g.id,
      goal: g.summary,
      achieved_date: g.updated_at
    })),
    total_active: active.length,
    total_achieved: achieved.length
  };
}

// =====================================================
// Standard Search
// =====================================================

async function standardSearch(supabase, userId, query, options) {
  const embedding = await generateEmbedding(query);
  
  // Get user preferences
  const { data: prefs } = await supabase
    .from('memory_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: options.threshold || 0.4,
    match_count: options.limit || 15,
    p_user_id: userId,
    p_memory_types: options.memoryTypes || null,
    p_include_historical: options.includeHistorical ?? prefs?.include_historical_by_default ?? false,
    p_exclude_expired: options.excludeExpired ?? true,
    p_min_importance: options.minImportance || null,
    p_sensitivity_max: options.sensitivityMax || prefs?.default_sensitivity_level || 'normal'
  });

  // Update access tracking
  if (memories?.length) {
    await supabase.rpc('update_memory_access', {
      p_memory_ids: memories.map(m => m.id)
    });
  }

  return {
    type: 'standard',
    query,
    results: memories?.map(m => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      type: m.memory_type,
      entity_type: m.entity_type,
      importance: m.importance,
      similarity: m.similarity,
      final_score: m.final_score,
      is_historical: m.is_historical,
      sentiment: m.sentiment_average
    })) || [],
    count: memories?.length || 0
  };
}

// =====================================================
// Helpers
// =====================================================

function extractTimeframe(query) {
  const now = new Date();
  
  if (query.includes('yesterday')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  
  if (query.includes('last week') || query.includes('this week')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { start, end: now };
  }
  
  if (query.includes('last month')) {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    return { start, end: now };
  }
  
  if (query.includes('recently')) {
    const start = new Date(now);
    start.setDate(start.getDate() - 3);
    return { start, end: now };
  }
  
  // Default: last 7 days
  const start = new Date(now);
  start.setDate(start.getDate() - 7);
  return { start, end: now };
}

function extractEntitiesFromQuery(query) {
  // Simple extraction - capitalize words that might be names
  const words = query.split(/\s+/);
  const potentialEntities = words.filter(w => 
    w.length > 2 && 
    /^[A-Z]/.test(w) &&
    !['How', 'What', 'Who', 'The', 'And', 'But'].includes(w)
  );
  return potentialEntities;
}

async function generateEmbedding(text) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });
  const data = await response.json();
  return data.data[0].embedding;
}
```

### 6.3 Memory Consolidation API

```javascript
// api/memory-consolidate.js

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export default async function handler(req, res) {
  const { userId, force = false, threshold = 0.85 } = req.body;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Find all active entities with embeddings
  const { data: entities, error } = await supabase
    .from('user_entities')
    .select('id, name, summary, embedding, memory_type, importance_score, mention_count, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('embedding', 'is', null);

  if (error || !entities?.length) {
    return res.json({ consolidated: 0, candidates: 0, message: 'No entities to consolidate' });
  }

  // Find similar pairs
  const candidates = [];

  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const similarity = cosineSimilarity(entities[i].embedding, entities[j].embedding);
      
      if (similarity >= threshold) {
        candidates.push({
          entity1: entities[i],
          entity2: entities[j],
          similarity
        });
      }
    }
  }

  if (candidates.length === 0) {
    return res.json({ consolidated: 0, candidates: 0, message: 'No duplicate memories found' });
  }

  if (!force) {
    // Return candidates for review
    return res.json({
      consolidated: 0,
      candidates: candidates.length,
      preview: candidates.slice(0, 10).map(c => ({
        entity1: { id: c.entity1.id, name: c.entity1.name, summary: c.entity1.summary },
        entity2: { id: c.entity2.id, name: c.entity2.name, summary: c.entity2.summary },
        similarity: (c.similarity * 100).toFixed(1) + '%'
      })),
      message: 'Run with force=true to consolidate'
    });
  }

  // Consolidate
  const results = [];

  for (const candidate of candidates) {
    try {
      // Determine which to keep (higher importance + more mentions + older)
      const score1 = (candidate.entity1.importance_score || 0.5) + 
                     (candidate.entity1.mention_count || 0) * 0.01 +
                     (new Date() - new Date(candidate.entity1.created_at)) / (1000 * 60 * 60 * 24 * 365);
      const score2 = (candidate.entity2.importance_score || 0.5) + 
                     (candidate.entity2.mention_count || 0) * 0.01 +
                     (new Date() - new Date(candidate.entity2.created_at)) / (1000 * 60 * 60 * 24 * 365);

      const keeper = score1 >= score2 ? candidate.entity1 : candidate.entity2;
      const merged = score1 >= score2 ? candidate.entity2 : candidate.entity1;

      // Use Claude to merge the summaries intelligently
      const mergeResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Merge these two memory entries about the same thing into one concise summary:

Memory 1: "${keeper.summary}"
Memory 2: "${merged.summary}"

Write a single merged summary that preserves all unique information. Keep it concise (1-2 sentences).`
        }]
      });

      const mergedSummary = mergeResponse.content[0]?.text || keeper.summary;

      // Update keeper
      await supabase
        .from('user_entities')
        .update({
          summary: mergedSummary,
          importance_score: Math.max(keeper.importance_score || 0.5, merged.importance_score || 0.5),
          mention_count: (keeper.mention_count || 0) + (merged.mention_count || 0),
          context_notes: [
            ...(keeper.context_notes || []),
            ...(merged.context_notes || [])
          ].slice(-10),
          version: (keeper.version || 1) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', keeper.id);

      // Archive merged entity
      await supabase
        .from('user_entities')
        .update({
          status: 'archived',
          superseded_by: keeper.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', merged.id);

      // Log operation
      await supabase
        .from('memory_operations')
        .insert({
          user_id: userId,
          operation: 'CONSOLIDATE',
          candidate_fact: merged.summary,
          llm_reasoning: `Merged with ${keeper.name} (${(candidate.similarity * 100).toFixed(1)}% similar)`,
          entity_id: keeper.id,
          merged_entity_ids: [merged.id],
          kept_entity_id: keeper.id,
          old_content: merged.summary,
          new_content: mergedSummary
        });

      results.push({
        kept: keeper.id,
        merged: merged.id,
        similarity: candidate.similarity,
        new_summary: mergedSummary
      });

    } catch (err) {
      console.error('Consolidation error:', err);
      results.push({
        error: err.message,
        entity1: candidate.entity1.id,
        entity2: candidate.entity2.id
      });
    }
  }

  return res.json({
    consolidated: results.filter(r => !r.error).length,
    failed: results.filter(r => r.error).length,
    results
  });
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

---

## BUILD 7: MIRROR INTEGRATION

### 7.1 Type-Aware Context for Mirror

```javascript
// Enhancement for api/mirror.js

async function buildMirrorContext(supabase, userId, query) {
  // Generate embedding for the query
  const embedding = await generateEmbedding(query);
  
  // Get user preferences
  const { data: prefs } = await supabase
    .from('memory_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Detect if query asks about history/past
  const includeHistorical = /used to|previously|in the past|history|changed/.test(query.toLowerCase());

  // Get relevant memories with enhanced search
  const { data: memories } = await supabase.rpc('match_entities_enhanced', {
    query_embedding: embedding,
    match_threshold: 0.35,
    match_count: 20,
    p_user_id: userId,
    p_include_historical: includeHistorical,
    p_exclude_expired: true,
    p_sensitivity_max: prefs?.default_sensitivity_level || 'normal'
  });

  if (!memories?.length) {
    return { context: '', memories: [] };
  }

  // Prioritize by type for better context
  const prioritized = {
    preferences: memories.filter(m => m.memory_type === 'preference'),
    goals: memories.filter(m => m.memory_type === 'goal' && !m.is_historical),
    facts: memories.filter(m => m.memory_type === 'fact'),
    entities: memories.filter(m => m.memory_type === 'entity' || !m.memory_type),
    events: memories.filter(m => m.memory_type === 'event'),
    decisions: memories.filter(m => m.memory_type === 'decision'),
    historical: memories.filter(m => m.is_historical)
  };

  // Build context sections
  let context = '';

  if (prioritized.preferences.length) {
    context += `\n<user_preferences>\n`;
    prioritized.preferences.forEach(p => {
      context += `- ${p.summary}\n`;
    });
    context += `</user_preferences>\n`;
  }

  if (prioritized.goals.length) {
    context += `\n<active_goals>\n`;
    prioritized.goals.forEach(g => {
      context += `- ${g.summary}${g.expires_at ? ` (deadline: ${new Date(g.expires_at).toLocaleDateString()})` : ''}\n`;
    });
    context += `</active_goals>\n`;
  }

  if (prioritized.entities.length) {
    context += `\n<relevant_context>\n`;
    prioritized.entities.forEach(e => {
      const sentiment = e.sentiment_average > 0.3 ? '(positive)' : 
                       e.sentiment_average < -0.3 ? '(negative)' : '';
      context += `- ${e.name}: ${e.summary} ${sentiment}\n`;
    });
    context += `</relevant_context>\n`;
  }

  if (prioritized.facts.length) {
    context += `\n<known_facts>\n`;
    prioritized.facts.forEach(f => {
      context += `- ${f.summary}\n`;
    });
    context += `</known_facts>\n`;
  }

  if (prioritized.events.length) {
    context += `\n<upcoming_events>\n`;
    prioritized.events.forEach(e => {
      const dateStr = e.effective_from ? new Date(e.effective_from).toLocaleDateString() : '';
      context += `- ${e.summary}${dateStr ? ` (${dateStr})` : ''}\n`;
    });
    context += `</upcoming_events>\n`;
  }

  if (includeHistorical && prioritized.historical.length) {
    context += `\n<historical_context>\n`;
    prioritized.historical.forEach(h => {
      context += `- Previously: ${h.summary}\n`;
    });
    context += `</historical_context>\n`;
  }

  // Get related entities via graph if main entity detected
  const mainEntity = memories.find(m => m.entity_type === 'person' && m.similarity > 0.6);
  if (mainEntity) {
    const { data: connections } = await supabase.rpc('traverse_entity_graph', {
      p_entity_id: mainEntity.id,
      p_user_id: userId,
      p_max_depth: 1,
      p_min_strength: 0.4
    });

    if (connections?.length) {
      context += `\n<related_context>\n`;
      context += `${mainEntity.name}'s connections:\n`;
      connections.forEach(c => {
        context += `- ${c.relationship_types.join(' → ')} ${c.entity_name}\n`;
      });
      context += `</related_context>\n`;
    }
  }

  return {
    context,
    memories: memories.map(m => m.id),
    stats: {
      total: memories.length,
      by_type: Object.fromEntries(
        Object.entries(prioritized).map(([k, v]) => [k, v.length]).filter(([, v]) => v > 0)
      )
    }
  };
}
```

---

## VERIFICATION CHECKLIST

### Database Verification

```sql
-- Run these queries to verify schema

-- 1. Check user_entities columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_entities'
ORDER BY ordinal_position;

-- Expected new columns:
-- memory_type, is_historical, effective_from, expires_at, 
-- recurrence_pattern, sensitivity_level, version, access_count,
-- last_accessed_at, outcome, outcome_sentiment, outcome_recorded_at

-- 2. Check new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('memory_jobs', 'memory_operations', 'memory_preferences', 'entity_sentiment_history');

-- 3. Check entity_relationships enhancements
SELECT column_name FROM information_schema.columns
WHERE table_name = 'entity_relationships';

-- Expected: started_at, ended_at, strength, is_active, metadata, confidence

-- 4. Check functions exist
SELECT proname FROM pg_proc
WHERE proname IN (
  'match_entities_enhanced',
  'traverse_entity_graph',
  'get_sentiment_trajectory',
  'get_sentiment_trend',
  'apply_memory_decay',
  'cleanup_expired_memories',
  'update_memory_access'
);

-- 5. Check cron jobs
SELECT * FROM cron.job;
-- Expected: cleanup-memories (daily 3am), decay-memories (weekly Sunday 4am)
```

### API Verification

```bash
# Test memory-update API
curl -X POST https://your-app.vercel.app/api/memory-update \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "candidateFact": {
      "content": "Marcus joined Notion as a product manager",
      "memory_type": "fact",
      "name": "Marcus",
      "importance": "high"
    },
    "similarMemories": []
  }'
# Expected: {"operation": "ADD", "entity_id": "...", ...}

# Test memory-search special queries
curl -X POST https://your-app.vercel.app/api/memory-search \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-id", "query": "What do you know about me?"}'
# Expected: {"type": "self_summary", "summary": "...", ...}

# Test consolidation preview
curl -X POST https://your-app.vercel.app/api/memory-consolidate \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user-id", "force": false}'
# Expected: {"candidates": N, "preview": [...]}
```

---

## EDGE CASES REFERENCE

| Edge Case | Detection | Handler | Implementation |
|-----------|-----------|---------|----------------|
| Job change | "left X", "joined Y", change_type: job | UPDATE supersede | Creates new entity, marks old as historical |
| Name correction | "actually spelled", is_correction: true | UPDATE replace | Direct replacement, logs correction |
| Duplicate entities | Similarity > 85% | consolidate.js | LLM-merged summary, archive duplicate |
| Relationship change | "broke up", "got married" | UPDATE supersede | Relationship as historical, new current |
| Death/loss | Keywords: died, passed, loss | sensitivity: sensitive | Flag for careful retrieval |
| "I used to" | is_historical: true | Extraction | Mark as historical, don't supersede current |
| "Starting next month" | effective_from detected | Extraction | Set effective_from, exclude from retrieval until date |
| "Every Monday" | recurrence_pattern detected | Extraction | Store pattern JSON, special event handling |
| Medical/financial | Keywords detected | sensitivity: sensitive/private | Filter in retrieval based on user prefs |
| "Don't remember" | Explicit deletion request | DELETE hard_delete: true | Permanent removal |
| "What do you know about me?" | Query pattern | Special handler | Self-summary generation |
| Negation queries | "not", "except", "without" | Special handler | Exclusion filter |
| Expired memories | expires_at < NOW() | Cleanup cron | Daily archival at 3am |
| Low importance decay | importance_score < 0.1 | Decay cron | Weekly decay at 4am Sunday |

---

## FILE STRUCTURE SUMMARY

```
api/
  memory-update.js        ← NEW: Core UPDATE phase (ADD/UPDATE/DELETE/NOOP)
  memory-search.js        ← NEW: Special query handlers + standard search
  memory-consolidate.js   ← NEW: Duplicate detection and merging
  analyze.js              ← MODIFY: Add UPDATE phase integration
  extract-entities.js     ← MODIFY: Enhanced extraction with types
  mirror.js               ← MODIFY: Type-aware context building

supabase/
  functions/
    memory-worker/
      index.ts            ← NEW: Async job processor

lib/
  memory-queue.js         ← NEW: Job scheduling utilities
```

---

**END OF COMPLETE SPECIFICATION**

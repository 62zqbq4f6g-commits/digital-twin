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


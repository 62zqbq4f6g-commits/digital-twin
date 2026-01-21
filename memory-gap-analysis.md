# Memory Architecture Gap Analysis
## Inscript vs "Agent That Never Forgets" Blueprint

**Date:** January 20, 2026
**Status:** Analysis Complete

---

## Executive Summary

Inscript has a **solid foundation** (70-75% complete) with sophisticated Mem0-inspired memory operations. However, several critical gaps prevent it from achieving the article's full "never forgets" architecture.

| Category | Coverage | Priority |
|----------|----------|----------|
| Short-Term Memory (Checkpointing) | ❌ 0% | P2 |
| Three-Layer Hierarchy | ⚠️ 65% | P0 |
| Knowledge Graph | ✅ 90% | - |
| Memory Maintenance | ⚠️ 40% | P0 |
| Retrieval Pipeline | ⚠️ 70% | P1 |
| Core Principles | ✅ 95% | - |

---

## ✅ WHAT INSCRIPT HAS (Strengths)

### 1. Intelligent Memory Operations (Mem0 Parity)
- **LLM Decision Layer:** ADD/UPDATE/DELETE/NOOP with tool calling
- **Conflict Resolution:** `replace`, `append`, `supersede` merge strategies
- **Version Tracking:** `supersedes_id`, `superseded_by`, `version` fields
- **Audit Trail:** Complete `memory_operations` table with LLM reasoning

### 2. Hybrid Memory Architecture
- **Vector Store:** pgvector embeddings (1536d OpenAI text-embedding-3-small)
- **Knowledge Graph:** `entity_relationships` with strength, confidence, temporal tracking
- **Composite Scoring:** 50% semantic + 20% importance + 15% recency + 15% access

### 3. Temporal Reasoning
- **Historical Marking:** `is_historical` for "used to" statements
- **Expiration:** `expires_at` for time-bound memories
- **Recurrence:** `recurrence_pattern` for weekly/monthly events
- **Future-Dating:** `effective_from` for "starting next month"

### 4. Memory Decay
- **Importance-Based Decay:** 5-20% weekly by memory type
- **Access Protection:** Recently accessed memories don't decay
- **Scheduled Cleanup:** Daily + weekly cron jobs defined

### 5. Privacy & Security
- **Sensitivity Levels:** normal/sensitive/private
- **Row-Level Security:** Users see only their own data
- **Soft Delete Default:** Hard delete only on explicit request

### 6. Memory Classification
- **8 Memory Types:** entity, fact, preference, event, goal, procedure, decision, action
- **Importance Levels:** critical/high/medium/low/trivial with scores

---

## ❌ CRITICAL GAPS TO FILL

### Gap 1: No Checkpointing System (Short-Term Memory)
**Article Requirement:**
> "A checkpoint is a snapshot of the entire state at a specific moment. This gives you determinism, recoverability, and debuggability."

**Current State:** Inscript has no conversation state checkpointing. Sessions don't persist state between API calls.

**Why It Matters:**
- Can't resume conversations exactly where left off
- Can't replay/debug agent decisions
- Can't recover from crashes mid-conversation

**Implementation Needed:**
```javascript
// Checkpoint schema needed
conversation_checkpoints {
  id: UUID,
  user_id: UUID,
  session_id: UUID,
  state: JSONB,          // Full conversation state
  tool_calls: JSONB[],   // Tools invoked
  memory_context: JSONB, // Retrieved memories at this point
  created_at: TIMESTAMPTZ
}
```

**Effort:** Medium (2-3 days)
**Priority:** P2 (Not blocking core functionality)

---

### Gap 2: No Category-Level Summaries (Layer 3 Missing)
**Article Requirement:**
> "Layer 3: Categories (Evolving Summaries) - Items are grouped into files like `work_preferences.md` or `personal_life.md`"

**Current State:**
- ✅ Layer 1 (Resources): Notes table
- ✅ Layer 2 (Items): user_entities with atomic facts
- ❌ Layer 3 (Categories): No category-level summaries

Inscript stores individual entities but doesn't synthesize them into category summaries like:
- `work_context.md` - Overall work situation
- `relationships.md` - Social network summary
- `goals_priorities.md` - Current objectives

**Why It Matters:**
- Can't quickly retrieve "user's work situation" without scanning all entities
- No high-level narrative coherence
- Retrieval always starts at item level (expensive)

**Implementation Needed:**
```sql
-- New table
memory_category_summaries {
  id: UUID,
  user_id: UUID,
  category: TEXT,           -- 'work', 'relationships', 'health', 'goals'
  summary: TEXT,            -- LLM-generated summary
  included_entity_ids: UUID[],
  last_synthesized_at: TIMESTAMPTZ,
  version: INT
}
```

```javascript
// Category synthesis function
async function synthesizeCategorySummary(userId, category) {
  const entities = await getEntitiesByCategory(userId, category);
  const summary = await llm.invoke(`
    Synthesize these memories about ${category} into a coherent summary:
    ${entities.map(e => e.summary).join('\n')}

    Write 2-4 paragraphs capturing the full picture.
  `);
  return upsertCategorySummary(userId, category, summary);
}
```

**Effort:** Medium (3-4 days)
**Priority:** P0 (Critical for narrative coherence)

---

### Gap 3: Tiered Retrieval Missing
**Article Requirement:**
> "Pull Category Summaries first. Ask LLM: 'Is this enough?' If yes → Respond. If no → Drill down into specific items."

**Current State:** Retrieval always queries at entity level. No tiered approach.

**Why It Matters:**
- Token waste: Retrieving 15 entities when a summary would suffice
- Missing forest for trees: No high-level context
- Expensive: Every query does full semantic search

**Implementation Needed:**
```javascript
async function tieredRetrieval(query, userId) {
  // Stage 1: Get category summaries
  const categories = await selectRelevantCategories(query, userId);
  const summaries = await getCategorySummaries(userId, categories);

  // Stage 2: Sufficiency check
  const sufficient = await llm.invoke(`
    Query: ${query}
    Summaries: ${JSON.stringify(summaries)}
    Can you answer comprehensively with just these? YES/NO
  `);

  if (sufficient.includes('YES')) {
    return { type: 'category', data: summaries };
  }

  // Stage 3: Drill down to entities
  const entities = await searchEntities(query, userId, { limit: 10 });
  return { type: 'entity', data: entities };
}
```

**Effort:** Medium (2-3 days)
**Priority:** P1 (Depends on Gap 2)

---

### Gap 4: Nightly Consolidation Missing
**Article Requirement:**
> "Every night at 3 AM, a background process reviews the day's conversations. It looks for patterns the agent missed during live operation. It merges redundant memories. It promotes frequently-accessed items to higher-priority storage."

**Current State:**
- ✅ `cleanup_expired_memories()` runs daily (archives expired)
- ❌ No pattern detection
- ❌ No frequency-based promotion
- ❌ No consolidation of today's memories

**Why It Matters:**
- Redundant memories accumulate during active use
- Pattern detection only happens during extraction, not review
- No "second look" at what was learned today

**Implementation Needed:**
```javascript
// Nightly consolidation job
async function nightlyConsolidation(userId) {
  // 1. Get today's memories
  const todaysMemories = await getMemoriesSince(userId, hours=24);

  // 2. Find redundancies
  const duplicates = await findSimilarMemories(todaysMemories, threshold=0.85);
  for (const group of duplicates) {
    await mergeMemories(group);
  }

  // 3. Detect patterns
  const patterns = await llm.invoke(`
    Review today's memories and identify patterns:
    ${todaysMemories.map(m => m.summary).join('\n')}

    What patterns, connections, or insights did we miss?
  `);
  await storePatterns(userId, patterns);

  // 4. Promote hot memories
  const hotMemories = await getHighAccessMemories(userId, period='7d');
  await promoteImportance(hotMemories);

  // 5. Re-synthesize affected categories
  const affectedCategories = getUniqueCategories(todaysMemories);
  for (const cat of affectedCategories) {
    await synthesizeCategorySummary(userId, cat);
  }
}
```

**Effort:** High (4-5 days)
**Priority:** P0 (Critical for memory health)

---

### Gap 5: Weekly Re-summarization Missing
**Article Requirement:**
> "Once a week, the system re-summarizes category files. It compresses old items into higher-level insights."

**Current State:**
- ✅ `apply_memory_decay()` runs weekly (decays scores)
- ❌ No automatic re-summarization
- ❌ No compression of old items into insights

**Why It Matters:**
- Category summaries get stale
- Old items don't get consolidated into wisdom
- Memory becomes fragmented over time

**Implementation Needed:**
```javascript
// Weekly summarization job
async function weeklySummarization(userId) {
  const categories = await getAllCategories(userId);

  for (const category of categories) {
    // 1. Get all memories in category
    const memories = await getMemoriesByCategory(userId, category);

    // 2. Separate old (>30 days) from recent
    const old = memories.filter(m => ageInDays(m) > 30);
    const recent = memories.filter(m => ageInDays(m) <= 30);

    // 3. Compress old into insights
    if (old.length >= 5) {
      const insight = await compressToInsight(old);
      await storeInsight(userId, category, insight);
      await archiveMemories(old);
    }

    // 4. Re-synthesize category summary
    await synthesizeCategorySummary(userId, category);
  }
}
```

**Effort:** Medium (2-3 days)
**Priority:** P1 (Important for long-term health)

---

### Gap 6: Monthly Re-indexing Missing
**Article Requirement:**
> "On a monthly basis, we run a full re-index of the memory store. Embeddings are rebuilt with the latest model version, and graph edges are adjusted based on real usage."

**Current State:** No re-indexing exists.

**Why It Matters:**
- Embedding models improve; old vectors become stale
- Graph edges don't reflect actual usage patterns
- Search quality degrades over time

**Implementation Needed:**
```javascript
// Monthly re-index job
async function monthlyReindex(userId) {
  // 1. Re-embed all memories with latest model
  const memories = await getAllMemories(userId);
  for (const memory of memories) {
    const newEmbedding = await embedText(memory.summary);
    await updateEmbedding(memory.id, newEmbedding);
  }

  // 2. Adjust graph edges by actual access patterns
  const relationships = await getAllRelationships(userId);
  for (const rel of relationships) {
    const accessStats = await getCoAccessStats(rel.source_id, rel.target_id);
    const newStrength = calculateStrengthFromAccess(accessStats);
    await updateRelationshipStrength(rel.id, newStrength);
  }

  // 3. Archive dead nodes (unused 180+ days)
  const deadNodes = await findUnusedMemories(userId, days=180);
  await archiveMemories(deadNodes);

  // 4. Rebuild category summaries
  await rebuildAllCategorySummaries(userId);
}
```

**Effort:** Medium (2-3 days)
**Priority:** P2 (Important for scale)

---

### Gap 7: Query Synthesis Missing
**Article Requirement:**
> "It starts with a broad search using a synthesized query, not the raw user input."

**Current State:**
- ✅ Special query detection (temporal, relational, etc.)
- ❌ No general query synthesis

Example of gap:
- User: "I'm stressed about work"
- Current: Searches for "stressed about work"
- Ideal: Synthesizes to "work situation, deadlines, manager, projects, stress triggers"

**Why It Matters:**
- Raw queries miss context
- Retrieval is too literal
- Relevant memories don't surface

**Implementation Needed:**
```javascript
async function synthesizeSearchQuery(userMessage, recentContext) {
  const synthesis = await llm.invoke(`
    User message: "${userMessage}"
    Recent context: ${recentContext}

    Generate a comprehensive search query that captures:
    1. Explicit topics mentioned
    2. Implicit topics (emotional state → related people/situations)
    3. Related entities that might be relevant

    Return a single search string optimized for semantic similarity.
  `);

  return synthesis;
}
```

**Effort:** Low (1 day)
**Priority:** P1 (High impact, low effort)

---

### Gap 8: Token-Budget-Aware Assembly Missing
**Article Requirement:**
> "The result is a prompt that contains only the 5-10 memory tokens that actually move the needle... We filter those prospects through a 'relevance scorer' and a 'time-decay' function."

**Current State:**
- ✅ Limits to top 15 entities
- ❌ No explicit token budgeting
- ❌ No "is this worth the tokens?" filter

**Why It Matters:**
- May inject irrelevant memories that waste context
- No optimization for token efficiency
- Can't balance between breadth and depth

**Implementation Needed:**
```javascript
async function assembleContext(memories, maxTokens = 2000) {
  const selected = [];
  let tokenCount = 0;

  // Sort by composite score (already done)
  const ranked = memories.sort((a, b) => b.score - a.score);

  for (const memory of ranked) {
    const memoryTokens = countTokens(memory.summary);

    // Token budget check
    if (tokenCount + memoryTokens > maxTokens) {
      break;
    }

    // Value check: is this worth the tokens?
    const valuePerToken = memory.score / memoryTokens;
    if (valuePerToken < 0.001) { // threshold
      continue; // Skip low-value memories
    }

    selected.push(memory);
    tokenCount += memoryTokens;
  }

  return formatMemoryContext(selected);
}
```

**Effort:** Low (1 day)
**Priority:** P1 (Cost optimization)

---

## IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1) — P0 Items
1. **Create `memory_category_summaries` table** (Gap 2)
2. **Implement category synthesis function** (Gap 2)
3. **Build nightly consolidation job** (Gap 4)

### Phase 2: Retrieval Enhancement (Week 2) — P1 Items
4. **Implement tiered retrieval** (Gap 3)
5. **Add query synthesis** (Gap 7)
6. **Add token-budget assembly** (Gap 8)
7. **Implement weekly re-summarization** (Gap 5)

### Phase 3: Long-Term Health (Week 3) — P2 Items
8. **Build monthly re-indexing job** (Gap 6)
9. **Implement checkpointing** (Gap 1)
10. **Add memory health dashboard**

---

## QUICK WINS (Can Ship This Week)

| Item | Effort | Impact |
|------|--------|--------|
| Query synthesis | 1 day | High - Better retrieval |
| Token budgeting | 1 day | Medium - Cost savings |
| Category summaries table | 0.5 day | Unlocks tiered retrieval |
| Basic category synthesis | 1 day | High - Narrative coherence |

---

## ARCHITECTURE COMPARISON

### Article's "Operating System" Model
```
┌─────────────────────────────────────────────┐
│              PROCESS MANAGEMENT             │
│         (Checkpointing, State)              │
├─────────────────────────────────────────────┤
│              MEMORY MANAGEMENT              │
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │ RAM     │  │ SSD     │  │ Archive     │ │
│  │ (Chat)  │  │ (Active)│  │ (Historical)│ │
│  └─────────┘  └─────────┘  └─────────────┘ │
├─────────────────────────────────────────────┤
│               I/O MANAGEMENT                │
│          (Tools, Retrieval, APIs)           │
└─────────────────────────────────────────────┘
```

### Inscript Current
```
┌─────────────────────────────────────────────┐
│              PROCESS MANAGEMENT             │
│              ❌ NOT IMPLEMENTED             │
├─────────────────────────────────────────────┤
│              MEMORY MANAGEMENT              │
│  ┌─────────┐  ┌─────────┐  ┌─────────────┐ │
│  │ Notes   │  │Entities │  │ Archived    │ │
│  │ ✅      │  │ ✅      │  │ ✅          │ │
│  └─────────┘  └─────────┘  └─────────────┘ │
│                                             │
│  ⚠️ Missing: Category Summaries Layer       │
├─────────────────────────────────────────────┤
│               I/O MANAGEMENT                │
│              ✅ IMPLEMENTED                 │
└─────────────────────────────────────────────┘
```

---

## SUCCESS METRICS

After implementing all gaps:

| Metric | Current | Target |
|--------|---------|--------|
| Retrieval relevance | ~70% | 90%+ |
| Token efficiency | Unknown | Track cost/query |
| Memory coherence | Entity-level | Category-level |
| Stale memories | Unknown | <5% after 90 days |
| Duplicate rate | Unknown | <2% |

---

## CONCLUSION

Inscript has **excellent building blocks** but lacks the **synthesis and maintenance layers** that make memory truly "never forget."

**The critical insight from the article:**
> "Memory isn't a hard drive. It's a process."

Inscript treats memory as storage (entities go in, entities come out). The article's architecture treats memory as a **living system** that consolidates, summarizes, decays, and evolves.

**Top 3 Actions:**
1. Add category summaries (narrative coherence)
2. Build nightly consolidation (memory health)
3. Implement tiered retrieval (efficiency)

These three changes transform Inscript from "good memory" to "never forgets."

---

*Generated: January 20, 2026*

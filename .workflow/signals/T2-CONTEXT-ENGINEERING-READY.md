# T2 → T4: CONTEXT ENGINEERING READY

**Completed:** January 28, 2026
**Terminal:** T2

---

## Files Created

| File | Purpose |
|------|---------|
| `/lib/mirror/task-classifier.js` | Classify messages into task types |
| `/lib/mirror/context-strategies.js` | Define context loading strategies |
| `/lib/mirror/context-loader.js` | Load context based on strategy |
| `/lib/mirror/graph-traversal.js` | Navigate entity relationships |
| `/lib/mirror/index.js` | Updated with all exports |

---

## API Usage

```javascript
import {
  loadContextForTask,
  formatContextForPrompt,
  classifyTask,
  getTaskTypeLabel
} from './lib/mirror/index.js';

// In MIRROR handler:
const context = await loadContextForTask(userId, message, supabase);
const contextString = formatContextForPrompt(context);

// Response includes:
// - context.taskType ('entity_recall', 'decision', 'emotional', etc.)
// - context.taskLabel (human-readable)
// - context.strategy (description of what's being loaded)
// - context.entities, context.facts, context.notes, context.patterns
// - context.contextUsed (for UI display)
```

---

## Task Types

| Type | Triggers | Context Loaded |
|------|----------|----------------|
| `entity_recall` | "what do you know about", "who is" | Entity + facts + mentions |
| `decision` | "should I", "help me decide" | Values, people, past decisions |
| `emotional` | "I'm stressed", "feeling" | Patterns, supportive relationships |
| `research` | "research", "deep dive" | Broad search, all related |
| `thinking_partner` | "I'm thinking about" | Related notes, thinking patterns |
| `factual` | "when did", "where does" | Entity + facts only |
| `general` | (fallback) | Top entities, recent notes |

---

## Context Strategies

Each task type has a defined strategy:

- **entities**: `mentioned_only` | `relevant_people` | `supportive_relationships` | `all_related` | `top_by_importance`
- **facts**: `all_for_entity` | `high_confidence` | `relevant` | `all` | `minimal` | `none`
- **notes**: `mentions_only` | `related_topics` | `past_similar` | `broad_search` | `recent` | `none`
- **patterns**: `behavioral` | `emotional_patterns` | `thinking_patterns` | `all` | `none`

---

## Graph Traversal

```javascript
import { traverseGraph, findEntitiesForTopic } from './lib/mirror/index.js';

// Get entity with all connections
const result = await traverseGraph(userId, entityId, supabase);
// Returns: { entity, facts, connections: [{ entity, relationship, via }] }

// Find entities related to a topic
const entities = await findEntitiesForTopic(userId, 'productivity', supabase);
// Returns: [{ ...entity, relevanceScore }]
```

---

## Integration Points

### For api/mirror.js:

Replace generic context loading with:

```javascript
import { loadContextForTask, formatContextForPrompt } from '../lib/mirror/index.js';

// Before calling LLM:
const context = await loadContextForTask(userId, userMessage, supabase);
const contextString = formatContextForPrompt(context);

// Add to system prompt:
systemPrompt += contextString;

// Return context metadata to UI:
response.contextUsed = context.contextUsed;
response.taskType = context.taskType;
```

---

## Privacy Compliance

- No content logging (only error codes, user IDs, task types)
- Notes content not searched (E2E encrypted) — only titles/metadata
- Facts and entities are user-specific (RLS enforced)

---

## Next Steps for T4

1. Wire `loadContextForTask` into `api/mirror.js`
2. Update MIRROR UI to display `contextUsed` with task type badge
3. Run integration tests
4. Verify context relevance with real queries

---

**Signal Status:** READY FOR T4

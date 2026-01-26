# Terminal 2: Data Layer Lead — Sprint 2

**Role:** Update queries and transforms for structured facts + MIRROR messages  
**Task ID:** `export-sprint2-t2`

---

## Context: What We Built in Sprint 1

We shipped **Portable Memory Export** — users can download everything Inscript knows about them as JSON.

**What's working:**
- `/lib/export/queries.js` — Your database queries
- `/lib/export/transforms.js` — Your data transformation
- `/lib/export/privacy.js` — Your privacy filtering
- Full export pipeline working

**What's missing (Sprint 2 fixes):**
1. **Structured facts** — Entities need queryable facts like "Marcus works_at Anthropic"
2. **MIRROR messages** — Export includes summaries but not the actual conversation messages
3. **Privacy controls** — Columns are being added by T1, your filters already support this

---

## Your Ownership

**Files you OWN:**
```
/lib/export/queries.js       ← Add getEntityFacts, update getConversations
/lib/export/transforms.js    ← Update transformEntity, transformConversation
/lib/export/privacy.js       ← Already done, may need minor updates
/lib/export/types.js         ← Add new type definitions
```

**Files you READ (for context):**
```
/api/export.js               ← T1's API (may need to pass facts to transforms)
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-data
```

---

## Dependency: Wait for T1

**T1 is creating the `entity_facts` table.** You cannot test fact queries until T1 signals:
```
T1 → T2: MIGRATIONS COMPLETE
```

**You CAN start on MIRROR messages immediately** — that table already exists.

---

## Task 1: Add MIRROR Messages to Export (DO FIRST — No blockers)

### 1.1 Update getConversations in queries.js

Find your existing `getConversations` function and update it:

```javascript
/**
 * Get MIRROR conversations WITH full message history
 */
export async function getConversations(user_id) {
  // Get conversations
  const { data: conversations, error: convError } = await supabase
    .from('mirror_conversations')
    .select(`
      id,
      status,
      summary,
      key_insights,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (convError) {
    console.error('[Export] Failed to get conversations:', convError);
    return [];
  }

  if (!conversations?.length) {
    return [];
  }

  // Get messages for all conversations in one query
  const conversationIds = conversations.map(c => c.id);
  
  const { data: messages, error: msgError } = await supabase
    .from('mirror_messages')
    .select(`
      id,
      conversation_id,
      role,
      content,
      created_at
    `)
    .in('conversation_id', conversationIds)
    .order('created_at', { ascending: true });

  if (msgError) {
    console.error('[Export] Failed to get messages:', msgError);
    // Return conversations without messages rather than failing
    return conversations.map(c => ({ ...c, messages: [] }));
  }

  // Group messages by conversation
  const messagesByConvo = {};
  for (const msg of (messages || [])) {
    if (!messagesByConvo[msg.conversation_id]) {
      messagesByConvo[msg.conversation_id] = [];
    }
    messagesByConvo[msg.conversation_id].push(msg);
  }

  // Attach messages to conversations
  return conversations.map(conv => ({
    ...conv,
    messages: messagesByConvo[conv.id] || []
  }));
}
```

### 1.2 Update transformConversation in transforms.js

```javascript
/**
 * Transform conversation with messages to export format
 */
export function transformConversation(conv) {
  return {
    id: conv.id,
    status: conv.status || 'completed',
    summary: conv.summary || null,
    key_insights: conv.key_insights || [],
    started_at: conv.created_at,
    updated_at: conv.updated_at,
    
    // NEW: Include full message history
    message_count: conv.messages?.length || 0,
    messages: (conv.messages || []).map(msg => ({
      role: msg.role,           // 'user' or 'assistant'
      content: msg.content,
      timestamp: msg.created_at
    }))
  };
}
```

### 1.3 Test MIRROR Messages

```javascript
// Quick test
import { getConversations } from './lib/export/queries.js';
import { transformConversation } from './lib/export/transforms.js';

const convos = await getConversations('YOUR_USER_ID');
console.log('Conversations:', convos.length);
console.log('First convo messages:', convos[0]?.messages?.length);

const transformed = convos.map(transformConversation);
console.log('Transformed:', JSON.stringify(transformed[0], null, 2));
```

**Checkpoint:** Export should now include messages array in each conversation.

---

## Task 2: Add Entity Facts to Export (AFTER T1 signals)

### 2.1 Add getEntityFacts to queries.js

```javascript
/**
 * Get all entity facts for a user
 */
export async function getEntityFacts(user_id) {
  const { data, error } = await supabase
    .from('entity_facts')
    .select(`
      id,
      entity_id,
      predicate,
      object_text,
      object_entity_id,
      confidence,
      source_note_id,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get entity facts:', error);
    return [];
  }
  
  return data || [];
}
```

### 2.2 Update transformEntity in transforms.js

The function signature needs to accept facts:

```javascript
/**
 * Transform entity with facts to export format
 * @param {Object} entity - Entity from database
 * @param {Array} allFacts - All facts for this user (we'll filter to this entity)
 */
export function transformEntity(entity, allFacts = []) {
  // Filter facts for this entity
  const entityFacts = allFacts.filter(f => f.entity_id === entity.id);
  
  return {
    id: entity.id,
    type: mapEntityType(entity.entity_type),
    name: entity.name,
    aliases: entity.aliases || [],  // NEW: Include aliases
    relationship: entity.relationship,
    description: entity.summary || null,
    
    importance: entity.importance_score || 0,
    sentiment: entity.sentiment_average || 0,
    mention_count: entity.mention_count || 0,
    
    // NEW: Structured facts
    facts: entityFacts.map(f => ({
      predicate: f.predicate,
      object: f.object_text,
      confidence: f.confidence,
      source_note_id: f.source_note_id || null
    })),
    
    temporal: {
      first_seen: entity.created_at,
      last_seen: entity.updated_at,
      valid_from: entity.effective_from || null,
      valid_until: entity.expires_at || null,
      active: !entity.is_historical
    },
    
    privacy: entity.privacy_level || 'internal'
  };
}
```

### 2.3 Update the Export API Call Pattern

T1 will need to update `/api/export.js` to fetch facts and pass them to transforms:

```javascript
// In /api/export.js (T1's file, but document the pattern)
const [entities, facts, ...other] = await Promise.all([
  getEntities(user_id),
  getEntityFacts(user_id),  // NEW
  // ... other queries
]);

// Pass facts to transform
const transformedEntities = publicEntities.map(e => transformEntity(e, facts));
```

**Signal T1 when this is ready:**
```
T2 → T1: FACT TRANSFORMS READY
Updated transformEntity to accept facts array.
Update /api/export.js to:
1. Import getEntityFacts from queries.js
2. Call getEntityFacts(user_id) in Promise.all
3. Pass facts to transformEntity: entities.map(e => transformEntity(e, facts))
```

---

## Task 3: Update types.js

Add new type definitions:

```javascript
// /lib/export/types.js

export const EXPORT_VERSION = "1.1.0";  // Bump version for Sprint 2

export const PRIVACY_LEVELS = ['private', 'internal', 'shared'];

export const ENTITY_TYPES = [
  'person', 
  'organization', 
  'place', 
  'project', 
  'concept', 
  'event', 
  'thing'
];

export const PATTERN_TYPES = [
  'temporal', 
  'preference', 
  'habit', 
  'relational', 
  'behavioral', 
  'emotional'
];

// NEW: Fact predicate types
export const FACT_PREDICATES = [
  'works_at',      // Employment
  'role',          // Job title
  'relationship',  // Relation to user
  'location',      // Where they are
  'likes',         // Preferences
  'dislikes',      // Anti-preferences
  'status',        // Current state
  'expertise',     // Skills
  'studied_at',    // Education
  'owns',          // Possessions
  'member_of',     // Group membership
  'collaborates_with'  // Working relationships
];

// NEW: Message roles
export const MESSAGE_ROLES = ['user', 'assistant', 'system'];
```

---

## Task 4: Update buildMeta

Update to reflect new version and include fact counts:

```javascript
/**
 * Build meta section with Sprint 2 additions
 */
export function buildMeta({ entities, notes, patterns, facts = [], conversations = [] }) {
  const timestamps = notes
    .map(n => new Date(n.created_at))
    .filter(d => !isNaN(d));
  
  // Count total messages across conversations
  const totalMessages = conversations.reduce(
    (sum, c) => sum + (c.messages?.length || 0), 
    0
  );
  
  return {
    version: "1.1.0",  // Bumped for Sprint 2
    exported_at: new Date().toISOString(),
    source: "Inscript",
    source_version: "8.6.0",  // Update as needed
    
    counts: {
      entities: entities.length,
      notes: notes.length,
      patterns: patterns.length,
      facts: facts.length,           // NEW
      conversations: conversations.length,
      messages: totalMessages        // NEW
    },
    
    date_range: {
      first_entry: timestamps.length 
        ? new Date(Math.min(...timestamps)).toISOString() 
        : null,
      last_entry: timestamps.length 
        ? new Date(Math.max(...timestamps)).toISOString() 
        : null
    },
    
    embedding_note: "Embeddings not included. Regenerate from content if needed."
  };
}
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| getConversations returns messages | Check messages array exists | ☐ |
| transformConversation includes messages | Export has message content | ☐ |
| getEntityFacts returns facts | After T1 migration, query works | ☐ |
| transformEntity includes facts | Export entities have facts array | ☐ |
| buildMeta has fact/message counts | Meta shows new counts | ☐ |
| Version bumped to 1.1.0 | Meta.version is correct | ☐ |

---

## Handoff Signals

**You signal when MIRROR messages ready:**
```
T2 → T4: MIRROR MESSAGES READY
Conversations now include full message history.
Export will show:
- conversations[].messages[]
- conversations[].message_count
- meta.counts.messages
Test the export!
```

**You signal T1 when fact transforms ready:**
```
T2 → T1: FACT TRANSFORMS READY
transformEntity now accepts (entity, allFacts) parameters.
Update /api/export.js to:
1. Import { getEntityFacts } from queries.js
2. Add getEntityFacts(user_id) to Promise.all
3. Pass facts: entities.map(e => transformEntity(e, facts))
```

**You signal when fully complete:**
```
T2 → ALL: DATA LAYER SPRINT 2 COMPLETE
- MIRROR messages in export ✅
- Entity facts in export ✅
- Version 1.1.0 ✅
Ready for E2E testing.
```

---

## Definition of Done

- [ ] `getConversations` fetches messages from `mirror_messages`
- [ ] `transformConversation` includes messages array
- [ ] `getEntityFacts` query function added
- [ ] `transformEntity` accepts and includes facts
- [ ] `buildMeta` includes fact and message counts
- [ ] Version bumped to 1.1.0
- [ ] All transforms handle null/empty gracefully
- [ ] T1 and T4 signaled

---

## Export Structure After Sprint 2

```json
{
  "inscript_export": {
    "identity": { ... },
    
    "entities": [
      {
        "id": "...",
        "name": "Marcus",
        "type": "person",
        "aliases": ["Marc"],
        "facts": [
          { "predicate": "works_at", "object": "Anthropic", "confidence": 0.95 },
          { "predicate": "role", "object": "Engineer", "confidence": 0.9 },
          { "predicate": "location", "object": "San Francisco", "confidence": 0.85 }
        ],
        ...
      }
    ],
    
    "episodes": {
      "notes": [ ... ],
      "meetings": [ ... ],
      "conversations": [
        {
          "id": "...",
          "summary": "Discussed project priorities",
          "message_count": 12,
          "messages": [
            { "role": "user", "content": "What should I focus on?", "timestamp": "..." },
            { "role": "assistant", "content": "Based on your patterns...", "timestamp": "..." }
          ]
        }
      ]
    },
    
    "patterns": [ ... ],
    
    "meta": {
      "version": "1.1.0",
      "counts": {
        "entities": 23,
        "notes": 156,
        "facts": 87,
        "conversations": 12,
        "messages": 248
      }
    }
  }
}
```

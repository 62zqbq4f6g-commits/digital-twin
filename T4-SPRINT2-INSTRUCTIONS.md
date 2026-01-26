# Terminal 4: QA & Integration Lead — Sprint 2

**Role:** Test structured facts, MIRROR messages, and privacy controls  
**Task ID:** `export-sprint2-t4`

---

## Context: What We Built in Sprint 1

We shipped **Portable Memory Export** — fully tested, all E2E passing.

**Sprint 1 Deliverables (yours):**
- `/tests/export/fixtures/mock-data.js`
- `/tests/export/transforms.test.js`
- `/tests/export/api.test.js`
- `/tests/export/E2E-CHECKLIST.md`
- `/docs/EXPORT.md`

---

## Sprint 2 Additions to Test

| Feature | Owner | What to Test |
|---------|-------|--------------|
| Structured facts | T1 + T2 | Facts appear in export, extracted from notes |
| MIRROR messages | T2 | Full message history in conversations |
| Privacy controls | T1 + T3 | Toggle works, private items excluded |
| Privacy indicator | T3 | Shows correct count |
| Privacy APIs | T3 | privacy-summary, update-privacy work |

---

## Your Ownership

**Files you OWN:**
```
/tests/export/fixtures/mock-data.js    ← Update with facts, messages
/tests/export/transforms.test.js       ← Add fact/message tests
/tests/export/api.test.js              ← Add privacy API tests
/tests/export/E2E-CHECKLIST.md         ← Update for Sprint 2
/docs/EXPORT.md                        ← Update documentation
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-tests
```

---

## Dependency: Wait for Other Terminals

| Terminal | Signal to Wait For | Then Test |
|----------|-------------------|-----------|
| T1 | "MIGRATIONS COMPLETE" | Database has new columns/tables |
| T2 | "MIRROR MESSAGES READY" | Test conversation export |
| T2 | "FACT TRANSFORMS READY" | Test entity facts in export |
| T3 | "PRIVACY UI READY" | Test privacy toggles |

**You can start updating fixtures and tests immediately.** Run them after signals arrive.

---

## Task 1: Update Test Fixtures (DO FIRST)

Update `/tests/export/fixtures/mock-data.js`:

```javascript
// /tests/export/fixtures/mock-data.js
// OWNER: T4
// Updated for Sprint 2: facts and messages

export const mockUserId = 'test-user-00000000-0000-0000-0000-000000000001';

// === EXISTING (from Sprint 1) ===

export const mockProfile = {
  user_id: mockUserId,
  name: 'Test User',
  role_type: 'Product Manager',
  goals: ['Ship v1', 'Get user feedback', 'Iterate quickly'],
  tone: 'warm',
  life_seasons: ['career transition', 'learning phase'],
  depth_answer: 'I am building products that help people think better.',
  custom_instructions: 'Be concise and direct.'
};

export const mockKeyPeople = [
  { name: 'Alice Chen', relationship: 'colleague', created_at: '2024-06-15T10:00:00Z' },
  { name: 'Bob Smith', relationship: 'mentor', created_at: '2024-06-20T10:00:00Z' }
];

export const mockEntities = [
  {
    id: 'ent-001',
    name: 'Alice Chen',
    entity_type: 'person',
    summary: 'Colleague at work, PM on the platform team',
    importance_score: 0.9,
    sentiment_average: 0.7,
    mention_count: 23,
    is_historical: false,
    privacy_level: 'internal',
    aliases: ['Alice', 'A. Chen'],
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2025-01-20T10:00:00Z'
  },
  {
    id: 'ent-002',
    name: 'Project Phoenix',
    entity_type: 'project',
    summary: 'Main product initiative for Q1',
    importance_score: 0.95,
    sentiment_average: 0.5,
    mention_count: 45,
    is_historical: false,
    privacy_level: 'internal',
    aliases: ['Phoenix', 'the project'],
    created_at: '2024-09-01T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z'
  },
  {
    id: 'ent-003',
    name: 'Secret Project',
    entity_type: 'project',
    summary: 'Confidential work',
    importance_score: 0.8,
    mention_count: 5,
    is_historical: false,
    privacy_level: 'private',  // EXCLUDED from export
    created_at: '2025-01-01T10:00:00Z',
    updated_at: '2025-01-25T10:00:00Z'
  }
];

export const mockNotes = [
  {
    id: 'note-001',
    content: 'Met with Alice about Project Phoenix roadmap. She works at Acme Corp as a Product Manager. She raised concerns about the timeline.',
    note_type: 'standard',
    category: 'work',
    sentiment: -0.2,
    privacy_level: 'internal',
    created_at: '2025-01-20T14:30:00Z',
    updated_at: '2025-01-20T14:30:00Z'
  },
  {
    id: 'note-002',
    content: 'Private reflection about personal matters.',
    note_type: 'standard',
    category: 'personal',
    sentiment: 0.0,
    privacy_level: 'private',  // EXCLUDED from export
    created_at: '2025-01-22T20:00:00Z',
    updated_at: '2025-01-22T20:00:00Z'
  }
];

export const mockPatterns = [
  {
    id: 'pat-001',
    pattern_type: 'temporal',
    description: 'You do your best deep work between 9-11pm on weeknights',
    confidence: 0.85,
    evidence: { note_ids: ['note-001'] },
    status: 'active',
    privacy_level: 'internal',
    created_at: '2024-10-01T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z'
  }
];

// === NEW FOR SPRINT 2 ===

/**
 * Entity facts - structured predicate/object pairs
 */
export const mockEntityFacts = [
  {
    id: 'fact-001',
    user_id: mockUserId,
    entity_id: 'ent-001',  // Alice Chen
    predicate: 'works_at',
    object_text: 'Acme Corp',
    object_entity_id: null,
    confidence: 0.95,
    source_note_id: 'note-001',
    created_at: '2025-01-20T14:30:00Z',
    updated_at: '2025-01-20T14:30:00Z'
  },
  {
    id: 'fact-002',
    user_id: mockUserId,
    entity_id: 'ent-001',  // Alice Chen
    predicate: 'role',
    object_text: 'Product Manager',
    object_entity_id: null,
    confidence: 0.9,
    source_note_id: 'note-001',
    created_at: '2025-01-20T14:30:00Z',
    updated_at: '2025-01-20T14:30:00Z'
  },
  {
    id: 'fact-003',
    user_id: mockUserId,
    entity_id: 'ent-002',  // Project Phoenix
    predicate: 'status',
    object_text: 'active',
    object_entity_id: null,
    confidence: 1.0,
    source_note_id: null,
    created_at: '2025-01-15T10:00:00Z',
    updated_at: '2025-01-15T10:00:00Z'
  }
];

/**
 * MIRROR conversations with messages
 */
export const mockConversations = [
  {
    id: 'conv-001',
    user_id: mockUserId,
    status: 'completed',
    summary: 'Discussed project priorities and next steps for Q1',
    key_insights: ['Focus on user feedback', 'Reduce scope for v1'],
    created_at: '2025-01-19T10:00:00Z',
    updated_at: '2025-01-19T10:30:00Z',
    messages: [
      {
        id: 'msg-001',
        conversation_id: 'conv-001',
        role: 'user',
        content: 'What should I focus on this week?',
        created_at: '2025-01-19T10:00:00Z'
      },
      {
        id: 'msg-002',
        conversation_id: 'conv-001',
        role: 'assistant',
        content: 'Based on your recent notes about Project Phoenix, I\'d suggest prioritizing the timeline concerns Alice raised.',
        created_at: '2025-01-19T10:01:00Z'
      },
      {
        id: 'msg-003',
        conversation_id: 'conv-001',
        role: 'user',
        content: 'Good point. What about the Q1 goals?',
        created_at: '2025-01-19T10:05:00Z'
      },
      {
        id: 'msg-004',
        conversation_id: 'conv-001',
        role: 'assistant',
        content: 'Your Q1 goals are ambitious. Consider reducing scope to ensure you ship something users can actually try.',
        created_at: '2025-01-19T10:06:00Z'
      }
    ]
  },
  {
    id: 'conv-002',
    user_id: mockUserId,
    status: 'completed',
    summary: 'Quick check-in about meeting preparation',
    key_insights: ['Prepare data-driven slides'],
    created_at: '2025-01-20T09:00:00Z',
    updated_at: '2025-01-20T09:15:00Z',
    messages: [
      {
        id: 'msg-005',
        conversation_id: 'conv-002',
        role: 'user',
        content: 'I have a meeting with Alice tomorrow. Any tips?',
        created_at: '2025-01-20T09:00:00Z'
      },
      {
        id: 'msg-006',
        conversation_id: 'conv-002',
        role: 'assistant',
        content: 'Alice prefers data-driven presentations. Consider preparing concrete metrics for the timeline discussion.',
        created_at: '2025-01-20T09:01:00Z'
      }
    ]
  }
];

/**
 * Expected counts after privacy filtering
 */
export const expectedCounts = {
  entities: 2,      // Excludes 'Secret Project' (private)
  notes: 1,         // Excludes private note
  patterns: 1,
  facts: 3,         // All facts are from non-private entities
  conversations: 2,
  messages: 6       // Total messages across conversations
};

/**
 * Expected structure for exported entity with facts
 */
export const expectedEntityWithFacts = {
  id: 'ent-001',
  type: 'person',
  name: 'Alice Chen',
  aliases: ['Alice', 'A. Chen'],
  facts: [
    { predicate: 'works_at', object: 'Acme Corp', confidence: 0.95 },
    { predicate: 'role', object: 'Product Manager', confidence: 0.9 }
  ]
};

/**
 * Expected structure for exported conversation with messages
 */
export const expectedConversationWithMessages = {
  id: 'conv-001',
  summary: 'Discussed project priorities and next steps for Q1',
  message_count: 4,
  messages: [
    { role: 'user', content: 'What should I focus on this week?' },
    { role: 'assistant', content: expect.stringContaining('Project Phoenix') }
  ]
};
```

---

## Task 2: Update Transform Tests

Update `/tests/export/transforms.test.js`:

```javascript
// Add these tests to transforms.test.js

import {
  mockEntities,
  mockEntityFacts,
  mockConversations,
  expectedEntityWithFacts,
  expectedCounts
} from './fixtures/mock-data.js';

import {
  transformEntity,
  transformConversation,
  buildMeta
} from '../../lib/export/transforms.js';

// === NEW TESTS FOR SPRINT 2 ===

describe('Sprint 2: Entity Facts', () => {
  
  test('transformEntity includes facts array', () => {
    const entity = mockEntities[0]; // Alice Chen
    const facts = mockEntityFacts.filter(f => f.entity_id === entity.id);
    
    const result = transformEntity(entity, mockEntityFacts);
    
    expect(result.facts).toBeDefined();
    expect(Array.isArray(result.facts)).toBe(true);
    expect(result.facts.length).toBe(2); // works_at, role
  });
  
  test('transformEntity fact has correct structure', () => {
    const entity = mockEntities[0];
    const result = transformEntity(entity, mockEntityFacts);
    
    const worksAtFact = result.facts.find(f => f.predicate === 'works_at');
    expect(worksAtFact).toBeDefined();
    expect(worksAtFact.object).toBe('Acme Corp');
    expect(worksAtFact.confidence).toBe(0.95);
  });
  
  test('transformEntity with no facts returns empty array', () => {
    const entity = { ...mockEntities[0], id: 'no-facts-entity' };
    const result = transformEntity(entity, mockEntityFacts);
    
    expect(result.facts).toEqual([]);
  });
  
  test('transformEntity includes aliases', () => {
    const entity = mockEntities[0];
    const result = transformEntity(entity, []);
    
    expect(result.aliases).toBeDefined();
    expect(result.aliases).toContain('Alice');
  });
});

describe('Sprint 2: MIRROR Messages', () => {
  
  test('transformConversation includes messages array', () => {
    const conv = mockConversations[0];
    const result = transformConversation(conv);
    
    expect(result.messages).toBeDefined();
    expect(Array.isArray(result.messages)).toBe(true);
    expect(result.messages.length).toBe(4);
  });
  
  test('transformConversation includes message_count', () => {
    const conv = mockConversations[0];
    const result = transformConversation(conv);
    
    expect(result.message_count).toBe(4);
  });
  
  test('transformConversation message has correct structure', () => {
    const conv = mockConversations[0];
    const result = transformConversation(conv);
    
    const firstMessage = result.messages[0];
    expect(firstMessage.role).toBe('user');
    expect(firstMessage.content).toBeDefined();
    expect(firstMessage.timestamp).toBeDefined();
  });
  
  test('transformConversation with no messages returns empty array', () => {
    const conv = { ...mockConversations[0], messages: undefined };
    const result = transformConversation(conv);
    
    expect(result.messages).toEqual([]);
    expect(result.message_count).toBe(0);
  });
  
  test('transformConversation preserves summary and insights', () => {
    const conv = mockConversations[0];
    const result = transformConversation(conv);
    
    expect(result.summary).toBe(conv.summary);
    expect(result.key_insights).toEqual(conv.key_insights);
  });
});

describe('Sprint 2: Updated Meta', () => {
  
  test('buildMeta includes fact count', () => {
    const meta = buildMeta({
      entities: mockEntities.slice(0, 2),
      notes: [mockNotes[0]],
      patterns: mockPatterns,
      facts: mockEntityFacts,
      conversations: mockConversations
    });
    
    expect(meta.counts.facts).toBe(3);
  });
  
  test('buildMeta includes message count', () => {
    const meta = buildMeta({
      entities: [],
      notes: [],
      patterns: [],
      facts: [],
      conversations: mockConversations
    });
    
    expect(meta.counts.messages).toBe(6);
  });
  
  test('buildMeta version is 1.1.0', () => {
    const meta = buildMeta({
      entities: [],
      notes: [],
      patterns: [],
      facts: [],
      conversations: []
    });
    
    expect(meta.version).toBe('1.1.0');
  });
});
```

---

## Task 3: Update API Tests

Add to `/tests/export/api.test.js`:

```javascript
// Add these tests to api.test.js

describe('Sprint 2: Privacy APIs', () => {
  
  describe('GET /api/privacy-summary', () => {
    
    test('returns 401 without auth', async () => {
      const response = await fetch(`${API_URL}/api/privacy-summary`);
      expect(response.status).toBe(401);
    });
    
    test('returns counts object', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/privacy-summary`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('private_entities');
      expect(data).toHaveProperty('private_notes');
      expect(data).toHaveProperty('private_patterns');
    });
    
    test('counts are numbers', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/privacy-summary`, {
        headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
      });
      
      const data = await response.json();
      expect(typeof data.private_entities).toBe('number');
      expect(typeof data.private_notes).toBe('number');
      expect(typeof data.private_patterns).toBe('number');
    });
  });
  
  describe('POST /api/update-privacy', () => {
    
    test('returns 401 without auth', async () => {
      const response = await fetch(`${API_URL}/api/update-privacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'user_entities', id: 'test', privacy_level: 'private' })
      });
      expect(response.status).toBe(401);
    });
    
    test('returns 400 for invalid table', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/update-privacy`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${TEST_USER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ table: 'invalid_table', id: 'test', privacy_level: 'private' })
      });
      
      expect(response.status).toBe(400);
    });
    
    test('returns 400 for invalid privacy level', async () => {
      if (!TEST_USER_TOKEN) return;
      
      const response = await fetch(`${API_URL}/api/update-privacy`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${TEST_USER_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ table: 'user_entities', id: 'test', privacy_level: 'invalid' })
      });
      
      expect(response.status).toBe(400);
    });
  });
});

describe('Sprint 2: Export Content', () => {
  
  test('entities include facts array', async () => {
    if (!TEST_USER_TOKEN) return;
    
    const response = await fetch(`${API_URL}/api/export`, {
      headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
    });
    
    const data = await response.json();
    const entities = data.inscript_export.entities;
    
    // At least some entities should have facts (if extraction ran)
    const entityWithFacts = entities.find(e => e.facts?.length > 0);
    if (entityWithFacts) {
      expect(entityWithFacts.facts[0]).toHaveProperty('predicate');
      expect(entityWithFacts.facts[0]).toHaveProperty('object');
    }
  });
  
  test('conversations include messages', async () => {
    if (!TEST_USER_TOKEN) return;
    
    const response = await fetch(`${API_URL}/api/export`, {
      headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
    });
    
    const data = await response.json();
    const conversations = data.inscript_export.episodes.conversations;
    
    if (conversations.length > 0) {
      expect(conversations[0]).toHaveProperty('messages');
      expect(conversations[0]).toHaveProperty('message_count');
    }
  });
  
  test('meta includes fact and message counts', async () => {
    if (!TEST_USER_TOKEN) return;
    
    const response = await fetch(`${API_URL}/api/export`, {
      headers: { 'Authorization': `Bearer ${TEST_USER_TOKEN}` }
    });
    
    const data = await response.json();
    const meta = data.inscript_export.meta;
    
    expect(meta.counts).toHaveProperty('facts');
    expect(meta.counts).toHaveProperty('messages');
    expect(meta.version).toBe('1.1.0');
  });
});
```

---

## Task 4: Update E2E Checklist

Update `/tests/export/E2E-CHECKLIST.md`:

```markdown
# Export Feature E2E Test Checklist — Sprint 2

**Tester:** T4  
**Date:** ___________  
**Build:** Sprint 2

## Prerequisites
- [ ] Logged into Inscript with test account
- [ ] Account has: entities, notes, patterns, MIRROR conversations
- [ ] At least one item marked private
- [ ] Entity extraction has run (facts exist)

---

## Sprint 1 Tests (Regression)

### Export Flow
- [ ] Export button visible in Settings
- [ ] Click triggers loading state
- [ ] File downloads successfully
- [ ] JSON is valid and parseable
- [ ] Contains identity, entities, notes, patterns

---

## Sprint 2 Tests (New)

### Structured Facts
- [ ] Export includes `facts` array on entities
- [ ] Facts have predicate, object, confidence
- [ ] Facts came from note extraction

**Test:** Find an entity you know has facts. Verify they appear:
```json
"facts": [
  { "predicate": "works_at", "object": "...", "confidence": 0.9 }
]
```

### MIRROR Messages
- [ ] Conversations include `messages` array
- [ ] Messages have role, content, timestamp
- [ ] `message_count` matches array length
- [ ] Meta includes `messages` count

**Test:** Check a conversation you had:
```json
"conversations": [{
  "message_count": 4,
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}]
```

### Privacy Indicator
- [ ] Privacy indicator appears in export section
- [ ] Shows count of private items
- [ ] "Manage" link scrolls to privacy section

### Privacy Management
- [ ] Privacy section appears in Settings
- [ ] Tabs switch between Entities and Notes
- [ ] Items load and display
- [ ] Toggle checkbox works
- [ ] Toggle updates database (check Supabase)

### Privacy + Export Integration
- [ ] Mark an entity as private
- [ ] Export
- [ ] Verify entity is NOT in export
- [ ] Unmark as private
- [ ] Export again
- [ ] Verify entity IS in export

### Privacy APIs
- [ ] `/api/privacy-summary` returns counts
- [ ] `/api/update-privacy` changes privacy_level

---

## Meta Validation

- [ ] Version is "1.1.0"
- [ ] `counts.facts` is present
- [ ] `counts.messages` is present
- [ ] `counts.conversations` matches array length

---

## External Validation

### ChatGPT Test
- [ ] Upload Sprint 2 export
- [ ] Ask about a person → mentions their facts
- [ ] Ask about a conversation → knows message content

### Claude Test
- [ ] Upload Sprint 2 export
- [ ] Ask to summarize what it learned
- [ ] Verify it sees facts and messages

---

## Performance

- [ ] Export still < 10 seconds (with messages)
- [ ] Privacy summary loads quickly
- [ ] Privacy list loads without lag

---

## Issues Found

| Issue | Severity | Owner | Status |
|-------|----------|-------|--------|
| | | | |

---

## Sign-off

- [ ] All Sprint 1 tests still pass (regression)
- [ ] All Sprint 2 tests pass
- [ ] No P0 bugs open

Tester: _______________ Date: ___________
```

---

## Task 5: Update User Documentation

Update `/docs/EXPORT.md`:

```markdown
# Export Your Data from Inscript

Inscript lets you export everything we've learned about you. Take your data anywhere.

## How to Export

1. Open **Settings**
2. Find **Portable Memory** section
3. Click **Export My Memory**
4. File downloads as JSON

## What's Included

### Identity
Your name, goals, and how you want AI to communicate with you.

### People & Projects
Everyone and everything you've mentioned, with:
- **Facts** — Structured information like "Alice works at Acme Corp"
- **Relationships** — How they relate to you
- **Importance** — How often you mention them

### Notes
All your entries, thoughts, and reflections (except private ones).

### Conversations
Your full MIRROR chat history:
- Every message (yours and the AI's)
- Summaries and key insights
- When each conversation happened

### Patterns
Habits and preferences we've detected:
- When you work best
- Who you talk to about what
- Your preferences and routines

## Privacy Controls

### Marking Items as Private
1. Go to **Settings** → **Privacy Controls**
2. Find the item you want to hide
3. Check the **Private** box
4. It will be excluded from all future exports

### What Gets Excluded
- Items you mark as private
- Internal system data
- Raw embeddings (regenerated on import)

### Privacy Indicator
Before exporting, you'll see how many items will be excluded.

## Using Your Export

### With ChatGPT
Upload the JSON file or paste it, then say:
> "This is my personal context from Inscript. Use it to personalize your responses."

### With Claude
Same approach:
> "Here's my Inscript export. It contains my identity, people I know, notes, and conversation history."

### What AI Can Do With It
- Know your name and goals
- Reference people with specific facts ("Sarah works at Acme")
- Recall your past conversations
- Understand your patterns and preferences

## Version History

- **1.1.0** (Current) — Added structured facts and full MIRROR messages
- **1.0.0** — Initial release with identity, entities, notes, patterns
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| Fixtures updated | Has facts, messages | ☐ |
| Transform tests pass | `npm test transforms` | ☐ |
| API tests pass | `npm test api` | ☐ |
| E2E checklist complete | Manual testing | ☐ |
| Docs updated | EXPORT.md current | ☐ |
| ChatGPT validation | Facts visible | ☐ |

---

## Handoff Signals

**You signal when ready to test:**
```
T4 → T1, T2, T3: TESTS READY
Waiting for your signals to run full E2E.
```

**You signal when testing complete:**
```
T4 → ALL: SPRINT 2 E2E COMPLETE
- Structured facts: ✅
- MIRROR messages: ✅
- Privacy controls: ✅
- Regression: ✅
Ready to merge.
```

---

## Definition of Done

- [ ] Fixtures updated with facts and messages
- [ ] Transform tests pass
- [ ] API tests pass (including new privacy APIs)
- [ ] E2E checklist complete
- [ ] Documentation updated
- [ ] External validation (ChatGPT/Claude)
- [ ] No P0 bugs
- [ ] All terminals signaled

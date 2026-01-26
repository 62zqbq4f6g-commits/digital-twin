# Terminal 1: Database & Extraction Lead — Sprint 2

**Role:** Create database migrations and update entity extraction for structured facts  
**Task ID:** `export-sprint2-t1`

---

## Context: What We Built in Sprint 1

We shipped **Portable Memory Export** — users can download everything Inscript knows about them as JSON.

**What's working:**
- `/api/export.js` — API endpoint you built
- `/lib/export/*` — Data layer (queries, transforms, privacy)
- Settings UI with "Export My Memory" button
- Real exports working (28KB+ with identity, entities, notes, patterns)

**What's missing (Sprint 2 fixes):**
1. **Structured facts** — Currently entities have prose summaries, not queryable facts like "Marcus works_at Anthropic"
2. **Privacy controls** — Users can't mark items as private (columns don't exist yet)
3. **MIRROR messages** — Only summaries exported, not full conversation history (T2 handles)

---

## Your Ownership

**Files you OWN:**
```
/api/extract-entities.js     ← Update extraction prompt
/api/analyze.js              ← May need updates for fact storage
/supabase/migrations/        ← Database migrations (or run in Supabase dashboard)
```

**Files you READ (for context):**
```
/lib/export/queries.js       ← T2's queries (they'll add fact queries)
/lib/export/transforms.js    ← T2's transforms (they'll add fact transforms)
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/sprint2-database
```

---

## Task 1: Database Migrations (DO FIRST — T2 is waiting)

Add these columns and tables. Run via Supabase dashboard or create migration files.

### 1.1 Add privacy_level to user_entities

```sql
-- Check if column exists first
ALTER TABLE user_entities 
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'internal'
CHECK (privacy_level IN ('private', 'internal', 'shared'));

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_user_entities_privacy 
ON user_entities(user_id, privacy_level);
```

### 1.2 Add privacy_level to notes

```sql
ALTER TABLE notes
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'internal'
CHECK (privacy_level IN ('private', 'internal', 'shared'));

CREATE INDEX IF NOT EXISTS idx_notes_privacy 
ON notes(user_id, privacy_level);
```

### 1.3 Add privacy_level to user_patterns

```sql
ALTER TABLE user_patterns
ADD COLUMN IF NOT EXISTS privacy_level TEXT DEFAULT 'internal'
CHECK (privacy_level IN ('private', 'internal', 'shared'));

CREATE INDEX IF NOT EXISTS idx_user_patterns_privacy 
ON user_patterns(user_id, privacy_level);
```

### 1.4 Create entity_facts table

```sql
CREATE TABLE IF NOT EXISTS entity_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES user_entities(id) ON DELETE CASCADE,
  
  -- The fact itself
  predicate TEXT NOT NULL,           -- e.g., 'works_at', 'role', 'likes', 'location'
  object_text TEXT,                  -- e.g., 'Anthropic', 'Product Manager'
  object_entity_id UUID REFERENCES user_entities(id),  -- If object is another entity
  
  -- Metadata
  confidence FLOAT DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  source_note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_entity_facts_user ON entity_facts(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_facts_entity ON entity_facts(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_facts_predicate ON entity_facts(predicate);

-- Enable RLS
ALTER TABLE entity_facts ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only see their own facts
CREATE POLICY "Users can view own facts" ON entity_facts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own facts" ON entity_facts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own facts" ON entity_facts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own facts" ON entity_facts
  FOR DELETE USING (auth.uid() = user_id);
```

### 1.5 Add aliases to user_entities (for Sprint 3, but do now)

```sql
ALTER TABLE user_entities
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';
```

**Checkpoint:** Run `SELECT column_name FROM information_schema.columns WHERE table_name = 'entity_facts';` to verify table exists.

**Signal T2 when migrations complete:**
```
T1 → T2: MIGRATIONS COMPLETE
- entity_facts table created
- privacy_level columns added to: user_entities, notes, user_patterns
- aliases column added to user_entities
Ready for you to update queries.js
```

---

## Task 2: Update Entity Extraction Prompt

Find the entity extraction code (likely `/api/extract-entities.js` or within `/api/analyze.js`).

Update the prompt to output structured facts alongside entities:

### Current (approximate):
```javascript
const prompt = `Extract entities from this note...`;
```

### Updated:
```javascript
const extractionPrompt = `
Analyze this note and extract:
1. ENTITIES - People, organizations, projects, places, concepts mentioned
2. FACTS - Specific factual information about each entity

For each entity, provide:
- name: The entity's name (use full name if available)
- type: person | organization | project | place | concept | thing
- description: Brief summary of who/what this is

For each fact about an entity, provide:
- entity_name: Which entity this fact is about
- predicate: The type of fact (see list below)
- object: The value
- confidence: How certain you are (0.0 to 1.0)

PREDICATE TYPES:
- works_at: Employment (e.g., "Sarah works_at Acme Corp")
- role: Job title or position (e.g., "Sarah's role is Product Manager")
- relationship: Relation to user (e.g., "Marcus is close_friend")
- location: Where they are (e.g., "Marcus is in San Francisco")
- likes: Preferences (e.g., "Sarah likes data-driven presentations")
- dislikes: Anti-preferences (e.g., "Sarah dislikes last-minute changes")
- status: Current state (e.g., "Project Phoenix status is active")
- owns: Ownership (e.g., "Marcus owns a Tesla")
- studied_at: Education (e.g., "Sarah studied_at MIT")
- expertise: Skills (e.g., "Marcus has expertise in machine learning")

OUTPUT FORMAT (JSON):
{
  "entities": [
    {
      "name": "Sarah Chen",
      "type": "person",
      "description": "Colleague working on the platform team"
    }
  ],
  "facts": [
    {
      "entity_name": "Sarah Chen",
      "predicate": "works_at",
      "object": "Acme Corp",
      "confidence": 0.95
    },
    {
      "entity_name": "Sarah Chen",
      "predicate": "role",
      "object": "Product Manager",
      "confidence": 0.9
    },
    {
      "entity_name": "Sarah Chen",
      "predicate": "likes",
      "object": "data-driven presentations",
      "confidence": 0.8
    }
  ]
}

RULES:
- Only extract facts explicitly stated or strongly implied
- Use confidence < 0.7 for inferred facts
- Use confidence > 0.9 for explicitly stated facts
- If the note mentions a relationship between two entities, create a fact for it
- Don't invent facts that aren't in the note

NOTE TO ANALYZE:
${noteContent}
`;
```

---

## Task 3: Store Extracted Facts

After extraction, save facts to the `entity_facts` table.

### Find where entities are saved (likely after extraction):

```javascript
// After extracting entities and facts from the note
const { entities, facts } = extractionResult;

// Save entities first (existing logic)
for (const entity of entities) {
  const savedEntity = await saveOrUpdateEntity(user_id, entity);
  entityMap[entity.name] = savedEntity.id;
}

// NEW: Save facts
for (const fact of facts) {
  const entityId = entityMap[fact.entity_name];
  if (!entityId) {
    console.warn(`[Extract] No entity found for fact: ${fact.entity_name}`);
    continue;
  }
  
  // Check if fact already exists (avoid duplicates)
  const { data: existing } = await supabase
    .from('entity_facts')
    .select('id')
    .eq('entity_id', entityId)
    .eq('predicate', fact.predicate)
    .eq('object_text', fact.object)
    .maybeSingle();
  
  if (existing) {
    // Update confidence if higher
    await supabase
      .from('entity_facts')
      .update({ 
        confidence: Math.max(existing.confidence, fact.confidence),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Insert new fact
    await supabase
      .from('entity_facts')
      .insert({
        user_id,
        entity_id: entityId,
        predicate: fact.predicate,
        object_text: fact.object,
        confidence: fact.confidence,
        source_note_id: noteId
      });
  }
}

console.log(`[Extract] Saved ${facts.length} facts for ${entities.length} entities`);
```

---

## Task 4: Update Privacy Filtering in Export

Update `/api/export.js` to use the new privacy columns:

The existing `filterByPrivacy` from T2 should already work, but verify the queries are filtering correctly:

```javascript
// In /api/export.js, verify this is happening:
const publicEntities = filterByPrivacy(entities);  // Excludes privacy_level = 'private'
const publicNotes = filterByPrivacy(notes);
const publicPatterns = filterByPrivacy(patterns);
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| entity_facts table exists | Query returns columns | ☐ |
| privacy_level on user_entities | `\d user_entities` shows column | ☐ |
| privacy_level on notes | `\d notes` shows column | ☐ |
| privacy_level on user_patterns | `\d user_patterns` shows column | ☐ |
| Extraction outputs facts | Test with sample note | ☐ |
| Facts saved to database | Query entity_facts has rows | ☐ |

---

## Handoff Signals

**You signal T2 when migrations done:**
```
T1 → T2: MIGRATIONS COMPLETE
Tables ready:
- entity_facts (id, user_id, entity_id, predicate, object_text, confidence, source_note_id)
- privacy_level columns on: user_entities, notes, user_patterns
You can now add queries.
```

**You signal T3 when privacy columns ready:**
```
T1 → T3: PRIVACY COLUMNS READY
Columns added:
- user_entities.privacy_level
- notes.privacy_level
- user_patterns.privacy_level
Values: 'private', 'internal', 'shared' (default: 'internal')
You can now build the privacy toggle UI.
```

**You signal T4 when extraction updated:**
```
T1 → T4: EXTRACTION UPDATED
Entity extraction now outputs structured facts.
Test by creating a note and checking entity_facts table.
```

---

## Definition of Done

- [ ] `entity_facts` table created with RLS policies
- [ ] `privacy_level` column on user_entities, notes, user_patterns
- [ ] `aliases` column on user_entities
- [ ] Entity extraction prompt outputs structured facts
- [ ] Facts are saved to entity_facts table
- [ ] Duplicate facts are handled (update confidence)
- [ ] T2, T3, T4 signaled and unblocked

---

## Quick Reference: Fact Predicates

| Predicate | Example | Use For |
|-----------|---------|---------|
| `works_at` | Sarah works_at Acme | Employment |
| `role` | Sarah role is PM | Job title |
| `relationship` | Marcus is close_friend | Relation to user |
| `location` | Marcus in San Francisco | Where they are |
| `likes` | Sarah likes data-driven | Preferences |
| `dislikes` | Sarah dislikes surprises | Anti-preferences |
| `status` | Project is active | Current state |
| `expertise` | Marcus expertise in ML | Skills |
| `studied_at` | Sarah studied_at MIT | Education |
| `owns` | Marcus owns Tesla | Possessions |

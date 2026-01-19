# Phase 9: Entity System

## Overview

Auto-detect people, projects, places, and pets from note content. Let users confirm relationships. Display in TWIN tab under "YOUR WORLD."

---

## Entity Extraction

### When to Extract

Run on every note save (create or update).

### Extraction Prompt

Add to analysis API call:

```javascript
const extractionPrompt = `
Also extract any entities mentioned in this note.

Return as JSON in this format:
{
  "entities": [
    {
      "name": "Sarah",
      "type": "person",
      "context": "mentioned in context of company structuring",
      "sentiment": 0.2  // -1 to 1, based on tone when mentioned
    }
  ]
}

Entity types: person, project, place, pet, other

Rules:
- Only extract proper nouns (capitalized names)
- "Mom", "Dad", etc. count as person entities
- Project names are usually capitalized phrases related to work
- Pets are mentioned in caregiving context ("walked Seri", "fed the cat")
- If unsure, use type "other"
- Sentiment: negative=-1, neutral=0, positive=1
`;
```

### Processing Logic

```javascript
async function processExtractedEntities(entities, userId) {
  for (const entity of entities) {
    // Check if exists
    const { data: existing } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId)
      .eq('name', entity.name)
      .single();
    
    if (existing) {
      // Update existing entity
      const newContextNotes = [...(existing.context_notes || []), entity.context].slice(-10);
      const newMentionCount = existing.mention_count + 1;
      const newSentiment = existing.sentiment_average 
        ? (existing.sentiment_average * existing.mention_count + entity.sentiment) / newMentionCount
        : entity.sentiment;
      
      await supabase
        .from('user_entities')
        .update({
          mention_count: newMentionCount,
          last_mentioned_at: new Date(),
          context_notes: newContextNotes,
          sentiment_average: newSentiment
        })
        .eq('id', existing.id);
    } else {
      // Create new entity
      await supabase
        .from('user_entities')
        .insert({
          user_id: userId,
          name: entity.name,
          entity_type: entity.type,
          context_notes: [entity.context],
          sentiment_average: entity.sentiment
        });
    }
  }
  
  // Return new unconfirmed person entities for prompting
  const newPeople = entities.filter(e => 
    e.type === 'person' && 
    !existingNames.includes(e.name)
  );
  
  return newPeople;
}
```

---

## Entity Confirmation Prompt

When a new person entity is detected, show subtle prompt after note analysis.

### UI Design

```
┌─────────────────────────────────────┐
│                                     │
│  [Analysis output...]               │
│                                     │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│                                     │
│  I noticed you mentioned Sarah.     │  ← .entity-prompt__question
│  Who is she to you?                 │
│                                     │
│  [cofounder] [friend] [family]      │  ← Quick options
│  [colleague] [other: ____]          │
│                                     │
│     [Skip]  [Don't ask again]       │  ← Dismiss options
│                                     │
└─────────────────────────────────────┘
```

### CSS

```css
.entity-prompt {
  background: var(--ink-50);
  border-top: 1px solid var(--ink-100);
  padding: var(--space-4);
  margin-top: var(--space-4);
}

.entity-prompt__question {
  font: var(--type-body-small);
  color: var(--ink-600);
  font-style: italic;
  margin-bottom: var(--space-3);
}

.entity-prompt__options {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.entity-prompt__option {
  font: var(--type-caption);
  background: var(--paper-pure);
  border: 1px solid var(--ink-200);
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: all var(--duration-fast);
}

.entity-prompt__option:hover {
  border-color: var(--ink-400);
  background: var(--ink-50);
}

.entity-prompt__dismiss {
  display: flex;
  gap: var(--space-4);
}

.entity-prompt__dismiss-btn {
  font: var(--type-caption);
  color: var(--ink-400);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

### Relationship Options

```javascript
const RELATIONSHIP_OPTIONS = [
  'cofounder',
  'colleague', 
  'friend',
  'family',
  'partner',
  'mentor',
  'client',
  'other'
];
```

### Confirmation Logic

```javascript
async function confirmEntity(entityName, relationship, userId) {
  await supabase
    .from('user_entities')
    .update({
      relationship: relationship,
      confirmed: true
    })
    .eq('user_id', userId)
    .eq('name', entityName);
  
  // Also add to key_people if it's a person
  await supabase
    .from('user_key_people')
    .upsert({
      user_id: userId,
      name: entityName,
      relationship: relationship,
      added_via: 'confirmed'
    }, { onConflict: 'user_id,name' });
  
  hideEntityPrompt();
}

async function dismissEntity(entityName, userId, dontAskAgain = false) {
  if (dontAskAgain) {
    await supabase
      .from('user_entities')
      .update({ dismissed: true })
      .eq('user_id', userId)
      .eq('name', entityName);
  }
  
  hideEntityPrompt();
}
```

---

## YOUR WORLD Display (TWIN Tab)

### Layout

```
┌─────────────────────────────────────┐
│  YOUR WORLD                         │  ← .section-header
│  ─────────────────────────────────  │
│                                     │
│  PEOPLE                        [+]  │  ← subsection header + add btn
│                                     │
│  Sarah                              │  ← entity name
│  cofounder · 12×               [✎]  │  ← relationship · mentions · edit
│  ─────────────────────────────────  │
│  Mom                                │
│  family · 4×                   [✎]  │
│  ─────────────────────────────────  │
│  James                              │
│  ? · 2×                [Add context]│  ← unconfirmed entity
│                                     │
├─────────────────────────────────────┤
│  PROJECTS                           │
│                                     │
│  Digital Twin · 8×                  │
│  ─────────────────────────────────  │
│  Velolume · 3×                      │
│                                     │
├─────────────────────────────────────┤
│  PLACES                             │
│                                     │
│  Singapore · 3×                     │
│                                     │
└─────────────────────────────────────┘
```

### HTML Structure

```html
<div class="your-world">
  <h3 class="section-header">Your World</h3>
  
  <div class="entity-group">
    <div class="entity-group__header">
      <span class="label">People</span>
      <button class="btn-text" onclick="openAddPersonModal()">+</button>
    </div>
    
    <div class="entity-list" id="people-list">
      <!-- Populated by JS -->
    </div>
  </div>
  
  <div class="entity-group">
    <div class="entity-group__header">
      <span class="label">Projects</span>
    </div>
    <div class="entity-list" id="projects-list"></div>
  </div>
  
  <div class="entity-group">
    <div class="entity-group__header">
      <span class="label">Places</span>
    </div>
    <div class="entity-list" id="places-list"></div>
  </div>
</div>
```

### Entity Item Template

```javascript
function renderEntityItem(entity) {
  const isUnconfirmed = entity.entity_type === 'person' && !entity.confirmed && !entity.dismissed;
  
  return `
    <div class="entity-item">
      <div class="entity-item__name">${entity.name}</div>
      <div class="entity-item__meta">
        ${entity.relationship 
          ? `<span class="entity-item__relationship">${entity.relationship}</span> · ` 
          : isUnconfirmed ? '<span class="entity-item__unknown">?</span> · ' : ''
        }
        <span class="entity-item__mentions">${entity.mention_count}×</span>
        ${isUnconfirmed 
          ? `<button class="btn-text" onclick="promptEntityRelationship('${entity.name}')">Add context</button>`
          : `<button class="entity-item__edit" onclick="openEntityEdit('${entity.id}')">✎</button>`
        }
      </div>
    </div>
  `;
}
```

### CSS

```css
.entity-group {
  margin-bottom: var(--space-5);
}

.entity-group__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.entity-item {
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--ink-100);
}

.entity-item:last-child {
  border-bottom: none;
}

.entity-item__name {
  font: var(--type-body);
  color: var(--ink-800);
  margin-bottom: var(--space-1);
}

.entity-item__meta {
  font: var(--type-caption);
  color: var(--ink-400);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.entity-item__unknown {
  color: var(--ink-300);
}

.entity-item__edit {
  background: none;
  border: none;
  color: var(--ink-400);
  cursor: pointer;
  padding: var(--space-1);
  margin-left: auto;
}
```

---

## Entity Edit Modal

```
┌─────────────────────────────────────┐
│  Sarah                         [×]  │
│                                     │
│  RELATIONSHIP                       │
│  [cofounder________________]        │  ← editable input
│                                     │
│  NOTES                              │
│  [Complicated history_______]       │  ← optional context
│  [_________________________]        │
│                                     │
│  MENTIONED 12 TIMES                 │  ← read-only stats
│  First: Dec 15 · Last: Today        │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [Remove from Twin]    [ Save ]     │
│                                     │
└─────────────────────────────────────┘
```

### Remove Logic

"Remove from Twin" sets `dismissed: true` — doesn't delete, just hides from UI and stops prompting.

---

## Fetch Logic

```javascript
async function loadEntities(userId) {
  const { data: entities } = await supabase
    .from('user_entities')
    .select('*')
    .eq('user_id', userId)
    .eq('dismissed', false)
    .order('mention_count', { ascending: false });
  
  // Group by type
  return {
    people: entities.filter(e => e.entity_type === 'person'),
    projects: entities.filter(e => e.entity_type === 'project'),
    places: entities.filter(e => e.entity_type === 'place'),
    pets: entities.filter(e => e.entity_type === 'pet'),
    other: entities.filter(e => e.entity_type === 'other')
  };
}
```

---

## Empty States

**No entities yet:**
```
Your world will appear here as you write.
```

**No people:**
```
No people detected yet.
[+ Add someone manually]
```

---

## File Location

```
js/entities.js
├── processExtractedEntities()
├── renderEntityPrompt()
├── confirmEntity()
├── dismissEntity()
├── loadEntities()
├── renderYourWorld()
├── openEntityEdit()
└── saveEntity()
```

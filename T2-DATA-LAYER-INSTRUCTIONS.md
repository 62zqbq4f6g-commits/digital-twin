# Terminal 2: Data Layer — Queries & Transforms

**Role:** Build data retrieval and transformation layer  
**Task ID:** `export-build-t2`

---

## Your Ownership

**Files you OWN (only you touch these):**
```
/lib/export/queries.js      ← Database queries
/lib/export/transforms.js   ← Data transformation
/lib/export/privacy.js      ← Privacy filtering
/lib/export/types.js        ← Type definitions
```

**Files you READ (to understand data structures):**
```
/api/analyze.js             ← How notes are structured
/api/extract-entities.js    ← How entities are extracted
/api/detect-patterns.js     ← How patterns work
```

---

## Setup

```bash
cd ~/Projects/digital-twin
git checkout -b feat/export-data
mkdir -p lib/export
export CLAUDE_CODE_TASK_LIST_ID=export-build-t2
```

---

## Task 1: Create Directory Structure (Do First)

```bash
mkdir -p lib/export
touch lib/export/queries.js
touch lib/export/transforms.js
touch lib/export/privacy.js
touch lib/export/types.js
```

---

## Task 2: Build queries.js (PRIORITY — T1 is waiting)

Create `/lib/export/queries.js`:

```javascript
// /lib/export/queries.js
// OWNER: T2
// CONSUMERS: T1 (api/export.js)
// STATUS: Building

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Get user profile from user_profiles and onboarding_data
 */
export async function getProfile(user_id) {
  // Get from user_profiles
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  // Get from onboarding_data
  const { data: onboarding, error: onboardingError } = await supabase
    .from('onboarding_data')
    .select('*')
    .eq('user_id', user_id)
    .maybeSingle();

  // Get custom instructions from memory_preferences
  const { data: prefs, error: prefsError } = await supabase
    .from('memory_preferences')
    .select('custom_instructions')
    .eq('user_id', user_id)
    .maybeSingle();

  return {
    ...profile,
    ...onboarding,
    custom_instructions: prefs?.custom_instructions
  };
}

/**
 * Get key people (explicitly added by user)
 */
export async function getKeyPeople(user_id) {
  const { data, error } = await supabase
    .from('user_key_people')
    .select('name, relationship, created_at')
    .eq('user_id', user_id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Export] Failed to get key people:', error);
    return [];
  }
  return data || [];
}

/**
 * Get all entities for user
 */
export async function getEntities(user_id) {
  const { data, error } = await supabase
    .from('user_entities')
    .select(`
      id,
      name,
      entity_type,
      summary,
      importance_score,
      sentiment_average,
      mention_count,
      is_historical,
      effective_from,
      expires_at,
      sensitivity_level,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('importance_score', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get entities:', error);
    return [];
  }
  return data || [];
}

/**
 * Get entity relationships
 */
export async function getEntityRelationships(user_id) {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select(`
      id,
      subject_entity_id,
      object_entity_id,
      predicate,
      strength,
      confidence,
      is_active
    `)
    .eq('user_id', user_id);

  if (error) {
    console.error('[Export] Failed to get relationships:', error);
    return [];
  }
  return data || [];
}

/**
 * Get all notes for user (decrypted)
 * NOTE: Notes are encrypted - need to handle decryption
 */
export async function getNotes(user_id) {
  const { data, error } = await supabase
    .from('notes')
    .select(`
      id,
      content,
      note_type,
      category,
      sentiment,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get notes:', error);
    return [];
  }

  // TODO: Handle decryption if content is encrypted
  // For now, return as-is (may need to coordinate with existing decryption logic)
  return data || [];
}

/**
 * Get meeting history
 */
export async function getMeetings(user_id) {
  const { data, error } = await supabase
    .from('meeting_history')
    .select(`
      id,
      entity_id,
      note_id,
      meeting_date,
      topics,
      sentiment,
      action_items,
      created_at
    `)
    .eq('user_id', user_id)
    .order('meeting_date', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get meetings:', error);
    return [];
  }
  return data || [];
}

/**
 * Get MIRROR conversations
 */
export async function getConversations(user_id) {
  const { data, error } = await supabase
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
    .limit(50); // Limit to recent conversations

  if (error) {
    console.error('[Export] Failed to get conversations:', error);
    return [];
  }
  return data || [];
}

/**
 * Get detected patterns
 */
export async function getPatterns(user_id) {
  const { data, error } = await supabase
    .from('user_patterns')
    .select(`
      id,
      pattern_type,
      description,
      confidence,
      evidence,
      status,
      created_at,
      updated_at
    `)
    .eq('user_id', user_id)
    .eq('status', 'active')
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[Export] Failed to get patterns:', error);
    return [];
  }
  return data || [];
}
```

**Signal T1 when complete:**
```
T2 → T1: QUERIES READY
File: /lib/export/queries.js
Exports: getProfile, getKeyPeople, getEntities, getNotes, getMeetings, getConversations, getPatterns
Ready for import!
```

---

## Task 3: Build transforms.js

Create `/lib/export/transforms.js`:

```javascript
// /lib/export/transforms.js
// OWNER: T2
// CONSUMERS: T1 (api/export.js)

/**
 * Build identity section from profile and key people
 */
export function buildIdentity(profile, keyPeople) {
  return {
    name: profile?.name || null,
    role: profile?.role_type || null,
    self_description: profile?.depth_answer || null,
    
    goals: profile?.goals || [],
    life_context: profile?.life_seasons || [],
    
    communication: {
      tone: profile?.tone || 'warm',
      verbosity: 'adaptive',
      formality: 'adaptive',
      custom_instructions: profile?.custom_instructions || null
    },
    
    boundaries: profile?.boundaries || [],
    
    key_people: keyPeople.map(p => ({
      name: p.name,
      relationship: p.relationship
    }))
  };
}

/**
 * Transform entity to export format
 */
export function transformEntity(entity) {
  return {
    id: entity.id,
    type: mapEntityType(entity.entity_type),
    name: entity.name,
    description: entity.summary || null,
    
    importance: entity.importance_score || 0,
    sentiment: entity.sentiment_average || 0,
    mention_count: entity.mention_count || 0,
    
    temporal: {
      first_seen: entity.created_at,
      last_seen: entity.updated_at,
      valid_from: entity.effective_from || null,
      valid_until: entity.expires_at || null,
      active: !entity.is_historical
    },
    
    // Facts will be added in Sprint 2 when entity_facts table exists
    facts: [],
    
    sensitivity: entity.sensitivity_level || 'normal'
  };
}

/**
 * Map internal entity types to export types
 */
function mapEntityType(type) {
  const typeMap = {
    'person': 'person',
    'organization': 'organization',
    'company': 'organization',
    'place': 'place',
    'location': 'place',
    'project': 'project',
    'topic': 'concept',
    'concept': 'concept',
    'event': 'event',
    'thing': 'thing'
  };
  return typeMap[type?.toLowerCase()] || 'thing';
}

/**
 * Transform note to export format
 */
export function transformNote(note) {
  return {
    id: note.id,
    content: note.content,
    timestamp: note.created_at,
    category: note.category || 'uncategorized',
    type: note.note_type || 'standard',
    
    extracted: {
      sentiment: note.sentiment || 0,
      // entities and actions would come from note content parsing
      // keeping simple for v1
    }
  };
}

/**
 * Transform meeting to export format
 */
export function transformMeeting(meeting) {
  return {
    id: meeting.id,
    date: meeting.meeting_date,
    topics: meeting.topics || [],
    sentiment: meeting.sentiment || 0,
    action_items: meeting.action_items || [],
    entity_id: meeting.entity_id,
    note_id: meeting.note_id
  };
}

/**
 * Transform conversation to export format
 */
export function transformConversation(conv) {
  return {
    id: conv.id,
    status: conv.status,
    summary: conv.summary || null,
    key_insights: conv.key_insights || [],
    started_at: conv.created_at,
    updated_at: conv.updated_at
  };
}

/**
 * Transform pattern to export format
 */
export function transformPattern(pattern) {
  return {
    type: pattern.pattern_type,
    description: pattern.description,
    confidence: pattern.confidence || 0,
    
    // structured_data will be added in Sprint 3
    structured: null,
    
    evidence: {
      supporting_notes: pattern.evidence?.note_ids?.length || 0,
      first_detected: pattern.created_at,
      last_confirmed: pattern.updated_at
    }
  };
}

/**
 * Build meta section
 */
export function buildMeta({ entities, notes, patterns }) {
  const timestamps = notes
    .map(n => new Date(n.created_at))
    .filter(d => !isNaN(d));
  
  return {
    version: "1.0.0",
    exported_at: new Date().toISOString(),
    source: "Inscript",
    source_version: "8.5.0",
    
    counts: {
      entities: entities.length,
      notes: notes.length,
      patterns: patterns.length
    },
    
    date_range: {
      first_entry: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
      last_entry: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null
    },
    
    embedding_note: "Embeddings not included. Regenerate from content if needed."
  };
}
```

---

## Task 4: Build privacy.js

Create `/lib/export/privacy.js`:

```javascript
// /lib/export/privacy.js
// OWNER: T2
// CONSUMERS: T1 (api/export.js)

/**
 * Privacy levels:
 * - private: Never export
 * - internal: Export for personal use (default)
 * - shared: Can be shared with third-party apps
 */

/**
 * Filter items by privacy level
 * Excludes items marked as 'private'
 * 
 * @param {Array} items - Array of items with privacy_level field
 * @param {boolean} excludePrivate - Whether to exclude private items (default: true)
 * @returns {Array} Filtered items
 */
export function filterByPrivacy(items, excludePrivate = true) {
  if (!Array.isArray(items)) return [];
  
  if (!excludePrivate) return items;
  
  return items.filter(item => {
    // If no privacy_level, treat as 'internal' (exportable)
    const level = item.privacy_level || item.sensitivity_level || 'internal';
    return level !== 'private';
  });
}

/**
 * Check if a single item is exportable
 */
export function isExportable(item) {
  const level = item.privacy_level || item.sensitivity_level || 'internal';
  return level !== 'private';
}

/**
 * Get privacy stats for logging
 */
export function getPrivacyStats(items) {
  const stats = {
    total: items.length,
    private: 0,
    internal: 0,
    shared: 0
  };
  
  items.forEach(item => {
    const level = item.privacy_level || 'internal';
    if (stats[level] !== undefined) {
      stats[level]++;
    }
  });
  
  return stats;
}
```

---

## Task 5: Build types.js (Optional but helpful)

Create `/lib/export/types.js`:

```javascript
// /lib/export/types.js
// OWNER: T2
// Type definitions for export structure

/**
 * @typedef {Object} ExportIdentity
 * @property {string} name
 * @property {string} role
 * @property {string} self_description
 * @property {string[]} goals
 * @property {string[]} life_context
 * @property {Object} communication
 * @property {string[]} boundaries
 * @property {Array<{name: string, relationship: string}>} key_people
 */

/**
 * @typedef {Object} ExportEntity
 * @property {string} id
 * @property {string} type
 * @property {string} name
 * @property {string} description
 * @property {number} importance
 * @property {number} sentiment
 * @property {Object} temporal
 * @property {Array} facts
 */

/**
 * @typedef {Object} ExportNote
 * @property {string} id
 * @property {string} content
 * @property {string} timestamp
 * @property {string} category
 * @property {Object} extracted
 */

/**
 * @typedef {Object} ExportPattern
 * @property {string} type
 * @property {string} description
 * @property {number} confidence
 * @property {Object} structured
 * @property {Object} evidence
 */

/**
 * @typedef {Object} InscriptExport
 * @property {ExportIdentity} identity
 * @property {ExportEntity[]} entities
 * @property {Object} episodes
 * @property {ExportPattern[]} patterns
 * @property {Object} meta
 */

export const EXPORT_VERSION = "1.0.0";
export const PRIVACY_LEVELS = ['private', 'internal', 'shared'];
export const ENTITY_TYPES = ['person', 'organization', 'place', 'project', 'concept', 'event', 'thing'];
export const PATTERN_TYPES = ['temporal', 'preference', 'habit', 'relational', 'behavioral', 'emotional'];
```

---

## Checkpoints

| Checkpoint | Test | Status |
|------------|------|--------|
| queries.js exports all functions | Import test passes | ☐ |
| getProfile returns data | Test with real user_id | ☐ |
| getEntities returns array | Test with real user_id | ☐ |
| getNotes returns array | Test with real user_id | ☐ |
| transforms produce valid JSON | JSON.stringify works | ☐ |
| Privacy filter excludes private | Test with mixed privacy items | ☐ |

---

## Test Your Code

```javascript
// Quick test in Node REPL or test file
import { getProfile, getEntities } from './lib/export/queries.js';
import { transformEntity, buildIdentity } from './lib/export/transforms.js';
import { filterByPrivacy } from './lib/export/privacy.js';

// Test with a real user_id
const user_id = 'YOUR_TEST_USER_ID';

const profile = await getProfile(user_id);
console.log('Profile:', profile);

const entities = await getEntities(user_id);
console.log('Entities count:', entities.length);

const publicEntities = filterByPrivacy(entities);
console.log('Public entities:', publicEntities.length);

const transformed = publicEntities.map(transformEntity);
console.log('First transformed:', JSON.stringify(transformed[0], null, 2));
```

---

## Handoff Signals

**You signal when queries.js is ready:**
```
T2 → T1: QUERIES READY
File: /lib/export/queries.js  
Exports: getProfile, getKeyPeople, getEntities, getNotes, getMeetings, getConversations, getPatterns
All tested with real user data!
```

**You signal when transforms.js is ready:**
```
T2 → T1: TRANSFORMS READY
File: /lib/export/transforms.js
Exports: buildIdentity, transformEntity, transformNote, transformMeeting, transformConversation, transformPattern, buildMeta
```

**You signal when privacy.js is ready:**
```
T2 → T1: PRIVACY READY
File: /lib/export/privacy.js
Exports: filterByPrivacy, isExportable, getPrivacyStats
```

---

## Definition of Done

- [ ] `/lib/export/queries.js` — All query functions working
- [ ] `/lib/export/transforms.js` — All transform functions working
- [ ] `/lib/export/privacy.js` — Privacy filtering working
- [ ] All functions tested with real user data
- [ ] No console errors
- [ ] T1 successfully imports and uses your code

---

## Notes on Data

**Check existing code for:**
- Note decryption logic → may be in `/api/analyze.js` or similar
- Entity structure → check `user_entities` table schema
- Pattern structure → check `user_patterns` table schema

**If privacy_level column doesn't exist yet:**
- Use `sensitivity_level` as fallback
- Document this for Sprint 2 migration

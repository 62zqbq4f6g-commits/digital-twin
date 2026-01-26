# Export API Technical Documentation

**Version:** 1.0.0
**Last Updated:** January 26, 2026
**Owner:** T1 (Backend), T4 (QA)

---

## Overview

The Export API provides authenticated users with a complete, portable snapshot of their Inscript data in PAMP-compliant JSON format.

---

## API Endpoint

### GET /api/export

Returns the authenticated user's complete memory export.

#### Authentication

Requires valid Bearer token in Authorization header.

```http
GET /api/export HTTP/1.1
Host: api.inscript.ai
Authorization: Bearer <access_token>
```

#### Response

**Success (200 OK)**

```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Disposition: attachment; filename="inscript-export-2025-01-26.json"
```

```json
{
  "inscript_export": {
    "identity": { ... },
    "entities": [ ... ],
    "episodes": { "notes": [ ... ] },
    "patterns": [ ... ],
    "meta": { ... }
  }
}
```

**Unauthorized (401)**

```json
{
  "error": "Unauthorized",
  "message": "Valid authentication required"
}
```

**Server Error (500)**

```json
{
  "error": "Internal Server Error",
  "message": "Export failed. Please try again."
}
```

---

## Response Schema

### Root Object

```typescript
interface ExportResponse {
  inscript_export: {
    identity: Identity;
    entities: Entity[];
    episodes: Episodes;
    patterns: Pattern[];
    meta: Meta;
  }
}
```

### Identity

```typescript
interface Identity {
  name: string | null;
  role: string | null;
  goals: string[];
  life_seasons: string[];
  depth_answer: string | null;
  communication: {
    tone: 'warm' | 'direct' | 'professional' | 'casual';
    custom_instructions: string | null;
  };
  key_people: KeyPerson[];
}

interface KeyPerson {
  name: string;
  relationship: string;  // "colleague", "friend", "dog", "mentor", etc.
  added_at: string;      // ISO 8601 timestamp
}
```

### Entity

```typescript
interface Entity {
  id: string;
  type: EntityType;
  name: string;
  summary: string | null;
  importance: number;     // 0.0 - 1.0
  sentiment: {
    average: number;      // -1.0 to 1.0
    trend: 'improving' | 'stable' | 'declining';
  };
  mentions: number;
  temporal: {
    first_mention: string;  // ISO 8601 date
    last_mention: string;   // ISO 8601 date
    active: boolean;
  };
  privacy_level: 'internal' | 'shared';  // 'private' items excluded
}

type EntityType =
  | 'person'
  | 'project'
  | 'organization'
  | 'place'
  | 'pet'
  | 'concept'
  | 'event'
  | 'activity'
  | 'other';
```

### Episodes (Notes)

```typescript
interface Episodes {
  notes: Note[];
}

interface Note {
  id: string;
  content: string;           // Decrypted note content
  reflection: string | null; // AI-generated reflection
  category: NoteCategory;
  sentiment: number;         // -1.0 to 1.0
  timestamp: string;         // ISO 8601
  extracted: {
    entities: string[];      // Entity IDs mentioned
    actions: string[];       // Action items extracted
    sentiment: number;
  };
  privacy_level: 'internal' | 'shared';
}

type NoteCategory =
  | 'work'
  | 'personal'
  | 'health'
  | 'relationships'
  | 'creativity'
  | 'learning'
  | 'reflection'
  | 'other';
```

### Pattern

```typescript
interface Pattern {
  id: string;
  type: PatternType;
  description: string;
  confidence: number;        // 0.0 - 1.0 (minimum 0.7 to be included)
  status: 'active' | 'dormant' | 'archived';
  evidence: {
    supporting_notes: string[];  // Note IDs
    first_detected: string;      // ISO 8601 date
    last_confirmed: string;      // ISO 8601 date
    occurrence_count: number;
  };
  privacy_level: 'internal' | 'shared';
}

type PatternType =
  | 'temporal'      // Time-based behaviors
  | 'relational'    // People/entity relationships
  | 'emotional'     // Emotional patterns
  | 'behavioral'    // Actions and habits
  | 'thematic';     // Recurring themes
```

### Meta

```typescript
interface Meta {
  version: string;           // "1.0.0"
  exported_at: string;       // ISO 8601 timestamp
  export_format: 'pamp';     // Portable AI Memory Protocol
  counts: {
    entities: number;
    notes: number;
    patterns: number;
    key_people: number;
  };
  date_range: {
    first_entry: string;     // ISO 8601 date
    last_entry: string;      // ISO 8601 date
  };
  checksum: string;          // SHA-256 for integrity verification
}
```

---

## Privacy Filtering

Items with `privacy_level: 'private'` are **automatically excluded** from exports:

```sql
-- Example: Entity filtering in API
SELECT * FROM user_entities
WHERE user_id = $1
  AND privacy_level != 'private';
```

### Privacy Level Definitions

| Level | Meaning | In Export? |
|-------|---------|------------|
| `private` | User-only, never shared | No |
| `internal` | Default, included in exports | Yes |
| `shared` | Explicitly shareable | Yes |

---

## Transform Functions

Located in `/lib/export/transforms.js`:

### buildIdentity(profile, keyPeople)

Transforms user profile and key people into export identity format.

```javascript
const identity = buildIdentity(profile, keyPeople);
// Returns: Identity object
```

### transformEntity(entity)

Transforms database entity to export format.

```javascript
const exportEntity = transformEntity(dbEntity);
// Returns: Entity object with type mapping
```

**Type Mapping:**

| Database `entity_type` | Export `type` |
|------------------------|---------------|
| `company` | `organization` |
| `person` | `person` |
| `project` | `project` |
| Others | Passed through |

### transformNote(note)

Transforms database note to export format.

```javascript
const exportNote = transformNote(dbNote);
// Returns: Note object with extracted metadata
```

### transformPattern(pattern)

Transforms database pattern to export format.

```javascript
const exportPattern = transformPattern(dbPattern);
// Returns: Pattern object with evidence structure
```

### buildMeta(data)

Generates export metadata with counts and checksums.

```javascript
const meta = buildMeta({ entities, notes, patterns });
// Returns: Meta object
```

---

## Privacy Utilities

Located in `/lib/export/privacy.js`:

### filterByPrivacy(items)

Filters array to exclude items with `privacy_level: 'private'`.

```javascript
const publicEntities = filterByPrivacy(allEntities);
// Returns: Array without private items
```

---

## Database Queries

### Entities Query

```sql
SELECT
  id,
  name,
  entity_type,
  summary,
  importance_score,
  sentiment_average,
  mention_count,
  is_historical,
  privacy_level,
  created_at,
  updated_at
FROM user_entities
WHERE user_id = $1
  AND privacy_level != 'private'
ORDER BY importance_score DESC;
```

### Notes Query

```sql
SELECT
  id,
  content,
  reflection,
  category,
  sentiment,
  privacy_level,
  created_at,
  updated_at
FROM notes
WHERE user_id = $1
  AND privacy_level != 'private'
ORDER BY created_at DESC;
```

### Patterns Query

```sql
SELECT
  id,
  pattern_type,
  description,
  confidence,
  evidence,
  status,
  privacy_level,
  created_at,
  updated_at
FROM user_patterns
WHERE user_id = $1
  AND privacy_level != 'private'
  AND confidence >= 0.7
ORDER BY confidence DESC;
```

---

## Performance Considerations

### Target Metrics

| Account Size | Target Response Time |
|--------------|---------------------|
| < 100 notes | < 5 seconds |
| 100-1000 notes | < 15 seconds |
| 1000+ notes | < 30 seconds |

### Optimization Strategies

1. **Parallel queries**: Fetch entities, notes, patterns concurrently
2. **Streaming**: For very large exports, consider streaming JSON
3. **Pagination**: Not currently implemented, but consider for 10k+ notes
4. **Caching**: Profile and key people can be cached (rarely change)

---

## Testing

### Unit Tests

Located in `/tests/export/transforms.test.js`:

```bash
npm test -- tests/export/transforms.test.js
```

Tests cover:
- `buildIdentity` with all fields and null handling
- `transformEntity` type mapping and temporal flags
- `transformNote` sentiment extraction
- `transformPattern` evidence structure
- `filterByPrivacy` exclusion logic
- `buildMeta` count calculations

### Integration Tests

Located in `/tests/export/api.test.js`:

```bash
# Requires TEST_USER_TOKEN environment variable
TEST_USER_TOKEN=xxx npm test -- tests/export/api.test.js
```

Tests cover:
- Authentication (401 without token)
- Response format validation
- Content-Disposition header
- Privacy filtering (no private items)
- Performance (< 10 second response)

### E2E Checklist

Located in `/tests/export/E2E-CHECKLIST.md`:

Manual checklist for:
- UI interactions (button states, loading, success/error)
- File validation (JSON structure, data accuracy)
- Cross-browser testing
- External AI validation (ChatGPT, Claude)

---

## Error Handling

### Client-Side

```javascript
try {
  const response = await fetch('/api/export', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Redirect to login
    } else {
      // Show error message
    }
    return;
  }

  const blob = await response.blob();
  // Trigger download
} catch (error) {
  // Network error
  showError('Export failed. Check your connection.');
}
```

### Server-Side

```javascript
export default async function handler(req, res) {
  try {
    // Validate auth
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Build export
    const exportData = await buildExport(user.id);

    // Send response
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition',
      `attachment; filename="inscript-export-${today()}.json"`);
    res.json(exportData);

  } catch (error) {
    console.error('Export failed:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Export failed. Please try again.'
    });
  }
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-26 | Initial release |

---

## Related Files

| File | Purpose |
|------|---------|
| `/api/export.js` | API endpoint (T1) |
| `/lib/export/transforms.js` | Transform functions (T2) |
| `/lib/export/privacy.js` | Privacy filtering (T2) |
| `/js/settings-export.js` | UI component (T3) |
| `/tests/export/` | Test suite (T4) |
| `/docs/EXPORT.md` | User documentation (T4) |

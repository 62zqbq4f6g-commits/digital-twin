# Inscript + PAMP Integration Plan

**Version:** 0.1 Draft  
**Date:** January 25, 2026  
**Status:** Architecture Planning

---

## Part 1: Embedding Portability Strategy

### The Problem

Embeddings are:
- **Model-specific**: OpenAI `text-embedding-3-small` produces 1536 dimensions; Cohere produces 1024; local models vary
- **Semantically incompatible**: A vector from Model A cannot be meaningfully compared to Model B
- **Large**: Each embedding is 1536 floats × 4 bytes = 6KB per note. 10,000 notes = 60MB of embeddings alone

### Options Analyzed

| Approach | Pros | Cons | Recommendation |
|----------|------|------|----------------|
| **Include in export** | Complete backup | Large files, model lock-in | ❌ Not recommended |
| **Exclude from export** | Smaller files, clean | Requires regeneration on import | ✅ Current recommendation |
| **Conversion layer** | Cross-model compatibility | Complex, lossy, maintenance burden | ⚠️ Future consideration |
| **Standardized embedding** | True portability | No industry standard exists | 🔮 Long-term vision |

### Recommended Strategy: Export Without, Regenerate On Import

```
┌─────────────────────────────────────────────────────────────────┐
│                     PAMP EXPORT FILE                             │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Profile (Core Identity)                                     │
│  ✅ Entities (with relationships, facts, temporal data)         │
│  ✅ Episodes (notes, conversations)                             │
│  ✅ Patterns (behavioral, preference)                           │
│  ✅ Embedding METADATA (model, dimensions, date generated)      │
│  ❌ Embedding VECTORS (not included)                            │
└─────────────────────────────────────────────────────────────────┘
```

**Why this works:**
1. **Text is preserved**: All raw content that generated embeddings is in the export
2. **Any app can regenerate**: Importing app uses its own model to embed content
3. **Semantic search works**: Regenerated embeddings are internally consistent
4. **File size stays small**: 10,000 notes = ~5MB vs 65MB with vectors

### Embedding Metadata Schema

Include this in export to help importing apps understand the original embedding context:

```json
{
  "embeddingConfig": {
    "model": "text-embedding-3-small",
    "provider": "openai",
    "dimensions": 1536,
    "generatedAt": "2025-01-20T10:30:00Z",
    "contentTypes": {
      "notes": {
        "count": 847,
        "embeddedFields": ["content", "reflection"]
      },
      "entities": {
        "count": 234,
        "embeddedFields": ["name", "description", "facts"]
      }
    },
    "note": "Embeddings not included in export. Regenerate using content fields."
  }
}
```

### Future: Embedding Normalization Layer (Phase 4+)

If cross-model compatibility becomes critical, consider:

```
┌─────────────────────────────────────────────────────────────────┐
│                  PAMP EMBEDDING BRIDGE (Future)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Source App (OpenAI)        Target App (Cohere)                 │
│  ┌───────────────┐          ┌───────────────┐                   │
│  │ 1536 dims     │          │ 1024 dims     │                   │
│  └───────────────┘          └───────────────┘                   │
│          │                          ▲                           │
│          ▼                          │                           │
│  ┌─────────────────────────────────────────────┐                │
│  │         SEMANTIC ALIGNMENT LAYER            │                │
│  │  • Parallel corpus training                 │                │
│  │  • Linear projection matrix                 │                │
│  │  • Preserves relative distances             │                │
│  └─────────────────────────────────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Requirements for this approach:**
- Train alignment on parallel corpus (same text embedded by both models)
- Linear transformation preserves approximate cosine similarity
- Maintained mapping matrices for popular model pairs
- Community-contributed bridges

**Verdict:** Interesting but premature. Focus on content-based export first.

---

## Part 2: Inscript Schema → PAMP Mapping

### Current Inscript Database Tables

| Table | Purpose | PAMP Mapping |
|-------|---------|--------------|
| `notes` | User's raw input | Layer 3: Episodes |
| `user_entities` | Extracted entities | Layer 2: Entities |
| `user_key_people` | Explicit key people | Layer 2: Entities (high priority) |
| `user_patterns` | Detected patterns | Layer 4: Patterns |
| `category_summaries` | Aggregated insights | Layer 4: Patterns |
| `user_profiles` | Onboarding data | Layer 1: Profile |
| `meeting_history` | Meeting records | Layer 3: Episodes |
| `mirror_conversations` | MIRROR chat history | Layer 3: Episodes |
| `note_embeddings` | Vector store | Layer 5: Embeddings |

### Gap Analysis

| PAMP Feature | Inscript Status | Gap | Priority |
|--------------|-----------------|-----|----------|
| **Profile.communicationStyle** | ❌ Missing | No formality/verbosity/tone preferences | P1 |
| **Profile.selfDescription.values** | ❌ Missing | Onboarding doesn't capture values | P2 |
| **Entity.temporal.validFrom/validUntil** | ❌ Missing | No "when did this person enter/leave user's life" | P1 |
| **Entity.scores.importance** | ⚠️ Partial | Have mention_count, not importance score | P2 |
| **Entity.scores.confidence** | ❌ Missing | No confidence on entity extraction | P1 |
| **Entity.facts[]** | ❌ Missing | Entities don't have structured facts | P1 |
| **Entity.relationships[]** | ⚠️ Basic | Have relationship field, not graph edges | P1 |
| **Note.extractionMetadata** | ❌ Missing | Don't track what was extracted from each note | P2 |
| **Pattern.evidence[]** | ⚠️ Partial | Have supporting_notes, not structured evidence | P2 |
| **Privacy labels (private/internal/shared)** | ❌ Missing | No granular privacy per entity | P1 |
| **Export function** | ❌ Missing | No JSON-LD export | P1 |

### Schema Upgrade Plan

#### Phase A: Core PAMP Alignment (2-3 weeks)

**1. Upgrade `user_entities` table**

```sql
-- Add PAMP-required columns
ALTER TABLE user_entities ADD COLUMN IF NOT EXISTS
  confidence DECIMAL(3,2) DEFAULT 0.8,
  importance DECIMAL(3,2),
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  privacy_level TEXT DEFAULT 'internal' CHECK (privacy_level IN ('private', 'internal', 'shared')),
  source TEXT DEFAULT 'inferred' CHECK (source IN ('user_stated', 'inferred', 'imported'));

-- Create entity_facts table (new)
CREATE TABLE entity_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  predicate TEXT NOT NULL,  -- 'likes', 'works_at', 'allergic_to'
  object_text TEXT,  -- For simple values
  object_entity_id UUID REFERENCES user_entities(id),  -- For entity references
  confidence DECIMAL(3,2) DEFAULT 0.8,
  source TEXT DEFAULT 'inferred',
  source_note_id UUID REFERENCES notes(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create entity_relationships table (new)
CREATE TABLE entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  source_entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE,
  target_entity_id UUID REFERENCES user_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,  -- 'works_at', 'married_to', 'friend_of'
  direction TEXT DEFAULT 'bidirectional' CHECK (direction IN ('outgoing', 'incoming', 'bidirectional')),
  strength DECIMAL(3,2),
  context TEXT,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**2. Upgrade `user_profiles` table**

```sql
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  communication_formality TEXT DEFAULT 'adaptive',
  communication_verbosity TEXT DEFAULT 'adaptive',
  communication_tone TEXT DEFAULT 'warm',
  custom_instructions TEXT,
  values JSONB DEFAULT '[]',
  goals JSONB DEFAULT '[]';
```

**3. Add extraction metadata to `notes`**

```sql
ALTER TABLE notes ADD COLUMN IF NOT EXISTS
  extraction_metadata JSONB DEFAULT '{}';
  -- Stores: entities extracted, facts extracted, patterns triggered

-- Example extraction_metadata:
-- {
--   "entities_extracted": ["uuid1", "uuid2"],
--   "facts_created": ["uuid3"],
--   "processed_at": "2025-01-20T10:00:00Z",
--   "model_version": "claude-3.5-sonnet"
-- }
```

**4. Add privacy to `user_patterns`**

```sql
ALTER TABLE user_patterns ADD COLUMN IF NOT EXISTS
  privacy_level TEXT DEFAULT 'internal' CHECK (privacy_level IN ('private', 'internal', 'shared'));
```

#### Phase B: Extraction Pipeline Upgrade (1-2 weeks)

**Current flow:**
```
Note → Extract entities → Save to user_entities
```

**PAMP-aligned flow:**
```
Note → Extract entities, facts, relationships → 
       Resolve to existing entities → 
       Create/update facts with confidence → 
       Link relationships → 
       Store extraction metadata → 
       Update importance scores
```

**Changes to `api/extract-entities.js`:**

```javascript
// Current extraction output
{
  entities: [
    { name: "Sarah", category: "person", relationship: "colleague" }
  ]
}

// PAMP-aligned extraction output
{
  entities: [
    {
      name: "Sarah Chen",
      category: "person",
      confidence: 0.95,
      source: "inferred",
      facts: [
        {
          predicate: "works_at",
          object: "Acme Corp",
          confidence: 0.8
        },
        {
          predicate: "role",
          object: "Product Manager",
          confidence: 0.9
        }
      ],
      relationships: [
        {
          target: "user",  // Special: relationship to the user
          type: "colleague",
          context: "They work together on the Q3 roadmap"
        }
      ]
    }
  ],
  metadata: {
    model: "claude-3.5-sonnet",
    processed_at: "2025-01-25T10:00:00Z"
  }
}
```

#### Phase C: Export Function (1 week)

**New endpoint: `api/pamp-export.js`**

```javascript
// GET /api/pamp-export
// Returns: JSON-LD formatted PAMP export

export default async function handler(req, res) {
  const { user_id } = req.auth;
  
  // Gather all layers
  const profile = await getProfile(user_id);
  const entities = await getEntitiesWithFacts(user_id);
  const notes = await getNotes(user_id);
  const conversations = await getConversations(user_id);
  const patterns = await getPatterns(user_id);
  
  // Format as PAMP
  const pampExport = {
    "@context": "https://pamp.inscript.ai/schema/v1",
    "@type": "PAMPStore",
    "version": "1.0.0",
    "owner": {
      "@type": "Owner",
      "id": user_id,
      "exportedAt": new Date().toISOString()
    },
    "profile": formatProfile(profile),
    "entities": entities.map(formatEntity),
    "episodes": {
      "notes": notes.map(formatNote),
      "conversations": conversations.map(formatConversation)
    },
    "patterns": patterns.map(formatPattern),
    "embeddingConfig": {
      "model": "text-embedding-3-small",
      "provider": "openai",
      "dimensions": 1536,
      "note": "Vectors not included. Regenerate from content fields."
    },
    "checksum": generateChecksum(/* all data */)
  };
  
  res.setHeader('Content-Type', 'application/ld+json');
  res.setHeader('Content-Disposition', 'attachment; filename="pamp-export.json"');
  res.json(pampExport);
}
```

---

## Part 3: Implementation Roadmap

### Week 1-2: Database Schema
- [ ] Add columns to `user_entities` (confidence, importance, temporal, privacy, source)
- [ ] Create `entity_facts` table
- [ ] Create `entity_relationships` table
- [ ] Add communication preferences to `user_profiles`
- [ ] Add extraction_metadata to `notes`
- [ ] Write migration scripts
- [ ] Backfill existing data with defaults

### Week 3: Extraction Pipeline
- [ ] Upgrade entity extraction prompt to output PAMP-aligned structure
- [ ] Implement fact extraction and storage
- [ ] Implement relationship extraction and storage
- [ ] Add confidence scoring to extractions
- [ ] Store extraction metadata on notes

### Week 4: Export Function
- [ ] Implement `api/pamp-export.js`
- [ ] Format all layers as JSON-LD
- [ ] Add checksum for integrity verification
- [ ] Add UI button in Settings: "Export My Data (PAMP)"
- [ ] Test export with sample data

### Week 5: Import Function (Proof of Portability)
- [ ] Implement `api/pamp-import.js`
- [ ] Handle entity resolution (merge vs create)
- [ ] Handle fact conflicts (user mediation)
- [ ] Regenerate embeddings from imported content
- [ ] Add UI for import with progress

### Week 6: Polish & Testing
- [ ] End-to-end export → import test
- [ ] Verify all data survives round-trip
- [ ] Performance testing (large exports)
- [ ] Security review of export/import
- [ ] Documentation

---

## Part 4: Migration Notes

### Existing Data Migration

**For existing entities without facts:**
- Generate facts from current `relationship` field
- Set `source: 'inferred'` and `confidence: 0.7` (lower since we're backfilling)

**For existing patterns without privacy:**
- Default to `privacy_level: 'internal'`

**For notes without extraction_metadata:**
- Leave empty; future re-processing can populate

### Backwards Compatibility

**Current API contracts remain unchanged:**
- Existing endpoints continue to work
- New fields are additive
- Export is opt-in feature

---

## Part 5: Success Criteria

### Export completeness
- [ ] All notes export with content and metadata
- [ ] All entities export with facts and relationships
- [ ] All patterns export with evidence
- [ ] Profile exports with communication preferences

### Import fidelity
- [ ] Imported data round-trips correctly
- [ ] Entity resolution works (no duplicates)
- [ ] Embeddings regenerate successfully
- [ ] Search works after import

### Performance
- [ ] Export of 10,000 notes completes in < 30 seconds
- [ ] Export file size < 10MB for typical user
- [ ] Import with embedding regeneration < 5 minutes

---

## Appendix: File Structure Changes

```
/api
  ├── pamp-export.js      (new)
  ├── pamp-import.js      (new)
  ├── extract-entities.js (upgraded)
  └── ...

/lib
  ├── pamp/
  │   ├── schema.js       (PAMP type definitions)
  │   ├── formatters.js   (Transform Inscript → PAMP format)
  │   ├── validators.js   (Validate PAMP structure)
  │   └── checksum.js     (SHA-256 checksum for exports)
  └── ...

/sql/migrations
  ├── 0XX_add_entity_facts.sql
  ├── 0XX_add_entity_relationships.sql
  ├── 0XX_add_pamp_columns.sql
  └── 0XX_add_profile_communication.sql
```

---

## Summary

**Embedding Strategy:** Export metadata, not vectors. Regenerate on import.

**Integration Approach:** Incremental schema upgrades, backwards-compatible, 6-week timeline.

**Key Gaps to Address:**
1. Entity facts and relationships (graph structure)
2. Confidence and temporal validity on entities
3. Privacy labels throughout
4. Extraction metadata on notes
5. Export/import functions

**Outcome:** Inscript becomes the first PAMP-compliant personal AI memory app, with true data portability as a differentiator.

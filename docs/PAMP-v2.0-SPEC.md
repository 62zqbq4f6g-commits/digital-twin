# PAMP v2.0 Specification

## Portable AI Memory Protocol

**Version:** 2.0.0
**Status:** Draft
**Last Updated:** January 29, 2026
**Authors:** Inscript Team

---

## Abstract

The Portable AI Memory Protocol (PAMP) defines a standard format for representing personal AI memory that can be exported from one system and imported into another. PAMP enables true data portability for AI-augmented personal knowledge management.

## Goals

1. **Portability** — Memory can move between AI systems without loss
2. **Completeness** — All meaningful data is captured
3. **Privacy** — Supports encrypted content fields
4. **Extensibility** — Custom fields allowed without breaking compatibility
5. **AI-Optimized** — Structure designed for LLM consumption

---

## Document Structure

A PAMP document is a JSON object with the following top-level structure:

```typescript
interface PAMPDocument {
  "@context": "https://pamp.ai/schema/v2";
  version: "2.0.0";

  identity: IdentityLayer;
  knowledgeGraph: KnowledgeGraphLayer;
  episodes: EpisodeLayer;
  patterns: Pattern[];
  summaries: SummaryLayer;

  meta: DocumentMeta;
}
```

---

## Layer 1: Identity

The identity layer captures who the user is.

```typescript
interface IdentityLayer {
  // Core identity
  profile: {
    name?: string;
    selfDescription?: string;
    role?: string;
    values?: string[];
    goals?: string[];
    boundaries?: string[];        // Topics to avoid
    lifeContext?: string[];       // Current life situation
  };

  // Communication preferences
  communication?: {
    tone?: "warm" | "professional" | "casual" | "direct";
    formality?: "formal" | "informal" | "adaptive";
    verbosity?: "concise" | "detailed" | "adaptive";
    customInstructions?: string;
  };

  // Important people
  keyPeople?: KeyPerson[];
}

interface KeyPerson {
  name: string;
  relationship: string;           // "wife", "business partner", "mentor"
  importance?: number;            // 0-1 scale
  notes?: string;
}
```

### Required Fields
- `profile` object must exist (can be empty)

### Example

```json
{
  "profile": {
    "name": "Alex Chen",
    "role": "Founder at TechStartup",
    "goals": ["Launch MVP by Q2", "Hire 3 engineers"],
    "boundaries": ["Politics", "Religion"]
  },
  "communication": {
    "tone": "warm",
    "verbosity": "concise"
  },
  "keyPeople": [
    { "name": "Sarah", "relationship": "co-founder", "importance": 1.0 },
    { "name": "Marcus", "relationship": "advisor", "importance": 0.9 }
  ]
}
```

---

## Layer 2: Knowledge Graph

The knowledge graph captures entities (people, places, things, concepts) and their relationships.

```typescript
interface KnowledgeGraphLayer {
  entities: Entity[];
  relationships?: Relationship[];
  coOccurrences?: CoOccurrence[];
}

interface Entity {
  id: string;                     // Unique identifier
  name: string;
  aliases?: string[];             // Alternative names
  type: EntityType;

  // Structured facts about this entity
  facts?: Fact[];

  // Scores and metadata
  scores?: {
    importance?: number;          // 0-1, how important to user
    mentionCount?: number;        // Times mentioned
    sentiment?: number;           // -1 to 1, user's feeling
    lastMentioned?: string;       // ISO date
  };

  // Free-form summary
  summary?: string;

  // Privacy level
  privacyLevel?: "public" | "private" | "sensitive";
}

type EntityType =
  | "person"
  | "organization"
  | "place"
  | "project"
  | "concept"
  | "event"
  | "product"
  | "other";

interface Fact {
  predicate: string;              // e.g., "works_at", "lives_in", "likes"
  object: string;                 // e.g., "Anthropic", "San Francisco", "hiking"
  confidence?: number;            // 0-1
  source?: string;                // Where this fact came from
  temporal?: {
    validFrom?: string;           // ISO date
    validUntil?: string;          // ISO date
  };
}

interface Relationship {
  subject: string;                // Entity ID or name
  predicate: string;              // e.g., "knows", "works_with", "married_to"
  object: string;                 // Entity ID or name
  strength?: number;              // 0-1
  bidirectional?: boolean;        // true if relationship goes both ways
}

interface CoOccurrence {
  entityA: string;                // Entity ID or name
  entityB: string;                // Entity ID or name
  count: number;                  // Times mentioned together
  contexts?: string[];            // Sample contexts
}
```

### Standard Predicates

#### Entity Facts (Entity → World)
| Predicate | Meaning | Example |
|-----------|---------|---------|
| `works_at` | Employment | "Anthropic" |
| `lives_in` | Location | "San Francisco" |
| `role` | Job title | "CEO" |
| `likes` | Preference | "hiking" |
| `dislikes` | Aversion | "meetings" |
| `expert_in` | Expertise | "machine learning" |
| `birthday` | Date | "1990-05-15" |
| `email` | Contact | "alex@example.com" |
| `phone` | Contact | "+1-555-0123" |

#### User Behaviors (User → Entity)
| Predicate | Meaning |
|-----------|---------|
| `trusts_opinion_of` | User trusts this person's judgment |
| `seeks_advice_from` | User goes to this person for advice |
| `relies_on` | User depends on this entity |
| `learns_from` | User gains knowledge from this entity |
| `inspired_by` | User is inspired by this entity |
| `collaborates_with` | User works with this entity |
| `competes_with` | User competes with this entity |
| `avoids` | User avoids this entity |

#### Entity Qualities (Entity → User)
| Predicate | Meaning |
|-----------|---------|
| `helps_with` | Entity helps user with something |
| `challenges` | Entity challenges user |
| `supports` | Entity supports user |
| `mentors` | Entity mentors user |

### Example

```json
{
  "entities": [
    {
      "id": "e1",
      "name": "Marcus Chen",
      "type": "person",
      "facts": [
        { "predicate": "works_at", "object": "Anthropic", "confidence": 0.95 },
        { "predicate": "role", "object": "AI Researcher" }
      ],
      "scores": {
        "importance": 0.9,
        "sentiment": 0.8,
        "mentionCount": 47
      },
      "summary": "AI researcher and trusted advisor on technical decisions"
    }
  ],
  "relationships": [
    { "subject": "Marcus Chen", "predicate": "advises", "object": "user", "strength": 0.9 }
  ]
}
```

---

## Layer 3: Episodes

Episodes are time-bound memories: notes, conversations, meetings.

```typescript
interface EpisodeLayer {
  notes?: Note[];
  conversations?: Conversation[];
  meetings?: Meeting[];
}

interface Note {
  id: string;
  content: string;                // May be encrypted
  contentEncrypted?: string;      // If E2E encrypted

  timestamp: string;              // ISO date

  // Categorization
  category?: string;              // "work", "personal", "health", etc.
  tags?: string[];

  // Extracted data
  entityMentions?: string[];      // Entity IDs mentioned
  sentiment?: number;             // -1 to 1

  // Distillation (for old notes)
  isDistilled?: boolean;
  distilledSummary?: string;

  // Source
  source?: "manual" | "voice" | "import" | "meeting";
}

interface Conversation {
  id: string;
  title?: string;
  startedAt: string;              // ISO date
  endedAt?: string;               // ISO date

  messages: Message[];

  // Extracted insights
  summary?: string;
  keyInsights?: string[];
  entityMentions?: string[];
}

interface Message {
  role: "user" | "assistant";
  content: string;                // May be encrypted
  contentEncrypted?: string;
  timestamp: string;
}

interface Meeting {
  id: string;
  title?: string;
  date: string;                   // ISO date

  // Participants
  attendees?: string[];           // Names or entity IDs

  // Content
  topics?: string[];
  notes?: string;
  notesEncrypted?: string;

  // Outcomes
  actionItems?: string[];
  decisions?: string[];

  // Source
  source?: "manual" | "calendar" | "recording";
}
```

### Example

```json
{
  "notes": [
    {
      "id": "n1",
      "content": "Great call with Marcus about the AI strategy...",
      "timestamp": "2026-01-28T14:30:00Z",
      "category": "work",
      "entityMentions": ["e1"],
      "sentiment": 0.7
    }
  ],
  "conversations": [
    {
      "id": "c1",
      "title": "Thinking about product roadmap",
      "startedAt": "2026-01-28T10:00:00Z",
      "messages": [
        { "role": "user", "content": "Help me think about Q2 priorities", "timestamp": "2026-01-28T10:00:00Z" },
        { "role": "assistant", "content": "Based on your goals...", "timestamp": "2026-01-28T10:00:05Z" }
      ],
      "keyInsights": ["Focus on core features before expansion"]
    }
  ]
}
```

---

## Layer 4: Patterns

Patterns are learned behaviors and tendencies.

```typescript
interface Pattern {
  id?: string;
  type: PatternType;
  description: string;
  confidence: number;             // 0-1

  // Evidence
  evidence?: string[];            // Note IDs or descriptions
  observedCount?: number;

  // Temporal
  firstObserved?: string;         // ISO date
  lastObserved?: string;

  // Status
  status?: "active" | "historical" | "evolving";
}

type PatternType =
  | "behavioral"                  // How user acts
  | "emotional"                   // How user feels
  | "cognitive"                   // How user thinks
  | "social"                      // How user relates
  | "temporal"                    // Time-based patterns
  | "preference";                 // Preferences
```

### Example

```json
{
  "patterns": [
    {
      "type": "behavioral",
      "description": "Works best in morning hours, energy dips after 3pm",
      "confidence": 0.85,
      "observedCount": 12,
      "status": "active"
    },
    {
      "type": "emotional",
      "description": "Stress increases before major deadlines",
      "confidence": 0.78,
      "status": "active"
    }
  ]
}
```

---

## Layer 5: Summaries

Pre-computed summaries for efficient AI consumption.

```typescript
interface SummaryLayer {
  // Summaries by life category
  byCategory?: Record<string, CategorySummary>;

  // Overall summary
  overall?: string;

  // Recent context (last 7-14 days)
  recentContext?: string;

  // Behavioral profile (prose)
  behavioralProfile?: string;
}

interface CategorySummary {
  summary: string;
  entityCount?: number;
  noteCount?: number;
  lastUpdated?: string;           // ISO date
}
```

### Standard Categories
- `work_life` — Career, job, professional
- `relationships` — Personal relationships
- `health_wellness` — Physical and mental health
- `personal_growth` — Learning, development
- `interests_hobbies` — Leisure activities
- `finances` — Money, investments
- `family` — Family matters

### Example

```json
{
  "byCategory": {
    "work_life": {
      "summary": "Building an AI startup, focused on launch. Key advisor is Marcus.",
      "entityCount": 15,
      "lastUpdated": "2026-01-28"
    }
  },
  "behavioralProfile": "Seeks advice from trusted advisors before major decisions. Values direct communication. Morning person with creative energy peaks.",
  "recentContext": "Preparing for Q2 launch, had productive strategy call with Marcus."
}
```

---

## Document Metadata

```typescript
interface DocumentMeta {
  // Export info
  exportedAt: string;             // ISO date
  exportedBy?: string;            // Application name

  // Source info
  source: {
    application: string;          // "inscript", "mem0", etc.
    version?: string;
    userId?: string;              // Anonymized if needed
  };

  // Counts
  counts: {
    entities: number;
    facts: number;
    notes: number;
    conversations: number;
    meetings: number;
    patterns: number;
  };

  // Date range
  dateRange?: {
    earliest: string;             // ISO date
    latest: string;
  };

  // Encryption
  encryption?: {
    algorithm: string;            // "AES-256-GCM"
    keyDerivation?: string;       // "PBKDF2"
    encryptedFields: string[];    // List of encrypted field paths
  };
}
```

---

## Full Example

```json
{
  "@context": "https://pamp.ai/schema/v2",
  "version": "2.0.0",

  "identity": {
    "profile": {
      "name": "Alex Chen",
      "role": "Founder",
      "goals": ["Launch MVP", "Raise seed round"],
      "boundaries": ["Politics"]
    },
    "communication": {
      "tone": "warm",
      "verbosity": "concise"
    },
    "keyPeople": [
      { "name": "Sarah", "relationship": "co-founder", "importance": 1.0 },
      { "name": "Marcus", "relationship": "advisor", "importance": 0.9 }
    ]
  },

  "knowledgeGraph": {
    "entities": [
      {
        "id": "e1",
        "name": "Marcus Chen",
        "type": "person",
        "facts": [
          { "predicate": "works_at", "object": "Anthropic", "confidence": 0.95 },
          { "predicate": "role", "object": "AI Researcher" }
        ],
        "scores": { "importance": 0.9, "sentiment": 0.8 }
      },
      {
        "id": "e2",
        "name": "Anthropic",
        "type": "organization",
        "facts": [
          { "predicate": "industry", "object": "AI Safety" }
        ]
      }
    ],
    "relationships": [
      { "subject": "e1", "predicate": "works_at", "object": "e2" },
      { "subject": "e1", "predicate": "advises", "object": "user" }
    ]
  },

  "episodes": {
    "notes": [
      {
        "id": "n1",
        "content": "Great strategy call with Marcus today...",
        "timestamp": "2026-01-28T14:30:00Z",
        "category": "work",
        "entityMentions": ["e1"],
        "sentiment": 0.7
      }
    ],
    "conversations": [
      {
        "id": "c1",
        "title": "Q2 Planning",
        "startedAt": "2026-01-28T10:00:00Z",
        "messages": [
          { "role": "user", "content": "Help me prioritize Q2", "timestamp": "2026-01-28T10:00:00Z" },
          { "role": "assistant", "content": "Based on your goals...", "timestamp": "2026-01-28T10:00:05Z" }
        ]
      }
    ]
  },

  "patterns": [
    {
      "type": "behavioral",
      "description": "Seeks advisor input before major decisions",
      "confidence": 0.85
    }
  ],

  "summaries": {
    "byCategory": {
      "work_life": {
        "summary": "Building AI startup, preparing for launch",
        "lastUpdated": "2026-01-28"
      }
    },
    "behavioralProfile": "Values trusted advisors, prefers direct communication"
  },

  "meta": {
    "exportedAt": "2026-01-29T12:00:00Z",
    "source": {
      "application": "inscript",
      "version": "9.12.0"
    },
    "counts": {
      "entities": 2,
      "facts": 3,
      "notes": 1,
      "conversations": 1,
      "meetings": 0,
      "patterns": 1
    }
  }
}
```

---

## Validation Rules

### Required Fields
1. `@context` must be `"https://pamp.ai/schema/v2"`
2. `version` must be `"2.0.0"`
3. `identity.profile` must exist
4. `meta.exportedAt` must be valid ISO date
5. `meta.source.application` must exist
6. `meta.counts` must exist with all fields

### Entity Rules
1. Each entity must have `id`, `name`, and `type`
2. `type` must be a valid EntityType
3. `scores.importance` must be 0-1 if present
4. `scores.sentiment` must be -1 to 1 if present

### Episode Rules
1. Each note must have `id`, `content` (or `contentEncrypted`), and `timestamp`
2. Each conversation must have `id`, `startedAt`, and `messages`
3. Each message must have `role`, `content`, and `timestamp`

### Pattern Rules
1. Each pattern must have `type`, `description`, and `confidence`
2. `confidence` must be 0-1
3. `type` must be a valid PatternType

---

## Encryption

PAMP supports end-to-end encryption for sensitive content.

### Encrypted Fields
Content fields can be encrypted client-side:
- `notes[].contentEncrypted` (instead of `content`)
- `conversations[].messages[].contentEncrypted`
- `meetings[].notesEncrypted`

### Encryption Metadata
```json
{
  "meta": {
    "encryption": {
      "algorithm": "AES-256-GCM",
      "keyDerivation": "PBKDF2",
      "encryptedFields": [
        "episodes.notes[].contentEncrypted",
        "episodes.conversations[].messages[].contentEncrypted"
      ]
    }
  }
}
```

### Decryption
Importing applications must prompt user for decryption key if encrypted fields are present.

---

## Extensibility

### Custom Fields
Applications may add custom fields prefixed with `x_`:

```json
{
  "identity": {
    "profile": { "name": "Alex" },
    "x_inscript_tier": "managed",
    "x_inscript_joined": "2025-06-01"
  }
}
```

### Custom Predicates
Fact predicates can be any string. Standard predicates are recommended for interoperability.

---

## Versioning

- **Major version** (2.x.x): Breaking changes
- **Minor version** (x.1.x): New optional fields
- **Patch version** (x.x.1): Clarifications only

Applications should:
1. Accept any 2.x.x version
2. Ignore unknown fields
3. Use defaults for missing optional fields

---

## Implementation Notes

### For Exporters
1. Include all user data by default
2. Let users choose privacy levels
3. Validate before export
4. Include accurate counts in meta

### For Importers
1. Validate against schema
2. Handle missing optional fields
3. Prompt for encryption key if needed
4. Map predicates to local schema
5. Deduplicate entities by name/alias

### For AI Consumers
1. Use `summaries` for quick context
2. Use `identity` for personalization
3. Use `knowledgeGraph` for entity lookup
4. Use `episodes` for detailed history
5. Use `patterns` for behavioral awareness

---

## Reference Implementations

- **Inscript** (JavaScript): https://github.com/inscript/pamp-js
- **Validator**: `/lib/pamp/validator.js`

---

*PAMP v2.0 Specification*
*Portable AI Memory Protocol*
*Open Standard for AI Memory Portability*

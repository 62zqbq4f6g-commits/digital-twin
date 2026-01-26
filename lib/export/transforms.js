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
    source_version: "9.4.0",

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

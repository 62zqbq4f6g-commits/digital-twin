// /lib/export/transforms.js
// OWNER: T2
// CONSUMERS: T1 (api/export.js)
//
// Phase 19: PAMP v2.0 compliant exports
// See /docs/PAMP-v2.0-SPEC.md for specification

import { PAMP_VERSION, PAMP_CONTEXT } from '../pamp/index.js';

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
    aliases: entity.aliases || [],
    relationship: entity.relationship,
    description: entity.summary || null,

    importance: entity.importance_score || 0,
    sentiment: entity.sentiment_average || 0,
    mention_count: entity.mention_count || 0,

    // Structured facts
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

    // Include full message history
    message_count: conv.messages?.length || 0,
    messages: (conv.messages || []).map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.created_at
    }))
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
 * Transform user behavior to export format
 * Phase 19: Intent-Aware Extraction
 */
export function transformBehavior(behavior) {
  return {
    predicate: behavior.predicate,
    entity_name: behavior.entity_name,
    entity_id: behavior.entity_id,
    topic: behavior.topic || null,
    sentiment: behavior.sentiment || 0,
    confidence: behavior.confidence || 0,
    reinforcement_count: behavior.reinforcement_count || 1,
    evidence: behavior.evidence || null,
    first_detected: behavior.first_detected_at,
    last_reinforced: behavior.last_reinforced_at
  };
}

/**
 * Transform entity quality to export format
 * Phase 19: Intent-Aware Extraction
 */
export function transformEntityQuality(quality) {
  return {
    entity_name: quality.entity_name,
    entity_id: quality.entity_id,
    predicate: quality.predicate,
    object: quality.object,
    confidence: quality.confidence || 0,
    reinforcement_count: quality.reinforcement_count || 1,
    first_detected: quality.first_detected_at,
    last_reinforced: quality.last_reinforced_at
  };
}

/**
 * Transform entity link (co-occurrence) to export format
 * Phase 19: Entity graph
 */
export function transformEntityLink(link) {
  return {
    entity_a: link.entity_a,
    entity_b: link.entity_b,
    strength: link.strength || 1,
    context: link.context || null,
    last_seen: link.last_seen
  };
}

/**
 * Build meta section with Phase 19 additions
 */
export function buildMeta({
  entities,
  notes,
  patterns,
  facts = [],
  conversations = [],
  behaviors = [],
  entityQualities = [],
  entityLinks = []
}) {
  const timestamps = notes
    .map(n => new Date(n.created_at))
    .filter(d => !isNaN(d));

  // Count total messages across conversations
  const totalMessages = conversations.reduce(
    (sum, c) => sum + (c.messages?.length || 0),
    0
  );

  return {
    version: "2.0.0",
    exported_at: new Date().toISOString(),
    source: "Inscript",
    source_version: "9.9.0",

    counts: {
      entities: entities.length,
      notes: notes.length,
      patterns: patterns.length,
      facts: facts.length,
      conversations: conversations.length,
      messages: totalMessages,
      // Phase 19: Intent-Aware Extraction
      behaviors: behaviors.length,
      entity_qualities: entityQualities.length,
      entity_links: entityLinks.length
    },

    date_range: {
      first_entry: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
      last_entry: timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null
    },

    embedding_note: "Embeddings not included. Regenerate from content if needed.",
    pamp_version: PAMP_VERSION
  };
}

/**
 * Build full PAMP v2.0 compliant document
 * This is the master function for PAMP exports
 *
 * @param {Object} data - All user data from queries
 * @returns {Object} PAMP v2.0 compliant document
 */
export function buildPAMPDocument(data) {
  const {
    profile,
    keyPeople = [],
    entities = [],
    facts = [],
    relationships = [],
    notes = [],
    conversations = [],
    meetings = [],
    patterns = [],
    behaviors = [],
    entityQualities = [],
    entityLinks = [],
    categorySummaries = []
  } = data;

  // Build identity layer
  const identity = {
    profile: {
      name: profile?.name || undefined,
      selfDescription: profile?.depth_answer || undefined,
      role: profile?.role_type || undefined,
      values: profile?.values || undefined,
      goals: profile?.goals || [],
      boundaries: profile?.boundaries || [],
      lifeContext: profile?.life_seasons || []
    },
    communication: {
      tone: profile?.tone || 'warm',
      formality: 'adaptive',
      verbosity: 'adaptive',
      customInstructions: profile?.custom_instructions || undefined
    },
    keyPeople: keyPeople.map(p => ({
      name: p.name,
      relationship: p.relationship,
      importance: p.importance || undefined
    }))
  };

  // Build knowledge graph layer
  const knowledgeGraph = {
    entities: entities.map(e => {
      const entityFacts = facts.filter(f => f.entity_id === e.id);
      return {
        id: e.id,
        name: e.name,
        aliases: e.aliases || undefined,
        type: mapEntityType(e.entity_type),
        facts: entityFacts.map(f => ({
          predicate: f.predicate,
          object: f.object_text,
          confidence: f.confidence || undefined,
          source: f.source_note_id || undefined
        })),
        scores: {
          importance: e.importance_score || undefined,
          mentionCount: e.mention_count || undefined,
          sentiment: e.sentiment_average || undefined,
          lastMentioned: e.updated_at || undefined
        },
        summary: e.summary || undefined,
        privacyLevel: mapPrivacyLevel(e.privacy_level)
      };
    }),
    relationships: relationships.map(r => ({
      subject: r.source_entity_id || r.entity_a,
      predicate: r.relationship_type || r.predicate,
      object: r.target_entity_id || r.entity_b,
      strength: r.strength || undefined,
      bidirectional: r.bidirectional || false
    })),
    coOccurrences: entityLinks.map(l => ({
      entityA: l.entity_a,
      entityB: l.entity_b,
      count: l.strength || 1,
      contexts: l.context ? [l.context] : undefined
    }))
  };

  // Build episodes layer
  const episodes = {
    notes: notes.map(n => ({
      id: n.id,
      content: n.content || undefined,
      contentEncrypted: n.content_encrypted || undefined,
      timestamp: n.created_at,
      category: n.category || undefined,
      tags: n.tags || undefined,
      entityMentions: n.entity_mentions || undefined,
      sentiment: n.sentiment || undefined,
      isDistilled: n.is_distilled || false,
      distilledSummary: n.distilled_summary || undefined,
      source: n.note_type === 'meeting' ? 'meeting' : n.note_type === 'voice' ? 'voice' : 'manual'
    })),
    conversations: conversations.map(c => ({
      id: c.id,
      title: c.title || undefined,
      startedAt: c.created_at,
      endedAt: c.updated_at || undefined,
      messages: (c.messages || []).map(m => ({
        role: m.role,
        content: m.content || undefined,
        contentEncrypted: m.content_encrypted || undefined,
        timestamp: m.created_at
      })),
      summary: c.summary || undefined,
      keyInsights: c.key_insights || undefined,
      entityMentions: c.entity_mentions || undefined
    })),
    meetings: meetings.map(m => ({
      id: m.id,
      title: m.title || undefined,
      date: m.meeting_date,
      attendees: m.attendees || undefined,
      topics: m.topics || [],
      notes: m.notes || undefined,
      notesEncrypted: m.notes_encrypted || undefined,
      actionItems: m.action_items || [],
      decisions: m.decisions || undefined,
      source: m.source || 'manual'
    }))
  };

  // Build patterns array
  const pampPatterns = patterns.map(p => ({
    id: p.id,
    type: mapPatternType(p.pattern_type),
    description: p.description,
    confidence: p.confidence || 0.5,
    evidence: p.evidence?.note_ids || undefined,
    observedCount: p.observed_count || undefined,
    firstObserved: p.created_at,
    lastObserved: p.updated_at,
    status: p.status || 'active'
  }));

  // Add behaviors as behavioral patterns
  for (const b of behaviors) {
    pampPatterns.push({
      type: 'behavioral',
      description: `${b.predicate.replace(/_/g, ' ')} ${b.entity_name}${b.topic ? ` (${b.topic})` : ''}`,
      confidence: b.confidence || 0.5,
      firstObserved: b.first_detected_at,
      lastObserved: b.last_reinforced_at,
      status: 'active'
    });
  }

  // Build summaries layer
  const summaries = {
    byCategory: {},
    overall: undefined,
    recentContext: undefined,
    behavioralProfile: undefined
  };

  for (const s of categorySummaries) {
    if (s.category === 'behavioral_profile') {
      summaries.behavioralProfile = s.summary;
    } else {
      summaries.byCategory[s.category] = {
        summary: s.summary,
        entityCount: s.entity_count || undefined,
        noteCount: s.note_count || undefined,
        lastUpdated: s.updated_at
      };
    }
  }

  // Build meta
  const timestamps = notes
    .map(n => new Date(n.created_at))
    .filter(d => !isNaN(d));

  const totalMessages = conversations.reduce(
    (sum, c) => sum + (c.messages?.length || 0),
    0
  );

  const meta = {
    exportedAt: new Date().toISOString(),
    source: {
      application: 'inscript',
      version: '9.12.0'
    },
    counts: {
      entities: entities.length,
      facts: facts.length,
      notes: notes.length,
      conversations: conversations.length,
      meetings: meetings.length,
      patterns: pampPatterns.length
    },
    dateRange: timestamps.length ? {
      earliest: new Date(Math.min(...timestamps)).toISOString(),
      latest: new Date(Math.max(...timestamps)).toISOString()
    } : undefined
  };

  // Assemble full PAMP document
  return {
    "@context": PAMP_CONTEXT,
    version: PAMP_VERSION,
    identity,
    knowledgeGraph,
    episodes,
    patterns: pampPatterns,
    summaries,
    meta
  };
}

/**
 * Map internal privacy level to PAMP privacy level
 */
function mapPrivacyLevel(level) {
  const map = {
    'public': 'public',
    'internal': 'private',
    'private': 'private',
    'sensitive': 'sensitive',
    'confidential': 'sensitive'
  };
  return map[level?.toLowerCase()] || 'private';
}

/**
 * Map internal pattern type to PAMP pattern type
 */
function mapPatternType(type) {
  const map = {
    'behavioral': 'behavioral',
    'behavior': 'behavioral',
    'emotional': 'emotional',
    'emotion': 'emotional',
    'cognitive': 'cognitive',
    'thinking': 'cognitive',
    'social': 'social',
    'relationship': 'social',
    'temporal': 'temporal',
    'time': 'temporal',
    'preference': 'preference',
    'habit': 'behavioral'
  };
  return map[type?.toLowerCase()] || 'behavioral';
}

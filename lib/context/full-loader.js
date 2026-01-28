/**
 * FULL CONTEXT LOADER
 *
 * Phase 2 - Post-RAG Architecture
 *
 * Loads the ENTIRE user memory into a structured object.
 * No chunking. No embeddings. No retrieval.
 * Just give the AI everything and let it navigate.
 *
 * OWNER: T2 (Data Layer)
 * CONSUMERS: /api/context/full.js, MIRROR
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Load complete user memory
 * @param {string} userId
 * @param {object} options - Loading options
 * @param {object} supabase - Supabase client (optional, will create if not provided)
 * @returns {Promise<object>} Complete user memory
 */
export async function loadFullContext(userId, options = {}, supabase = null) {
  const {
    includeNoteContent = false,  // E2E encrypted - usually false server-side
    noteLimit = 500,             // Max notes to include
    entityLimit = 200,           // Max entities
    conversationLimit = 50,      // Max MIRROR conversations
    patternMinConfidence = 0.6,  // Min confidence for patterns
    behaviorMinConfidence = 0.5, // Min confidence for behaviors
  } = options;

  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );
  }

  const startTime = Date.now();
  const timings = {};

  // Helper to time queries
  const timeQuery = async (name, fn) => {
    const start = Date.now();
    const result = await fn();
    timings[name] = Date.now() - start;
    return result;
  };

  // Load all data in parallel
  const [
    identity,
    entities,
    facts,
    entityLinks,
    behaviors,
    entityQualities,
    patterns,
    categorySummaries,
    notes,
    conversations,
    meetings
  ] = await Promise.all([
    timeQuery('identity', () => loadIdentity(userId, supabase)),
    timeQuery('entities', () => loadEntities(userId, entityLimit, supabase)),
    timeQuery('facts', () => loadFacts(userId, supabase)),
    timeQuery('entityLinks', () => loadEntityLinks(userId, supabase)),
    timeQuery('behaviors', () => loadBehaviors(userId, behaviorMinConfidence, supabase)),
    timeQuery('entityQualities', () => loadEntityQualities(userId, behaviorMinConfidence, supabase)),
    timeQuery('patterns', () => loadPatterns(userId, patternMinConfidence, supabase)),
    timeQuery('categorySummaries', () => loadCategorySummaries(userId, supabase)),
    timeQuery('notes', () => loadNotes(userId, noteLimit, includeNoteContent, supabase)),
    timeQuery('conversations', () => loadConversations(userId, conversationLimit, supabase)),
    timeQuery('meetings', () => loadMeetings(userId, supabase))
  ]);

  // Build entity map for quick lookups
  const entityMap = new Map(entities.map(e => [e.id, e]));

  // Attach facts to entities
  for (const fact of facts) {
    const entity = entityMap.get(fact.entity_id);
    if (entity) {
      if (!entity.facts) entity.facts = [];
      entity.facts.push({
        predicate: fact.predicate,
        object: fact.object_text,
        confidence: fact.confidence
      });
    }
  }

  // Attach behaviors to entities
  for (const behavior of behaviors) {
    if (behavior.entity_id) {
      const entity = entityMap.get(behavior.entity_id);
      if (entity) {
        if (!entity.userBehaviors) entity.userBehaviors = [];
        entity.userBehaviors.push({
          predicate: behavior.predicate,
          topic: behavior.topic,
          sentiment: behavior.sentiment,
          confidence: behavior.confidence
        });
      }
    }
  }

  // Attach qualities to entities
  for (const quality of entityQualities) {
    if (quality.entity_id) {
      const entity = entityMap.get(quality.entity_id);
      if (entity) {
        if (!entity.qualities) entity.qualities = [];
        entity.qualities.push({
          predicate: quality.predicate,
          object: quality.object,
          confidence: quality.confidence
        });
      }
    }
  }

  const totalTime = Date.now() - startTime;

  return {
    userId,
    loadedAt: new Date().toISOString(),

    // Layer 1: Identity
    identity,

    // Layer 2: Knowledge Graph
    knowledgeGraph: {
      entities: Array.from(entityMap.values()),
      relationships: entityLinks,
      entityCount: entities.length,
      factCount: facts.length,
      linkCount: entityLinks.length
    },

    // Layer 3: Episodes
    episodes: {
      notes,
      conversations,
      meetings,
      noteCount: notes.length,
      conversationCount: conversations.length,
      meetingCount: meetings.length
    },

    // Layer 4: Procedural Memory
    procedural: {
      behaviors,
      entityQualities,
      patterns,
      categorySummaries,
      behaviorCount: behaviors.length,
      qualityCount: entityQualities.length,
      patternCount: patterns.length
    },

    // Meta
    meta: {
      timings,
      totalLoadTime: totalTime,
      options: {
        noteLimit,
        entityLimit,
        conversationLimit,
        patternMinConfidence,
        behaviorMinConfidence
      }
    }
  };
}

/**
 * Load user identity (profile, onboarding, key people)
 */
async function loadIdentity(userId, supabase) {
  const [profileResult, onboardingResult, keyPeopleResult, prefsResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('onboarding_data')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_key_people')
      .select('name, relationship, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('memory_preferences')
      .select('custom_instructions, tone')
      .eq('user_id', userId)
      .maybeSingle()
  ]);

  const profile = profileResult.data || {};
  const onboarding = onboardingResult.data || {};
  const keyPeople = keyPeopleResult.data || [];
  const prefs = prefsResult.data || {};

  return {
    name: onboarding.name || profile.name || null,
    role: onboarding.role_type || null,
    selfDescription: onboarding.depth_answer || null,
    goals: onboarding.goals || [],
    lifeContext: onboarding.life_seasons || [],
    boundaries: onboarding.boundaries || [],
    communication: {
      tone: prefs.tone || onboarding.tone || 'warm',
      customInstructions: prefs.custom_instructions || null
    },
    keyPeople: keyPeople.map(p => ({
      name: p.name,
      relationship: p.relationship
    }))
  };
}

/**
 * Load entities ordered by importance
 */
async function loadEntities(userId, limit, supabase) {
  const { data, error } = await supabase
    .from('user_entities')
    .select(`
      id, name, entity_type, relationship, summary,
      importance_score, sentiment_average, mention_count,
      is_historical, effective_from, expires_at,
      created_at, updated_at
    `)
    .eq('user_id', userId)
    .order('importance_score', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('[full-loader] Error loading entities:', error.code);
    return [];
  }

  return (data || []).map(e => ({
    id: e.id,
    name: e.name,
    type: e.entity_type,
    relationship: e.relationship,
    summary: e.summary,
    importance: e.importance_score || 0,
    sentiment: e.sentiment_average || 0,
    mentions: e.mention_count || 0,
    isHistorical: e.is_historical || false,
    temporal: {
      firstSeen: e.created_at,
      lastSeen: e.updated_at,
      validFrom: e.effective_from,
      validUntil: e.expires_at
    },
    facts: [],         // Will be populated
    userBehaviors: [], // Will be populated
    qualities: []      // Will be populated
  }));
}

/**
 * Load all entity facts
 */
async function loadFacts(userId, supabase) {
  const { data, error } = await supabase
    .from('entity_facts')
    .select('entity_id, predicate, object_text, confidence')
    .eq('user_id', userId)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[full-loader] Error loading facts:', error.code);
    return [];
  }

  return data || [];
}

/**
 * Load entity links (co-occurrences)
 */
async function loadEntityLinks(userId, supabase) {
  const { data, error } = await supabase
    .from('entity_links')
    .select('entity_a, entity_b, strength, context, last_seen')
    .eq('user_id', userId)
    .order('strength', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[full-loader] Error loading entity links:', error.code);
    return [];
  }

  return (data || []).map(link => ({
    entityA: link.entity_a,
    entityB: link.entity_b,
    strength: link.strength,
    context: link.context,
    lastSeen: link.last_seen
  }));
}

/**
 * Load user behaviors
 */
async function loadBehaviors(userId, minConfidence, supabase) {
  const { data, error } = await supabase
    .from('user_behaviors')
    .select(`
      predicate, entity_id, entity_name, topic, sentiment,
      confidence, reinforcement_count, first_detected_at, last_reinforced_at
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('confidence', minConfidence)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[full-loader] Error loading behaviors:', error.code);
    return [];
  }

  return (data || []).map(b => ({
    predicate: b.predicate,
    entityId: b.entity_id,
    entityName: b.entity_name,
    topic: b.topic,
    sentiment: b.sentiment,
    confidence: b.confidence,
    reinforcements: b.reinforcement_count,
    firstDetected: b.first_detected_at,
    lastReinforced: b.last_reinforced_at
  }));
}

/**
 * Load entity qualities
 */
async function loadEntityQualities(userId, minConfidence, supabase) {
  const { data, error } = await supabase
    .from('entity_qualities')
    .select(`
      entity_id, entity_name, predicate, object,
      confidence, reinforcement_count, first_detected_at, last_reinforced_at
    `)
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('confidence', minConfidence)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[full-loader] Error loading entity qualities:', error.code);
    return [];
  }

  return (data || []).map(q => ({
    entityId: q.entity_id,
    entityName: q.entity_name,
    predicate: q.predicate,
    object: q.object,
    confidence: q.confidence,
    reinforcements: q.reinforcement_count,
    firstDetected: q.first_detected_at,
    lastReinforced: q.last_reinforced_at
  }));
}

/**
 * Load patterns
 */
async function loadPatterns(userId, minConfidence, supabase) {
  const { data, error } = await supabase
    .from('user_patterns')
    .select('pattern_type, description, short_description, confidence, category, created_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gte('confidence', minConfidence)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('[full-loader] Error loading patterns:', error.code);
    return [];
  }

  return (data || []).map(p => ({
    type: p.pattern_type,
    description: p.short_description || p.description,
    fullDescription: p.description,
    confidence: p.confidence,
    category: p.category,
    detectedAt: p.created_at
  }));
}

/**
 * Load category summaries
 */
async function loadCategorySummaries(userId, supabase) {
  const { data, error } = await supabase
    .from('category_summaries')
    .select('category, summary, entity_count, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[full-loader] Error loading category summaries:', error.code);
    return [];
  }

  return (data || []).map(s => ({
    category: s.category,
    summary: s.summary,
    entityCount: s.entity_count,
    updatedAt: s.updated_at
  }));
}

/**
 * Load notes (metadata only by default - content is E2E encrypted)
 */
async function loadNotes(userId, limit, includeContent, supabase) {
  const fields = includeContent
    ? 'id, title, content, note_type, category, created_at, is_distilled, distilled_summary'
    : 'id, title, note_type, category, created_at, is_distilled, distilled_summary';

  const { data, error } = await supabase
    .from('notes')
    .select(fields)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[full-loader] Error loading notes:', error.code);
    return [];
  }

  return (data || []).map(n => ({
    id: n.id,
    title: n.title,
    content: includeContent ? n.content : undefined,
    type: n.note_type,
    category: n.category,
    createdAt: n.created_at,
    isDistilled: n.is_distilled,
    distilledSummary: n.distilled_summary
  }));
}

/**
 * Load MIRROR conversations with message summaries
 */
async function loadConversations(userId, limit, supabase) {
  const { data: conversations, error } = await supabase
    .from('mirror_conversations')
    .select('id, status, summary, key_insights, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[full-loader] Error loading conversations:', error.code);
    return [];
  }

  if (!conversations?.length) return [];

  // Get message counts per conversation
  const conversationIds = conversations.map(c => c.id);
  const { data: messageCounts } = await supabase
    .from('mirror_messages')
    .select('conversation_id')
    .in('conversation_id', conversationIds);

  const countMap = {};
  for (const msg of (messageCounts || [])) {
    countMap[msg.conversation_id] = (countMap[msg.conversation_id] || 0) + 1;
  }

  return conversations.map(c => ({
    id: c.id,
    status: c.status,
    summary: c.summary,
    keyInsights: c.key_insights,
    messageCount: countMap[c.id] || 0,
    startedAt: c.created_at,
    lastActivity: c.updated_at
  }));
}

/**
 * Load meetings
 */
async function loadMeetings(userId, supabase) {
  const { data, error } = await supabase
    .from('meeting_history')
    .select('id, entity_id, meeting_date, topics, sentiment, action_items')
    .eq('user_id', userId)
    .order('meeting_date', { ascending: false })
    .limit(100);

  if (error) {
    console.error('[full-loader] Error loading meetings:', error.code);
    return [];
  }

  return (data || []).map(m => ({
    id: m.id,
    entityId: m.entity_id,
    date: m.meeting_date,
    topics: m.topics,
    sentiment: m.sentiment,
    actionItems: m.action_items
  }));
}

/**
 * Estimate token count for the loaded context
 * Rough estimate: 1 token ≈ 4 characters
 */
export function estimateTokenCount(context) {
  const json = JSON.stringify(context);
  return Math.ceil(json.length / 4);
}

export default { loadFullContext, estimateTokenCount };

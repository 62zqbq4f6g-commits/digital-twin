/**
 * BI-TEMPORAL FACT MANAGEMENT
 *
 * Utilities for temporal knowledge queries:
 * - Point-in-time queries ("what did I know on date X?")
 * - Fact history ("how did this fact evolve?")
 * - Contradiction detection
 * - Manual invalidation
 *
 * @module lib/knowledge/temporal-facts
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client
 */
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  );
}

/**
 * Get facts as they were known at a specific point in time
 *
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @param {Date|string} asOf - Point in time to query
 * @returns {Promise<Array>} Facts that were current at that time
 *
 * @example
 * // What did I know about Marcus on November 15?
 * const facts = await getFactsAtTime(userId, marcusId, '2025-11-15');
 */
export async function getFactsAtTime(userId, entityId, asOf) {
  const supabase = getSupabase();
  const timestamp = new Date(asOf).toISOString();

  const { data, error } = await supabase.rpc('get_facts_at_time', {
    p_user_id: userId,
    p_entity_id: entityId,
    p_as_of: timestamp
  });

  if (error) {
    console.error('[temporal-facts] getFactsAtTime error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get the full history of a specific fact (all versions)
 *
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @param {string} predicate - The predicate to get history for
 * @returns {Promise<Array>} All versions of this fact, newest first
 *
 * @example
 * // How has Marcus's employer changed over time?
 * const history = await getFactHistory(userId, marcusId, 'works_at');
 * // Returns: [
 * //   { object_text: 'Anthropic', version: 2, valid_from: '2025-12-01', is_current: true },
 * //   { object_text: 'Google', version: 1, valid_from: '2025-06-01', invalidated_at: '2025-12-01' }
 * // ]
 */
export async function getFactHistory(userId, entityId, predicate) {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('get_fact_history', {
    p_user_id: userId,
    p_entity_id: entityId,
    p_predicate: predicate
  });

  if (error) {
    console.error('[temporal-facts] getFactHistory error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Get all current (non-invalidated) facts for an entity
 *
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @returns {Promise<Array>} Current facts
 */
export async function getCurrentFacts(userId, entityId) {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('get_current_facts', {
    p_user_id: userId,
    p_entity_id: entityId
  });

  if (error) {
    console.error('[temporal-facts] getCurrentFacts error:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Manually invalidate a fact (for user corrections)
 *
 * @param {string} factId - Fact ID to invalidate
 * @param {string} reason - Reason for invalidation
 * @param {Date|string} validTo - When the fact stopped being true
 * @returns {Promise<boolean>} Success
 */
export async function invalidateFact(factId, reason = 'user_corrected', validTo = new Date()) {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('invalidate_fact', {
    p_fact_id: factId,
    p_reason: reason,
    p_valid_to: new Date(validTo).toISOString()
  });

  if (error) {
    console.error('[temporal-facts] invalidateFact error:', error.message);
    return false;
  }

  return data === true;
}

/**
 * Create a new fact with temporal metadata
 *
 * @param {object} supabase - Supabase client
 * @param {object} fact - Fact data
 * @param {string} fact.userId - User ID
 * @param {string} fact.entityId - Entity ID
 * @param {string} fact.predicate - Predicate (e.g., 'works_at')
 * @param {string} fact.objectText - Object value (e.g., 'Anthropic')
 * @param {number} fact.confidence - Confidence score 0-1
 * @param {string} fact.sourceType - Source type (note, mirror, etc.)
 * @param {string} fact.sourceId - Source record ID
 * @param {Date|string} fact.validFrom - When the fact became true (defaults to now)
 * @returns {Promise<object|null>} Created fact or null
 */
export async function createFactWithTemporal(supabase, fact) {
  const {
    userId,
    entityId,
    predicate,
    objectText,
    confidence = 0.7,
    sourceType = 'note',
    sourceId = null,
    validFrom = new Date()
  } = fact;

  const { data, error } = await supabase
    .from('entity_facts')
    .insert({
      user_id: userId,
      entity_id: entityId,
      predicate: predicate,
      object_text: objectText,
      confidence: confidence,
      source_type: sourceType,
      source_id: sourceId,
      valid_from: new Date(validFrom).toISOString(),
      first_mentioned: new Date().toISOString(),
      last_mentioned: new Date().toISOString(),
      mention_count: 1,
      status: 'active',
      is_current: true,
      version: 1  // Trigger will update if contradiction found
    })
    .select()
    .single();

  if (error) {
    console.error('[temporal-facts] createFactWithTemporal error:', error.message);
    return null;
  }

  return data;
}

/**
 * Get a timeline of an entity's knowledge evolution
 *
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @returns {Promise<Array>} Timeline of fact changes
 */
export async function getEntityTimeline(userId, entityId) {
  const supabase = getSupabase();

  // Get all facts for this entity, including invalidated ones
  const { data, error } = await supabase
    .from('entity_facts')
    .select('*')
    .eq('user_id', userId)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[temporal-facts] getEntityTimeline error:', error.message);
    return [];
  }

  // Build timeline events
  const timeline = [];

  for (const fact of data || []) {
    // Fact creation event
    timeline.push({
      type: 'fact_created',
      timestamp: fact.created_at,
      predicate: fact.predicate,
      object: fact.object_text,
      confidence: fact.confidence,
      version: fact.version,
      factId: fact.id
    });

    // Fact invalidation event (if applicable)
    if (fact.invalidated_at) {
      timeline.push({
        type: 'fact_invalidated',
        timestamp: fact.invalidated_at,
        predicate: fact.predicate,
        object: fact.object_text,
        reason: fact.invalidation_reason,
        supersededBy: fact.invalidated_by,
        factId: fact.id
      });
    }
  }

  // Sort by timestamp
  return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

/**
 * Compare knowledge state between two points in time
 *
 * @param {string} userId - User ID
 * @param {string} entityId - Entity ID
 * @param {Date|string} time1 - First point in time
 * @param {Date|string} time2 - Second point in time
 * @returns {Promise<object>} Diff showing added, removed, and changed facts
 */
export async function compareKnowledgeAtTimes(userId, entityId, time1, time2) {
  const [facts1, facts2] = await Promise.all([
    getFactsAtTime(userId, entityId, time1),
    getFactsAtTime(userId, entityId, time2)
  ]);

  // Create maps for comparison
  const map1 = new Map(facts1.map(f => [`${f.predicate}:${f.object_text}`, f]));
  const map2 = new Map(facts2.map(f => [`${f.predicate}:${f.object_text}`, f]));

  const added = [];
  const removed = [];
  const changed = [];

  // Find added facts (in time2 but not time1)
  for (const [key, fact] of map2) {
    if (!map1.has(key)) {
      // Check if this is a change (same predicate, different object)
      const samePredicateFact = facts1.find(f => f.predicate === fact.predicate);
      if (samePredicateFact) {
        changed.push({
          predicate: fact.predicate,
          from: samePredicateFact.object_text,
          to: fact.object_text
        });
      } else {
        added.push(fact);
      }
    }
  }

  // Find removed facts (in time1 but not time2)
  for (const [key, fact] of map1) {
    if (!map2.has(key)) {
      // Skip if this was part of a "changed" entry
      const wasChanged = changed.find(c => c.predicate === fact.predicate);
      if (!wasChanged) {
        removed.push(fact);
      }
    }
  }

  return {
    time1: new Date(time1).toISOString(),
    time2: new Date(time2).toISOString(),
    added,
    removed,
    changed
  };
}

/**
 * Predicates that are single-value (contradiction detection applies)
 */
export const SINGLE_VALUE_PREDICATES = [
  'works_at',
  'lives_in',
  'job_title',
  'reports_to',
  'married_to',
  'dating',
  'age',
  'birthday',
  'company',
  'role',
  'location',
  'employer',
  'email',
  'phone'
];

/**
 * Check if a predicate allows multiple values
 * @param {string} predicate
 * @returns {boolean}
 */
export function isMultiValuePredicate(predicate) {
  return !SINGLE_VALUE_PREDICATES.includes(predicate.toLowerCase());
}

export default {
  getFactsAtTime,
  getFactHistory,
  getCurrentFacts,
  invalidateFact,
  createFactWithTemporal,
  getEntityTimeline,
  compareKnowledgeAtTimes,
  isMultiValuePredicate,
  SINGLE_VALUE_PREDICATES
};

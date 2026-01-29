/**
 * KNOWLEDGE GRAPH STORAGE
 *
 * Persists extracted knowledge with deduplication and merging.
 * Handles entities, relationships, topics, and behaviors.
 *
 * @module lib/extraction/knowledge-store
 */

import { createClient } from '@supabase/supabase-js';

/**
 * Get Supabase client
 * Uses service role key for server-side operations
 */
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  );
}

/**
 * Store extracted knowledge in the database
 *
 * @param {string} userId - User ID
 * @param {object} extraction - Extraction result from extractor
 * @param {object} options - Storage options
 * @param {string} options.sourceType - Source type (note, mirror, meeting)
 * @param {string} options.sourceId - Source record ID
 * @param {object} options.supabase - Optional Supabase client
 * @returns {Promise<object>} Storage results
 */
export async function storeExtraction(userId, extraction, options = {}) {
  const { sourceType = 'note', sourceId = null, supabase: providedSupabase } = options;
  const supabase = providedSupabase || getSupabaseClient();

  const results = {
    entitiesCreated: 0,
    entitiesUpdated: 0,
    factsCreated: 0,
    factsUpdated: 0,
    topicsCreated: 0,
    topicsUpdated: 0,
    behaviorsCreated: 0,
    behaviorsUpdated: 0,
    linksCreated: 0
  };

  // Map to track entity names -> IDs for relationship creation
  const entityMap = new Map();

  try {
    // 1. Store entities
    for (const entity of extraction.entities || []) {
      const result = await upsertEntity(supabase, userId, entity, sourceType);
      if (result) {
        entityMap.set(entity.name.toLowerCase(), result.id);
        if (result.created) {
          results.entitiesCreated++;
        } else {
          results.entitiesUpdated++;
        }
      }
    }

    // 2. Store topics
    for (const topic of extraction.topics || []) {
      const result = await upsertTopic(supabase, userId, topic);
      if (result) {
        if (result.created) {
          results.topicsCreated++;
        } else {
          results.topicsUpdated++;
        }
      }
    }

    // 3. Store relationships as facts
    for (const rel of extraction.relationships || []) {
      const subjectId = entityMap.get(rel.subject.toLowerCase());
      if (subjectId) {
        const result = await upsertFact(supabase, userId, subjectId, rel, sourceType, sourceId);
        if (result) {
          if (result.created) {
            results.factsCreated++;
          } else {
            results.factsUpdated++;
          }
        }
      }
    }

    // 4. Create co-occurrence links between entities mentioned together
    const entityIds = Array.from(entityMap.values());
    if (entityIds.length > 1) {
      const linkCount = await createEntityLinks(supabase, userId, entityIds, sourceType);
      results.linksCreated = linkCount;
    }

    // 5. Store behaviors
    for (const behavior of extraction.behaviors || []) {
      const targetId = behavior.target_entity
        ? entityMap.get(behavior.target_entity.toLowerCase())
        : null;
      const targetName = behavior.target_entity || null;

      const result = await upsertBehavior(supabase, userId, behavior, targetId, targetName, sourceType, sourceId);
      if (result) {
        if (result.created) {
          results.behaviorsCreated++;
        } else {
          results.behaviorsUpdated++;
        }
      }
    }

    console.log('[KNOWLEDGE-STORE] Storage complete:', results);
    return results;

  } catch (error) {
    console.error('[KNOWLEDGE-STORE] Error:', error.message);
    return results;
  }
}

/**
 * Upsert an entity (create if new, update if exists)
 */
async function upsertEntity(supabase, userId, entity, sourceType) {
  try {
    // Check for existing entity (case-insensitive)
    const { data: existing } = await supabase
      .from('user_entities')
      .select('id, mention_count, importance_score')
      .eq('user_id', userId)
      .ilike('name', entity.name.trim())
      .single();

    if (existing) {
      // Update existing entity
      const newMentionCount = (existing.mention_count || 0) + 1;
      const newImportance = Math.min(1.0, (existing.importance_score || 0.5) + 0.02);

      await supabase
        .from('user_entities')
        .update({
          mention_count: newMentionCount,
          last_mentioned: new Date().toISOString(),
          importance_score: newImportance,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      return { id: existing.id, created: false };
    }

    // Create new entity
    const { data: newEntity, error } = await supabase
      .from('user_entities')
      .insert({
        user_id: userId,
        name: entity.name.trim(),
        entity_type: entity.type,
        subtype: entity.subtype || null,
        summary: entity.context || null,
        mention_count: 1,
        importance_score: entity.confidence || 0.5,
        first_mentioned: new Date().toISOString(),
        last_mentioned: new Date().toISOString(),
        status: 'active'
      })
      .select('id')
      .single();

    if (error) {
      console.error('[KNOWLEDGE-STORE] Entity insert error:', error.message);
      return null;
    }

    return { id: newEntity.id, created: true };

  } catch (error) {
    console.error('[KNOWLEDGE-STORE] Entity upsert error:', error.message);
    return null;
  }
}

/**
 * Upsert a topic
 */
async function upsertTopic(supabase, userId, topic) {
  try {
    const normalized = topic.name.trim().toLowerCase();

    // Check for existing topic
    const { data: existing } = await supabase
      .from('user_topics')
      .select('id, mention_count')
      .eq('user_id', userId)
      .eq('normalized_name', normalized)
      .single();

    if (existing) {
      // Update existing topic
      await supabase
        .from('user_topics')
        .update({
          mention_count: (existing.mention_count || 0) + 1,
          last_mentioned: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      return { id: existing.id, created: false };
    }

    // Create new topic
    const { data: newTopic, error } = await supabase
      .from('user_topics')
      .insert({
        user_id: userId,
        name: topic.name.trim(),
        normalized_name: normalized,
        description: topic.context || null,
        importance_score: topic.confidence || 0.5,
        mention_count: 1
      })
      .select('id')
      .single();

    if (error) {
      // Might be unique constraint violation from race condition
      if (error.code === '23505') {
        // Fetch the existing one
        const { data: existing } = await supabase
          .from('user_topics')
          .select('id')
          .eq('user_id', userId)
          .eq('normalized_name', normalized)
          .single();
        return existing ? { id: existing.id, created: false } : null;
      }
      console.error('[KNOWLEDGE-STORE] Topic insert error:', error.message);
      return null;
    }

    return { id: newTopic.id, created: true };

  } catch (error) {
    console.error('[KNOWLEDGE-STORE] Topic upsert error:', error.message);
    return null;
  }
}

/**
 * Upsert a fact (relationship)
 */
async function upsertFact(supabase, userId, entityId, rel, sourceType, sourceId) {
  try {
    // Check for existing fact
    const { data: existing } = await supabase
      .from('entity_facts')
      .select('id, mention_count, confidence')
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .eq('predicate', rel.predicate)
      .ilike('object_text', rel.object)
      .single();

    if (existing) {
      // Update existing fact - increase confidence and mention count
      const newConfidence = Math.min(1.0, (existing.confidence || 0.7) + 0.02);

      await supabase
        .from('entity_facts')
        .update({
          mention_count: (existing.mention_count || 0) + 1,
          last_mentioned: new Date().toISOString(),
          confidence: newConfidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      return { id: existing.id, created: false };
    }

    // Create new fact
    const { data: newFact, error } = await supabase
      .from('entity_facts')
      .insert({
        user_id: userId,
        entity_id: entityId,
        predicate: rel.predicate,
        object_text: rel.object,
        confidence: rel.confidence || 0.7,
        source_type: sourceType,
        source_id: sourceId,
        mention_count: 1,
        first_mentioned: new Date().toISOString(),
        last_mentioned: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      console.error('[KNOWLEDGE-STORE] Fact insert error:', error.message);
      return null;
    }

    return { id: newFact.id, created: true };

  } catch (error) {
    console.error('[KNOWLEDGE-STORE] Fact upsert error:', error.message);
    return null;
  }
}

/**
 * Create co-occurrence links between entities
 */
async function createEntityLinks(supabase, userId, entityIds, sourceType) {
  let linksCreated = 0;

  // Create links between all pairs of entities
  for (let i = 0; i < entityIds.length; i++) {
    for (let j = i + 1; j < entityIds.length; j++) {
      // Sort IDs to ensure consistent ordering
      const [entityA, entityB] = [entityIds[i], entityIds[j]].sort();

      try {
        // Check for existing link
        const { data: existing } = await supabase
          .from('entity_links')
          .select('id, strength')
          .eq('user_id', userId)
          .eq('entity_a', entityA)
          .eq('entity_b', entityB)
          .single();

        if (existing) {
          // Update strength
          await supabase
            .from('entity_links')
            .update({
              strength: (existing.strength || 1) + 1,
              last_seen: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          // Create new link
          await supabase
            .from('entity_links')
            .insert({
              user_id: userId,
              entity_a: entityA,
              entity_b: entityB,
              relationship_type: 'co_occurred',
              strength: 1,
              context: `Co-mentioned in ${sourceType}`
            });
          linksCreated++;
        }
      } catch (error) {
        // Ignore duplicate key errors
        if (!error.message?.includes('duplicate')) {
          console.error('[KNOWLEDGE-STORE] Link error:', error.message);
        }
      }
    }
  }

  return linksCreated;
}

/**
 * Upsert a behavior
 */
async function upsertBehavior(supabase, userId, behavior, targetEntityId, targetEntityName, sourceType, sourceId) {
  try {
    // Check for existing behavior
    const query = supabase
      .from('user_behaviors')
      .select('id, confidence, reinforcement_count')
      .eq('user_id', userId)
      .eq('predicate', behavior.type);

    if (targetEntityId) {
      query.eq('entity_id', targetEntityId);
    }

    if (behavior.topic) {
      query.eq('topic', behavior.topic);
    }

    const { data: existing } = await query.single();

    if (existing) {
      // Reinforce existing behavior
      const newConfidence = Math.min(1.0, (existing.confidence || 0.7) + 0.05);

      await supabase
        .from('user_behaviors')
        .update({
          confidence: newConfidence,
          reinforcement_count: (existing.reinforcement_count || 1) + 1,
          last_reinforced_at: new Date().toISOString(),
          evidence: behavior.evidence || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      return { id: existing.id, created: false };
    }

    // Create new behavior
    const { data: newBehavior, error } = await supabase
      .from('user_behaviors')
      .insert({
        user_id: userId,
        predicate: behavior.type,
        entity_id: targetEntityId,
        entity_name: targetEntityName || behavior.target_entity || 'unknown',
        topic: behavior.topic || null,
        evidence: behavior.evidence || null,
        confidence: behavior.confidence || 0.6,
        source_type: sourceType,
        source_note_id: sourceId,
        reinforcement_count: 1,
        status: 'active'
      })
      .select('id')
      .single();

    if (error) {
      console.error('[KNOWLEDGE-STORE] Behavior insert error:', error.message);
      return null;
    }

    return { id: newBehavior.id, created: true };

  } catch (error) {
    console.error('[KNOWLEDGE-STORE] Behavior upsert error:', error.message);
    return null;
  }
}

/**
 * Get existing entities for a user (for context in extraction)
 */
export async function getExistingEntities(userId, limit = 50) {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, importance_score')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('importance_score', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[KNOWLEDGE-STORE] Error fetching entities:', error.message);
    return [];
  }

  return data || [];
}

export default {
  storeExtraction,
  getExistingEntities
};

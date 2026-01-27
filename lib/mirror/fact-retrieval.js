// /lib/mirror/fact-retrieval.js
// Optimized fact retrieval for MIRROR context
// OWNER: T2
// CONSUMERS: T1 (api/mirror.js)

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

/**
 * Get facts relevant to the current MIRROR conversation
 *
 * @param {string} user_id - User ID
 * @param {string} userMessage - Current user message
 * @param {Array} recentMessages - Recent conversation history
 * @returns {Promise<Object>} Facts organized by entity
 */
async function getRelevantFacts(user_id, userMessage, recentMessages = []) {
  // 1. Get all user's entities (for name matching)
  const { data: entities } = await supabase
    .from('user_entities')
    .select('id, name, entity_type, relationship, importance_score')
    .eq('user_id', user_id);

  if (!entities?.length) return { facts: [], entities: [], factsByEntity: {} };

  // 2. Find mentioned entities in current message
  const mentionedNames = findMentionedNames(userMessage, entities);

  // 3. Find entities mentioned in recent conversation
  const recentMentions = recentMessages
    .flatMap(msg => findMentionedNames(msg.content || '', entities));

  // 4. Combine and dedupe
  const relevantNames = [...new Set([...mentionedNames, ...recentMentions])];

  // 5. Get entity IDs
  let relevantEntities = entities.filter(e => relevantNames.includes(e.name));
  let entityIds = relevantEntities.map(e => e.id);

  if (entityIds.length === 0) {
    // No specific entities mentioned, get top entities by importance
    const topEntities = entities
      .sort((a, b) => (b.importance_score || 0) - (a.importance_score || 0))
      .slice(0, 5);
    entityIds = topEntities.map(e => e.id);
    relevantEntities = topEntities;
  }

  // 6. Fetch facts for relevant entities
  const { data: facts } = await supabase
    .from('entity_facts')
    .select('id, entity_id, predicate, object_text, confidence')
    .eq('user_id', user_id)
    .in('entity_id', entityIds)
    .gte('confidence', 0.6)  // Only reasonably confident facts
    .order('confidence', { ascending: false })
    .limit(50);  // Cap to prevent token explosion

  // 7. Group facts by entity
  const factsByEntity = groupFactsByEntity(facts || [], relevantEntities);

  return {
    facts: facts || [],
    entities: relevantEntities,
    factsByEntity
  };
}

/**
 * Find entity names mentioned in text
 */
function findMentionedNames(text, entities) {
  if (!text) return [];
  return entities
    .filter(e => {
      const nameLower = e.name.toLowerCase();
      // Check for word boundary matches
      const pattern = new RegExp(`\\b${escapeRegex(nameLower)}\\b`, 'i');
      return pattern.test(text);
    })
    .map(e => e.name);
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Group facts by entity with entity info
 */
function groupFactsByEntity(facts, entities) {
  const entityMap = Object.fromEntries(
    entities.map(e => [e.id, e])
  );

  const grouped = {};

  for (const fact of facts) {
    const entity = entityMap[fact.entity_id];
    if (!entity) continue;

    if (!grouped[entity.name]) {
      grouped[entity.name] = {
        entity: {
          name: entity.name,
          type: entity.entity_type,
          relationship: entity.relationship
        },
        facts: []
      };
    }

    grouped[entity.name].facts.push({
      predicate: fact.predicate,
      object: fact.object_text,
      confidence: fact.confidence
    });
  }

  return grouped;
}

/**
 * Find connections between entities (shared facts)
 */
async function findEntityConnections(user_id, entityIds) {
  if (!entityIds || entityIds.length < 2) return [];

  // Get all facts for these entities
  const { data: facts } = await supabase
    .from('entity_facts')
    .select('entity_id, predicate, object_text')
    .eq('user_id', user_id)
    .in('entity_id', entityIds);

  if (!facts?.length) return [];

  // Find shared objects (e.g., same company)
  const byObject = {};
  for (const fact of facts) {
    const key = `${fact.predicate}:${fact.object_text}`;
    if (!byObject[key]) byObject[key] = [];
    byObject[key].push(fact.entity_id);
  }

  // Return connections where 2+ entities share a fact
  const connections = [];
  for (const [key, ids] of Object.entries(byObject)) {
    if (ids.length >= 2) {
      const [predicate, object] = key.split(':');
      connections.push({
        predicate,
        object,
        entityIds: [...new Set(ids)]
      });
    }
  }

  return connections;
}

module.exports = {
  getRelevantFacts,
  findEntityConnections
};

/**
 * Graph Traversal
 *
 * Navigate entity relationships to find connected context.
 * Example: Sarah → works_at Anthropic → others at Anthropic
 *
 * OWNER: T2
 * CONSUMERS: context-loader.js, api/mirror.js
 */

/**
 * Traverse entity relationship graph
 * @param {string} userId
 * @param {string} entityId
 * @param {object} supabase - Supabase client
 * @param {number} depth - How deep to traverse (default 1)
 * @returns {Promise<object>} Entity with connections
 */
export async function traverseGraph(userId, entityId, supabase, depth = 1) {
  const entity = await getEntity(userId, entityId, supabase);
  if (!entity) return null;

  const facts = await getFacts(userId, entityId, supabase);
  const connections = [];

  for (const fact of facts) {
    // Find colleagues at same company
    if (fact.predicate === 'works_at' || fact.predicate === 'company') {
      const colleagues = await findEntitiesByFact(userId, 'works_at', fact.object_text, supabase);
      for (const colleague of colleagues) {
        if (colleague.id !== entityId) {
          connections.push({
            entity: colleague,
            relationship: `also works at ${fact.object_text}`,
            via: fact
          });
        }
      }
    }

    // Direct relationships
    if (['knows', 'friend', 'spouse', 'sibling', 'parent', 'child', 'partner'].includes(fact.predicate)) {
      const related = await findEntityByName(userId, fact.object_text, supabase);
      if (related) {
        connections.push({
          entity: related,
          relationship: fact.predicate,
          via: fact
        });
      }
    }

    // Manager/reports relationships
    if (fact.predicate === 'reports_to' || fact.predicate === 'manager') {
      const manager = await findEntityByName(userId, fact.object_text, supabase);
      if (manager) {
        connections.push({
          entity: manager,
          relationship: 'reports to',
          via: fact
        });
      }
    }

    // Member of same organization
    if (fact.predicate === 'member_of' || fact.predicate === 'belongs_to') {
      const members = await findEntitiesByFact(userId, fact.predicate, fact.object_text, supabase);
      for (const member of members) {
        if (member.id !== entityId) {
          connections.push({
            entity: member,
            relationship: `also member of ${fact.object_text}`,
            via: fact
          });
        }
      }
    }

    // Studied at same place
    if (fact.predicate === 'studied_at' || fact.predicate === 'school') {
      const alumni = await findEntitiesByFact(userId, fact.predicate, fact.object_text, supabase);
      for (const alum of alumni) {
        if (alum.id !== entityId) {
          connections.push({
            entity: alum,
            relationship: `also studied at ${fact.object_text}`,
            via: fact
          });
        }
      }
    }
  }

  // Dedupe connections by entity id
  const seen = new Set();
  const uniqueConnections = connections.filter(conn => {
    if (seen.has(conn.entity.id)) return false;
    seen.add(conn.entity.id);
    return true;
  });

  return {
    entity,
    facts,
    connections: uniqueConnections
  };
}

/**
 * Find all entities connected to a topic
 * @param {string} userId
 * @param {string} topic
 * @param {object} supabase
 * @returns {Promise<Array>} Entities with relevance scores
 */
export async function findEntitiesForTopic(userId, topic, supabase) {
  try {
    // Search notes for topic (by title since content is encrypted)
    const { data: notes } = await supabase
      .from('notes')
      .select('id, title')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .ilike('title', `%${topic}%`)
      .limit(20);

    if (!notes || notes.length === 0) {
      // Fallback: search entities directly
      const { data: directEntities } = await supabase
        .from('user_entities')
        .select('*')
        .eq('user_id', userId)
        .or(`name.ilike.%${topic}%,summary.ilike.%${topic}%`)
        .limit(10);

      return (directEntities || []).map(e => ({
        ...e,
        relevanceScore: 1
      }));
    }

    // Find entities mentioned in those notes
    const { data: entities } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId);

    if (!entities) return [];

    // Score entities by how many topic-notes mention them (in title)
    const entityScores = new Map();

    for (const entity of entities) {
      let score = 0;
      for (const note of notes) {
        if (note.title && note.title.toLowerCase().includes(entity.name.toLowerCase())) {
          score++;
        }
      }

      // Also check if entity name/summary contains topic
      if (entity.name.toLowerCase().includes(topic.toLowerCase())) {
        score += 2;
      }
      if (entity.summary && entity.summary.toLowerCase().includes(topic.toLowerCase())) {
        score += 1;
      }

      if (score > 0) {
        entityScores.set(entity.id, { entity, score });
      }
    }

    // Sort by score and return
    return Array.from(entityScores.values())
      .sort((a, b) => b.score - a.score)
      .map(item => ({
        ...item.entity,
        relevanceScore: item.score
      }));

  } catch (error) {
    console.error('[graph-traversal] Error finding entities for topic:', error.message);
    return [];
  }
}

/**
 * Build relationship context string
 * @param {object} traversalResult - Result from traverseGraph
 * @returns {string} Formatted connections
 */
export function formatConnections(traversalResult) {
  if (!traversalResult || !traversalResult.connections.length) return '';

  let text = 'Related people:\n';
  for (const conn of traversalResult.connections.slice(0, 10)) {
    text += `- ${conn.entity.name}: ${conn.relationship}\n`;
  }
  return text;
}

/**
 * Get entity network — all entities within N hops
 * @param {string} userId
 * @param {string} entityId
 * @param {object} supabase
 * @param {number} maxDepth
 * @returns {Promise<object>} Network graph
 */
export async function getEntityNetwork(userId, entityId, supabase, maxDepth = 2) {
  const visited = new Set();
  const nodes = [];
  const edges = [];

  async function explore(currentId, depth) {
    if (depth > maxDepth || visited.has(currentId)) return;
    visited.add(currentId);

    const result = await traverseGraph(userId, currentId, supabase, 1);
    if (!result) return;

    nodes.push({
      id: result.entity.id,
      name: result.entity.name,
      type: result.entity.entity_type,
      depth
    });

    for (const conn of result.connections) {
      edges.push({
        from: currentId,
        to: conn.entity.id,
        relationship: conn.relationship
      });

      // Recursively explore connections
      if (depth < maxDepth) {
        await explore(conn.entity.id, depth + 1);
      }
    }
  }

  await explore(entityId, 0);

  return { nodes, edges };
}

// ============================================
// PHASE 19: BI-DIRECTIONAL RELATIONSHIP INFERENCE
// ============================================

/**
 * Infer bi-directional relationships from existing facts and behaviors
 * @param {string} userId
 * @param {string} entityId
 * @param {object} supabase
 * @returns {Promise<Array>} Inferred relationships
 */
export async function inferBidirectionalRelationships(userId, entityId, supabase) {
  const inferred = [];
  const entity = await getEntity(userId, entityId, supabase);
  if (!entity) return inferred;

  // 1. Infer from entity_facts: A → predicate → B implies B → inverse → A
  const facts = await getFacts(userId, entityId, supabase);
  const inverseMap = {
    'reports_to': 'manages',
    'manages': 'reports_to',
    'spouse_of': 'spouse_of',
    'married_to': 'married_to',
    'parent_of': 'child_of',
    'child_of': 'parent_of',
    'sibling_of': 'sibling_of',
    'mentor_to': 'mentored_by',
    'mentored_by': 'mentor_to',
    'partner_of': 'partner_of',
    'colleague_of': 'colleague_of'
  };

  for (const fact of facts) {
    const inversePredicate = inverseMap[fact.predicate];
    if (inversePredicate && fact.object_entity_id) {
      inferred.push({
        from_entity_id: fact.object_entity_id,
        from_entity_name: fact.object_text,
        predicate: inversePredicate,
        to_entity_id: entityId,
        to_entity_name: entity.name,
        confidence: fact.confidence * 0.9, // Slightly lower confidence for inferred
        inferred: true,
        source: 'entity_facts_inverse'
      });
    }
  }

  // 2. Infer from entity_links (co-occurrence)
  try {
    const { data: links } = await supabase
      .from('entity_links')
      .select('entity_a, entity_b, strength, context')
      .eq('user_id', userId)
      .or(`entity_a.eq.${entityId},entity_b.eq.${entityId}`);

    for (const link of (links || [])) {
      const otherId = link.entity_a === entityId ? link.entity_b : link.entity_a;
      const { data: otherEntity } = await supabase
        .from('user_entities')
        .select('name')
        .eq('id', otherId)
        .maybeSingle();

      if (otherEntity) {
        inferred.push({
          from_entity_id: entityId,
          from_entity_name: entity.name,
          predicate: 'co_mentioned_with',
          to_entity_id: otherId,
          to_entity_name: otherEntity.name,
          strength: link.strength,
          context: link.context,
          confidence: Math.min(0.9, link.strength / 10), // Scale strength to confidence
          inferred: true,
          source: 'entity_links'
        });
      }
    }
  } catch (error) {
    console.warn('[graph-traversal] Error inferring from entity_links:', error.message);
  }

  // 3. Infer from user_behaviors: User → behavior → Entity
  try {
    const { data: behaviors } = await supabase
      .from('user_behaviors')
      .select('predicate, entity_id, entity_name, topic, confidence')
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .eq('status', 'active');

    const behaviorInverseMap = {
      'trusts_opinion_of': 'is_trusted_by_user_on',
      'seeks_advice_from': 'advises_user_on',
      'relies_on': 'is_relied_upon_by_user',
      'learns_from': 'teaches_user',
      'inspired_by': 'inspires_user',
      'collaborates_with': 'collaborates_with_user'
    };

    for (const behavior of (behaviors || [])) {
      const inverseBehavior = behaviorInverseMap[behavior.predicate];
      if (inverseBehavior) {
        inferred.push({
          entity_id: entityId,
          entity_name: behavior.entity_name,
          predicate: inverseBehavior,
          topic: behavior.topic,
          confidence: behavior.confidence * 0.95,
          inferred: true,
          source: 'user_behaviors_inverse'
        });
      }
    }
  } catch (error) {
    console.warn('[graph-traversal] Error inferring from user_behaviors:', error.message);
  }

  // 4. Infer from entity_qualities: Entity → quality → User
  try {
    const { data: qualities } = await supabase
      .from('entity_qualities')
      .select('predicate, entity_id, entity_name, object, confidence')
      .eq('user_id', userId)
      .eq('entity_id', entityId)
      .eq('status', 'active');

    for (const quality of (qualities || [])) {
      inferred.push({
        entity_id: entityId,
        entity_name: quality.entity_name,
        predicate: quality.predicate,
        object: quality.object,
        confidence: quality.confidence,
        inferred: false, // This is direct, not inferred
        source: 'entity_qualities'
      });
    }
  } catch (error) {
    console.warn('[graph-traversal] Error getting entity_qualities:', error.message);
  }

  return inferred;
}

/**
 * Get full entity profile including inferred relationships
 * @param {string} userId
 * @param {string} entityId
 * @param {object} supabase
 * @returns {Promise<object>} Complete entity profile
 */
export async function getEntityProfile(userId, entityId, supabase) {
  const [entity, facts, inferred] = await Promise.all([
    getEntity(userId, entityId, supabase),
    getFacts(userId, entityId, supabase),
    inferBidirectionalRelationships(userId, entityId, supabase)
  ]);

  if (!entity) return null;

  return {
    entity,
    facts,
    inferred,
    // Merge direct and inferred for easy consumption
    allRelationships: [
      ...facts.map(f => ({
        predicate: f.predicate,
        object: f.object_text,
        confidence: f.confidence,
        inferred: false
      })),
      ...inferred.map(i => ({
        predicate: i.predicate,
        object: i.to_entity_name || i.object || i.topic,
        confidence: i.confidence,
        inferred: i.inferred
      }))
    ]
  };
}

/**
 * Get behavioral context for an entity (how user relates to them)
 * @param {string} userId
 * @param {string} entityName
 * @param {object} supabase
 * @returns {Promise<object>} Behavioral context
 */
export async function getBehavioralContext(userId, entityName, supabase) {
  try {
    // Get user behaviors toward this entity
    const { data: behaviors } = await supabase
      .from('user_behaviors')
      .select('*')
      .eq('user_id', userId)
      .ilike('entity_name', entityName)
      .eq('status', 'active');

    // Get entity qualities
    const { data: qualities } = await supabase
      .from('entity_qualities')
      .select('*')
      .eq('user_id', userId)
      .ilike('entity_name', entityName)
      .eq('status', 'active');

    return {
      userBehaviors: behaviors || [],
      entityQualities: qualities || [],
      summary: formatBehavioralSummary(behaviors || [], qualities || [])
    };
  } catch (error) {
    console.warn('[graph-traversal] Error getting behavioral context:', error.message);
    return { userBehaviors: [], entityQualities: [], summary: '' };
  }
}

/**
 * Format behavioral context as natural language
 */
function formatBehavioralSummary(behaviors, qualities) {
  const parts = [];

  // User behaviors
  for (const b of behaviors.slice(0, 3)) {
    const topicPart = b.topic ? ` (especially on ${b.topic})` : '';
    switch (b.predicate) {
      case 'trusts_opinion_of':
        parts.push(`You trust their opinion${topicPart}`);
        break;
      case 'seeks_advice_from':
        parts.push(`You often seek their advice${topicPart}`);
        break;
      case 'relies_on':
        parts.push(`You rely on them${topicPart}`);
        break;
      case 'learns_from':
        parts.push(`You learn from them${topicPart}`);
        break;
      case 'inspired_by':
        parts.push(`They inspire you${topicPart}`);
        break;
      case 'conflicted_about':
        parts.push(`You have mixed feelings about them`);
        break;
    }
  }

  // Entity qualities
  for (const q of qualities.slice(0, 3)) {
    switch (q.predicate) {
      case 'helps_with':
        parts.push(`They help you with ${q.object}`);
        break;
      case 'challenges':
        parts.push(`They challenge your ${q.object}`);
        break;
      case 'supports':
        parts.push(`They provide ${q.object} support`);
        break;
      case 'mentors':
        parts.push(`They mentor you on ${q.object}`);
        break;
    }
  }

  return parts.join('. ') + (parts.length > 0 ? '.' : '');
}

// --- Helper Functions ---

async function getEntity(userId, entityId, supabase) {
  try {
    const { data } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId)
      .eq('id', entityId)
      .single();
    return data;
  } catch {
    return null;
  }
}

async function getFacts(userId, entityId, supabase) {
  try {
    const { data } = await supabase
      .from('entity_facts')
      .select('*')
      .eq('user_id', userId)
      .eq('entity_id', entityId);
    return data || [];
  } catch {
    return [];
  }
}

async function findEntitiesByFact(userId, predicate, objectText, supabase) {
  try {
    // Find all entities that have this predicate-object combination
    const { data: facts } = await supabase
      .from('entity_facts')
      .select('entity_id')
      .eq('user_id', userId)
      .eq('predicate', predicate)
      .ilike('object_text', `%${objectText}%`);

    if (!facts || facts.length === 0) return [];

    const entityIds = [...new Set(facts.map(f => f.entity_id))];

    const { data: entities } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId)
      .in('id', entityIds);

    return entities || [];
  } catch {
    return [];
  }
}

async function findEntityByName(userId, name, supabase) {
  try {
    const { data } = await supabase
      .from('user_entities')
      .select('*')
      .eq('user_id', userId)
      .ilike('name', `%${name}%`)
      .limit(1);
    return data?.[0] || null;
  } catch {
    return null;
  }
}

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

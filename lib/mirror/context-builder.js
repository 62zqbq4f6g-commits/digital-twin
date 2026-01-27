// /lib/mirror/context-builder.js
// Format facts into natural language context for MIRROR
// OWNER: T2
// CONSUMERS: T1 (api/mirror.js)

/**
 * Build a natural language context block from facts
 *
 * @param {Object} factsByEntity - Grouped facts from getRelevantFacts()
 * @returns {string} Formatted context string
 */
export function buildFactsContext(factsByEntity) {
  if (!factsByEntity || Object.keys(factsByEntity).length === 0) {
    return '';
  }

  const sections = [];

  for (const [name, data] of Object.entries(factsByEntity)) {
    const { entity, facts } = data;
    if (facts.length === 0) continue;

    // Build entity description
    let description = `**${name}**`;
    if (entity.relationship) {
      description += ` (${entity.relationship})`;
    } else if (entity.type && entity.type !== 'person') {
      description += ` (${entity.type})`;
    }

    // Format facts naturally
    const factLines = facts
      .slice(0, 5)  // Max 5 facts per entity
      .map(f => formatFact(f.predicate, f.object, f.confidence))
      .filter(Boolean);

    if (factLines.length > 0) {
      sections.push(`${description}\n${factLines.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

/**
 * Format a single fact naturally
 */
function formatFact(predicate, object, confidence) {
  if (!object) return null;

  const predicateMap = {
    'works_at': `Works at ${object}`,
    'role': `Role: ${object}`,
    'relationship': `Relationship: ${object}`,
    'location': `Location: ${object}`,
    'likes': `Likes ${object}`,
    'dislikes': `Dislikes ${object}`,
    'expertise': `Expert in ${object}`,
    'studied_at': `Studied at ${object}`,
    'owns': `Owns ${object}`,
    'status': `Status: ${object}`,
    'member_of': `Member of ${object}`,
    'collaborates_with': `Collaborates with ${object}`
  };

  const formatted = predicateMap[predicate] || `${predicate}: ${object}`;

  // Add confidence indicator for lower confidence
  if (confidence < 0.8) {
    return `- ${formatted} (uncertain)`;
  }
  return `- ${formatted}`;
}

/**
 * Build connections context
 */
export function buildConnectionsContext(connections, entities) {
  if (!connections?.length) return '';

  const entityMap = Object.fromEntries(
    entities.map(e => [e.id, e.name])
  );

  const lines = connections.map(conn => {
    const names = conn.entityIds
      .map(id => entityMap[id])
      .filter(Boolean)
      .join(' and ');

    if (conn.predicate === 'works_at') {
      return `${names} both work at ${conn.object}`;
    }
    if (conn.predicate === 'member_of') {
      return `${names} are both members of ${conn.object}`;
    }
    if (conn.predicate === 'studied_at') {
      return `${names} both studied at ${conn.object}`;
    }
    return `${names} share: ${conn.predicate} ${conn.object}`;
  });

  return lines.join('\n');
}

/**
 * Build the complete MIRROR context object
 */
export function buildMirrorContext(factsData, connections = []) {
  const { factsByEntity, entities } = factsData;

  return {
    factsContext: buildFactsContext(factsByEntity),
    connectionsContext: buildConnectionsContext(connections, entities || []),
    entityCount: Object.keys(factsByEntity || {}).length,
    factCount: Object.values(factsByEntity || {}).reduce(
      (sum, e) => sum + e.facts.length, 0
    )
  };
}

/**
 * ENTITY TYPES CONFIGURATION
 *
 * NO HARDCODED EXTRACTION LISTS.
 * Context clues guide AI extraction - the AI decides what's an entity.
 *
 * @module lib/extraction/entity-types
 */

/**
 * Entity type definitions with visual styling and context hints
 * The AI uses contextClues to understand when to extract these types
 */
export const ENTITY_TYPES = {
  person: {
    label: 'Person',
    color: '#4A90D9',
    icon: '👤',
    subtypes: ['friend', 'colleague', 'family', 'acquaintance', 'mentor', 'client', 'partner', 'manager', 'report'],
    contextClues: [
      'met', 'talked to', 'called', 'emailed', 'with', 'told me', 'asked', 'said',
      'mentioned', 'reached out', 'caught up with', 'introduced me to'
    ],
    description: 'People the user knows, interacts with, or mentions'
  },

  company: {
    label: 'Organization',
    color: '#7B68EE',
    icon: '🏢',
    subtypes: ['company', 'startup', 'team', 'community', 'institution', 'nonprofit', 'agency', 'firm'],
    contextClues: [
      'works at', 'joined', 'company', 'startup', 'team at', 'founded', 'organization',
      'applied to', 'interviewing at', 'left', 'hired by', 'consulting for'
    ],
    description: 'Companies, organizations, teams the user is connected to'
  },

  place: {
    label: 'Place',
    color: '#50C878',
    icon: '📍',
    subtypes: ['city', 'country', 'venue', 'neighborhood', 'region', 'landmark', 'office', 'home', 'restaurant'],
    contextClues: [
      'in', 'at', 'from', 'to', 'visited', 'traveling to', 'based in', 'moved to',
      'live in', 'going to', 'arrived in', 'leaving', 'located in'
    ],
    description: 'Locations, cities, venues, places of significance'
  },

  project: {
    label: 'Project',
    color: '#FFB347',
    icon: '📋',
    subtypes: ['work_project', 'personal_project', 'side_project', 'initiative', 'feature', 'product'],
    contextClues: [
      'working on', 'building', 'project', 'launching', 'shipping', 'developing',
      'started', 'finished', 'milestone', 'deadline', 'release', 'sprint'
    ],
    description: 'Projects, initiatives, things being built or worked on'
  },

  event: {
    label: 'Event',
    color: '#FF6B6B',
    icon: '📅',
    subtypes: ['meeting', 'trip', 'conference', 'milestone', 'deadline', 'celebration', 'interview', 'presentation'],
    contextClues: [
      'meeting', 'trip', 'conference', 'event', 'call', 'dinner', 'deadline',
      'scheduled', 'happening', 'attended', 'presenting', 'celebrating'
    ],
    description: 'Events, meetings, deadlines, significant moments in time'
  },

  topic: {
    label: 'Topic',
    color: '#DDA0DD',
    icon: '💡',
    subtypes: ['interest', 'skill', 'domain', 'field', 'concept', 'technology', 'idea'],
    contextClues: [
      'about', 'interested in', 'learning', 'studying', 'thinking about', 'focused on',
      'researching', 'exploring', 'passionate about', 'curious about'
    ],
    description: 'Topics, interests, areas of focus or expertise'
  },

  product: {
    label: 'Product',
    color: '#87CEEB',
    icon: '🛠️',
    subtypes: ['software', 'hardware', 'service', 'tool', 'app', 'platform', 'device'],
    contextClues: [
      'using', 'switched to', 'trying', 'app', 'tool', 'software', 'platform',
      'installed', 'upgraded', 'cancelled', 'subscribed to', 'paying for'
    ],
    description: 'Products, tools, services, apps the user uses or considers'
  },

  content: {
    label: 'Content',
    color: '#98D8C8',
    icon: '📚',
    subtypes: ['book', 'article', 'podcast', 'video', 'paper', 'course', 'movie', 'show'],
    contextClues: [
      'reading', 'watched', 'listening to', 'book', 'article', 'podcast',
      'finished', 'started', 'recommended', 'loved', 'mentioned in'
    ],
    description: 'Books, articles, podcasts, videos, content consumed'
  }
};

/**
 * Relationship types between entities
 * Defines valid subject-object pairs and labels for relationships
 */
export const RELATIONSHIP_TYPES = {
  // Person relationships
  works_at: { subject: 'person', object: 'company', label: 'works at' },
  knows: { subject: 'person', object: 'person', label: 'knows' },
  lives_in: { subject: 'person', object: 'place', label: 'lives in' },
  from: { subject: 'person', object: 'place', label: 'from' },
  expertise_in: { subject: 'person', object: 'topic', label: 'has expertise in' },
  manages: { subject: 'person', object: 'person', label: 'manages' },
  reports_to: { subject: 'person', object: 'person', label: 'reports to' },

  // User-to-entity relationships (behaviors)
  trusts: { subject: 'user', object: 'person', context: 'topic', label: 'trusts' },
  seeks_advice_from: { subject: 'user', object: 'person', context: 'topic', label: 'seeks advice from' },
  interested_in: { subject: 'user', object: 'topic', label: 'interested in' },
  working_on: { subject: 'user', object: 'project', label: 'working on' },
  visited: { subject: 'user', object: 'place', temporal: true, label: 'visited' },
  uses: { subject: 'user', object: 'product', label: 'uses' },
  met_at: { subject: 'user', object: 'person', context: 'place', label: 'met at' },
  learning: { subject: 'user', object: 'topic', label: 'learning' },

  // Project relationships
  involves: { subject: 'project', object: 'person', label: 'involves' },
  related_to: { subject: 'project', object: 'topic', label: 'related to' },
  part_of: { subject: 'project', object: 'company', label: 'part of' },

  // Event relationships
  happened_at: { subject: 'event', object: 'place', label: 'happened at' },
  attended_by: { subject: 'event', object: 'person', label: 'attended by' },
  about: { subject: 'event', object: 'topic', label: 'about' },

  // Company relationships
  founded_by: { subject: 'company', object: 'person', label: 'founded by' },
  based_in: { subject: 'company', object: 'place', label: 'based in' },
  works_on: { subject: 'company', object: 'topic', label: 'works on' },

  // Content relationships
  written_by: { subject: 'content', object: 'person', label: 'written by' },
  covers: { subject: 'content', object: 'topic', label: 'covers' }
};

/**
 * Behavior types - how the user relates TO entities
 * This is what makes the graph PERSONAL
 */
export const BEHAVIOR_TYPES = {
  trusts_opinion: {
    label: 'Trusts opinion of',
    description: 'User values this person\'s judgment on specific topics',
    signal_phrases: ['trust', 'believe', 'value their opinion', 'always ask', 'go-to person']
  },
  seeks_advice: {
    label: 'Seeks advice from',
    description: 'User asks this person for guidance',
    signal_phrases: ['advice', 'asked them', 'consulted', 'what do you think', 'help me think']
  },
  inspired_by: {
    label: 'Inspired by',
    description: 'User finds inspiration from this person or content',
    signal_phrases: ['inspired', 'love how they', 'want to be like', 'admire']
  },
  relies_on: {
    label: 'Relies on',
    description: 'User depends on this person or thing',
    signal_phrases: ['rely on', 'couldn\'t do without', 'depend on', 'need']
  },
  avoids: {
    label: 'Avoids',
    description: 'User tends to avoid this person, topic, or thing',
    signal_phrases: ['avoid', 'don\'t want to', 'staying away', 'not interested']
  },
  prefers: {
    label: 'Prefers',
    description: 'User has a preference for this over alternatives',
    signal_phrases: ['prefer', 'like better', 'my favorite', 'always choose']
  },
  struggles_with: {
    label: 'Struggles with',
    description: 'User finds this challenging or difficult',
    signal_phrases: ['struggle', 'hard for me', 'difficult', 'can\'t seem to', 'frustrated']
  },
  excited_about: {
    label: 'Excited about',
    description: 'User is enthusiastic about this',
    signal_phrases: ['excited', 'can\'t wait', 'really looking forward', 'pumped', 'thrilled']
  },
  worried_about: {
    label: 'Worried about',
    description: 'User has concerns about this',
    signal_phrases: ['worried', 'concerned', 'anxious about', 'nervous', 'stressed']
  }
};

/**
 * Get entity type configuration by type name
 * @param {string} type - Entity type name
 * @returns {object|null} Entity type configuration
 */
export function getEntityType(type) {
  return ENTITY_TYPES[type] || null;
}

/**
 * Get color for entity type (for visualization)
 * @param {string} type - Entity type name
 * @returns {string} Hex color code
 */
export function getColorForType(type) {
  return ENTITY_TYPES[type]?.color || '#999999';
}

/**
 * Get all entity type names
 * @returns {string[]} Array of entity type names
 */
export function getEntityTypeNames() {
  return Object.keys(ENTITY_TYPES);
}

/**
 * Get relationship types for a given subject type
 * @param {string} subjectType - Subject entity type
 * @returns {object[]} Array of valid relationship types
 */
export function getRelationshipsForSubject(subjectType) {
  return Object.entries(RELATIONSHIP_TYPES)
    .filter(([_, config]) => config.subject === subjectType)
    .map(([type, config]) => ({ type, ...config }));
}

/**
 * Build extraction prompt with all type definitions
 * Used by the AI extraction engine
 * @returns {string} Prompt text describing all types
 */
export function buildTypeDefinitionsForPrompt() {
  const entityDefs = Object.entries(ENTITY_TYPES)
    .map(([type, config]) => `- ${type}: ${config.description}. Subtypes: ${config.subtypes.join(', ')}`)
    .join('\n');

  const relationshipDefs = Object.entries(RELATIONSHIP_TYPES)
    .map(([type, config]) => `- ${type}: ${config.subject} → ${config.label} → ${config.object}`)
    .join('\n');

  const behaviorDefs = Object.entries(BEHAVIOR_TYPES)
    .map(([type, config]) => `- ${type}: ${config.description}`)
    .join('\n');

  return `ENTITY TYPES:\n${entityDefs}\n\nRELATIONSHIP TYPES:\n${relationshipDefs}\n\nBEHAVIOR TYPES (user's relationship TO entities):\n${behaviorDefs}`;
}

export default {
  ENTITY_TYPES,
  RELATIONSHIP_TYPES,
  BEHAVIOR_TYPES,
  getEntityType,
  getColorForType,
  getEntityTypeNames,
  getRelationshipsForSubject,
  buildTypeDefinitionsForPrompt
};

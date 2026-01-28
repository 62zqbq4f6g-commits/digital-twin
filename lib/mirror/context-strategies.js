/**
 * Context Strategies
 *
 * Defines what context to load for each task type.
 * Part of RAG 2.0 — task-aware context loading.
 *
 * OWNER: T2
 * CONSUMERS: context-loader.js
 */

export const contextStrategies = {
  entity_recall: {
    entities: 'mentioned_only',
    facts: 'all_for_entity',
    notes: 'mentions_only',
    patterns: 'none',
    maxTokens: 2000,
    description: 'Loading information about specific people/things'
  },

  decision: {
    entities: 'relevant_people',
    facts: 'high_confidence',
    notes: 'related_topics',
    patterns: 'behavioral',
    maxTokens: 4000,
    description: 'Loading decision-relevant context'
  },

  emotional: {
    entities: 'supportive_relationships',
    facts: 'minimal',
    notes: 'past_similar',
    patterns: 'emotional_patterns',
    maxTokens: 3000,
    description: 'Loading supportive context'
  },

  research: {
    entities: 'all_related',
    facts: 'all',
    notes: 'broad_search',
    patterns: 'all',
    maxTokens: 6000,
    description: 'Loading comprehensive research context'
  },

  thinking_partner: {
    entities: 'mentioned_plus_related',
    facts: 'relevant',
    notes: 'similar_explorations',
    patterns: 'thinking_patterns',
    maxTokens: 4000,
    description: 'Loading thinking context'
  },

  factual: {
    entities: 'mentioned_only',
    facts: 'all_for_entity',
    notes: 'none',
    patterns: 'none',
    maxTokens: 1500,
    description: 'Loading factual context'
  },

  general: {
    entities: 'top_by_importance',
    facts: 'high_confidence',
    notes: 'recent',
    patterns: 'none',
    maxTokens: 3000,
    description: 'Loading general context'
  }
};

/**
 * Get strategy for task type
 * @param {string} taskType
 * @returns {object} Strategy configuration
 */
export function getContextStrategy(taskType) {
  return contextStrategies[taskType] || contextStrategies.general;
}

/**
 * Get all available task types with their strategies
 * @returns {string[]}
 */
export function getTaskTypes() {
  return Object.keys(contextStrategies);
}

/**
 * Get strategy description for UI
 * @param {string} taskType
 * @returns {string}
 */
export function getStrategyDescription(taskType) {
  const strategy = getContextStrategy(taskType);
  return strategy.description;
}

/**
 * Get max tokens for task type
 * @param {string} taskType
 * @returns {number}
 */
export function getMaxTokens(taskType) {
  const strategy = getContextStrategy(taskType);
  return strategy.maxTokens;
}

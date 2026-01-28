// /lib/mirror/index.js
// Export all MIRROR context functions
// OWNER: T2
// CONSUMERS: api/mirror.js

// Existing fact retrieval and context building
export { getRelevantFacts, findEntityConnections } from './fact-retrieval.js';
export { buildFactsContext, buildConnectionsContext, buildMirrorContext } from './context-builder.js';

// Existing specialized modes
export { detectResearchMode, conductResearch, buildResearchPrompt, formatResearchForContextUI } from './research-mode.js';
export { detectKnowledgeQuery, getKnowledgeAbout, buildKnowledgePrompt, formatKnowledgeForContextUI } from './knowledge-about.js';

// RAG 2.0: Task-aware context engineering
export {
  classifyTask,
  extractMentionedEntities,
  extractTopics,
  getTaskTypeLabel,
  getTaskTypes
} from './task-classifier.js';

export {
  contextStrategies,
  getContextStrategy,
  getStrategyDescription,
  getMaxTokens
} from './context-strategies.js';

export {
  loadContextForTask,
  formatContextForPrompt,
  getContextSummary
} from './context-loader.js';

export {
  traverseGraph,
  findEntitiesForTopic,
  formatConnections,
  getEntityNetwork
} from './graph-traversal.js';

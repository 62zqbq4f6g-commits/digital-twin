// /lib/mirror/index.js
// Export all MIRROR context functions
// OWNER: T2
// CONSUMERS: T1 (api/mirror.js)

export { getRelevantFacts, findEntityConnections } from './fact-retrieval.js';
export { buildFactsContext, buildConnectionsContext, buildMirrorContext } from './context-builder.js';

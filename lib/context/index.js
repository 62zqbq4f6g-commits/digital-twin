/**
 * CONTEXT MODULE
 *
 * Phase 2 - Post-RAG Architecture
 *
 * Complete user memory loading and formatting for AI consumption.
 * No chunking. No embeddings. No retrieval. Just load everything.
 *
 * Usage:
 *   import { loadFullContext, buildContextDocument } from '../lib/context';
 *
 *   const context = await loadFullContext(userId);
 *   const document = buildContextDocument(context);
 */

// Full context loading
export { loadFullContext, estimateTokenCount } from './full-loader.js';

// Document building (markdown format)
export { buildContextDocument, buildCompactDocument } from './document-builder.js';

// Agent-specific formats
export {
  formatForMCP,
  formatAsSystemPrompt,
  formatForGPTKnowledge,
  formatForClaudeProject
} from './agent-format.js';

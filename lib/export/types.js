// /lib/export/types.js
// OWNER: T2
// Type definitions for export structure

/**
 * @typedef {Object} ExportIdentity
 * @property {string} name
 * @property {string} role
 * @property {string} self_description
 * @property {string[]} goals
 * @property {string[]} life_context
 * @property {Object} communication
 * @property {string[]} boundaries
 * @property {Array<{name: string, relationship: string}>} key_people
 */

/**
 * @typedef {Object} ExportEntity
 * @property {string} id
 * @property {string} type
 * @property {string} name
 * @property {string} description
 * @property {number} importance
 * @property {number} sentiment
 * @property {Object} temporal
 * @property {Array} facts
 */

/**
 * @typedef {Object} ExportNote
 * @property {string} id
 * @property {string} content
 * @property {string} timestamp
 * @property {string} category
 * @property {Object} extracted
 */

/**
 * @typedef {Object} ExportPattern
 * @property {string} type
 * @property {string} description
 * @property {number} confidence
 * @property {Object} structured
 * @property {Object} evidence
 */

/**
 * @typedef {Object} InscriptExport
 * @property {ExportIdentity} identity
 * @property {ExportEntity[]} entities
 * @property {Object} episodes
 * @property {ExportPattern[]} patterns
 * @property {Object} meta
 */

export const EXPORT_VERSION = "1.1.0";  // Bumped for Sprint 2

export const PRIVACY_LEVELS = ['private', 'internal', 'shared'];

export const ENTITY_TYPES = [
  'person',
  'organization',
  'place',
  'project',
  'concept',
  'event',
  'thing'
];

export const PATTERN_TYPES = [
  'temporal',
  'preference',
  'habit',
  'relational',
  'behavioral',
  'emotional'
];

// Fact predicate types
export const FACT_PREDICATES = [
  'works_at',
  'role',
  'relationship',
  'location',
  'likes',
  'dislikes',
  'status',
  'expertise',
  'studied_at',
  'owns',
  'member_of',
  'collaborates_with'
];

// Message roles
export const MESSAGE_ROLES = ['user', 'assistant', 'system'];

/**
 * PAMP v2.0 Validator
 *
 * Validates PAMP documents against the v2.0 specification.
 * See /docs/PAMP-v2.0-SPEC.md for full specification.
 *
 * Usage:
 *   import { validatePAMP, PAMPError } from '../lib/pamp/validator.js';
 *
 *   const result = validatePAMP(document);
 *   if (!result.valid) {
 *     console.error(result.errors);
 *   }
 */

// Valid entity types
const ENTITY_TYPES = [
  'person',
  'organization',
  'place',
  'project',
  'concept',
  'event',
  'product',
  'other'
];

// Valid pattern types
const PATTERN_TYPES = [
  'behavioral',
  'emotional',
  'cognitive',
  'social',
  'temporal',
  'preference'
];

// Valid message roles
const MESSAGE_ROLES = ['user', 'assistant'];

// Valid privacy levels
const PRIVACY_LEVELS = ['public', 'private', 'sensitive'];

// Valid tones
const TONES = ['warm', 'professional', 'casual', 'direct'];

// Valid formality levels
const FORMALITY_LEVELS = ['formal', 'informal', 'adaptive'];

// Valid verbosity levels
const VERBOSITY_LEVELS = ['concise', 'detailed', 'adaptive'];

/**
 * Validation error class
 */
export class PAMPError extends Error {
  constructor(path, message, value = undefined) {
    super(`${path}: ${message}`);
    this.path = path;
    this.value = value;
    this.name = 'PAMPError';
  }
}

/**
 * Validation result
 */
class ValidationResult {
  constructor() {
    this.valid = true;
    this.errors = [];
    this.warnings = [];
  }

  addError(path, message, value) {
    this.valid = false;
    this.errors.push(new PAMPError(path, message, value));
  }

  addWarning(path, message) {
    this.warnings.push({ path, message });
  }

  merge(other) {
    if (!other.valid) this.valid = false;
    this.errors.push(...other.errors);
    this.warnings.push(...other.warnings);
  }
}

/**
 * Validate a PAMP document
 *
 * @param {object} doc - The PAMP document to validate
 * @param {object} options - Validation options
 * @returns {ValidationResult} Validation result with errors and warnings
 */
export function validatePAMP(doc, options = {}) {
  const {
    strict = false,      // If true, fail on warnings too
    maxEntities = 10000, // Max entities allowed
    maxNotes = 50000,    // Max notes allowed
  } = options;

  const result = new ValidationResult();

  // Check document exists
  if (!doc || typeof doc !== 'object') {
    result.addError('root', 'Document must be an object');
    return result;
  }

  // Validate @context
  if (doc['@context'] !== 'https://pamp.ai/schema/v2') {
    result.addError('@context', 'Must be "https://pamp.ai/schema/v2"', doc['@context']);
  }

  // Validate version
  if (!doc.version || !doc.version.startsWith('2.')) {
    result.addError('version', 'Must be a 2.x.x version string', doc.version);
  }

  // Validate identity
  result.merge(validateIdentity(doc.identity));

  // Validate knowledge graph
  if (doc.knowledgeGraph) {
    result.merge(validateKnowledgeGraph(doc.knowledgeGraph, maxEntities));
  }

  // Validate episodes
  if (doc.episodes) {
    result.merge(validateEpisodes(doc.episodes, maxNotes));
  }

  // Validate patterns
  if (doc.patterns) {
    result.merge(validatePatterns(doc.patterns));
  }

  // Validate summaries
  if (doc.summaries) {
    result.merge(validateSummaries(doc.summaries));
  }

  // Validate meta
  result.merge(validateMeta(doc.meta));

  // Convert warnings to errors in strict mode
  if (strict && result.warnings.length > 0) {
    result.valid = false;
    for (const warning of result.warnings) {
      result.errors.push(new PAMPError(warning.path, warning.message));
    }
  }

  return result;
}

/**
 * Validate identity layer
 */
function validateIdentity(identity) {
  const result = new ValidationResult();
  const path = 'identity';

  if (!identity) {
    result.addError(path, 'Identity layer is required');
    return result;
  }

  if (!identity.profile || typeof identity.profile !== 'object') {
    result.addError(`${path}.profile`, 'Profile object is required');
  }

  // Validate communication if present
  if (identity.communication) {
    const comm = identity.communication;

    if (comm.tone && !TONES.includes(comm.tone)) {
      result.addWarning(`${path}.communication.tone`, `Unknown tone: ${comm.tone}`);
    }

    if (comm.formality && !FORMALITY_LEVELS.includes(comm.formality)) {
      result.addWarning(`${path}.communication.formality`, `Unknown formality: ${comm.formality}`);
    }

    if (comm.verbosity && !VERBOSITY_LEVELS.includes(comm.verbosity)) {
      result.addWarning(`${path}.communication.verbosity`, `Unknown verbosity: ${comm.verbosity}`);
    }
  }

  // Validate key people if present
  if (identity.keyPeople) {
    if (!Array.isArray(identity.keyPeople)) {
      result.addError(`${path}.keyPeople`, 'Must be an array');
    } else {
      identity.keyPeople.forEach((person, i) => {
        if (!person.name) {
          result.addError(`${path}.keyPeople[${i}].name`, 'Name is required');
        }
        if (!person.relationship) {
          result.addError(`${path}.keyPeople[${i}].relationship`, 'Relationship is required');
        }
        if (person.importance !== undefined) {
          if (typeof person.importance !== 'number' || person.importance < 0 || person.importance > 1) {
            result.addError(`${path}.keyPeople[${i}].importance`, 'Must be a number between 0 and 1', person.importance);
          }
        }
      });
    }
  }

  return result;
}

/**
 * Validate knowledge graph layer
 */
function validateKnowledgeGraph(kg, maxEntities) {
  const result = new ValidationResult();
  const path = 'knowledgeGraph';

  // Validate entities
  if (kg.entities) {
    if (!Array.isArray(kg.entities)) {
      result.addError(`${path}.entities`, 'Must be an array');
    } else {
      if (kg.entities.length > maxEntities) {
        result.addWarning(`${path}.entities`, `Large entity count: ${kg.entities.length}`);
      }

      const entityIds = new Set();

      kg.entities.forEach((entity, i) => {
        const ePath = `${path}.entities[${i}]`;

        // Required fields
        if (!entity.id) {
          result.addError(`${ePath}.id`, 'ID is required');
        } else if (entityIds.has(entity.id)) {
          result.addError(`${ePath}.id`, `Duplicate entity ID: ${entity.id}`);
        } else {
          entityIds.add(entity.id);
        }

        if (!entity.name) {
          result.addError(`${ePath}.name`, 'Name is required');
        }

        if (!entity.type) {
          result.addError(`${ePath}.type`, 'Type is required');
        } else if (!ENTITY_TYPES.includes(entity.type)) {
          result.addWarning(`${ePath}.type`, `Unknown entity type: ${entity.type}`);
        }

        // Validate scores
        if (entity.scores) {
          const scores = entity.scores;

          if (scores.importance !== undefined) {
            if (typeof scores.importance !== 'number' || scores.importance < 0 || scores.importance > 1) {
              result.addError(`${ePath}.scores.importance`, 'Must be 0-1', scores.importance);
            }
          }

          if (scores.sentiment !== undefined) {
            if (typeof scores.sentiment !== 'number' || scores.sentiment < -1 || scores.sentiment > 1) {
              result.addError(`${ePath}.scores.sentiment`, 'Must be -1 to 1', scores.sentiment);
            }
          }

          if (scores.lastMentioned !== undefined) {
            if (!isValidISODate(scores.lastMentioned)) {
              result.addError(`${ePath}.scores.lastMentioned`, 'Must be valid ISO date');
            }
          }
        }

        // Validate facts
        if (entity.facts) {
          if (!Array.isArray(entity.facts)) {
            result.addError(`${ePath}.facts`, 'Must be an array');
          } else {
            entity.facts.forEach((fact, j) => {
              if (!fact.predicate) {
                result.addError(`${ePath}.facts[${j}].predicate`, 'Predicate is required');
              }
              if (!fact.object && fact.object !== '') {
                result.addError(`${ePath}.facts[${j}].object`, 'Object is required');
              }
              if (fact.confidence !== undefined) {
                if (typeof fact.confidence !== 'number' || fact.confidence < 0 || fact.confidence > 1) {
                  result.addError(`${ePath}.facts[${j}].confidence`, 'Must be 0-1');
                }
              }
            });
          }
        }

        // Validate privacy level
        if (entity.privacyLevel && !PRIVACY_LEVELS.includes(entity.privacyLevel)) {
          result.addWarning(`${ePath}.privacyLevel`, `Unknown privacy level: ${entity.privacyLevel}`);
        }
      });
    }
  }

  // Validate relationships
  if (kg.relationships) {
    if (!Array.isArray(kg.relationships)) {
      result.addError(`${path}.relationships`, 'Must be an array');
    } else {
      kg.relationships.forEach((rel, i) => {
        const rPath = `${path}.relationships[${i}]`;

        if (!rel.subject) {
          result.addError(`${rPath}.subject`, 'Subject is required');
        }
        if (!rel.predicate) {
          result.addError(`${rPath}.predicate`, 'Predicate is required');
        }
        if (!rel.object) {
          result.addError(`${rPath}.object`, 'Object is required');
        }
        if (rel.strength !== undefined) {
          if (typeof rel.strength !== 'number' || rel.strength < 0 || rel.strength > 1) {
            result.addError(`${rPath}.strength`, 'Must be 0-1');
          }
        }
      });
    }
  }

  return result;
}

/**
 * Validate episodes layer
 */
function validateEpisodes(episodes, maxNotes) {
  const result = new ValidationResult();
  const path = 'episodes';

  // Validate notes
  if (episodes.notes) {
    if (!Array.isArray(episodes.notes)) {
      result.addError(`${path}.notes`, 'Must be an array');
    } else {
      if (episodes.notes.length > maxNotes) {
        result.addWarning(`${path}.notes`, `Large note count: ${episodes.notes.length}`);
      }

      const noteIds = new Set();

      episodes.notes.forEach((note, i) => {
        const nPath = `${path}.notes[${i}]`;

        if (!note.id) {
          result.addError(`${nPath}.id`, 'ID is required');
        } else if (noteIds.has(note.id)) {
          result.addError(`${nPath}.id`, `Duplicate note ID: ${note.id}`);
        } else {
          noteIds.add(note.id);
        }

        // Must have content or contentEncrypted
        if (!note.content && !note.contentEncrypted) {
          result.addError(`${nPath}`, 'Must have content or contentEncrypted');
        }

        if (!note.timestamp) {
          result.addError(`${nPath}.timestamp`, 'Timestamp is required');
        } else if (!isValidISODate(note.timestamp)) {
          result.addError(`${nPath}.timestamp`, 'Must be valid ISO date');
        }

        if (note.sentiment !== undefined) {
          if (typeof note.sentiment !== 'number' || note.sentiment < -1 || note.sentiment > 1) {
            result.addError(`${nPath}.sentiment`, 'Must be -1 to 1');
          }
        }
      });
    }
  }

  // Validate conversations
  if (episodes.conversations) {
    if (!Array.isArray(episodes.conversations)) {
      result.addError(`${path}.conversations`, 'Must be an array');
    } else {
      episodes.conversations.forEach((convo, i) => {
        const cPath = `${path}.conversations[${i}]`;

        if (!convo.id) {
          result.addError(`${cPath}.id`, 'ID is required');
        }

        if (!convo.startedAt) {
          result.addError(`${cPath}.startedAt`, 'startedAt is required');
        } else if (!isValidISODate(convo.startedAt)) {
          result.addError(`${cPath}.startedAt`, 'Must be valid ISO date');
        }

        if (!convo.messages || !Array.isArray(convo.messages)) {
          result.addError(`${cPath}.messages`, 'Messages array is required');
        } else {
          convo.messages.forEach((msg, j) => {
            const mPath = `${cPath}.messages[${j}]`;

            if (!msg.role) {
              result.addError(`${mPath}.role`, 'Role is required');
            } else if (!MESSAGE_ROLES.includes(msg.role)) {
              result.addError(`${mPath}.role`, `Invalid role: ${msg.role}`);
            }

            if (!msg.content && !msg.contentEncrypted) {
              result.addError(`${mPath}`, 'Must have content or contentEncrypted');
            }

            if (!msg.timestamp) {
              result.addError(`${mPath}.timestamp`, 'Timestamp is required');
            }
          });
        }
      });
    }
  }

  // Validate meetings
  if (episodes.meetings) {
    if (!Array.isArray(episodes.meetings)) {
      result.addError(`${path}.meetings`, 'Must be an array');
    } else {
      episodes.meetings.forEach((meeting, i) => {
        const mPath = `${path}.meetings[${i}]`;

        if (!meeting.id) {
          result.addError(`${mPath}.id`, 'ID is required');
        }

        if (!meeting.date) {
          result.addError(`${mPath}.date`, 'Date is required');
        } else if (!isValidISODate(meeting.date)) {
          result.addError(`${mPath}.date`, 'Must be valid ISO date');
        }
      });
    }
  }

  return result;
}

/**
 * Validate patterns
 */
function validatePatterns(patterns) {
  const result = new ValidationResult();
  const path = 'patterns';

  if (!Array.isArray(patterns)) {
    result.addError(path, 'Must be an array');
    return result;
  }

  patterns.forEach((pattern, i) => {
    const pPath = `${path}[${i}]`;

    if (!pattern.type) {
      result.addError(`${pPath}.type`, 'Type is required');
    } else if (!PATTERN_TYPES.includes(pattern.type)) {
      result.addWarning(`${pPath}.type`, `Unknown pattern type: ${pattern.type}`);
    }

    if (!pattern.description) {
      result.addError(`${pPath}.description`, 'Description is required');
    }

    if (pattern.confidence === undefined) {
      result.addError(`${pPath}.confidence`, 'Confidence is required');
    } else if (typeof pattern.confidence !== 'number' || pattern.confidence < 0 || pattern.confidence > 1) {
      result.addError(`${pPath}.confidence`, 'Must be 0-1');
    }
  });

  return result;
}

/**
 * Validate summaries
 */
function validateSummaries(summaries) {
  const result = new ValidationResult();
  const path = 'summaries';

  if (typeof summaries !== 'object') {
    result.addError(path, 'Must be an object');
    return result;
  }

  // Validate byCategory
  if (summaries.byCategory) {
    if (typeof summaries.byCategory !== 'object') {
      result.addError(`${path}.byCategory`, 'Must be an object');
    } else {
      for (const [category, summary] of Object.entries(summaries.byCategory)) {
        if (!summary.summary) {
          result.addError(`${path}.byCategory.${category}.summary`, 'Summary is required');
        }
        if (summary.lastUpdated && !isValidISODate(summary.lastUpdated)) {
          result.addError(`${path}.byCategory.${category}.lastUpdated`, 'Must be valid ISO date');
        }
      }
    }
  }

  return result;
}

/**
 * Validate document metadata
 */
function validateMeta(meta) {
  const result = new ValidationResult();
  const path = 'meta';

  if (!meta) {
    result.addError(path, 'Meta section is required');
    return result;
  }

  // Required: exportedAt
  if (!meta.exportedAt) {
    result.addError(`${path}.exportedAt`, 'exportedAt is required');
  } else if (!isValidISODate(meta.exportedAt)) {
    result.addError(`${path}.exportedAt`, 'Must be valid ISO date');
  }

  // Required: source
  if (!meta.source) {
    result.addError(`${path}.source`, 'Source is required');
  } else {
    if (!meta.source.application) {
      result.addError(`${path}.source.application`, 'Application name is required');
    }
  }

  // Required: counts
  if (!meta.counts) {
    result.addError(`${path}.counts`, 'Counts are required');
  } else {
    const requiredCounts = ['entities', 'facts', 'notes', 'conversations', 'meetings', 'patterns'];
    for (const count of requiredCounts) {
      if (meta.counts[count] === undefined) {
        result.addError(`${path}.counts.${count}`, `${count} count is required`);
      } else if (typeof meta.counts[count] !== 'number') {
        result.addError(`${path}.counts.${count}`, 'Must be a number');
      }
    }
  }

  // Validate dateRange if present
  if (meta.dateRange) {
    if (meta.dateRange.earliest && !isValidISODate(meta.dateRange.earliest)) {
      result.addError(`${path}.dateRange.earliest`, 'Must be valid ISO date');
    }
    if (meta.dateRange.latest && !isValidISODate(meta.dateRange.latest)) {
      result.addError(`${path}.dateRange.latest`, 'Must be valid ISO date');
    }
  }

  return result;
}

/**
 * Check if string is valid ISO date
 */
function isValidISODate(str) {
  if (typeof str !== 'string') return false;
  const date = new Date(str);
  return !isNaN(date.getTime());
}

/**
 * Quick validation - returns true/false only
 */
export function isValidPAMP(doc) {
  return validatePAMP(doc).valid;
}

/**
 * Get PAMP version from document
 */
export function getPAMPVersion(doc) {
  return doc?.version || null;
}

/**
 * Check if document is encrypted
 */
export function isEncrypted(doc) {
  return Boolean(doc?.meta?.encryption?.encryptedFields?.length);
}

/**
 * Get list of encrypted fields
 */
export function getEncryptedFields(doc) {
  return doc?.meta?.encryption?.encryptedFields || [];
}

export default {
  validatePAMP,
  isValidPAMP,
  getPAMPVersion,
  isEncrypted,
  getEncryptedFields,
  PAMPError
};

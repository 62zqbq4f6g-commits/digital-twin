/**
 * UNIFIED INPUT ROUTER FOR KNOWLEDGE EXTRACTION
 *
 * Routes ALL user inputs to the knowledge graph extraction pipeline.
 * Central hub that ensures every piece of user data enriches the knowledge graph.
 *
 * Supported input types:
 * - notes (regular, meeting, voice, ambient)
 * - profile (onboarding data, YOU tab edits)
 * - key_people (relationship definitions)
 * - mirror (conversation messages)
 * - settings (user preferences)
 *
 * @module lib/extraction/input-router
 */

import { extractFromText } from './extractor.js';
import { storeExtraction } from './knowledge-store.js';
import { convertKeyPersonToFacts } from './profile-converter.js';

/**
 * Input type definitions
 */
export const INPUT_TYPES = {
  NOTE: 'note',
  MEETING: 'meeting',
  VOICE: 'voice',
  AMBIENT: 'ambient',
  PROFILE: 'profile',
  KEY_PERSON: 'key_person',
  MIRROR: 'mirror',
  SETTINGS: 'settings',
  ONBOARDING: 'onboarding'
};

/**
 * Route input to appropriate extraction pipeline
 * Fire-and-forget — doesn't block the caller
 *
 * @param {string} userId - User ID
 * @param {string} inputType - Type of input (from INPUT_TYPES)
 * @param {object} data - Input data
 * @param {object} options - Additional options
 * @returns {Promise<object>} Extraction results
 */
export async function routeInput(userId, inputType, data, options = {}) {
  console.log(`[INPUT-ROUTER] Routing ${inputType} for user ${userId}`);

  try {
    switch (inputType) {
      case INPUT_TYPES.NOTE:
      case INPUT_TYPES.MEETING:
      case INPUT_TYPES.VOICE:
      case INPUT_TYPES.AMBIENT:
        return await extractFromNote(userId, data, { ...options, noteType: inputType });

      case INPUT_TYPES.PROFILE:
      case INPUT_TYPES.ONBOARDING:
        return await extractFromProfile(userId, data, options);

      case INPUT_TYPES.KEY_PERSON:
        return await extractFromKeyPerson(userId, data, options);

      case INPUT_TYPES.MIRROR:
        return await extractFromMirror(userId, data, options);

      case INPUT_TYPES.SETTINGS:
        return await extractFromSettings(userId, data, options);

      default:
        console.warn(`[INPUT-ROUTER] Unknown input type: ${inputType}`);
        return null;
    }
  } catch (error) {
    console.error(`[INPUT-ROUTER] Error processing ${inputType}:`, error.message);
    return null;
  }
}

/**
 * Queue input for extraction (fire-and-forget)
 * Use this when you don't need to wait for results
 *
 * @param {string} userId - User ID
 * @param {string} inputType - Type of input
 * @param {object} data - Input data
 * @param {object} options - Additional options
 */
export function queueInput(userId, inputType, data, options = {}) {
  // Fire and forget
  routeInput(userId, inputType, data, options)
    .catch(err => console.error(`[INPUT-ROUTER] Background extraction failed:`, err.message));

  return { queued: true, inputType };
}

/**
 * Extract knowledge from a note
 */
async function extractFromNote(userId, data, options = {}) {
  const { content, noteId, title, noteType = 'note' } = data;

  if (!content || content.trim().length < 15) {
    console.log('[INPUT-ROUTER] Note too short for extraction');
    return null;
  }

  // Build extraction text
  let text = content;
  if (title) {
    text = `${title}\n\n${content}`;
  }

  // Extract using AI
  const extraction = await extractFromText(text, {
    sourceType: noteType,
    ...options
  });

  // Check if anything to store
  const hasContent = extraction.entities.length > 0 ||
    extraction.relationships.length > 0 ||
    extraction.behaviors.length > 0 ||
    extraction.topics.length > 0;

  if (!hasContent) {
    console.log('[INPUT-ROUTER] No knowledge extracted from note');
    return null;
  }

  // Store extraction
  const results = await storeExtraction(userId, extraction, {
    sourceType: noteType,
    sourceId: noteId
  });

  console.log(`[INPUT-ROUTER] Note extraction complete:`, results);
  return results;
}

/**
 * Extract knowledge from profile data
 *
 * NOTE: Profile data (life_seasons, mental_focus, tone, etc.) is already stored
 * in onboarding_data and user_profiles tables, which MIRROR loads directly.
 *
 * We DON'T create redundant "Self" entity facts because:
 * 1. MIRROR already loads from onboarding_data/user_profiles
 * 2. Duplication causes maintenance issues
 *
 * What we DO extract:
 * - Depth answer might contain valuable insights → AI extract
 * - Life context free text → AI extract
 */
async function extractFromProfile(userId, data, options = {}) {
  // Only AI-extract from free text fields that might contain entities/insights
  const freeTextFields = [];

  if (data.depth_answer && data.depth_answer.length > 30) {
    freeTextFields.push(data.depth_answer);
  }

  if (data.life_context && data.life_context.length > 30) {
    freeTextFields.push(data.life_context);
  }

  if (freeTextFields.length === 0) {
    console.log('[INPUT-ROUTER] No free text to extract from profile');
    return null;
  }

  // AI extract from free text fields
  const text = freeTextFields.join('\n\n');
  const extraction = await extractFromText(text, {
    sourceType: 'profile',
    ...options
  });

  const hasContent = extraction.entities.length > 0 ||
    extraction.relationships.length > 0 ||
    extraction.behaviors.length > 0 ||
    extraction.topics.length > 0;

  if (!hasContent) {
    console.log('[INPUT-ROUTER] No knowledge extracted from profile text');
    return null;
  }

  const results = await storeExtraction(userId, extraction, {
    sourceType: 'profile'
  });

  console.log(`[INPUT-ROUTER] Profile extraction complete:`, results);
  return results;
}

/**
 * Extract knowledge from key person
 * Creates behavioral predicates based on relationship type
 */
async function extractFromKeyPerson(userId, data, options = {}) {
  const { name, relationship, notes } = data;

  if (!name || !relationship) {
    console.log('[INPUT-ROUTER] Key person missing name or relationship');
    return null;
  }

  const facts = convertKeyPersonToFacts(name, relationship, notes);

  // Store the person as an entity + facts
  const extraction = {
    entities: [{
      name: name,
      type: 'person',
      subtype: mapRelationshipToSubtype(relationship),
      context: `Key person: ${relationship}`,
      confidence: 1.0 // User explicitly defined
    }],
    relationships: facts.map(f => ({
      subject: 'user',
      predicate: f.predicate,
      object: name,
      context: f.context,
      confidence: 1.0
    })),
    behaviors: facts.filter(f => f.isBehavior).map(f => ({
      type: f.predicate,
      target_entity: name,
      evidence: `User defined ${name} as ${relationship}`,
      confidence: 1.0
    })),
    topics: []
  };

  const results = await storeExtraction(userId, extraction, {
    sourceType: 'key_person',
    ...options
  });

  console.log(`[INPUT-ROUTER] Key person extraction complete:`, results);
  return results;
}

/**
 * Extract knowledge from MIRROR conversation
 * Already handled by auto-extract.js, but can be called directly
 */
async function extractFromMirror(userId, data, options = {}) {
  const { userMessage, assistantResponse, conversationId } = data;

  if (!userMessage || userMessage.trim().length < 10) {
    return null;
  }

  // Focus on user message
  let text = userMessage;
  if (assistantResponse && assistantResponse.length > 50) {
    text += `\n\n[Context: ${assistantResponse.substring(0, 300)}]`;
  }

  const extraction = await extractFromText(text, {
    sourceType: 'mirror',
    ...options
  });

  const hasContent = extraction.entities.length > 0 ||
    extraction.relationships.length > 0 ||
    extraction.behaviors.length > 0;

  if (!hasContent) {
    return null;
  }

  const results = await storeExtraction(userId, extraction, {
    sourceType: 'mirror',
    sourceId: conversationId
  });

  console.log(`[INPUT-ROUTER] MIRROR extraction complete:`, results);
  return results;
}

/**
 * Extract knowledge from settings/preferences
 *
 * NOTE: Settings are already stored in user_settings table.
 * We don't duplicate to entity_facts because:
 * 1. Settings change frequently
 * 2. user_settings is the source of truth
 * 3. MIRROR can read user_settings directly if needed
 *
 * This function exists for future extensibility but currently
 * just logs the change without duplication.
 */
async function extractFromSettings(userId, data, options = {}) {
  console.log(`[INPUT-ROUTER] Settings updated for user ${userId}:`, Object.keys(data));
  // Settings are already stored in user_settings table
  // No need to duplicate to knowledge graph
  return { logged: true, keys: Object.keys(data) };
}

/**
 * Map relationship type to entity subtype
 */
function mapRelationshipToSubtype(relationship) {
  const mapping = {
    'mentor': 'mentor',
    'close friend': 'friend',
    'friend': 'friend',
    'colleague': 'colleague',
    'coworker': 'colleague',
    'family': 'family',
    'parent': 'family',
    'sibling': 'family',
    'partner': 'partner',
    'spouse': 'partner',
    'client': 'client',
    'manager': 'manager',
    'boss': 'manager',
    'report': 'report',
    'cofounder': 'colleague'
  };

  const lower = relationship.toLowerCase();
  return mapping[lower] || 'acquaintance';
}

export default {
  INPUT_TYPES,
  routeInput,
  queueInput
};

/**
 * AI-POWERED EXTRACTION ENGINE
 *
 * Uses Claude Haiku for fast, cheap extraction.
 * NO pattern matching — pure AI understanding.
 *
 * @module lib/extraction/extractor
 */

import Anthropic from '@anthropic-ai/sdk';
import { ENTITY_TYPES, RELATIONSHIP_TYPES, BEHAVIOR_TYPES, buildTypeDefinitionsForPrompt } from './entity-types.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Use Haiku for fast, cheap extraction
const EXTRACTION_MODEL = 'claude-3-5-haiku-20241022';

/**
 * Build the system prompt for extraction
 * Includes all type definitions and rules
 */
function buildExtractionPrompt() {
  const typeDefinitions = buildTypeDefinitionsForPrompt();

  return `You are a knowledge extraction system for a personal AI memory application.
Your job is to extract structured information from user text.

${typeDefinitions}

EXTRACTION RULES:
1. Extract ALL entities mentioned, even briefly or implicitly
2. Infer entity types from context, not just explicit labels
3. Extract relationships when explicit OR strongly implied
4. Detect user behaviors from writing patterns and emotional signals
5. Include confidence scores (0.0-1.0) based on how certain you are
6. For ambiguous names (e.g., "Apple"), infer type from context
7. Extract temporal relationships when dates/times are mentioned
8. Capture sentiment when emotions are expressed

CONFIDENCE GUIDELINES:
- 0.9-1.0: Explicitly stated ("Marcus works at Anthropic")
- 0.7-0.8: Strongly implied ("talked to Marcus about the Anthropic deal")
- 0.5-0.6: Inferred from context ("Marcus mentioned their enterprise focus")
- Below 0.5: Don't extract (too uncertain)

Respond ONLY with valid JSON in this exact format:
{
  "entities": [
    {
      "name": "exact name as mentioned",
      "type": "person|company|place|project|event|topic|product|content",
      "subtype": "optional subtype",
      "context": "brief context about this entity",
      "confidence": 0.8
    }
  ],
  "relationships": [
    {
      "subject": "entity name",
      "predicate": "relationship_type",
      "object": "entity name or value",
      "context": "optional context",
      "confidence": 0.7
    }
  ],
  "behaviors": [
    {
      "type": "behavior_type",
      "target_entity": "entity name",
      "topic": "optional topic this applies to",
      "evidence": "the phrase that indicates this behavior",
      "confidence": 0.6
    }
  ],
  "topics": [
    {
      "name": "topic name",
      "context": "why this topic is relevant",
      "confidence": 0.8
    }
  ]
}`;
}

/**
 * Extract knowledge from text using Claude Haiku
 *
 * @param {string} text - Text to extract from
 * @param {object} options - Extraction options
 * @param {string} options.sourceType - Source type (note, mirror, meeting)
 * @param {object} options.existingEntities - Known entities for reference
 * @returns {Promise<object>} Extracted knowledge
 */
export async function extractFromText(text, options = {}) {
  const { sourceType = 'note', existingEntities = [] } = options;

  // Skip extraction for very short text
  if (!text || text.trim().length < 15) {
    return { entities: [], relationships: [], behaviors: [], topics: [] };
  }

  try {
    const startTime = Date.now();

    // Build context hint with existing entities
    let contextHint = '';
    if (existingEntities.length > 0) {
      const entityNames = existingEntities.slice(0, 20).map(e => e.name).join(', ');
      contextHint = `\n\nKnown entities from this user (reference for consistency): ${entityNames}`;
    }

    const response = await anthropic.messages.create({
      model: EXTRACTION_MODEL,
      max_tokens: 2000,
      temperature: 0.1, // Low temperature for consistent extraction
      system: buildExtractionPrompt(),
      messages: [{
        role: 'user',
        content: `Extract knowledge from this ${sourceType}:\n\n${text}${contextHint}`
      }]
    });

    const responseText = response.content[0]?.text || '';

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('[EXTRACTOR] No JSON found in response');
      return { entities: [], relationships: [], behaviors: [], topics: [] };
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Validate and filter extracted data
    const validatedResult = {
      entities: validateEntities(extracted.entities || []),
      relationships: validateRelationships(extracted.relationships || []),
      behaviors: validateBehaviors(extracted.behaviors || []),
      topics: validateTopics(extracted.topics || [])
    };

    const duration = Date.now() - startTime;
    console.log(`[EXTRACTOR] Extracted in ${duration}ms:`, {
      entities: validatedResult.entities.length,
      relationships: validatedResult.relationships.length,
      behaviors: validatedResult.behaviors.length,
      topics: validatedResult.topics.length
    });

    return validatedResult;

  } catch (error) {
    console.error('[EXTRACTOR] Extraction error:', error.message);
    return { entities: [], relationships: [], behaviors: [], topics: [] };
  }
}

/**
 * Validate extracted entities
 */
function validateEntities(entities) {
  return entities.filter(entity => {
    // Must have name and valid type
    if (!entity.name || typeof entity.name !== 'string') return false;
    if (!entity.type || !ENTITY_TYPES[entity.type]) return false;

    // Clean up
    entity.name = entity.name.trim();
    entity.confidence = Math.min(1, Math.max(0, entity.confidence || 0.5));

    // Validate subtype if provided
    if (entity.subtype) {
      const validSubtypes = ENTITY_TYPES[entity.type].subtypes;
      if (!validSubtypes.includes(entity.subtype)) {
        entity.subtype = null;
      }
    }

    return entity.name.length > 0 && entity.confidence >= 0.5;
  });
}

/**
 * Validate extracted relationships
 */
function validateRelationships(relationships) {
  return relationships.filter(rel => {
    // Must have subject, predicate, object
    if (!rel.subject || !rel.predicate || !rel.object) return false;

    // Clean up
    rel.subject = String(rel.subject).trim();
    rel.predicate = String(rel.predicate).trim().toLowerCase().replace(/\s+/g, '_');
    rel.object = String(rel.object).trim();
    rel.confidence = Math.min(1, Math.max(0, rel.confidence || 0.5));

    return rel.confidence >= 0.5;
  });
}

/**
 * Validate extracted behaviors
 */
function validateBehaviors(behaviors) {
  return behaviors.filter(behavior => {
    // Must have type
    if (!behavior.type) return false;

    // Normalize type
    behavior.type = String(behavior.type).trim().toLowerCase().replace(/\s+/g, '_');

    // Check if valid behavior type
    if (!BEHAVIOR_TYPES[behavior.type]) {
      // Try to map common variations
      const typeMap = {
        'trusts': 'trusts_opinion',
        'trust': 'trusts_opinion',
        'seeks_advice': 'seeks_advice',
        'advice': 'seeks_advice',
        'inspired': 'inspired_by',
        'relies': 'relies_on',
        'avoid': 'avoids',
        'prefer': 'prefers',
        'struggles': 'struggles_with',
        'excited': 'excited_about',
        'worried': 'worried_about'
      };
      behavior.type = typeMap[behavior.type] || behavior.type;

      if (!BEHAVIOR_TYPES[behavior.type]) return false;
    }

    behavior.confidence = Math.min(1, Math.max(0, behavior.confidence || 0.5));

    return behavior.confidence >= 0.5;
  });
}

/**
 * Validate extracted topics
 */
function validateTopics(topics) {
  return topics.filter(topic => {
    if (!topic.name || typeof topic.name !== 'string') return false;

    topic.name = topic.name.trim();
    topic.confidence = Math.min(1, Math.max(0, topic.confidence || 0.5));

    return topic.name.length > 1 && topic.confidence >= 0.5;
  });
}

/**
 * Extract from a MIRROR conversation exchange
 * Optimized for conversational context
 *
 * @param {string} userMessage - User's message
 * @param {string} assistantResponse - Assistant's response
 * @param {object} options - Options
 * @returns {Promise<object>} Extracted knowledge
 */
export async function extractFromMirrorExchange(userMessage, assistantResponse, options = {}) {
  // Focus on user message - that's where their knowledge is
  // Include assistant response for context but weight toward user's words
  const text = `User said: ${userMessage}

Context from conversation: ${assistantResponse?.substring(0, 500) || ''}`;

  return extractFromText(text, { ...options, sourceType: 'mirror' });
}

/**
 * Batch extract from multiple texts
 * More efficient for processing many items
 *
 * @param {string[]} texts - Array of texts to extract from
 * @param {object} options - Options
 * @returns {Promise<object>} Combined extraction results
 */
export async function batchExtract(texts, options = {}) {
  const combined = {
    entities: [],
    relationships: [],
    behaviors: [],
    topics: []
  };

  // Process in parallel with concurrency limit
  const BATCH_SIZE = 5;
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(text => extractFromText(text, options))
    );

    for (const result of results) {
      combined.entities.push(...result.entities);
      combined.relationships.push(...result.relationships);
      combined.behaviors.push(...result.behaviors);
      combined.topics.push(...result.topics);
    }
  }

  // Deduplicate entities by name (case-insensitive)
  const entityMap = new Map();
  for (const entity of combined.entities) {
    const key = entity.name.toLowerCase();
    const existing = entityMap.get(key);
    if (!existing || entity.confidence > existing.confidence) {
      entityMap.set(key, entity);
    }
  }
  combined.entities = Array.from(entityMap.values());

  return combined;
}

export default {
  extractFromText,
  extractFromMirrorExchange,
  batchExtract
};

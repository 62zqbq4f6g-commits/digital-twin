/**
 * AUTO-EXTRACT FROM MIRROR
 *
 * Extracts knowledge automatically from MIRROR conversations.
 * Fire-and-forget - doesn't block the response.
 *
 * @module lib/mirror/auto-extract
 */

import { extractFromText } from '../extraction/extractor.js';
import { storeExtraction, getExistingEntities } from '../extraction/knowledge-store.js';

/**
 * Track extraction frequency per conversation
 * We don't need to extract every single message
 */
const conversationTracker = new Map();

// Clean up old entries periodically (every 10 minutes)
const CLEANUP_INTERVAL = 10 * 60 * 1000;
const TRACKER_TTL = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of conversationTracker.entries()) {
    if (now - value.lastUpdated > TRACKER_TTL) {
      conversationTracker.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Queue extraction from a MIRROR exchange
 * Fire-and-forget - doesn't block the response
 *
 * @param {string} userId - User ID
 * @param {string} userMessage - User's message
 * @param {string} assistantResponse - Assistant's response
 * @param {string} conversationId - Conversation ID
 * @param {object} supabase - Supabase client (optional)
 */
export async function extractFromMirrorExchange(userId, userMessage, assistantResponse, conversationId, supabase = null) {
  // Track message count for this conversation
  const trackerKey = `${userId}:${conversationId}`;
  const tracker = conversationTracker.get(trackerKey) || { count: 0, lastUpdated: Date.now() };
  tracker.count++;
  tracker.lastUpdated = Date.now();
  conversationTracker.set(trackerKey, tracker);

  // Extract on first message, then every 3rd message
  // This balances knowledge capture with API cost
  const shouldExtract = tracker.count === 1 || tracker.count % 3 === 0;

  if (!shouldExtract) {
    console.log(`[AUTO-EXTRACT] Skipping extraction (message ${tracker.count} in conversation)`);
    return null;
  }

  // Fire and forget - don't await
  processExtraction(userId, userMessage, assistantResponse, conversationId, supabase)
    .catch(err => console.error('[AUTO-EXTRACT] Background extraction error:', err.message));

  return { queued: true, messageNumber: tracker.count };
}

/**
 * Process extraction in background
 */
async function processExtraction(userId, userMessage, assistantResponse, conversationId, supabase) {
  const startTime = Date.now();
  console.log(`[AUTO-EXTRACT] Starting extraction for user ${userId}`);

  try {
    // Get existing entities for context (helps with consistency)
    const existingEntities = await getExistingEntities(userId, 30);

    // Extract from user message (primary source of knowledge)
    // Include assistant response as context but focus on user's words
    const text = buildExtractionText(userMessage, assistantResponse);

    const extraction = await extractFromText(text, {
      sourceType: 'mirror',
      existingEntities
    });

    // Check if we have anything to store
    const hasContent = extraction.entities.length > 0 ||
      extraction.relationships.length > 0 ||
      extraction.behaviors.length > 0 ||
      extraction.topics.length > 0;

    if (!hasContent) {
      console.log('[AUTO-EXTRACT] No knowledge to extract from this exchange');
      return null;
    }

    // Store extraction
    const results = await storeExtraction(userId, extraction, {
      sourceType: 'mirror',
      sourceId: conversationId,
      supabase
    });

    const duration = Date.now() - startTime;
    console.log(`[AUTO-EXTRACT] Complete in ${duration}ms:`, results);

    return results;

  } catch (error) {
    console.error('[AUTO-EXTRACT] Processing error:', error.message);
    return null;
  }
}

/**
 * Build extraction text from MIRROR exchange
 * Focuses on user message but includes assistant context
 */
function buildExtractionText(userMessage, assistantResponse) {
  // Primary focus: what the user said
  let text = userMessage;

  // If assistant mentioned entities or facts, include as context
  // This helps catch things user confirmed or discussed
  if (assistantResponse && assistantResponse.length > 50) {
    // Only include first portion to avoid noise
    const contextPortion = assistantResponse.substring(0, 300);
    text += `\n\n[Context from conversation: ${contextPortion}]`;
  }

  return text;
}

/**
 * Force extraction from a MIRROR exchange
 * Use for important messages that should definitely be processed
 *
 * @param {string} userId - User ID
 * @param {string} userMessage - User's message
 * @param {string} assistantResponse - Assistant's response
 * @param {string} conversationId - Conversation ID
 * @param {object} supabase - Supabase client (optional)
 */
export async function forceExtractFromMirrorExchange(userId, userMessage, assistantResponse, conversationId, supabase = null) {
  return processExtraction(userId, userMessage, assistantResponse, conversationId, supabase);
}

/**
 * Get extraction stats for a user
 * Useful for debugging and monitoring
 */
export function getExtractionStats(userId) {
  const stats = {
    activeConversations: 0,
    totalMessages: 0
  };

  for (const [key, value] of conversationTracker.entries()) {
    if (key.startsWith(userId)) {
      stats.activeConversations++;
      stats.totalMessages += value.count;
    }
  }

  return stats;
}

export default {
  extractFromMirrorExchange,
  forceExtractFromMirrorExchange,
  getExtractionStats
};

/**
 * API Client
 *
 * Handles AI calls for both tiers:
 * - Managed: Calls /api/mirror (our proxy)
 * - BYOK: Calls Anthropic directly from browser
 */

import { getSetting, setSetting, removeSetting, SETTINGS } from './settings-store.js';

// ============================================
// TIER DETECTION
// ============================================

/**
 * Get current tier
 * @returns {'managed' | 'byok'}
 */
export function getTier() {
  const apiKey = localStorage.getItem(SETTINGS.API_KEY);
  return apiKey ? 'byok' : 'managed';
}

/**
 * Check if BYOK is configured
 */
export function isBYOK() {
  return getTier() === 'byok';
}

// ============================================
// API KEY MANAGEMENT
// ============================================

/**
 * Set API key for BYOK
 * @param {string} key - Anthropic API key
 */
export function setApiKey(key) {
  if (key) {
    localStorage.setItem(SETTINGS.API_KEY, key);
  } else {
    localStorage.removeItem(SETTINGS.API_KEY);
  }
}

/**
 * Get stored API key
 */
export function getApiKey() {
  return localStorage.getItem(SETTINGS.API_KEY);
}

/**
 * Clear API key (switch to managed tier)
 */
export function clearApiKey() {
  localStorage.removeItem(SETTINGS.API_KEY);
}

/**
 * Validate API key format
 * @param {string} key
 * @returns {boolean}
 */
export function validateApiKeyFormat(key) {
  return key && typeof key === 'string' && key.startsWith('sk-ant-');
}

// ============================================
// AI CALLS
// ============================================

/**
 * Call AI (routes to appropriate handler based on tier)
 * @param {object} params
 * @param {string} params.systemPrompt
 * @param {Array} params.messages
 * @param {string} [params.model]
 * @param {number} [params.maxTokens]
 * @returns {Promise<object>}
 */
export async function callAI({ systemPrompt, messages, model = 'claude-sonnet-4-20250514', maxTokens = 4096 }) {
  if (isBYOK()) {
    return callAnthropicDirect({ systemPrompt, messages, model, maxTokens });
  } else {
    return callManagedProxy({ systemPrompt, messages, model, maxTokens });
  }
}

/**
 * Direct call to Anthropic (BYOK tier)
 */
async function callAnthropicDirect({ systemPrompt, messages, model, maxTokens }) {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('API key not configured. Please add your Anthropic API key in Settings.');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));

    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Anthropic API key in Settings.');
    }
    if (response.status === 429) {
      throw new Error('Rate limited. Please wait a moment and try again.');
    }
    if (response.status === 402) {
      throw new Error('Insufficient credits. Please add credits to your Anthropic account.');
    }
    if (response.status === 400) {
      throw new Error(error.error?.message || 'Invalid request to Anthropic API.');
    }

    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();

  return {
    content: data.content[0]?.text || '',
    model: data.model,
    usage: data.usage,
    tier: 'byok'
  };
}

/**
 * Proxy call through Inscript (Managed tier)
 */
async function callManagedProxy({ systemPrompt, messages, model, maxTokens }) {
  const response = await fetch('/api/mirror', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemPrompt,
      messages,
      model,
      maxTokens
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || error.error || `API error: ${response.status}`);
  }

  const data = await response.json();

  // Track usage for managed tier
  const { count, isOverLimit } = incrementMirrorCallCount();

  return {
    ...data,
    tier: 'managed',
    usage: {
      ...data.usage,
      mirrorCallCount: count,
      isOverLimit
    }
  };
}

// ============================================
// API KEY TESTING
// ============================================

/**
 * Test API key validity
 * @param {string} key
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function testApiKey(key) {
  if (!validateApiKeyFormat(key)) {
    return { valid: false, error: 'Invalid API key format. Should start with sk-ant-' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });

    if (response.ok) {
      return { valid: true };
    }

    const error = await response.json().catch(() => ({}));

    if (response.status === 401) {
      return { valid: false, error: 'Invalid API key' };
    }
    if (response.status === 402) {
      return { valid: false, error: 'No credits on this API key' };
    }

    return { valid: false, error: error.error?.message || `Unexpected error: ${response.status}` };
  } catch (e) {
    return { valid: false, error: `Connection error: ${e.message}` };
  }
}

// ============================================
// USAGE TRACKING (Managed Tier)
// ============================================

const MIRROR_CALL_COUNT_KEY = 'inscript_mirror_calls';
const MIRROR_CALL_RESET_KEY = 'inscript_mirror_reset';
const MANAGED_TIER_LIMIT = 500;

/**
 * Get current MIRROR call count for managed tier
 * @returns {{count: number, limit: number, remaining: number, resetDate: string}}
 */
export function getMirrorCallCount() {
  const count = parseInt(localStorage.getItem(MIRROR_CALL_COUNT_KEY) || '0', 10);
  const resetDate = localStorage.getItem(MIRROR_CALL_RESET_KEY) || getMonthStart();

  // Check if we need to auto-reset (new month)
  if (isNewMonth(resetDate)) {
    resetMirrorCallCount();
    return {
      count: 0,
      limit: MANAGED_TIER_LIMIT,
      remaining: MANAGED_TIER_LIMIT,
      resetDate: getMonthStart()
    };
  }

  return {
    count,
    limit: MANAGED_TIER_LIMIT,
    remaining: Math.max(0, MANAGED_TIER_LIMIT - count),
    resetDate
  };
}

/**
 * Increment MIRROR call count (called after each managed tier call)
 * @returns {{count: number, isOverLimit: boolean}}
 */
export function incrementMirrorCallCount() {
  const { count, resetDate } = getMirrorCallCount();
  const newCount = count + 1;

  localStorage.setItem(MIRROR_CALL_COUNT_KEY, String(newCount));
  localStorage.setItem(MIRROR_CALL_RESET_KEY, resetDate);

  return {
    count: newCount,
    isOverLimit: newCount > MANAGED_TIER_LIMIT
  };
}

/**
 * Reset MIRROR call count (called at month start or manually)
 */
export function resetMirrorCallCount() {
  localStorage.setItem(MIRROR_CALL_COUNT_KEY, '0');
  localStorage.setItem(MIRROR_CALL_RESET_KEY, getMonthStart());
}

/**
 * Check if user is over the managed tier limit
 * @returns {boolean}
 */
export function isOverMirrorLimit() {
  const { count } = getMirrorCallCount();
  return count >= MANAGED_TIER_LIMIT;
}

// Helper: Get first day of current month as ISO string
function getMonthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}

// Helper: Check if reset date is from a previous month
function isNewMonth(resetDate) {
  const currentMonthStart = getMonthStart();
  return resetDate < currentMonthStart;
}

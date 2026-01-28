/**
 * Tier Manager
 *
 * Handles tier selection and information display.
 */

import { setApiKey, getApiKey, clearApiKey, testApiKey, validateApiKeyFormat } from './api-client.js';
import { setSetting, getSetting, SETTINGS } from './settings-store.js';

// ============================================
// TIER DEFINITIONS
// ============================================

export const TIERS = {
  MANAGED: 'managed',
  BYOK: 'byok'
};

export const TIER_INFO = {
  managed: {
    id: 'managed',
    name: 'Managed AI',
    price: '$20/mo',
    description: 'AI included. Notes encrypted.',
    features: [
      'Notes encrypted — we can\'t read them',
      'AI included in subscription',
      'No setup required'
    ],
    caveats: [
      'AI conversations pass through our servers (never stored or logged)'
    ]
  },
  byok: {
    id: 'byok',
    name: 'Bring Your Own Key',
    price: '$10/mo + API costs',
    description: 'Full zero-knowledge. We see nothing.',
    features: [
      'Notes encrypted — we can\'t read them',
      'AI calls direct to Anthropic',
      'Complete privacy — we see nothing',
      'You control API spending'
    ],
    caveats: [
      'Requires Anthropic API key (~$5-15/mo typical usage)'
    ]
  }
};

// ============================================
// TIER MANAGEMENT
// ============================================

/**
 * Get current tier
 * @returns {'managed' | 'byok'}
 */
export function getCurrentTier() {
  return getApiKey() ? TIERS.BYOK : TIERS.MANAGED;
}

/**
 * Get tier info object
 * @param {string} tier
 * @returns {object}
 */
export function getTierInfo(tier) {
  return TIER_INFO[tier] || TIER_INFO.managed;
}

/**
 * Get current tier info
 * @returns {object}
 */
export function getCurrentTierInfo() {
  return getTierInfo(getCurrentTier());
}

/**
 * Set tier to BYOK with API key
 * @param {string} apiKey
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function setTierBYOK(apiKey) {
  if (!validateApiKeyFormat(apiKey)) {
    return { success: false, error: 'Invalid API key format. Should start with sk-ant-' };
  }

  const { valid, error } = await testApiKey(apiKey);

  if (!valid) {
    return { success: false, error: error || 'API key validation failed' };
  }

  setApiKey(apiKey);
  setSetting(SETTINGS.TIER, TIERS.BYOK);

  return { success: true };
}

/**
 * Set tier to Managed (remove API key)
 */
export function setTierManaged() {
  clearApiKey();
  setSetting(SETTINGS.TIER, TIERS.MANAGED);
}

/**
 * Check if user can use AI features
 * @returns {boolean}
 */
export function canUseAI() {
  // Managed tier always can (we provide)
  // BYOK tier needs valid key
  const tier = getCurrentTier();
  if (tier === TIERS.MANAGED) return true;
  return !!getApiKey();
}

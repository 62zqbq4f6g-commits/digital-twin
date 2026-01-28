/**
 * Settings Store
 *
 * Centralized settings management using localStorage.
 */

export const SETTINGS = {
  TIER: 'inscript_tier',
  API_KEY: 'anthropic_api_key',
  THEME: 'inscript_theme',
  ENCRYPTION_SETUP: 'inscript_encryption_setup'
};

/**
 * Get a setting value
 * @param {string} key - Setting key
 * @param {any} defaultValue - Default if not set
 * @returns {any} Setting value
 */
export function getSetting(key, defaultValue = null) {
  const value = localStorage.getItem(key);
  if (value === null) return defaultValue;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Set a setting value
 * @param {string} key - Setting key
 * @param {any} value - Value to store
 */
export function setSetting(key, value) {
  if (value === null || value === undefined) {
    localStorage.removeItem(key);
  } else if (typeof value === 'object') {
    localStorage.setItem(key, JSON.stringify(value));
  } else {
    localStorage.setItem(key, value);
  }
}

/**
 * Remove a setting
 * @param {string} key - Setting key
 */
export function removeSetting(key) {
  localStorage.removeItem(key);
}

/**
 * Clear all Inscript settings
 */
export function clearAllSettings() {
  Object.values(SETTINGS).forEach(key => {
    localStorage.removeItem(key);
  });
}

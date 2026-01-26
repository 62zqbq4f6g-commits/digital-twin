// /lib/export/privacy.js
// OWNER: T2
// CONSUMERS: T1 (api/export.js)

/**
 * Privacy levels:
 * - private: Never export
 * - internal: Export for personal use (default)
 * - shared: Can be shared with third-party apps
 */

/**
 * Filter items by privacy level
 * Excludes items marked as 'private'
 *
 * @param {Array} items - Array of items with privacy_level field
 * @param {boolean} excludePrivate - Whether to exclude private items (default: true)
 * @returns {Array} Filtered items
 */
export function filterByPrivacy(items, excludePrivate = true) {
  if (!Array.isArray(items)) return [];

  if (!excludePrivate) return items;

  return items.filter(item => {
    // If no privacy_level, treat as 'internal' (exportable)
    const level = item.privacy_level || item.sensitivity_level || 'internal';
    return level !== 'private';
  });
}

/**
 * Check if a single item is exportable
 */
export function isExportable(item) {
  const level = item.privacy_level || item.sensitivity_level || 'internal';
  return level !== 'private';
}

/**
 * Get privacy stats for logging
 */
export function getPrivacyStats(items) {
  const stats = {
    total: items.length,
    private: 0,
    internal: 0,
    shared: 0
  };

  items.forEach(item => {
    const level = item.privacy_level || 'internal';
    if (stats[level] !== undefined) {
      stats[level]++;
    }
  });

  return stats;
}

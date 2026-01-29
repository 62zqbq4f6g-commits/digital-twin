/**
 * PROFILE CACHING
 *
 * Simple in-memory cache for user profiles.
 * Reduces database load for MIRROR conversations.
 *
 * @module lib/cache/profile-cache
 */

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

// Cleanup interval: 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

// Cache storage
const cache = new Map();

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {Object} profile - The cached profile data
 * @property {number} timestamp - When the entry was created
 * @property {number} hits - Number of cache hits
 */

/**
 * Get cached profile for a user
 *
 * @param {string} userId - User ID
 * @returns {Object|null} Cached profile or null if not found/expired
 */
export function getCachedProfile(userId) {
  const entry = cache.get(userId);

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(userId);
    return null;
  }

  // Track hit count
  entry.hits++;

  return entry.profile;
}

/**
 * Set cached profile for a user
 *
 * @param {string} userId - User ID
 * @param {Object} profile - Profile data to cache
 */
export function setCachedProfile(userId, profile) {
  cache.set(userId, {
    profile,
    timestamp: Date.now(),
    hits: 0
  });
}

/**
 * Invalidate cached profile for a user
 * Call this when user data changes
 *
 * @param {string} userId - User ID
 */
export function invalidateProfile(userId) {
  cache.delete(userId);
}

/**
 * Invalidate all cached profiles
 * Call this during maintenance or updates
 */
export function invalidateAll() {
  cache.clear();
}

/**
 * Get profile with caching
 * Fetches from cache or calls fetch function
 *
 * @param {string} userId - User ID
 * @param {Function} fetchFn - Async function to fetch profile if not cached
 * @returns {Promise<Object>} Profile data
 */
export async function getProfileWithCache(userId, fetchFn) {
  // Try cache first
  let profile = getCachedProfile(userId);

  if (profile) {
    console.log(`[PROFILE-CACHE] Cache hit for user ${userId}`);
    return profile;
  }

  // Fetch fresh data
  console.log(`[PROFILE-CACHE] Cache miss for user ${userId}, fetching...`);
  profile = await fetchFn(userId);

  // Cache the result
  if (profile) {
    setCachedProfile(userId, profile);
  }

  return profile;
}

/**
 * Get cache statistics
 * Useful for monitoring
 */
export function getCacheStats() {
  let totalHits = 0;
  let totalEntries = 0;
  let expiredEntries = 0;
  const now = Date.now();

  for (const [userId, entry] of cache.entries()) {
    totalEntries++;
    totalHits += entry.hits;

    if (now - entry.timestamp > CACHE_TTL_MS) {
      expiredEntries++;
    }
  }

  return {
    totalEntries,
    expiredEntries,
    activeEntries: totalEntries - expiredEntries,
    totalHits,
    cacheSize: cache.size
  };
}

/**
 * Cleanup expired entries
 * Called automatically on interval
 */
function cleanupExpired() {
  const now = Date.now();
  let cleaned = 0;

  for (const [userId, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      cache.delete(userId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[PROFILE-CACHE] Cleaned ${cleaned} expired entries`);
  }
}

// Start cleanup interval
setInterval(cleanupExpired, CLEANUP_INTERVAL_MS);

export default {
  getCachedProfile,
  setCachedProfile,
  invalidateProfile,
  invalidateAll,
  getProfileWithCache,
  getCacheStats
};

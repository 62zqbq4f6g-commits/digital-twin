/**
 * NotesManager - Singleton for cached note access
 * Phase 16 Performance Optimization
 *
 * Prevents redundant DB.getAllNotes() calls by caching results
 * with a 5-second TTL. Invalidate on note create/update/delete.
 */

const NotesManager = {
  _cache: null,
  _lastFetch: 0,
  _ttl: 5000, // 5 second cache
  _fetchPromise: null, // Prevent duplicate concurrent fetches

  /**
   * Get all notes with caching
   * @param {boolean} forceRefresh - Force cache invalidation
   * @returns {Promise<Array>} Notes array
   */
  async getAll(forceRefresh = false) {
    const now = Date.now();

    // Return cached data if valid
    if (!forceRefresh && this._cache && (now - this._lastFetch) < this._ttl) {
      console.log('[NotesManager] Cache hit');
      return this._cache;
    }

    // If a fetch is already in progress, wait for it
    if (this._fetchPromise) {
      console.log('[NotesManager] Waiting for in-flight fetch');
      return this._fetchPromise;
    }

    console.log('[NotesManager] Cache miss, fetching...');

    // Create fetch promise to prevent duplicate requests
    this._fetchPromise = (async () => {
      try {
        this._cache = await DB.getAllNotes();
        this._lastFetch = Date.now();
        return this._cache;
      } finally {
        this._fetchPromise = null;
      }
    })();

    return this._fetchPromise;
  },

  /**
   * Invalidate cache - call after note changes
   */
  invalidate() {
    console.log('[NotesManager] Cache invalidated');
    this._cache = null;
    this._lastFetch = 0;
  },

  /**
   * Call this after any note create/update/delete
   */
  onNoteChanged() {
    this.invalidate();
  },

  /**
   * Get cache stats for debugging
   */
  getStats() {
    return {
      cached: !!this._cache,
      cacheSize: this._cache?.length || 0,
      cacheAge: this._lastFetch ? Date.now() - this._lastFetch : null,
      ttl: this._ttl
    };
  }
};

// Make globally available
window.NotesManager = NotesManager;
